import { useState, useCallback, useRef, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { LIMITS, buildContents } from '../shared/gemini';

const HISTORY_FOR_CONTEXT = 10;

async function generateViaServer(payload) {
  const session = supabase ? (await supabase.auth.getSession()).data.session : null;
  const response = await fetch('/api/generate', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
    },
    body: JSON.stringify(payload),
  });
  let data = {};
  try { data = await response.json(); } catch {}
  if (!response.ok) {
    const err = new Error(data.error || `AI request failed (${response.status})`);
    err.code = data.code;
    throw err;
  }
  return data;
}

export function useAI() {
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isExhausted, setIsExhausted] = useState(false);
  const [lastTokensUsed, setLastTokensUsed] = useState(null);
  const [lastRemainingBalance, setLastRemainingBalance] = useState(null);

  const messagesRef = useRef(messages);
  useEffect(() => { messagesRef.current = messages; }, [messages]);
  const busyRef = useRef(false);

  const sendMessage = useCallback(async (userText, editorCode = '', language = '') => {
    if (busyRef.current || !userText?.trim()) return;
    busyRef.current = true;
    const code = (editorCode || '').slice(0, LIMITS?.maxEditorCodeChars || 10000);
    const history = messagesRef.current
      .filter(m => !m.loading)
      .slice(-HISTORY_FOR_CONTEXT)
      .map(m => ({ role: m.role, content: m.content.slice(0, LIMITS?.maxMessageChars || 2000) }));
    const userMsg = { id: crypto.randomUUID(), role: 'user', content: userText };
    const assistantMsg = { id: crypto.randomUUID(), role: 'assistant', content: '', loading: true, streaming: true };
    
    setMessages(prev => [...prev, userMsg, assistantMsg]);
    setIsLoading(true);
    setError(null);
    
    try {
      const data = await generateViaServer({ messages: history, userText, editorCode: code, language });
      setLastTokensUsed(data.tokensUsed);
      setLastRemainingBalance(data.remainingBalance);
      
      setMessages(prev => prev.map(m =>
        m.id === assistantMsg.id ? { 
          ...m, 
          content: data.text, 
          loading: false, 
          streaming: false,
          tokensUsed: data.tokensUsed,
          remainingBalance: data.remainingBalance
        } : m
      ));
    } catch (err) {
      if (err.code === 'LIMIT_EXCEEDED' || err.code === 'NO_CREDITS') setIsExhausted(true);
      setError(err.message);
      setMessages(prev => prev.filter(m => m.id !== assistantMsg.id));
    } finally {
      busyRef.current = false;
      setIsLoading(false);
    }
  }, []);

  const clearMessages = useCallback(() => {
    setMessages([]);
    setError(null);
    setIsExhausted(false);
    setLastTokensUsed(null);
    setLastRemainingBalance(null);
  }, []);

  return { 
    messages, 
    sendMessage, 
    isLoading, 
    error, 
    isExhausted, 
    clearMessages,
    lastTokensUsed,
    lastRemainingBalance
  };
}
