import React, { useState } from 'react';
import { supabase } from '../lib/supabase';

const plans = [
  { id: 'starter', name: 'Starter', tokens: 500_000, price: 199, currency: 'INR' },
  { id: 'pro', name: 'Pro', tokens: 2_000_000, price: 599, currency: 'INR' },
  { id: 'power', name: 'Power', tokens: 10_000_000, price: 1999, currency: 'INR' }
];

export function PricingPage({ user, onComplete }) {
  const [loadingPlan, setLoadingPlan] = useState(null);
  const [error, setError] = useState(null);

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
          if (onComplete) onComplete(response);
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
    container: {
      padding: '3rem 1rem',
      backgroundColor: 'var(--bg-primary, #0f1115)',
      color: 'var(--text-primary, #e2e8f0)',
      minHeight: '100vh',
      fontFamily: 'system-ui, sans-serif'
    },
    header: { textAlign: 'center', marginBottom: '3rem' },
    title: { fontSize: '2.5rem', margin: '0 0 0.5rem', fontWeight: 'bold' },
    badge: {
      display: 'inline-block', padding: '0.25rem 0.75rem',
      backgroundColor: 'rgba(99, 102, 241, 0.2)', color: 'var(--accent, #6366f1)',
      borderRadius: '9999px', fontSize: '0.875rem', fontWeight: 'bold',
      marginBottom: '2rem'
    },
    grid: {
      display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
      gap: '2rem', maxWidth: '1000px', margin: '0 auto'
    },
    card: {
      backgroundColor: 'var(--bg-secondary, #1a1d24)',
      border: '1px solid var(--border-primary, #2d3748)',
      borderRadius: '12px', padding: '2rem',
      display: 'flex', flexDirection: 'column'
    },
    planName: { fontSize: '1.25rem', fontWeight: 'bold', margin: '0 0 1rem', color: 'var(--text-secondary, #a0aec0)' },
    price: { fontSize: '2.5rem', fontWeight: 'bold', margin: '0 0 1.5rem' },
    features: { flex: 1, margin: '0 0 2rem', padding: 0, listStyle: 'none' },
    featureItem: { marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' },
    button: {
      padding: '1rem', borderRadius: '8px', border: 'none',
      backgroundColor: 'var(--accent, #6366f1)', color: 'white',
      fontWeight: 'bold', fontSize: '1rem', cursor: 'pointer',
      width: '100%', transition: 'opacity 0.2s'
    },
    error: { textAlign: 'center', color: 'var(--error, #f56565)', marginTop: '2rem' }
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.title}>Choose Your Plan</h1>
        <div style={styles.badge}>Free trial: 1,000 tokens included with signup</div>
      </div>
      
      <div style={styles.grid}>
        {plans.map(plan => (
          <div key={plan.id} style={styles.card}>
            <div style={styles.planName}>{plan.name}</div>
            <div style={styles.price}>₹{plan.price}</div>
            <ul style={styles.features}>
              <li style={styles.featureItem}>
                <span style={{ color: 'var(--success, #48bb78)' }}>✓</span>
                {plan.tokens.toLocaleString()} tokens
              </li>
              <li style={styles.featureItem}>
                <span style={{ color: 'var(--success, #48bb78)' }}>✓</span>
                ~₹{(plan.price / plan.tokens).toFixed(4)} per token
              </li>
            </ul>
            <button
              style={{...styles.button, opacity: loadingPlan === plan.id ? 0.7 : 1}}
              disabled={loadingPlan === plan.id}
              onClick={() => handleBuy(plan)}
            >
              {loadingPlan === plan.id ? 'Processing...' : 'Buy Now'}
            </button>
          </div>
        ))}
      </div>
      
      {error && <div style={styles.error}>{error}</div>}
    </div>
  );
}
