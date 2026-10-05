import { createClient } from '@supabase/supabase-js';

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

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const user = await authenticate(req);
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    let { data: creditsData } = await supabaseAdmin
      .from('user_credits')
      .select('balance, lifetime_purchased, lifetime_used')
      .eq('user_id', user.id)
      .single();

    if (!creditsData) {
      // Create user_credits with 1000 free tokens
      const { data: newCredits, error } = await supabaseAdmin
        .from('user_credits')
        .insert({
          user_id: user.id,
          balance: 1000,
          lifetime_purchased: 0,
          lifetime_used: 0
        })
        .select()
        .single();
        
      if (error) {
        console.error('Error creating user_credits:', error);
      } else {
        creditsData = newCredits;
      }
    }

    const { data: recentUsage } = await supabaseAdmin
      .from('token_usage')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50);

    const { data: purchases } = await supabaseAdmin
      .from('token_purchases')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    return res.status(200).json({
      balance: creditsData?.balance || 0,
      lifetimePurchased: creditsData?.lifetime_purchased || 0,
      lifetimeUsed: creditsData?.lifetime_used || 0,
      recentUsage: recentUsage || [],
      purchases: purchases || []
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
