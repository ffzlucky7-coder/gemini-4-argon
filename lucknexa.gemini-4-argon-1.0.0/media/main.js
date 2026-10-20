// main.js - Client-Side Controller for Gemini 4 Argon Agent
// Creator: Lucky Kuntal (https://github.com/ffzlucky7-coder)
// Standards: Apple HIG, Quiet Luxury, Robust Error Handling, Zero Dependencies

(function () {
  const vscode = acquireVsCodeApi();

  // Internal State
  let currentThinkingLevel = 'high';
  let isThinking = false;
  let activeSessionId = null;
  const activeToolPills = new Map();

  // In-Stream Thinking Bubble Controller
  let activeThinkingBubble = null;

  function showThinkingBubble(title, subtitle) {
    removeThinkingBubble();
    if (!chatContainer) return;

    activeThinkingBubble = document.createElement('div');
    activeThinkingBubble.className = 'message model thinking-bubble';
    activeThinkingBubble.innerHTML = `
      <div class="thinking-spinner-ring" aria-hidden="true"></div>
      <div class="thinking-content">
        <span class="thinking-text">${escapeHtml(title || 'Gemini 4 Argon is thinking...')}</span>
        <span class="thinking-subtext">${escapeHtml(subtitle || 'Analyzing workspace & synthesizing response')}</span>
      </div>
    `;
    chatContainer.appendChild(activeThinkingBubble);
    chatContainer.scrollTop = chatContainer.scrollHeight;
  }

  function updateThinkingBubble(title, subtitle) {
    if (!activeThinkingBubble) {
      showThinkingBubble(title, subtitle);
      return;
    }
    const textEl = activeThinkingBubble.querySelector('.thinking-text');
    const subEl = activeThinkingBubble.querySelector('.thinking-subtext');
    if (textEl && title) textEl.textContent = title;
    if (subEl && subtitle !== undefined) subEl.textContent = subtitle;
    if (chatContainer) chatContainer.scrollTop = chatContainer.scrollHeight;
  }

  function removeThinkingBubble() {
    if (activeThinkingBubble && activeThinkingBubble.parentNode) {
      activeThinkingBubble.parentNode.removeChild(activeThinkingBubble);
    }
    activeThinkingBubble = null;
  }


  // Primary Elements
  const chatContainer = document.getElementById('chatContainer');
  const welcomeCard = document.getElementById('welcomeCard');
  const promptInput = document.getElementById('promptInput');
  const sendBtn = document.getElementById('sendBtn');
  const abortBtn = document.getElementById('abortBtn');
  const statusBar = document.getElementById('statusBar');
  const statusMessage = document.getElementById('statusMessage');
  const modePills = document.querySelectorAll('.segment-btn');
  const welcomeChips = document.querySelectorAll('.glass-chip');

  // Theme Elements
  const themeToggleBtn = document.getElementById('themeToggleBtn');
  const themeIconDark = document.getElementById('themeIconDark');
  const themeIconLight = document.getElementById('themeIconLight');

  // History Drawer Elements
  const historyToggleBtn = document.getElementById('historyToggleBtn');
  const historyDrawer = document.getElementById('historyDrawer');
  const drawerBackdrop = document.getElementById('drawerBackdrop');
  const closeHistoryBtn = document.getElementById('closeHistoryBtn');
  const sessionsList = document.getElementById('sessionsList');
  const newChatBtn = document.getElementById('newChatBtn');
  const drawerNewChatBtn = document.getElementById('drawerNewChatBtn');
  const clearAllHistoryBtn = document.getElementById('clearAllHistoryBtn');
  const historyCountBadge = document.getElementById('historyCountBadge');

  // Guide Elements
  const guideBtn = document.getElementById('guideBtn');
  const guideModal = document.getElementById('guideModal');
  const closeGuideBtn = document.getElementById('closeGuideBtn');
  const gotItGuideBtn = document.getElementById('gotItGuideBtn');
  const openGithubReadmeBtn = document.getElementById('openGithubReadmeBtn');

  // Settings Elements
  const settingsBtn = document.getElementById('settingsBtn');
  const settingsModal = document.getElementById('settingsModal');
  const closeSettingsBtn = document.getElementById('closeSettingsBtn');
  const cancelSettingsBtn = document.getElementById('cancelSettingsBtn');
  const saveSettingsBtn = document.getElementById('saveSettingsBtn');
  const testConnBtn = document.getElementById('testConnBtn');
  const testConnResult = document.getElementById('testConnResult');
  const cfgProjectId = document.getElementById('cfgProjectId');
  const cfgLocation = document.getElementById('cfgLocation');
  const cfgAuthMethod = document.getElementById('cfgAuthMethod');
  const cfgSaPath = document.getElementById('cfgSaPath');
  const cfgApiKey = document.getElementById('cfgApiKey');
  const browseSaBtn = document.getElementById('browseSaBtn');
  const saFileGroup = document.getElementById('saFileGroup');
  const apiKeyGroup = document.getElementById('apiKeyGroup');
  const adcDetectedBadge = document.getElementById('adcDetectedBadge');
  const adcDetectedPath = document.getElementById('adcDetectedPath');

  // ==========================================================================
  // 1. THEME MANAGEMENT (Apple Ceramic & Deep Space Glass)
  // ==========================================================================
  function applyTheme(theme) {
    if (theme === 'dark') {
      document.body.setAttribute('data-theme', 'dark');
      if (themeIconDark) themeIconDark.style.display = 'none';
      if (themeIconLight) themeIconLight.style.display = 'block';
    } else if (theme === 'light') {
      document.body.setAttribute('data-theme', 'light');
      if (themeIconDark) themeIconDark.style.display = 'block';
      if (themeIconLight) themeIconLight.style.display = 'none';
    } else {
      document.body.removeAttribute('data-theme');
      if (themeIconDark) themeIconDark.style.display = 'block';
      if (themeIconLight) themeIconLight.style.display = 'none';
    }
    try {
      localStorage.setItem('gemini_argon_theme', theme);
    } catch (_) {}
  }

  // Load saved theme or default to dark
  let currentTheme = 'dark';
  try {
    currentTheme = localStorage.getItem('gemini_argon_theme') || 'dark';
  } catch (_) {}
  applyTheme(currentTheme);

  if (themeToggleBtn) {
    themeToggleBtn.addEventListener('click', () => {
      const current = document.body.getAttribute('data-theme') || (document.body.classList.contains('vscode-light') ? 'light' : 'dark');
      const nextTheme = current === 'dark' ? 'light' : 'dark';
      applyTheme(nextTheme);
    });
  }

  // ==========================================================================
  // 2. AUTO-EXPANDING COMPOSER & KEYBOARD HANDLERS
  // ==========================================================================
  if (promptInput) {
    promptInput.addEventListener('input', () => {
      promptInput.style.height = 'auto';
      promptInput.style.height = Math.min(promptInput.scrollHeight, 130) + 'px';
      updateSendBtnState();
    });

    promptInput.addEventListener('keydown', (e) => {
      if (e.isComposing || e.keyCode === 229) return;
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    });
  }

  function updateSendBtnState() {
    if (!sendBtn || !promptInput) return;
    const hasText = promptInput.value.trim().length > 0;
    sendBtn.disabled = !hasText || isThinking;
  }

  if (sendBtn) {
    sendBtn.addEventListener('click', () => sendMessage());
  }

  // Starter Prompts Click Handler
  welcomeChips.forEach((chip) => {
    chip.addEventListener('click', () => {
      const prompt = chip.getAttribute('data-prompt');
      if (prompt) {
        sendMessage(prompt);
      }
    });
  });

  // ==========================================================================
  // 3. MESSAGE SUBMISSION & EXECUTION LIFECYCLE
  // ==========================================================================
  function sendMessage(customPrompt) {
    const text = customPrompt || (promptInput ? promptInput.value.trim() : '');
    if (!text || isThinking) return;

    if (welcomeCard) {
      welcomeCard.style.display = 'none';
    }

    appendMessage('user', text);

    if (promptInput) {
      promptInput.value = '';
      promptInput.style.height = 'auto';
    }
    updateSendBtnState();

    isThinking = true;
    showStatus(`Reasoning (${currentThinkingLevel.toUpperCase()})...`);

    vscode.postMessage({
      type: 'sendMessage',
      text: text,
      thinkingLevel: currentThinkingLevel
    });
  }

  // Reasoning Level Switcher (Docked Above Input)
  modePills.forEach((pill) => {
    pill.addEventListener('click', () => {
      modePills.forEach((p) => {
        p.classList.remove('active');
        p.setAttribute('aria-checked', 'false');
      });
      pill.classList.add('active');
      pill.setAttribute('aria-checked', 'true');
      currentThinkingLevel = pill.getAttribute('data-level') || 'high';

      vscode.postMessage({
        type: 'saveConfig',
        config: { thinkingLevel: currentThinkingLevel }
      });
    });
  });

  // Abort / Stop Generation Controller
  if (abortBtn) {
    abortBtn.addEventListener('click', () => {
      vscode.postMessage({ type: 'abort' });
      hideStatus();
      isThinking = false;
      updateSendBtnState();
    });
  }

  function showStatus(message) {
    if (statusBar) statusBar.style.display = 'flex';
    if (statusMessage) statusMessage.textContent = message;
  }

  function hideStatus() {
    if (statusBar) statusBar.style.display = 'none';
  }

  // ==========================================================================
  // 4. CHAT HISTORY DRAWER
  // ==========================================================================
  if (historyToggleBtn) {
    historyToggleBtn.addEventListener('click', openHistoryDrawer);
  }
  if (closeHistoryBtn) {
    closeHistoryBtn.addEventListener('click', closeHistoryDrawer);
  }
  if (drawerBackdrop) {
    drawerBackdrop.addEventListener('click', closeHistoryDrawer);
  }

  function openHistoryDrawer() {
    if (historyDrawer) {
      historyDrawer.classList.add('open');
      historyDrawer.setAttribute('aria-hidden', 'false');
    }
    if (drawerBackdrop) drawerBackdrop.classList.add('active');
  }

  function closeHistoryDrawer() {
    if (historyDrawer) {
      historyDrawer.classList.remove('open');
      historyDrawer.setAttribute('aria-hidden', 'true');
    }
    if (drawerBackdrop) drawerBackdrop.classList.remove('active');
  }

  if (newChatBtn) {
    newChatBtn.addEventListener('click', startNewChat);
  }
  if (drawerNewChatBtn) {
    drawerNewChatBtn.addEventListener('click', () => {
      startNewChat();
      closeHistoryDrawer();
    });
  }

  function startNewChat() {
    vscode.postMessage({ type: 'newChat' });
  }

  if (clearAllHistoryBtn) {
    clearAllHistoryBtn.addEventListener('click', () => {
      vscode.postMessage({ type: 'clearAllSessions' });
      closeHistoryDrawer();
    });
  }

  function renderSessionsList(sessions, activeId) {
    if (!sessionsList) return;
    sessionsList.innerHTML = '';

    if (historyCountBadge) {
      if (sessions && sessions.length > 0) {
        historyCountBadge.style.display = 'inline-block';
        historyCountBadge.textContent = sessions.length;
      } else {
        historyCountBadge.style.display = 'none';
      }
    }

    if (!sessions || sessions.length === 0) {
      const emptyMsg = document.createElement('div');
      emptyMsg.className = 'session-meta';
      emptyMsg.style.padding = '12px';
      emptyMsg.style.textAlign = 'center';
      emptyMsg.textContent = 'No saved conversations yet.';
      sessionsList.appendChild(emptyMsg);
      return;
    }

    sessions.forEach((s) => {
      const item = document.createElement('div');
      item.className = 'session-item' + (s.id === activeId ? ' active' : '');
      item.setAttribute('role', 'listitem');

      const info = document.createElement('div');
      info.className = 'session-info';

      const title = document.createElement('div');
      title.className = 'session-title';
      title.textContent = s.title || 'Untitled Session';

      const meta = document.createElement('div');
      meta.className = 'session-meta';
      meta.textContent = `${formatRelativeTime(s.updatedAt || s.createdAt)} • ${s.messageCount || 0} msgs`;

      info.appendChild(title);
      info.appendChild(meta);

      const delBtn = document.createElement('button');
      delBtn.className = 'delete-session-btn';
      delBtn.title = 'Delete Session';
      delBtn.setAttribute('aria-label', `Delete ${s.title}`);
      delBtn.innerHTML = '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>';

      delBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        vscode.postMessage({ type: 'deleteSession', sessionId: s.id });
      });

      item.appendChild(info);
      item.appendChild(delBtn);

      item.addEventListener('click', () => {
        vscode.postMessage({ type: 'switchSession', sessionId: s.id });
        closeHistoryDrawer();
      });

      sessionsList.appendChild(item);
    });
  }

  function formatRelativeTime(timestamp) {
    if (!timestamp) return 'Just now';
    const diff = Date.now() - timestamp;
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days === 1) return 'Yesterday';
    return `${days}d ago`;
  }

  // ==========================================================================
  // 5. SETTINGS & GUIDE DIALOGS
  // ==========================================================================
  if (settingsBtn) {
    settingsBtn.addEventListener('click', () => {
      if (settingsModal) settingsModal.style.display = 'flex';
    });
  }

  function closeSettings() {
    if (settingsModal) settingsModal.style.display = 'none';
    if (testConnResult) testConnResult.style.display = 'none';
  }

  if (closeSettingsBtn) closeSettingsBtn.addEventListener('click', closeSettings);
  if (cancelSettingsBtn) cancelSettingsBtn.addEventListener('click', closeSettings);

  if (cfgAuthMethod) {
    cfgAuthMethod.addEventListener('change', () => {
      updateAuthFieldsVisibility(cfgAuthMethod.value);
    });
  }

  function updateAuthFieldsVisibility(method) {
    if (!saFileGroup || !apiKeyGroup) return;
    if (method === 'serviceAccount') {
      saFileGroup.style.display = 'flex';
      apiKeyGroup.style.display = 'none';
    } else if (method === 'apiKey') {
      saFileGroup.style.display = 'none';
      apiKeyGroup.style.display = 'flex';
    } else {
      saFileGroup.style.display = 'none';
      apiKeyGroup.style.display = 'none';
    }
  }

  if (browseSaBtn) {
    browseSaBtn.addEventListener('click', () => {
      vscode.postMessage({ type: 'selectKeyFile' });
    });
  }

  if (saveSettingsBtn) {
    saveSettingsBtn.addEventListener('click', () => {
      const config = {
        projectId: cfgProjectId ? cfgProjectId.value.trim() : '',
        location: cfgLocation ? cfgLocation.value.trim() || 'global' : 'global',
        authMethod: cfgAuthMethod ? cfgAuthMethod.value : 'adc',
        serviceAccountKeyPath: cfgSaPath ? cfgSaPath.value.trim() : '',
        apiKey: cfgApiKey ? cfgApiKey.value.trim() : '',
        thinkingLevel: currentThinkingLevel
      };
      vscode.postMessage({ type: 'saveConfig', config });
      closeSettings();
    });
  }

  if (testConnBtn) {
    testConnBtn.addEventListener('click', () => {
      const config = {
        projectId: cfgProjectId ? cfgProjectId.value.trim() : '',
        location: cfgLocation ? cfgLocation.value.trim() || 'global' : 'global',
        authMethod: cfgAuthMethod ? cfgAuthMethod.value : 'adc',
        serviceAccountKeyPath: cfgSaPath ? cfgSaPath.value.trim() : '',
        apiKey: cfgApiKey ? cfgApiKey.value.trim() : '',
        thinkingLevel: 'low'
      };
      if (testConnResult) {
        testConnResult.className = 'test-result';
        testConnResult.style.display = 'block';
        testConnResult.textContent = 'Testing connection to Gemini 4 Argon...';
      }
      vscode.postMessage({ type: 'testConnection', config });
    });
  }

  // Guide Handlers
  if (guideBtn) {
    guideBtn.addEventListener('click', () => {
      if (guideModal) guideModal.style.display = 'flex';
    });
  }

  function closeGuide() {
    if (guideModal) guideModal.style.display = 'none';
  }

  if (closeGuideBtn) closeGuideBtn.addEventListener('click', closeGuide);
  if (gotItGuideBtn) gotItGuideBtn.addEventListener('click', closeGuide);

  if (openGithubReadmeBtn) {
    openGithubReadmeBtn.addEventListener('click', () => {
      vscode.postMessage({
        type: 'openExternalUrl',
        url: 'https://github.com/ffzlucky7-coder/gemini-4-argon#readme'
      });
    });
  }

  // ==========================================================================
  // 6. TOOL ACTIVITY ROWS & HUMAN-READABLE STATUS
  // ==========================================================================
  const TOOL_HUMAN_NAMES = {
    read_file: 'Reading project files',
    write_file: 'Writing file',
    edit_file: 'Refactoring code',
    list_dir: 'Scanning folder contents',
    get_workspace_structure: 'Mapping repository tree',
    search_code: 'Searching codebase',
    run_command: 'Executing command'
  };

  function createToolPill(toolName, id) {
    if (!chatContainer) return;
    const label = TOOL_HUMAN_NAMES[toolName] || `Running ${toolName}`;

    const pill = document.createElement('div');
    pill.className = 'tool-progress-pill';
    pill.id = `tool-${id}`;
    pill.innerHTML = `
      <div class="status-pulse-dot" style="width: 5px; height: 5px;"></div>
      <span>${escapeHtml(label)}...</span>
    `;
    chatContainer.appendChild(pill);
    chatContainer.scrollTop = chatContainer.scrollHeight;
    activeToolPills.set(id, pill);
  }

  function updateToolPill(id, success, toolName) {
    const pill = activeToolPills.get(id);
    if (!pill) return;

    const label = TOOL_HUMAN_NAMES[toolName] || toolName;
    pill.classList.remove('done', 'error');

    if (success) {
      pill.classList.add('done');
      pill.innerHTML = `
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="color: var(--color-success);"><polyline points="20 6 9 17 4 12"/></svg>
        <span>${escapeHtml(label)}</span>
      `;
    } else {
      pill.classList.add('error');
      pill.innerHTML = `
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="color: var(--color-error);"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        <span>${escapeHtml(label)} failed</span>
      `;
    }
  }

  // ==========================================================================
  // 7. MARKDOWN ENGINE WITH FENCED CODE BLOCKS & 1-CLICK COPY
  // ==========================================================================
  function appendMessage(role, content) {
    if (!chatContainer) return;
    const msgDiv = document.createElement('div');
    msgDiv.className = `message ${role}`;

    if (role === 'user') {
      msgDiv.textContent = content;
    } else {
      msgDiv.innerHTML = formatMarkdown(content);
      attachCodeCopyListeners(msgDiv);
    }

    chatContainer.appendChild(msgDiv);
    chatContainer.scrollTop = chatContainer.scrollHeight;
    return msgDiv;
  }

  function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  function formatMarkdown(text) {
    if (!text) return '';

    // 1. Extract and format fenced code blocks first
    const codeBlocks = [];
    let formatted = text.replace(/```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g, (match, lang, code) => {
      const placeholder = `__CODE_BLOCK_${codeBlocks.length}__`;
      const language = lang ? lang.trim().toLowerCase() : 'code';
      const cleanCode = code.replace(/\n$/, '');

      const html = `
        <div class="code-block-container">
          <div class="code-header">
            <span class="code-lang">${escapeHtml(language)}</span>
            <button class="copy-code-btn" type="button" aria-label="Copy code block">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
              <span>Copy</span>
            </button>
          </div>
          <pre><code class="language-${escapeHtml(language)}">${escapeHtml(cleanCode)}</code></pre>
        </div>
      `;
      codeBlocks.push(html);
      return placeholder;
    });

    // 2. Escape standard content
    formatted = escapeHtml(formatted);

    // 3. Inline code
    formatted = formatted.replace(/`([^`]+)`/g, '<code>$1</code>');

    // 4. Bold and Italics
    formatted = formatted.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    formatted = formatted.replace(/\*([^*]+)\*/g, '<em>$1</em>');

    // 5. Headings
    formatted = formatted.replace(/^### (.*$)/gim, '<h4>$1</h4>');
    formatted = formatted.replace(/^## (.*$)/gim, '<h3>$1</h3>');
    formatted = formatted.replace(/^# (.*$)/gim, '<h2>$1</h2>');

    // 6. Blockquotes
    formatted = formatted.replace(/^>\s*(.*$)/gim, '<blockquote>$1</blockquote>');

    // 7. Bullet lists
    formatted = formatted.replace(/^\s*[-*]\s+(.*$)/gim, '<li>$1</li>');
    formatted = formatted.replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>');

    // 8. Paragraphs
    formatted = formatted.replace(/\n\n+/g, '<br><br>');
    formatted = formatted.replace(/([^\n])\n([^\n])/g, '$1<br>$2');

    // 9. Restore code blocks
    codeBlocks.forEach((block, idx) => {
      formatted = formatted.replace(`__CODE_BLOCK_${idx}__`, block);
    });

    return formatted;
  }

  function attachCodeCopyListeners(container) {
    const copyBtns = container.querySelectorAll('.copy-code-btn');
    copyBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        const pre = btn.closest('.code-block-container').querySelector('pre code');
        if (!pre) return;

        const textToCopy = pre.textContent;
        navigator.clipboard.writeText(textToCopy).then(() => {
          btn.classList.add('copied');
          btn.innerHTML = `
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
            <span>Copied!</span>
          `;
          setTimeout(() => {
            btn.classList.remove('copied');
            btn.innerHTML = `
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
              <span>Copy</span>
            `;
          }, 2000);
        }).catch((err) => {
          console.error('Failed to copy code: ', err);
        });
      });
    });
  }

  // ==========================================================================
  // 8. IPC MESSAGE DISPATCHER FROM EXTENSION HOST
  // ==========================================================================
  window.addEventListener('message', (event) => {
    const msg = event.data;
    if (!msg) return;

    switch (msg.type) {
      case 'initState': {
        const cfg = msg.config || {};
        if (cfgProjectId) cfgProjectId.value = cfg.projectId || '';
        if (cfgLocation) cfgLocation.value = cfg.location || 'global';
        if (cfgAuthMethod) cfgAuthMethod.value = cfg.authMethod || 'adc';
        if (cfgSaPath) cfgSaPath.value = cfg.serviceAccountKeyPath || '';
        if (cfgApiKey) cfgApiKey.value = cfg.apiKey || '';

        updateAuthFieldsVisibility(cfg.authMethod || 'adc');

        if (cfg.thinkingLevel) {
          currentThinkingLevel = cfg.thinkingLevel;
          modePills.forEach((p) => {
            const matches = p.getAttribute('data-level') === currentThinkingLevel;
            p.classList.toggle('active', matches);
            p.setAttribute('aria-checked', matches ? 'true' : 'false');
          });
        }

        if (adcDetectedBadge && adcDetectedPath) {
          if (msg.adcDetected) {
            adcDetectedBadge.textContent = 'Detected';
            adcDetectedBadge.className = 'status-badge';
            adcDetectedPath.textContent = msg.adcPath || 'Standard ADC location';
          } else {
            adcDetectedBadge.textContent = 'Not Detected';
            adcDetectedBadge.className = 'status-badge error';
            adcDetectedPath.textContent = 'Run "gcloud auth application-default login" or use a Service Account key.';
          }
        }

        renderSessionsList(msg.sessions || [], msg.currentSession ? msg.currentSession.id : null);

        if (msg.currentSession && msg.currentSession.messages && msg.currentSession.messages.length > 0) {
          if (welcomeCard) welcomeCard.style.display = 'none';
          if (chatContainer) {
            chatContainer.innerHTML = '';
            msg.currentSession.messages.forEach((m) => appendMessage(m.role, m.content));
          }
        }
        break;
      }

      case 'sessionSwitched': {
        const sess = msg.session;
        if (!sess) break;
        activeSessionId = sess.id;
        if (chatContainer) chatContainer.innerHTML = '';

        if (!sess.messages || sess.messages.length === 0) {
          if (welcomeCard) {
            welcomeCard.style.display = 'flex';
            if (chatContainer) chatContainer.appendChild(welcomeCard);
          }
        } else {
          if (welcomeCard) welcomeCard.style.display = 'none';
          sess.messages.forEach((m) => appendMessage(m.role, m.content));
        }

        if (sess.thinkingLevel) {
          currentThinkingLevel = sess.thinkingLevel;
          modePills.forEach((p) => {
            const matches = p.getAttribute('data-level') === currentThinkingLevel;
            p.classList.toggle('active', matches);
            p.setAttribute('aria-checked', matches ? 'true' : 'false');
          });
        }

        renderSessionsList(msg.sessions || [], activeSessionId);
        hideStatus();
        isThinking = false;
        updateSendBtnState();
        break;
      }

      case 'sessionsUpdated': {
        renderSessionsList(msg.sessions || [], msg.activeSessionId);
        break;
      }

      case 'status': {
        if (msg.status === 'idle') {
          hideStatus();
          isThinking = false;
          updateSendBtnState();
        } else {
          showStatus(msg.message || 'Processing...');
        }
        break;
      }

      case 'tool_start': {
        createToolPill(msg.tool, msg.id);
        break;
      }

      case 'tool_end': {
        updateToolPill(msg.id, msg.success, msg.tool);
        break;
      }

      case 'text': {
        appendMessage('model', msg.content);
        hideStatus();
        isThinking = false;
        updateSendBtnState();
        break;
      }

      case 'error': {
        appendMessage('model', `**Error:** ${msg.error}`);
        hideStatus();
        isThinking = false;
        updateSendBtnState();
        break;
      }

      case 'cleared': {
        if (chatContainer) {
          chatContainer.innerHTML = '';
          if (welcomeCard) {
            welcomeCard.style.display = 'flex';
            chatContainer.appendChild(welcomeCard);
          }
        }
        hideStatus();
        isThinking = false;
        updateSendBtnState();
        break;
      }

      case 'externalPrompt': {
        if (welcomeCard) welcomeCard.style.display = 'none';
        appendMessage('user', msg.prompt);
        isThinking = true;
        showStatus(`Reasoning (${currentThinkingLevel.toUpperCase()})...`);
        updateSendBtnState();
        break;
      }

      case 'connectionTestResult': {
        if (testConnResult) {
          testConnResult.style.display = 'block';
          if (msg.success) {
            testConnResult.className = 'test-result success';
            testConnResult.textContent = `✓ ${msg.message}${msg.latencyMs ? ` (${msg.latencyMs}ms)` : ''}`;
          } else {
            testConnResult.className = 'test-result error';
            testConnResult.textContent = `✗ ${msg.message}`;
          }
        }
        break;
      }

      case 'keyFileSelected': {
        if (cfgSaPath) cfgSaPath.value = msg.path || '';
        break;
      }
    }
  });

})();
