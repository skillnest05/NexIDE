import React, { useState } from 'react';
import { supabase } from '../lib/supabase';

export function AuthWall() {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    
    try {
      let result;
      if (isSignUp) {
        result = await supabase.auth.signUp({ email, password });
      } else {
        result = await supabase.auth.signInWithPassword({ email, password });
      }
      if (result.error) throw result.error;
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({ provider: 'google' });
      if (error) throw error;
    } catch (err) {
      setError(err.message);
    }
  };

  const styles = {
    container: {
      position: 'fixed', inset: 0,
      backgroundColor: 'var(--bg-primary, #0f1115)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      color: 'var(--text-primary, #e2e8f0)',
      fontFamily: 'system-ui, -apple-system, sans-serif'
    },
    card: {
      backgroundColor: 'var(--bg-secondary, #1a1d24)',
      padding: '2.5rem',
      borderRadius: '8px',
      border: '1px solid var(--border-primary, #2d3748)',
      width: '100%', maxWidth: '400px',
      boxShadow: '0 4px 6px rgba(0, 0, 0, 0.3)'
    },
    title: { margin: '0 0 1.5rem', textAlign: 'center', fontSize: '1.5rem', fontWeight: 'bold' },
    tabs: { display: 'flex', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-primary, #2d3748)' },
    tab: (active) => ({
      flex: 1, padding: '0.75rem', textAlign: 'center', cursor: 'pointer',
      borderBottom: active ? '2px solid var(--accent, #6366f1)' : '2px solid transparent',
      color: active ? 'var(--accent, #6366f1)' : 'var(--text-secondary, #a0aec0)',
      fontWeight: active ? 'bold' : 'normal'
    }),
    form: { display: 'flex', flexDirection: 'column', gap: '1rem' },
    input: {
      padding: '0.75rem',
      borderRadius: '6px',
      border: '1px solid var(--border-secondary, #4a5568)',
      backgroundColor: 'var(--bg-tertiary, #2d3748)',
      color: 'white',
      outline: 'none',
      width: '100%',
      boxSizing: 'border-box'
    },
    button: {
      padding: '0.75rem',
      borderRadius: '6px',
      border: 'none',
      backgroundColor: 'var(--accent, #6366f1)',
      color: 'white',
      fontWeight: 'bold',
      cursor: 'pointer',
      width: '100%',
      marginTop: '0.5rem'
    },
    googleButton: {
      padding: '0.75rem',
      borderRadius: '6px',
      border: '1px solid var(--border-secondary, #4a5568)',
      backgroundColor: 'transparent',
      color: 'var(--text-primary, #e2e8f0)',
      fontWeight: 'bold',
      cursor: 'pointer',
      width: '100%',
      marginTop: '1rem',
      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem'
    },
    error: {
      color: 'var(--error, #f56565)',
      fontSize: '0.875rem',
      marginTop: '1rem',
      textAlign: 'center'
    }
  };

  return (
    <div style={styles.container}>
      <h1 style={{ marginBottom: '2rem', fontSize: '2.5rem', fontWeight: 800, color: 'var(--accent, #6366f1)' }}>NexIDE</h1>
      <div style={styles.card}>
        <div style={styles.title}>{isSignUp ? 'Create an Account' : 'Welcome Back'}</div>
        <div style={styles.tabs}>
          <div style={styles.tab(!isSignUp)} onClick={() => setIsSignUp(false)}>Sign In</div>
          <div style={styles.tab(isSignUp)} onClick={() => setIsSignUp(true)}>Sign Up</div>
        </div>
        <form onSubmit={handleSubmit} style={styles.form}>
          <input
            style={styles.input}
            type="email"
            placeholder="Email address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <input
            style={styles.input}
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <button style={styles.button} type="submit" disabled={loading}>
            {loading ? 'Processing...' : (isSignUp ? 'Sign Up' : 'Sign In')}
          </button>
        </form>
        
        <div style={{ textAlign: 'center', margin: '1.5rem 0 0.5rem', color: 'var(--text-muted, #718096)' }}>or</div>
        
        <button style={styles.googleButton} onClick={handleGoogle} type="button">
          <svg viewBox="0 0 24 24" width="18" height="18" xmlns="http://www.w3.org/2000/svg">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.86C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.05H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.95l3.66-2.86z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.05l3.66 2.86c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
          Continue with Google
        </button>

        {error && <div style={styles.error}>{error}</div>}
      </div>
    </div>
  );
}
