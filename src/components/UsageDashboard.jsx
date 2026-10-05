import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export function UsageDashboard({ user }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function fetchUsage() {
      if (!user) return;
      try {
        const session = await supabase.auth.getSession();
        const res = await fetch('/api/usage', {
          headers: { Authorization: `Bearer ${session.data.session?.access_token}` },
        });
        if (!res.ok) throw new Error('Failed to fetch usage data');
        const json = await res.json();
        setData(json);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    fetchUsage();
  }, [user]);

  const styles = {
    container: {
      padding: '2rem',
      color: 'var(--text-primary, #e2e8f0)',
      fontFamily: 'system-ui, sans-serif'
    },
    title: { fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '1.5rem' },
    statsGrid: {
      display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
      gap: '1rem', marginBottom: '2rem'
    },
    statCard: {
      backgroundColor: 'var(--bg-secondary, #1a1d24)',
      padding: '1.5rem', borderRadius: '8px',
      border: '1px solid var(--border-primary, #2d3748)'
    },
    statLabel: { fontSize: '0.875rem', color: 'var(--text-secondary, #a0aec0)', marginBottom: '0.5rem' },
    statValue: { fontSize: '2rem', fontWeight: 'bold', color: 'var(--accent, #6366f1)' },
    sectionTitle: { fontSize: '1.25rem', fontWeight: 'bold', margin: '2rem 0 1rem' },
    table: {
      width: '100%', borderCollapse: 'collapse',
      backgroundColor: 'var(--bg-secondary, #1a1d24)',
      borderRadius: '8px', overflow: 'hidden'
    },
    th: {
      textAlign: 'left', padding: '1rem',
      borderBottom: '1px solid var(--border-primary, #2d3748)',
      color: 'var(--text-secondary, #a0aec0)',
      fontSize: '0.875rem', fontWeight: 'bold'
    },
    td: {
      padding: '1rem',
      borderBottom: '1px solid var(--border-primary, #2d3748)',
      fontSize: '0.875rem'
    }
  };

  if (loading) return <div style={styles.container}>Loading usage...</div>;
  if (error) return <div style={styles.container}>Error: {error}</div>;
  if (!data) return null;

  return (
    <div style={styles.container}>
      <h2 style={styles.title}>Usage Dashboard</h2>
      
      <div style={styles.statsGrid}>
        <div style={styles.statCard}>
          <div style={styles.statLabel}>Current Balance</div>
          <div style={styles.statValue}>{data.balance?.toLocaleString() || 0}</div>
        </div>
        <div style={styles.statCard}>
          <div style={styles.statLabel}>Lifetime Used</div>
          <div style={{...styles.statValue, color: 'var(--text-primary, #e2e8f0)'}}>
            {data.lifetimeUsed?.toLocaleString() || 0}
          </div>
        </div>
        <div style={styles.statCard}>
          <div style={styles.statLabel}>Lifetime Purchased</div>
          <div style={{...styles.statValue, color: 'var(--text-primary, #e2e8f0)'}}>
            {data.lifetimePurchased?.toLocaleString() || 0}
          </div>
        </div>
      </div>

      <h3 style={styles.sectionTitle}>Recent Usage</h3>
      {data.recentUsage?.length > 0 ? (
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>Date</th>
              <th style={styles.th}>Model</th>
              <th style={styles.th}>Input Tokens</th>
              <th style={styles.th}>Output Tokens</th>
              <th style={styles.th}>Total</th>
            </tr>
          </thead>
          <tbody>
            {data.recentUsage.map((row, i) => (
              <tr key={i}>
                <td style={styles.td}>{new Date(row.date).toLocaleString()}</td>
                <td style={styles.td}>{row.model}</td>
                <td style={styles.td}>{row.inputTokens}</td>
                <td style={styles.td}>{row.outputTokens}</td>
                <td style={styles.td}>{row.inputTokens + row.outputTokens}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div style={{ color: 'var(--text-secondary, #a0aec0)' }}>No recent usage.</div>
      )}

      <h3 style={styles.sectionTitle}>Purchase History</h3>
      {data.purchaseHistory?.length > 0 ? (
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>Date</th>
              <th style={styles.th}>Amount</th>
              <th style={styles.th}>Tokens Added</th>
              <th style={styles.th}>Payment ID</th>
            </tr>
          </thead>
          <tbody>
            {data.purchaseHistory.map((row, i) => (
              <tr key={i}>
                <td style={styles.td}>{new Date(row.date).toLocaleString()}</td>
                <td style={styles.td}>₹{row.amount}</td>
                <td style={styles.td}>{row.tokens?.toLocaleString()}</td>
                <td style={styles.td}>{row.paymentId}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div style={{ color: 'var(--text-secondary, #a0aec0)' }}>No purchase history.</div>
      )}
    </div>
  );
}
