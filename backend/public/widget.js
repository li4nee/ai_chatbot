(function () {
  'use strict';

  // ─── Configuration ─────────────────────────────────────────────
  const script = document.currentScript;
  const API_KEY = script?.getAttribute('data-bot-key') || '';
  const API_URL = script?.src
    ? new URL(script.src).origin
    : 'http://localhost:3000';

  if (!API_KEY) {
    console.error('[ChatWidget] Missing data-bot-key attribute');
    return;
  }

  let sessionId = localStorage.getItem('chatbot_session_' + API_KEY) || '';
  let isOpen = false;
  let botConfig = {
    displayName: 'AI Assistant',
    themeColor: '#6366f1',
    welcomeMessage: '👋 Hi there! How can I help you today?'
  };

  let vapi = null;
  let isCalling = false;

  // ─── Live agent handoff state ───────────────────────────────────
  let handoffStatus = 'BOT';
  let pollInterval = null;
  let lastMessageTime = new Date().toISOString();
  const renderedMessageIds = new Set();

  function generateSessionId() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  // ─── Styles ────────────────────────────────────────────────────
  const styles = document.createElement('style');
  styles.textContent = `
    :root {
      --chatbot-primary: #6366f1;
    }

    #chatbot-widget-container * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
      font-family: 'Inter', 'Segoe UI', system-ui, -apple-system, sans-serif;
    }

    #chatbot-bubble {
      position: fixed;
      bottom: 24px;
      right: 24px;
      width: 60px;
      height: 60px;
      border-radius: 50%;
      background: var(--chatbot-primary);
      color: white;
      border: none;
      cursor: pointer;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 99999;
      transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
    }

    #chatbot-bubble:hover { transform: scale(1.1); }

    #chatbot-bubble svg { width: 28px; height: 28px; }
    #chatbot-bubble.open svg.chat-icon { display: none; }
    #chatbot-bubble.open svg.close-icon { display: block; }
    #chatbot-bubble:not(.open) svg.chat-icon { display: block; }
    #chatbot-bubble:not(.open) svg.close-icon { display: none; }

    #chatbot-window {
      position: fixed;
      bottom: 100px;
      right: 24px;
      width: 380px;
      height: 520px;
      background: #1a1a2e;
      border-radius: 16px;
      box-shadow: 0 12px 48px rgba(0, 0, 0, 0.3);
      display: none;
      flex-direction: column;
      overflow: hidden;
      z-index: 99998;
      animation: chatbot-slide-up 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
      border: 1px solid rgba(255, 255, 255, 0.1);
    }

    #chatbot-window.visible { display: flex; }

    @keyframes chatbot-slide-up {
      from { opacity: 0; transform: translateY(20px) scale(0.95); }
      to { opacity: 1; transform: translateY(0) scale(1); }
    }

    #chatbot-header {
      background: var(--chatbot-primary);
      color: white;
      padding: 16px 20px;
      display: flex;
      align-items: center;
      gap: 12px;
    }

    #chatbot-header-avatar {
      width: 36px;
      height: 36px;
      border-radius: 50%;
      background: rgba(255,255,255,0.2);
      display: flex;
      align-items: center;
      justify-content: center;
    }

    #chatbot-header-info h3 { font-size: 15px; font-weight: 600; }
    #chatbot-header-info p { font-size: 12px; color: rgba(255,255,255,0.7); }

    #chatbot-messages {
      flex: 1;
      overflow-y: auto;
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 12px;
      background: #16162a;
    }

    .chatbot-msg {
      max-width: 85%;
      padding: 10px 14px;
      border-radius: 12px;
      font-size: 14px;
      line-height: 1.5;
      word-wrap: break-word;
    }

    .chatbot-msg.user {
      align-self: flex-end;
      background: var(--chatbot-primary);
      color: white;
      border-bottom-right-radius: 4px;
    }

    .chatbot-msg.bot {
      align-self: flex-start;
      background: #252547;
      color: #e2e8f0;
      border-bottom-left-radius: 4px;
    }

    .chatbot-msg.typing {
      align-self: flex-start;
      background: #252547;
      padding: 8px 14px;
    }

    #chatbot-input-area {
      display: flex;
      padding: 12px 16px;
      background: #1a1a2e;
      border-top: 1px solid rgba(255,255,255,0.1);
      gap: 8px;
    }

    #chatbot-input {
      flex: 1;
      background: #252547;
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 10px;
      padding: 10px 14px;
      color: #e2e8f0;
      outline: none;
    }

    #chatbot-send {
      background: var(--chatbot-primary);
      border: none;
      border-radius: 10px;
      width: 42px;
      height: 42px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: opacity 0.2s;
    }

    #chatbot-send:disabled { opacity: 0.5; cursor: not-allowed; }
    #chatbot-send svg { width: 18px; height: 18px; fill: white; }

    .chatbot-welcome {
      text-align: center;
      color: #94a3b8;
      padding: 24px 16px;
      font-size: 13px;
    }

    .chatbot-typing-dots { display: flex; gap: 4px; }
    .chatbot-typing-dots span {
      width: 6px; height: 6px; background: var(--chatbot-primary);
      border-radius: 50%; animation: chatbot-bounce 1.4s infinite ease-in-out;
    }
    .chatbot-typing-dots span:nth-child(2) { animation-delay: 0.2s; }
    .chatbot-typing-dots span:nth-child(3) { animation-delay: 0.4s; }

    @keyframes chatbot-bounce {
      0%, 80%, 100% { transform: scale(0); }
      40% { transform: scale(1); }
    }

    #chatbot-call-btn {
      background: rgba(255, 255, 255, 0.2);
      border: none;
      border-radius: 8px;
      padding: 6px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: background 0.2s;
      margin-left: auto;
    }
    #chatbot-call-btn:hover { background: rgba(255, 255, 255, 0.3); }
    #chatbot-call-btn svg { width: 18px; height: 18px; stroke: white; }
    #chatbot-call-btn.active { background: #ef4444; animation: chatbot-pulse 1.5s infinite; }

    @keyframes chatbot-pulse {
      0% { transform: scale(1); box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.7); }
      70% { transform: scale(1.05); box-shadow: 0 0 0 10px rgba(239, 68, 68, 0); }
      100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); }
    }

    #chatbot-call-status {
      position: absolute;
      top: 70px;
      left: 0;
      right: 0;
      background: #ef4444;
      color: white;
      font-size: 12px;
      text-align: center;
      padding: 4px;
      display: none;
      z-index: 10;
    }
    #chatbot-call-status.visible { display: block; }

    #chatbot-status-banner {
      background: #252547;
      color: #94a3b8;
      font-size: 12px;
      text-align: center;
      padding: 6px 12px;
      display: none;
      border-bottom: 1px solid rgba(255,255,255,0.1);
    }
    #chatbot-status-banner.visible { display: block; }

    #chatbot-handoff-bar {
      padding: 8px 16px;
      background: #1a1a2e;
      border-top: 1px solid rgba(255,255,255,0.1);
      text-align: center;
    }
    #chatbot-request-human {
      background: transparent;
      border: 1px solid rgba(255,255,255,0.15);
      color: #94a3b8;
      border-radius: 8px;
      padding: 6px 14px;
      font-size: 12px;
      cursor: pointer;
    }
    #chatbot-request-human:hover { border-color: var(--chatbot-primary); color: #e2e8f0; }
    #chatbot-request-human:disabled { opacity: 0.6; cursor: not-allowed; }
  `;
  document.head.appendChild(styles);

  // ─── DOM Building ──────────────────────────────────────────────
  const container = document.createElement('div');
  container.id = 'chatbot-widget-container';
  document.body.appendChild(container);

  async function init() {
    try {
      const res = await fetch(`${API_URL}/chat/config`, {
        headers: { 'x-bot-api-key': API_KEY }
      });
      if (res.ok) {
        botConfig = await res.json();
        document.documentElement.style.setProperty('--chatbot-primary', botConfig.themeColor);
      }
    } catch (err) {
      console.warn('[ChatWidget] Using default config');
    }

    container.innerHTML = `
      <button id="chatbot-bubble">
        <svg class="chat-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
        </svg>
        <svg class="close-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>
      <div id="chatbot-window">
        <div id="chatbot-header">
          <div id="chatbot-header-avatar">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
              <path d="M12 2a7 7 0 0 1 7 7c0 3-2 5-4 6v2H9v-2c-2-1-4-3-4-6a7 7 0 0 1 7-7z"/>
              <line x1="9" y1="21" x2="15" y2="21"/>
            </svg>
          </div>
          <div id="chatbot-header-info">
            <h3>${botConfig.displayName}</h3>
            <p>Online • Ready to help</p>
          </div>
          <button id="chatbot-call-btn" title="Call AI Assistant">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.82 12.82 0 0 0 .62 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.91-1.91a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.62A2 2 0 0 1 22 16.92z"></path>
            </svg>
          </button>
        </div>
        <div id="chatbot-call-status">Live Call in Progress...</div>
        <div id="chatbot-status-banner"></div>
        <div id="chatbot-messages">
          <div class="chatbot-welcome">${botConfig.welcomeMessage}</div>
        </div>
        ${botConfig.humanHandoffEnabled ? `
        <div id="chatbot-handoff-bar">
          <button id="chatbot-request-human">🙋 Talk to a human</button>
        </div>` : ''}
        <div id="chatbot-input-area">
          <input id="chatbot-input" type="text" placeholder="Type your message..." autocomplete="off" />
          <button id="chatbot-send">
            <svg viewBox="0 0 24 24"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
          </button>
        </div>
      </div>
    `;

    const bubble = document.getElementById('chatbot-bubble');
    const chatWindow = document.getElementById('chatbot-window');
    const messagesEl = document.getElementById('chatbot-messages');
    const input = document.getElementById('chatbot-input');
    const sendBtn = document.getElementById('chatbot-send');
    const callBtn = document.getElementById('chatbot-call-btn');
    const callStatus = document.getElementById('chatbot-call-status');
    const statusBanner = document.getElementById('chatbot-status-banner');
    const requestHumanBtn = document.getElementById('chatbot-request-human');

    const updateHandoffStatus = (status) => {
      if (!status || status === handoffStatus) return;
      handoffStatus = status;
      if (status === 'NEEDS_HUMAN') {
        statusBanner.textContent = '⏳ Waiting for a human agent...';
        statusBanner.classList.add('visible');
      } else if (status === 'HUMAN') {
        statusBanner.textContent = '🧑 You\'re chatting with a team member';
        statusBanner.classList.add('visible');
      } else {
        statusBanner.classList.remove('visible');
      }
      const handoffBar = document.getElementById('chatbot-handoff-bar');
      if (handoffBar) {
        handoffBar.style.display = status === 'BOT' ? '' : 'none';
      }
      if (requestHumanBtn && status === 'BOT') {
        // Reset in case it was left mid-request (disabled/"Connecting...")
        // from before this conversation was handed off.
        requestHumanBtn.disabled = false;
        requestHumanBtn.textContent = '🙋 Talk to a human';
      }
    };

    const pollForUpdates = async () => {
      if (!sessionId) return;
      try {
        const res = await fetch(
          `${API_URL}/chat/messages?sessionId=${encodeURIComponent(sessionId)}&after=${encodeURIComponent(lastMessageTime)}`,
          { headers: { 'x-bot-api-key': API_KEY } },
        );
        if (!res.ok) return;
        const data = await res.json();
        updateHandoffStatus(data.status);
        (data.messages || []).forEach((m) => {
          lastMessageTime = m.createdAt;
          if (renderedMessageIds.has(m.id)) return;
          renderedMessageIds.add(m.id);
          if (m.role === 'agent') addMessage(m.content, 'bot');
        });
      } catch (err) {
        // ignore transient polling errors
      }
    };

    const startPolling = () => {
      if (pollInterval || !sessionId) return;
      pollInterval = setInterval(pollForUpdates, 4000);
    };

    const stopPolling = () => {
      if (pollInterval) {
        clearInterval(pollInterval);
        pollInterval = null;
      }
    };

    if (requestHumanBtn) {
      requestHumanBtn.onclick = async () => {
        if (!sessionId) {
          sessionId = generateSessionId();
          localStorage.setItem('chatbot_session_' + API_KEY, sessionId);
        }
        requestHumanBtn.disabled = true;
        requestHumanBtn.textContent = 'Connecting...';
        try {
          const res = await fetch(`${API_URL}/chat/request-human`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-bot-api-key': API_KEY },
            body: JSON.stringify({ sessionId }),
          });
          if (res.ok) {
            const data = await res.json();
            updateHandoffStatus(data.status);
            startPolling();
          } else {
            requestHumanBtn.disabled = false;
            requestHumanBtn.textContent = '🙋 Talk to a human';
          }
        } catch (err) {
          requestHumanBtn.disabled = false;
          requestHumanBtn.textContent = '🙋 Talk to a human';
        }
      };
    }

    // Voice is BYOK — only available when the bot has configured its own
    // Vapi public key + assistant ID (see /chat/config).
    const voiceEnabled = !!(botConfig.vapiPublicKey && botConfig.vapiAssistantId);
    if (!voiceEnabled) {
      callBtn.style.display = 'none';
    }

    // Initialize Vapi if the SDK is present and this bot has voice configured
    if (voiceEnabled && typeof Vapi !== 'undefined') {
      vapi = new Vapi(botConfig.vapiPublicKey);

      vapi.on('call-start', () => {
        isCalling = true;
        callBtn.classList.add('active');
        callStatus.classList.add('visible');
        addMessage('Voice call started...', 'bot');
      });

      vapi.on('call-end', () => {
        isCalling = false;
        callBtn.classList.remove('active');
        callStatus.classList.remove('visible');
        addMessage('Voice call ended.', 'bot');
      });

      vapi.on('error', (e) => {
        console.error('Vapi Error:', e);
        isCalling = false;
        callBtn.classList.remove('active');
        callStatus.classList.remove('visible');
        addMessage('Voice call error. Please check mic permissions.', 'bot');
      });
    }

    const toggleCall = async () => {
      if (!vapi) {
        addMessage('Voice agent not initialized. Refresh page.', 'bot');
        return;
      }

      if (isCalling) {
        vapi.stop();
      } else {
        try {
          await vapi.start(botConfig.vapiAssistantId);
        } catch (err) {
          console.error(err);
        }
      }
    };

    callBtn.onclick = toggleCall;

    bubble.onclick = () => {
      isOpen = !isOpen;
      bubble.classList.toggle('open', isOpen);
      chatWindow.classList.toggle('visible', isOpen);
      if (isOpen) {
        input.focus();
        startPolling();
      } else {
        stopPolling();
      }
    };

    const linkify = (text) => {
      const urlRegex = /(https?:\/\/[^\s]+)/g;
      return text.replace(urlRegex, (url) => {
        return `<a href="${url}" target="_blank" rel="noopener noreferrer" style="color: inherit; text-decoration: underline;">${url}</a>`;
      });
    };

    const addMessage = (text, sender) => {
      const welcome = messagesEl.querySelector('.chatbot-welcome');
      if (welcome) welcome.remove();

      const msg = document.createElement('div');
      msg.className = `chatbot-msg ${sender}`;
      
      // Escape HTML to prevent XSS, then linkify
      const escapedText = text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
      
      msg.innerHTML = linkify(escapedText);
      
      messagesEl.appendChild(msg);
      messagesEl.scrollTop = messagesEl.scrollHeight;
      return msg;
    };

    const showTyping = () => {
      const typing = document.createElement('div');
      typing.className = 'chatbot-msg bot typing';
      typing.id = 'chatbot-typing';
      typing.innerHTML = '<div class="chatbot-typing-dots"><span></span><span></span><span></span></div>';
      messagesEl.appendChild(typing);
      messagesEl.scrollTop = messagesEl.scrollHeight;
    };

    const removeTyping = () => {
      const el = document.getElementById('chatbot-typing');
      if (el) el.remove();
    };

    const sendMessage = async () => {
      const text = input.value.trim();
      if (!text) return;

      addMessage(text, 'user');
      input.value = '';
      sendBtn.disabled = true;
      showTyping();

      try {
        const res = await fetch(`${API_URL}/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-bot-api-key': API_KEY },
          body: JSON.stringify({ message: text, sessionId }),
        });

        removeTyping();
        if (!res.ok) throw new Error();

        const data = await res.json();
        if (data.sessionId) {
          sessionId = data.sessionId;
          localStorage.setItem('chatbot_session_' + API_KEY, sessionId);
          startPolling();
        }
        updateHandoffStatus(data.status);
        if (data.reply) addMessage(data.reply, 'bot');
      } catch (err) {
        removeTyping();
        addMessage('Something went wrong. Please try again.', 'bot');
      } finally {
        sendBtn.disabled = false;
        input.focus();
      }
    };

    sendBtn.onclick = sendMessage;
    input.onkeydown = (e) => {
      if (e.key === 'Enter') sendMessage();
    };
  }

  init();
})();
