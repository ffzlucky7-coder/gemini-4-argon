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

  // Multimodal Attachment Elements
  const attachFileBtn = document.getElementById('attachFileBtn');
  const mediaFileInput = document.getElementById('mediaFileInput');
  const attachmentPreviewBar = document.getElementById('attachmentPreviewBar');
  const dragDropOverlay = document.getElementById('dragDropOverlay');

  // Multi-Provider & Model Elements
  const cfgProvider = document.getElementById('cfgProvider');
  const cfgModelId = document.getElementById('cfgModelId');
  const vertexConfigFields = document.getElementById('vertexConfigFields');
  const claudeConfigFields = document.getElementById('claudeConfigFields');
  const openAiConfigFields = document.getElementById('openAiConfigFields');
  const cfgClaudeKey = document.getElementById('cfgClaudeKey');
  const cfgOpenAiKey = document.getElementById('cfgOpenAiKey');

  // Attachment state
  let currentAttachments = [];

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

  function formatFileSize(bytes) {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return (bytes / Math.pow(k, i)).toFixed(1) + ' ' + sizes[i];
  }

  function renderAttachmentChips() {
    if (!attachmentPreviewBar) return;
    attachmentPreviewBar.innerHTML = '';

    if (currentAttachments.length === 0) {
      attachmentPreviewBar.style.display = 'none';
      updateSendBtnState();
      return;
    }

    attachmentPreviewBar.style.display = 'flex';

    currentAttachments.forEach((att, idx) => {
      const chip = document.createElement('div');
      chip.className = 'attachment-chip';

      if (att.mimeType && att.mimeType.startsWith('image/') && att.thumbUrl) {
        const img = document.createElement('img');
        img.className = 'attachment-thumb';
        img.src = att.thumbUrl;
        img.alt = att.name;
        chip.appendChild(img);
      } else {
        const iconWrap = document.createElement('div');
        iconWrap.className = 'attachment-chip-icon';
        iconWrap.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>';
        chip.appendChild(iconWrap);
      }

      const nameSpan = document.createElement('span');
      nameSpan.className = 'attachment-chip-name';
      nameSpan.textContent = att.name;
      chip.appendChild(nameSpan);

      const sizeSpan = document.createElement('span');
      sizeSpan.className = 'attachment-chip-size';
      sizeSpan.textContent = formatFileSize(att.size);
      chip.appendChild(sizeSpan);

      const removeBtn = document.createElement('button');
      removeBtn.className = 'attachment-remove-btn';
      removeBtn.setAttribute('title', 'Remove attachment');
      removeBtn.innerHTML = '&times;';
      removeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        currentAttachments.splice(idx, 1);
        renderAttachmentChips();
      });
      chip.appendChild(removeBtn);

      attachmentPreviewBar.appendChild(chip);
    });

    updateSendBtnState();
  }

  function handleFiles(files) {
    if (!files || files.length === 0) return;
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUrl = e.target.result;
        const parts = dataUrl.split(';base64,');
        const mimeType = file.type || 'application/octet-stream';
        const base64Data = parts[1] || '';

        currentAttachments.push({
          name: file.name,
          mimeType: mimeType,
          size: file.size,
          base64Data: base64Data,
          thumbUrl: file.type.startsWith('image/') ? dataUrl : null
        });
        renderAttachmentChips();
      };
      reader.readAsDataURL(file);
    }
  }

  if (attachFileBtn && mediaFileInput) {
    attachFileBtn.addEventListener('click', () => {
      mediaFileInput.click();
    });

    mediaFileInput.addEventListener('change', () => {
      if (mediaFileInput.files) {
        handleFiles(mediaFileInput.files);
        mediaFileInput.value = '';
      }
    });
  }

  // Drag and Drop Handling
  let dragCounter = 0;
  window.addEventListener('dragenter', (e) => {
    e.preventDefault();
    dragCounter++;
    if (dragDropOverlay) dragDropOverlay.style.display = 'flex';
  });

  window.addEventListener('dragleave', (e) => {
    e.preventDefault();
    dragCounter--;
    if (dragCounter <= 0) {
      dragCounter = 0;
      if (dragDropOverlay) dragDropOverlay.style.display = 'none';
    }
  });

  window.addEventListener('dragover', (e) => {
    e.preventDefault();
  });

  window.addEventListener('drop', (e) => {
    e.preventDefault();
    dragCounter = 0;
    if (dragDropOverlay) dragDropOverlay.style.display = 'none';
    if (e.dataTransfer && e.dataTransfer.files) {
      handleFiles(e.dataTransfer.files);
    }
  });

  function updateSendBtnState() {
    if (!sendBtn || !promptInput) return;
    const hasText = promptInput.value.trim().length > 0;
    const hasAttachments = currentAttachments.length > 0;
    sendBtn.disabled = (!hasText && !hasAttachments) || isThinking;
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
    const hasAttachments = currentAttachments.length > 0;
    if ((!text && !hasAttachments) || isThinking) return;

    if (welcomeCard) {
      welcomeCard.style.display = 'none';
    }

    const attachmentsToSend = currentAttachments.slice();
    appendMessage('user', text || `[Attached ${attachmentsToSend.length} file(s)]`, attachmentsToSend);

    if (promptInput) {
      promptInput.value = '';
      promptInput.style.height = 'auto';
    }
    currentAttachments = [];
    renderAttachmentChips();

    isThinking = true;
    showStatus(`Reasoning (${currentThinkingLevel.toUpperCase()})...`);

    vscode.postMessage({
      type: 'sendMessage',
      text: text,
      thinkingLevel: currentThinkingLevel,
      attachments: attachmentsToSend.map(a => ({
        name: a.name,
        mimeType: a.mimeType,
        size: a.size,
        base64Data: a.base64Data
      }))
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

  function updateProviderFieldsVisibility(provider) {
    if (!cfgProvider) return;
    const p = (provider || 'vertex').toLowerCase();
    if (vertexConfigFields) vertexConfigFields.style.display = p === 'vertex' ? 'block' : 'none';
    if (claudeConfigFields) claudeConfigFields.style.display = p === 'claude' ? 'block' : 'none';
    if (openAiConfigFields) openAiConfigFields.style.display = p === 'openai' ? 'block' : 'none';

    if (cfgModelId) {
      const options = cfgModelId.options;
      let firstVisibleVal = null;
      for (let i = 0; i < options.length; i++) {
        const opt = options[i];
        let visible = false;
        if (p === 'vertex' && opt.value.startsWith('gemini')) visible = true;
        if (p === 'claude' && opt.value.startsWith('claude')) visible = true;
        if (p === 'openai' && opt.value.startsWith('gpt')) visible = true;

        opt.style.display = visible ? '' : 'none';
        opt.disabled = !visible;
        if (visible && !firstVisibleVal) firstVisibleVal = opt.value;
      }
      const currentSelectedOpt = cfgModelId.options[cfgModelId.selectedIndex];
      if (currentSelectedOpt && currentSelectedOpt.disabled && firstVisibleVal) {
        cfgModelId.value = firstVisibleVal;
      }
    }
  }

  if (cfgProvider) {
    cfgProvider.addEventListener('change', () => {
      updateProviderFieldsVisibility(cfgProvider.value);
    });
  }

  if (saveSettingsBtn) {
    saveSettingsBtn.addEventListener('click', () => {
      const config = {
        provider: cfgProvider ? cfgProvider.value : 'vertex',
        modelId: cfgModelId ? cfgModelId.value : 'gemini-4-argon',
        projectId: cfgProjectId ? cfgProjectId.value.trim() : '',
        location: cfgLocation ? cfgLocation.value.trim() || 'global' : 'global',
        authMethod: cfgAuthMethod ? cfgAuthMethod.value : 'adc',
        serviceAccountKeyPath: cfgSaPath ? cfgSaPath.value.trim() : '',
        apiKey: cfgApiKey ? cfgApiKey.value.trim() : '',
        claudeApiKey: cfgClaudeKey ? cfgClaudeKey.value.trim() : '',
        openAiApiKey: cfgOpenAiKey ? cfgOpenAiKey.value.trim() : '',
        thinkingLevel: currentThinkingLevel
      };
      vscode.postMessage({ type: 'saveConfig', config });
      closeSettings();
    });
  }

  if (testConnBtn) {
    testConnBtn.addEventListener('click', () => {
      const config = {
        provider: cfgProvider ? cfgProvider.value : 'vertex',
        modelId: cfgModelId ? cfgModelId.value : 'gemini-4-argon',
        projectId: cfgProjectId ? cfgProjectId.value.trim() : '',
        location: cfgLocation ? cfgLocation.value.trim() || 'global' : 'global',
        authMethod: cfgAuthMethod ? cfgAuthMethod.value : 'adc',
        serviceAccountKeyPath: cfgSaPath ? cfgSaPath.value.trim() : '',
        apiKey: cfgApiKey ? cfgApiKey.value.trim() : '',
        claudeApiKey: cfgClaudeKey ? cfgClaudeKey.value.trim() : '',
        openAiApiKey: cfgOpenAiKey ? cfgOpenAiKey.value.trim() : '',
        thinkingLevel: 'low'
      };
      if (testConnResult) {
        testConnResult.className = 'test-result';
        testConnResult.style.display = 'block';
        const pName = config.provider === 'claude' ? 'Claude' : (config.provider === 'openai' ? 'OpenAI' : 'Gemini 4 Argon');
        testConnResult.textContent = `Testing connection to ${pName}...`;
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
  function appendMessage(role, content, attachments) {
    if (!chatContainer) return;
    const msgDiv = document.createElement('div');
    msgDiv.className = `message ${role}`;

    // Render attachments if present
    if (Array.isArray(attachments) && attachments.length > 0) {
      const attWrap = document.createElement('div');
      attWrap.className = 'message-attachments';
      attachments.forEach((att) => {
        const item = document.createElement('div');
        item.className = 'message-attachment-item';

        if (att.mimeType && att.mimeType.startsWith('image/') && (att.thumbUrl || att.base64Data)) {
          const img = document.createElement('img');
          img.className = 'message-attachment-thumb';
          img.src = att.thumbUrl || `data:${att.mimeType};base64,${att.base64Data}`;
          img.alt = att.name || 'Attachment';
          item.appendChild(img);
        } else {
          const iconSpan = document.createElement('span');
          iconSpan.style.display = 'inline-flex';
          iconSpan.style.alignItems = 'center';
          iconSpan.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>';
          item.appendChild(iconSpan);
        }

        const details = document.createElement('div');
        details.className = 'message-attachment-details';

        const nameSpan = document.createElement('span');
        nameSpan.className = 'message-attachment-name';
        nameSpan.textContent = att.name || 'file';
        details.appendChild(nameSpan);

        if (att.size) {
          const sizeSpan = document.createElement('span');
          sizeSpan.className = 'message-attachment-size';
          sizeSpan.textContent = formatFileSize(att.size);
          details.appendChild(sizeSpan);
        }

        item.appendChild(details);
        attWrap.appendChild(item);
      });
      msgDiv.appendChild(attWrap);
    }

    if (role === 'user') {
      const textSpan = document.createElement('div');
      textSpan.textContent = content;
      msgDiv.appendChild(textSpan);
    } else {
      const bodySpan = document.createElement('div');
      bodySpan.innerHTML = formatMarkdown(content);
      attachCodeCopyListeners(bodySpan);
      msgDiv.appendChild(bodySpan);
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
        <div class="code-block-container" data-language="${escapeHtml(language)}">
          <div class="code-header">
            <span class="code-lang">📄 ${escapeHtml(language)}</span>
            <div class="code-header-actions">
              <button class="code-action-btn open-code-btn" type="button" title="Open in Editor">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                <span>Open</span>
              </button>
              <button class="code-action-btn download-code-btn" type="button" title="Download File">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                <span>Download</span>
              </button>
              <button class="copy-code-btn" type="button" aria-label="Copy code block">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                <span>Copy</span>
              </button>
            </div>
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


  const LANG_EXT_MAP = {
    python: '.py', py: '.py',
    javascript: '.js', js: '.js', jsx: '.jsx',
    typescript: '.ts', ts: '.ts', tsx: '.tsx',
    html: '.html', css: '.css', json: '.json',
    markdown: '.md', md: '.md',
    bash: '.sh', sh: '.sh', shell: '.sh',
    powershell: '.ps1', ps1: '.ps1',
    sql: '.sql', yaml: '.yaml', yml: '.yml',
    rust: '.rs', rs: '.rs',
    go: '.go', c: '.c', cpp: '.cpp',
    java: '.java', kotlin: '.kt',
    xml: '.xml', svg: '.svg'
  };

  function downloadBrowserBlob(data, fileName) {
    try {
      const blob = new Blob([data], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      console.warn('Browser blob download failed:', e);
    }
  }

  function appendFileArtifactCard(result) {
    if (!chatContainer || !result) return;
    const card = document.createElement('div');
    card.className = 'file-artifact-card';
    const filePath = result.path || 'file.txt';
    const fileName = filePath.split(/[\\/]/).pop();
    const bytes = result.bytesWritten || 0;
    const sizeStr = bytes > 1024 ? (bytes / 1024).toFixed(1) + ' KB' : bytes + ' B';

    card.innerHTML = `
      <div class="artifact-card-inner">
        <div class="artifact-card-left">
          <div class="artifact-card-icon">📄</div>
          <div class="artifact-card-meta">
            <span class="artifact-card-filename">${escapeHtml(fileName)}</span>
            <span class="artifact-card-path">${escapeHtml(filePath)} • ${sizeStr}</span>
          </div>
        </div>
        <div class="artifact-card-buttons">
          <button class="artifact-btn open-file-btn" type="button" title="Open in Editor">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
            <span>Open in Editor</span>
          </button>
          <button class="artifact-btn download-file-btn" type="button" title="Download File">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            <span>Download</span>
          </button>
        </div>
      </div>
    `;

    const openBtn = card.querySelector('.open-file-btn');
    if (openBtn) {
      openBtn.addEventListener('click', () => {
        vscode.postMessage({ type: 'openFile', path: filePath });
      });
    }

    const downloadBtn = card.querySelector('.download-file-btn');
    if (downloadBtn) {
      downloadBtn.addEventListener('click', () => {
        vscode.postMessage({ type: 'downloadWorkspaceFile', path: filePath });
      });
    }

    chatContainer.appendChild(card);
    chatContainer.scrollTop = chatContainer.scrollHeight;
  }

  function attachCodeCopyListeners(container) {
    // 1. Copy Buttons
    const copyBtns = container.querySelectorAll('.copy-code-btn');
    copyBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        const pre = btn.closest('.code-block-container').querySelector('pre code');
        if (!pre) return;
        const textToCopy = pre.textContent;
        navigator.clipboard.writeText(textToCopy).then(() => {
          btn.classList.add('copied');
          btn.innerHTML = `
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
            <span>Copied!</span>
          `;
          setTimeout(() => {
            btn.classList.remove('copied');
            btn.innerHTML = `
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
              <span>Copy</span>
            `;
          }, 2000);
        });
      });
    });

    // 2. Open in Editor Buttons
    const openBtns = container.querySelectorAll('.open-code-btn');
    openBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        const wrap = btn.closest('.code-block-container');
        const pre = wrap ? wrap.querySelector('pre code') : null;
        if (!pre) return;
        const lang = wrap.getAttribute('data-language') || 'plaintext';
        vscode.postMessage({
          type: 'openNewDocument',
          content: pre.textContent,
          language: lang
        });
      });
    });

    // 3. Download File Buttons
    const dlBtns = container.querySelectorAll('.download-code-btn');
    dlBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        const wrap = btn.closest('.code-block-container');
        const pre = wrap ? wrap.querySelector('pre code') : null;
        if (!pre) return;
        const lang = (wrap.getAttribute('data-language') || 'file').toLowerCase();
        const ext = LANG_EXT_MAP[lang] || '.txt';
        const fileName = (lang !== 'file' && lang !== 'code' ? lang : 'script') + ext;
        const codeText = pre.textContent;

        // Trigger both browser blob download and VS Code save dialog
        downloadBrowserBlob(codeText, fileName);
        vscode.postMessage({
          type: 'downloadFile',
          content: codeText,
          fileName: fileName
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
        if (cfgProvider) cfgProvider.value = cfg.provider || 'vertex';
        if (cfgModelId) cfgModelId.value = cfg.modelId || 'gemini-4-argon';
        if (cfgClaudeKey) cfgClaudeKey.value = cfg.claudeApiKey || '';
        if (cfgOpenAiKey) cfgOpenAiKey.value = cfg.openAiApiKey || '';

        updateAuthFieldsVisibility(cfg.authMethod || 'adc');
        updateProviderFieldsVisibility(cfg.provider || 'vertex');

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
            msg.currentSession.messages.forEach((m) => appendMessage(m.role, m.content, m.attachments));
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
          sess.messages.forEach((m) => appendMessage(m.role, m.content, m.attachments));
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
        if (msg.tool === 'write_file' && msg.success && msg.result) {
          appendFileArtifactCard(msg.result);
        }
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

  // Request initial state on script load
  try {
    vscode.postMessage({ type: 'getInitialState' });
  } catch (_) {}

})();
