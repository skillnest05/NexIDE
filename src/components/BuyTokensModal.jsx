import React, { useState } from 'react';
import { supabase } from '../lib/supabase';

const plans = [
  { id: 'starter', name: 'Starter', tokens: 500_000, price: 199, currency: 'INR' },
  { id: 'pro', name: 'Pro', tokens: 2_000_000, price: 599, currency: 'INR' },
  { id: 'power', name: 'Power', tokens: 10_000_000, price: 1999, currency: 'INR' }
];

export function BuyTokensModal({ open, onClose, user, onPurchaseComplete }) {
  const [loadingPlan, setLoadingPlan] = useState(null);
  const [error, setError] = useState(null);

  if (!open) return null;

  const loadRazorpay = () => new Promise((resolve) => {
    if (window.Razorpay) { resolve(true); return; }
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });

  const handleBuy = async (plan) => {
    setLoadingPlan(plan.id);
    setError(null);
    try {
      const isLoaded = await loadRazorpay();
      if (!isLoaded) throw new Error('Razorpay failed to load');

      const session = supabase ? (await supabase.auth.getSession()).data.session : null;
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({ plan: plan.id })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to initialize checkout');

      const options = {
        key: data.keyId,
        amount: data.amount,
        currency: data.currency,
        name: 'NexIDE',
        description: `${plan.name} — ${plan.tokens.toLocaleString()} tokens`,
        order_id: data.orderId,
        handler: (response) => {
          if (onPurchaseComplete) onPurchaseComplete(response);
          onClose();
        },
        prefill: { email: user?.email },
        theme: { color: '#6366f1' },
      };
      const rzp = new window.Razorpay(options);
      rzp.on('payment.failed', (resp) => setError(resp.error.description));
      rzp.open();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoadingPlan(null);
    }
  };

  const styles = {
    overlay: {
      position: 'fixed', inset: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.7)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 1000, padding: '1rem',
      fontFamily: 'system-ui, sans-serif'
    },
    modal: {
      backgroundColor: 'var(--bg-secondary, #1a1d24)',
      border: '1px solid var(--border-primary, #2d3748)',
      borderRadius: '12px',
      padding: '2rem',
      width: '100%', maxWidth: '700px',
      position: 'relative',
      color: 'var(--text-primary, #e2e8f0)'
    },
    closeBtn: {
      position: 'absolute', top: '1rem', right: '1rem',
      background: 'none', border: 'none', color: 'var(--text-secondary, #a0aec0)',
      cursor: 'pointer', fontSize: '1.5rem', lineHeight: 1
    },
    title: { margin: '0 0 1.5rem', fontSize: '1.5rem', fontWeight: 'bold' },
    grid: {
      display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
      gap: '1rem'
    },
    card: {
      backgroundColor: 'var(--bg-tertiary, #2d3748)',
      border: '1px solid var(--border-secondary, #4a5568)',
      borderRadius: '8px', padding: '1.5rem',
      display: 'flex', flexDirection: 'column'
    },
    planName: { fontSize: '1.1rem', fontWeight: 'bold', margin: '0 0 0.5rem' },
    tokens: { color: 'var(--accent, #6366f1)', fontWeight: 'bold', marginBottom: '1rem' },
    price: { fontSize: '1.5rem', fontWeight: 'bold', margin: '0 0 1rem' },
    button: {
      padding: '0.75rem', borderRadius: '6px', border: 'none',
      backgroundColor: 'var(--accent, #6366f1)', color: 'white',
      fontWeight: 'bold', cursor: 'pointer',
      width: '100%', marginTop: 'auto'
    },
    error: { color: 'var(--error, #f56565)', marginTop: '1rem', textAlign: 'center', fontSize: '0.875rem' }
  };

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={e => e.stopPropagation()}>
        <button style={styles.closeBtn} onClick={onClose}>&times;</button>
        <h2 style={styles.title}>Get More Tokens</h2>
        
        <div style={styles.grid}>
          {plans.map(plan => (
            <div key={plan.id} style={styles.card}>
              <div style={styles.planName}>{plan.name}</div>
              <div style={styles.tokens}>{plan.tokens.toLocaleString()} tokens</div>
              <div style={styles.price}>₹{plan.price}</div>
              <button
                style={{...styles.button, opacity: loadingPlan === plan.id ? 0.7 : 1}}
                disabled={loadingPlan === plan.id}
                onClick={() => handleBuy(plan)}
              >
                {loadingPlan === plan.id ? 'Processing...' : 'Buy'}
              </button>
            </div>
          ))}
        </div>
        
        {error && <div style={styles.error}>{error}</div>}
      </div>
    </div>
  );
}
