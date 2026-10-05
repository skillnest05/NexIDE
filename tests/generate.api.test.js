import { describe, it, expect, vi, beforeEach } from 'vitest';

const getUser = vi.fn();
const mockSendToAgent = vi.fn();
const mockCheckBalance = vi.fn();
const mockDeductTokens = vi.fn();
const mockLogUsage = vi.fn();

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({ auth: { getUser } }),
}));

vi.mock('../api/_lib/opencodeBridge.js', () => ({
  sendToAgent: (...args) => mockSendToAgent(...args),
}));

vi.mock('../api/_lib/tokenAccounting.js', () => ({
  checkBalance: (...args) => mockCheckBalance(...args),
  deductTokens: (...args) => mockDeductTokens(...args),
  logUsage: (...args) => mockLogUsage(...args),
}));

// Mock the global budget tracker export from rateLimit
vi.mock('../api/_lib/rateLimit.js', async (importOriginal) => {
  const original = await importOriginal();
  return {
    ...original,
    createGlobalBudgetTracker: () => ({
      check: () => Promise.resolve({ allowed: true, remaining: 999999 }),
      record: () => Promise.resolve(),
    }),
  };
});

function mockRes() {
  const res = { statusCode: 200, body: null, headers: {} };
  res.status = (c) => { res.statusCode = c; return res; };
  res.json = (b) => { res.body = b; return res; };
  res.setHeader = (k, v) => { res.headers[k] = v; return res; };
  return res;
}

const post = (body, token) => ({
  method: 'POST',
  headers: token ? { authorization: `Bearer ${token}` } : {},
  body,
});

let handler;
beforeEach(async () => {
  vi.resetModules();
  getUser.mockReset();
  mockSendToAgent.mockReset();
  mockCheckBalance.mockReset();
  mockDeductTokens.mockReset();
  mockLogUsage.mockReset();
  process.env.OPENCODE_SERVER_URL = 'http://127.0.0.1:4096';
  process.env.VITE_SUPABASE_URL = 'https://example.supabase.co';
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_test';
  process.env.AI_RATE_LIMIT_PER_MINUTE = '2';
  ({ default: handler } = await import('../api/generate.js'));
});

describe('/api/generate', () => {
  it('rejects non-POST', async () => {
    const res = mockRes();
    await handler({ method: 'GET', headers: {} }, res);
    expect(res.statusCode).toBe(405);
  });

  it('requires a signed-in user', async () => {
    const res = mockRes();
    await handler(post({ userText: 'hi' }), res);
    expect(res.statusCode).toBe(401);
    expect(mockSendToAgent).not.toHaveBeenCalled();
  });

  it('rejects invalid tokens', async () => {
    getUser.mockResolvedValue({ data: { user: null }, error: new Error('bad jwt') });
    const res = mockRes();
    await handler(post({ userText: 'hi' }, 'forged'), res);
    expect(res.statusCode).toBe(401);
  });

  it('returns 402 when user has zero balance', async () => {
    getUser.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null });
    mockCheckBalance.mockResolvedValue({ balance: 0, lifetime_used: 500, lifetime_purchased: 500 });
    const res = mockRes();
    await handler(post({ userText: 'hi' }, 'tok'), res);
    expect(res.statusCode).toBe(402);
    expect(res.body.code).toBe('NO_CREDITS');
    expect(mockSendToAgent).not.toHaveBeenCalled();
  });

  it('validates input', async () => {
    getUser.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null });
    mockCheckBalance.mockResolvedValue({ balance: 1000, lifetime_used: 0, lifetime_purchased: 0 });
    const res = mockRes();
    await handler(post({ userText: '' }, 'tok'), res);
    expect(res.statusCode).toBe(400);
  });

  it('answers with tokens used and deducts balance', async () => {
    getUser.mockResolvedValue({ data: { user: { id: 'u2' } }, error: null });
    mockCheckBalance.mockResolvedValue({ balance: 1000, lifetime_used: 0, lifetime_purchased: 0 });
    mockSendToAgent.mockResolvedValue({ text: 'answer', inputTokens: 10, outputTokens: 20 });
    mockDeductTokens.mockResolvedValue(970);
    mockLogUsage.mockResolvedValue();

    const res = mockRes();
    await handler(post({ userText: 'hi', messages: [] }, 'tok'), res);
    expect(res.statusCode).toBe(200);
    expect(res.body.text).toBe('answer');
    expect(res.body.tokensUsed).toBe(30);
    expect(res.body.remainingBalance).toBe(970);
    expect(mockDeductTokens).toHaveBeenCalledWith('u2', 30);
    expect(mockLogUsage).toHaveBeenCalledWith('u2', 10, 20, 'opencode');
  });

  it('returns 503 when OPENCODE_SERVER_URL is missing', async () => {
    delete process.env.OPENCODE_SERVER_URL;
    vi.resetModules();
    const { default: freshHandler } = await import('../api/generate.js');
    getUser.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null });
    const res = mockRes();
    await freshHandler(post({ userText: 'hi' }, 'tok'), res);
    expect(res.statusCode).toBe(503);
    expect(mockSendToAgent).not.toHaveBeenCalled();
  });
});
