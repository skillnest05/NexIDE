import { createClient } from '@supabase/supabase-js';
import Razorpay from 'razorpay';

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

const PLANS = {
  starter: { tokens: 500_000, amount: 19900, currency: 'INR', name: 'Starter' },     // ₹199 in paise
  pro:     { tokens: 2_000_000, amount: 59900, currency: 'INR', name: 'Pro' },        // ₹599
  power:   { tokens: 10_000_000, amount: 199900, currency: 'INR', name: 'Power' },    // ₹1,999
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const user = await authenticate(req);
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { plan: planId } = req.body || {};
    const plan = PLANS[planId];
    if (!plan) {
      return res.status(400).json({ error: 'Invalid plan' });
    }

    const key_id = process.env.RAZORPAY_KEY_ID;
    const key_secret = process.env.RAZORPAY_KEY_SECRET;

    if (!key_id || !key_secret) {
      return res.status(500).json({ error: 'Razorpay configuration missing' });
    }

    const razorpay = new Razorpay({ key_id, key_secret });

    const order = await razorpay.orders.create({
      amount: plan.amount,
      currency: plan.currency,
      receipt: `nexide_${user.id}_${Date.now()}`,
      notes: { userId: user.id, plan: planId, tokens: plan.tokens }
    });

    return res.status(200).json({
      orderId: order.id,
      amount: plan.amount,
      currency: plan.currency,
      keyId: key_id,
      plan: plan.name,
      tokens: plan.tokens
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
