import { createClient } from '@supabase/supabase-js';
import { validateRequest } from '../src/shared/gemini.js';
import { rateLimiterFromEnv, createGlobalBudgetTracker, createUpstashStore } from './_lib/rateLimit.js';
import { sendToAgent } from './_lib/opencodeBridge.js';
import { checkBalance, deductTokens, logUsage } from './_lib/tokenAccounting.js';

const limiter = rateLimiterFromEnv();

let globalBudgetTracker = null;
function getGlobalBudgetTracker() {
  if (globalBudgetTracker) return globalBudgetTracker;
  const env = process.env;
  const url = env.UPSTASH_REDIS_REST_URL || env.KV_REST_API_URL;
  const token = env.UPSTASH_REDIS_REST_TOKEN || env.KV_REST_API_TOKEN;
  const store = url && token ? createUpstashStore(url, token) : undefined;
  globalBudgetTracker = createGlobalBudgetTracker(store, Number(env.GLOBAL_DAILY_TOKEN_BUDGET) || 1000000);
  return globalBudgetTracker;
}

let supabaseAdminless = null;
function supabaseClient() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return null;
  supabaseAdminless ??= createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  return supabaseAdminless;
}

async function authenticate(req) {
  const header = req.headers?.authorization || req.headers?.Authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return null;
  const client = supabaseClient();
  if (!client) return null;
  const { data, error } = await client.auth.getUser(token);
  if (error || !data?.user) return null;
  return data.user;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const opencodeUrl = process.env.OPENCODE_SERVER_URL;
  if (!opencodeUrl) {
    return res.status(503).json({
      error: 'No system AI server is configured.',
      code: 'MISSING_KEY',
    });
  }

  const user = await authenticate(req);
  if (!user) {
    return res.status(401).json({
      error: 'Sign in to use the built-in AI.',
      code: 'AUTH_REQUIRED',
    });
  }

  const credits = await checkBalance(user.id);
  if (credits.balance <= 0) {
    return res.status(402).json({ 
      error: 'No tokens remaining. Purchase more tokens to continue using AI.', 
      code: 'NO_CREDITS' 
    });
  }

  const budget = await getGlobalBudgetTracker().check();
  if (!budget.allowed) {
    return res.status(429).json({
      error: 'Global AI capacity reached for today. Please try again tomorrow.',
      code: 'GLOBAL_RATE_LIMIT',
    });
  }

  const limit = await limiter.check(user.id);
  if (!limit.allowed) {
    res.setHeader('Retry-After', String(limit.retryAfterSec));
    return res.status(429).json({
      error: 'Too many requests — please wait a moment.',
      code: 'RATE_LIMITED',
    });
  }

  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const invalid = validateRequest(body);
  if (invalid) return res.status(400).json({ error: invalid, code: 'INVALID_REQUEST' });

  const { messages = [], userText, editorCode = '', language = '' } = body;
  
  let fullMessage = messages.map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`).join('\n\n');
  if (fullMessage) fullMessage += '\n\n';
  fullMessage += userText || '';

  try {
    const result = await sendToAgent(user.id, fullMessage, editorCode, language);
    
    const tokensUsed = result.inputTokens + result.outputTokens;
    const remainingBalance = await deductTokens(user.id, tokensUsed);
    
    await Promise.all([
      logUsage(user.id, result.inputTokens, result.outputTokens, 'opencode'),
      getGlobalBudgetTracker().record(tokensUsed)
    ]);

    return res.status(200).json({ 
      text: result.text, 
      tokensUsed, 
      remainingBalance 
    });
  } catch (error) {
    console.error('OpenCode API Error:', error?.status, error?.message || error);
    return res.status(502).json({ error: 'Failed to generate response', code: 'UPSTREAM_ERROR' });
  }
}
