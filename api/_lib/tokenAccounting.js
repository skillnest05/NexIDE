import { createClient } from '@supabase/supabase-js';

let _supabaseAdmin = null;
function getSupabaseAdmin() {
  if (_supabaseAdmin) return _supabaseAdmin;
  
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!url || !key) {
    console.warn('Supabase URL or Service Role Key missing. Token accounting will fail.');
    return null;
  }
  
  _supabaseAdmin = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
  return _supabaseAdmin;
}

export async function checkBalance(userId) {
  const supabase = getSupabaseAdmin();
  if (!supabase) return { balance: 0, lifetime_used: 0, lifetime_purchased: 0 };

  const { data, error } = await supabase
    .from('user_credits')
    .select('balance, lifetime_used, lifetime_purchased')
    .eq('user_id', userId)
    .single();

  if (error && error.code === 'PGRST116') {
    // No row found, create with free trial
    const newRecord = { user_id: userId, balance: 1000 };
    const { data: inserted, error: insertError } = await supabase
      .from('user_credits')
      .insert(newRecord)
      .select('balance, lifetime_used, lifetime_purchased')
      .single();
      
    if (insertError) {
      console.error('Failed to create user credits:', insertError);
      return { balance: 0, lifetime_used: 0, lifetime_purchased: 0 };
    }
    return inserted;
  }

  if (error) {
    console.error('Error checking balance:', error);
    return { balance: 0, lifetime_used: 0, lifetime_purchased: 0 };
  }

  return data;
}

export async function deductTokens(userId, totalTokens) {
  const supabase = getSupabaseAdmin();
  if (!supabase) return 0;
  
  const current = await checkBalance(userId);
  if (current.balance < totalTokens) return 0;
  
  const newBalance = current.balance - totalTokens;
  const newLifetimeUsed = current.lifetime_used + totalTokens;
  
  const { data, error } = await supabase
    .from('user_credits')
    .update({ 
      balance: newBalance, 
      lifetime_used: newLifetimeUsed,
      updated_at: new Date().toISOString()
    })
    .eq('user_id', userId)
    .eq('balance', current.balance)
    .select();
    
  if (error || !data || data.length === 0) {
    // Race condition or insufficient.
    return 0;
  }
  
  return newBalance;
}

export async function logUsage(userId, inputTokens, outputTokens, model) {
  const supabase = getSupabaseAdmin();
  if (!supabase) return;
  
  await supabase
    .from('token_usage')
    .insert({
      user_id: userId,
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      total_tokens: inputTokens + outputTokens,
      model: model
    });
}

export async function creditTokens(userId, tokens) {
  const supabase = getSupabaseAdmin();
  if (!supabase) return 0;
  
  const current = await checkBalance(userId);
  const newBalance = current.balance + tokens;
  const newLifetime = current.lifetime_purchased + tokens;
  
  const { data, error } = await supabase
    .from('user_credits')
    .update({ 
      balance: newBalance,
      lifetime_purchased: newLifetime,
      updated_at: new Date().toISOString()
    })
    .eq('user_id', userId)
    .select()
    .single();
    
  if (error) {
    console.error('Error crediting tokens:', error);
    return current.balance;
  }
  return newBalance;
}
