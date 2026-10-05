const OPENCODE_URL = process.env.OPENCODE_SERVER_URL || 'http://127.0.0.1:4096';
const OPENCODE_PWD = process.env.OPENCODE_SERVER_PASSWORD || '';

// Map<userId, sessionId> - Note: use Redis in production
const sessions = new Map();

function estimateTokens(text) {
  if (!text) return 0;
  return Math.ceil(text.length / 4);
}

function getAuthHeader() {
  if (!OPENCODE_PWD) return {};
  return {
    'Authorization': `Basic ${Buffer.from(`opencode:${OPENCODE_PWD}`).toString('base64')}`
  };
}

export async function sendToAgent(userId, message, editorCode, language) {
  try {
    let sessionId = sessions.get(userId);

    // Create session if it doesn't exist
    if (!sessionId) {
      const createRes = await fetch(`${OPENCODE_URL}/api/session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeader()
        }
      });
      
      if (!createRes.ok) {
        throw new Error(`Failed to create session: ${createRes.status}`);
      }
      
      const sessionData = await createRes.json();
      sessionId = sessionData.id;
      sessions.set(userId, sessionId);
    }

    // Prepare message content
    let content = message;
    if (editorCode) {
      content += `\n\nCode context (${language}):\n\`\`\`${language}\n${editorCode}\n\`\`\``;
    }

    const inputTokens = estimateTokens(content);

    // Send message to session
    const sendRes = await fetch(`${OPENCODE_URL}/api/session/${sessionId}/message`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeader()
      },
      body: JSON.stringify({ content })
    });

    if (!sendRes.ok) {
      if (sendRes.status === 404) {
        // Session might have expired on server, clear our cache and retry once
        sessions.delete(userId);
        return sendToAgent(userId, message, editorCode, language);
      }
      throw new Error(`Failed to send message: ${sendRes.status}`);
    }

    const result = await sendRes.json();
    const text = result.text || result.content || '';
    
    return {
      text,
      inputTokens,
      outputTokens: result.outputTokens || estimateTokens(text)
    };

  } catch (error) {
    console.error('OpenCode API Error:', error);
    throw new Error('Failed to communicate with OpenCode server');
  }
}

export function resetSession(userId) {
  sessions.delete(userId);
}
