import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

export function useCredits(user) {
  const [credits, setCredits] = useState(null);  // { balance, lifetimePurchased, lifetimeUsed }
  const [loading, setLoading] = useState(false);

  const fetchCredits = useCallback(async () => {
    if (!user) { setCredits(null); return; }
    setLoading(true);
    try {
      const session = await supabase.auth.getSession();
      const res = await fetch('/api/usage', {
        headers: { Authorization: `Bearer ${session.data.session?.access_token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setCredits({ balance: data.balance, lifetimePurchased: data.lifetimePurchased, lifetimeUsed: data.lifetimeUsed });
      }
    } catch (e) { console.error('Failed to fetch credits:', e); }
    finally { setLoading(false); }
  }, [user]);

  useEffect(() => { fetchCredits(); }, [fetchCredits]);

  // Call this after a successful AI response to update balance locally
  const updateBalance = useCallback((newBalance) => {
    setCredits(prev => prev ? { ...prev, balance: newBalance } : null);
  }, []);

  return { credits, loading, fetchCredits, updateBalance };
}
