/**
 * extension.js
 * Main entry point for the Gemini 4 Argon Autonomous Agent Extension.
 * Creator: Lucky Kuntal (https://github.com/ffzlucky7-coder)
 * Features:
 *  - Persistent Multi-Session Chat History & Memory
 *  - Autonomous Workspace Tools & Terminal Execution
 *  - Multimodal Media & File Attachment Support (Images, Audio, PDF, Code)
 *  - Multi-Provider Adapter (Gemini 4 Argon, Claude 5.x, GPT-6)
 *  - Adaptive Thinking Mode (Low / Medium / High)
 *  - Universal GCP Multi-Auth (ADC, Service Account, API Key)
 */

const vscode = require('vscode');
const path = require('path');
const fs = require('fs');
const { GeminiAgent } = require('./agentLoop');
const { getAdcFilePath, getAuthHeaders } = require('./authProvider');

const SESSIONS_STORAGE_KEY = 'gemini4argon_sessions_store_v1';
const CURRENT_SESSION_ID_KEY = 'gemini4argon_active_session_id';

let currentAgent = null;

function getExtensionConfig() {
  const cfg = vscode.workspace.getConfiguration('gemini4Argon');
  return {
    projectId: cfg.get('projectId') || process.env.GEMINI_PROJECT_ID || '',
    location: cfg.get('location') || 'global',
    thinkingLevel: cfg.get('thinkingLevel') || 'high',
    authMethod: cfg.get('authMethod') || 'adc',
    serviceAccountKeyPath: cfg.get('serviceAccountKeyPath') || '',
    apiKey: cfg.get('apiKey') || '',
    provider: cfg.get('provider') || 'vertex',
    modelId: cfg.get('modelId') || 'gemini-4-argon',
    claudeApiKey: cfg.get('claudeApiKey') || '',
    openAiApiKey: cfg.get('openAiApiKey') || ''
  };
}

function getStoredSessions(context) {
  let sessions = context.globalState.get(SESSIONS_STORAGE_KEY);
  if (!Array.isArray(sessions) || sessions.length === 0) {
    const initialSession = {
      id: 'sess_' + Date.now(),
      title: 'New Conversation',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      messages: [],
      thinkingLevel: 'high',
      provider: 'vertex',
      modelId: 'gemini-4-argon'
    };
    sessions = [initialSession];
    context.globalState.update(SESSIONS_STORAGE_KEY, sessions);
    context.globalState.update(CURRENT_SESSION_ID_KEY, initialSession.id);
  }
  return sessions;
}

function saveStoredSessions(context, sessions) {
  return context.globalState.update(SESSIONS_STORAGE_KEY, sessions);
}

function getActiveSessionId(context) {
  return context.globalState.get(CURRENT_SESSION_ID_KEY);
}

function setActiveSessionId(context, id) {
  return context.globalState.update(CURRENT_SESSION_ID_KEY, id);
}

async function testConnectionMulti(config) {
  const provider = (config.provider || 'vertex').toLowerCase();

  if (provider === 'claude') {
    const key = config.claudeApiKey || process.env.ANTHROPIC_API_KEY;
    if (!key) return { success: false, message: 'Anthropic API key required.' };
    const start = Date.now();
    try {
      const resp = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': key,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: config.modelId || 'claude-opus-5.5',
          max_tokens: 10,
          messages: [{ role: 'user', content: 'Ping' }]
        })
      });
      const latency = Date.now() - start;
      if (resp.ok) {
        return { success: true, message: `Connected to Claude (${config.modelId || 'claude-opus-5.5'})`, latencyMs: latency };
      }
      return { success: false, message: `Claude API returned HTTP ${resp.status}` };
    } catch (err) {
      return { success: false, message: err.message };
    }
  } else if (provider === 'openai') {
    const key = config.openAiApiKey || process.env.OPENAI_API_KEY;
    if (!key) return { success: false, message: 'OpenAI API key required.' };
    const start = Date.now();
    try {
      const resp = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${key}`
        },
        body: JSON.stringify({
          model: config.modelId || 'gpt-6-astra',
          max_tokens: 10,
          messages: [{ role: 'user', content: 'Ping' }]
        })
      });
      const latency = Date.now() - start;
      if (resp.ok) {
        return { success: true, message: `Connected to OpenAI (${config.modelId || 'gpt-6-astra'})`, latencyMs: latency };
      }
      return { success: false, message: `OpenAI API returned HTTP ${resp.status}` };
    } catch (err) {
      return { success: false, message: err.message };
    }
  } else {
    // Vertex AI
    const startTime = Date.now();
    try {
      const headers = await getAuthHeaders(config);
      const projectId = config.projectId || process.env.GEMINI_PROJECT_ID || '';
    if (!projectId) {
      return { success: false, message: 'Google Cloud Project ID is not configured. Please enter your Project ID in Settings (⚙️).' };
    }
      const location = config.location || 'global';
      const url = `https://aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/publishers/google/models/gemini-4-argon:generateContent`;
      const resp = await fetch(url, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: 'Respond with OK' }] }],
          generationConfig: { maxOutputTokens: 10, thinkingConfig: { thinkingLevel: 'low' } }
        })
      });
      const latency = Date.now() - startTime;
      if (resp.ok) {
        return { success: true, message: 'Successfully connected to Gemini 4 Argon!', latencyMs: latency };
      }
      const err = await resp.text();
      return { success: false, message: `Vertex AI error: ${err}` };
    } catch (err) {
      return { success: false, message: err.message };
    }
  }
}

class GeminiChatViewProvider {
  constructor(context) {
    this.context = context;
    this.view = null;
  }

  resolveWebviewView(webviewView, context, token) {
    this.view = webviewView;
    const webview = webviewView.webview;

    webview.options = {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.file(path.join(this.context.extensionPath, 'media'))
      ]
    };

    const workspaceFolders = vscode.workspace.workspaceFolders;
    const workspaceRoot = workspaceFolders && workspaceFolders.length > 0
      ? workspaceFolders[0].uri.fsPath
      : process.cwd();

    const config = getExtensionConfig();
    currentAgent = new GeminiAgent(workspaceRoot, config);

    webview.html = this.getHtmlForWebview(webview);

    webview.onDidReceiveMessage(async (message) => {
      const sessions = getStoredSessions(this.context);
      let activeSessionId = getActiveSessionId(this.context) || sessions[0].id;
      let activeSession = sessions.find(s => s.id === activeSessionId) || sessions[0];

      switch (message.type) {
        case 'getInitialState': {
          const adcFile = getAdcFilePath();
          const adcDetected = !!adcFile;

          webview.postMessage({
            type: 'initState',
            config: getExtensionConfig(),
            adcDetected: adcDetected,
            adcPath: adcFile || '',
            sessions: sessions.map(s => ({
              id: s.id,
              title: s.title,
              createdAt: s.createdAt,
              updatedAt: s.updatedAt,
              messageCount: (s.messages || []).length,
              thinkingLevel: s.thinkingLevel || 'high',
              provider: s.provider || 'vertex'
            })),
            currentSession: activeSession
          });
          break;
        }

        case 'sendMessage': {
          const hasText = message.text && message.text.trim().length > 0;
          const attachments = message.attachments || [];
          if (!hasText && attachments.length === 0) return;
          const userPrompt = hasText ? message.text.trim() : 'Inspect the attached file(s) and provide analysis.';
          const thinkingLevel = message.thinkingLevel || activeSession.thinkingLevel || 'high';

          currentAgent.updateConfig({ thinkingLevel });

          // Record user message into session
          activeSession.messages.push({
            role: 'user',
            content: userPrompt,
            attachments: attachments,
            timestamp: Date.now()
          });

          // Auto-generate title for first user prompt
          if (activeSession.title === 'New Conversation' || activeSession.title.startsWith('Conversation')) {
            activeSession.title = userPrompt.length > 38 ? userPrompt.slice(0, 35) + '...' : userPrompt;
          }
          activeSession.updatedAt = Date.now();
          activeSession.thinkingLevel = thinkingLevel;

          await saveStoredSessions(this.context, sessions);

          // Stream through agent loop
          let responseText = '';
          await currentAgent.run(userPrompt, (evt) => {
            if (evt.type === 'text') {
              responseText = evt.content;
            }
            webview.postMessage(evt);
          }, attachments);

          if (responseText) {
            activeSession.messages.push({
              role: 'model',
              content: responseText,
              timestamp: Date.now()
            });
            activeSession.updatedAt = Date.now();
            await saveStoredSessions(this.context, sessions);
          }

          // Send updated session list
          webview.postMessage({
            type: 'sessionsUpdated',
            sessions: sessions.map(s => ({
              id: s.id,
              title: s.title,
              createdAt: s.createdAt,
              updatedAt: s.updatedAt,
              messageCount: (s.messages || []).length,
              thinkingLevel: s.thinkingLevel || 'high'
            })),
            activeSessionId: activeSession.id
          });
          break;
        }

        case 'newChat': {
          const newSession = {
            id: 'sess_' + Date.now(),
            title: 'New Conversation',
            createdAt: Date.now(),
            updatedAt: Date.now(),
            messages: [],
            thinkingLevel: getExtensionConfig().thinkingLevel || 'high',
            provider: getExtensionConfig().provider || 'vertex'
          };
          sessions.unshift(newSession);
          await saveStoredSessions(this.context, sessions);
          await setActiveSessionId(this.context, newSession.id);

          currentAgent.clearHistory();

          webview.postMessage({
            type: 'sessionSwitched',
            session: newSession,
            sessions: sessions.map(s => ({
              id: s.id,
              title: s.title,
              createdAt: s.createdAt,
              updatedAt: s.updatedAt,
              messageCount: (s.messages || []).length,
              thinkingLevel: s.thinkingLevel || 'high'
            }))
          });
          break;
        }

        case 'switchSession': {
          const target = sessions.find(s => s.id === message.sessionId);
          if (target) {
            await setActiveSessionId(this.context, target.id);
            currentAgent.clearHistory();
            currentAgent.updateConfig({ thinkingLevel: target.thinkingLevel || 'high' });

            target.messages.forEach(m => {
              currentAgent.history.push({
                role: m.role,
                parts: [{ text: m.content }]
              });
            });

            webview.postMessage({
              type: 'sessionSwitched',
              session: target,
              sessions: sessions.map(s => ({
                id: s.id,
                title: s.title,
                createdAt: s.createdAt,
                updatedAt: s.updatedAt,
                messageCount: (s.messages || []).length,
                thinkingLevel: s.thinkingLevel || 'high'
              }))
            });
          }
          break;
        }

        case 'deleteSession': {
          const idx = sessions.findIndex(s => s.id === message.sessionId);
          if (idx !== -1) {
            sessions.splice(idx, 1);
            if (sessions.length === 0) {
              const freshSession = {
                id: 'sess_' + Date.now(),
                title: 'New Conversation',
                createdAt: Date.now(),
                updatedAt: Date.now(),
                messages: [],
                thinkingLevel: 'high'
              };
              sessions.push(freshSession);
            }
            await saveStoredSessions(this.context, sessions);
            const nextActive = sessions[0];
            await setActiveSessionId(this.context, nextActive.id);

            currentAgent.history = nextActive.messages.map(m => ({
              role: m.role,
              parts: [{ text: m.content }]
            }));

            webview.postMessage({
              type: 'sessionSwitched',
              session: nextActive,
              sessions: sessions.map(s => ({
                id: s.id,
                title: s.title,
                createdAt: s.createdAt,
                updatedAt: s.updatedAt,
                messageCount: (s.messages || []).length,
                thinkingLevel: s.thinkingLevel || 'high'
              }))
            });
          }
          break;
        }

        case 'clearAllHistory': {
          const cleanSession = {
            id: 'sess_' + Date.now(),
            title: 'New Conversation',
            createdAt: Date.now(),
            updatedAt: Date.now(),
            messages: [],
            thinkingLevel: 'high'
          };
          const freshSessions = [cleanSession];
          await saveStoredSessions(this.context, freshSessions);
          await setActiveSessionId(this.context, cleanSession.id);
          currentAgent.clearHistory();

          webview.postMessage({
            type: 'sessionSwitched',
            session: cleanSession,
            sessions: freshSessions.map(s => ({
              id: s.id,
              title: s.title,
              createdAt: s.createdAt,
              updatedAt: s.updatedAt,
              messageCount: 0,
              thinkingLevel: 'high'
            }))
          });
          break;
        }

        case 'openExternalUrl': {
          if (message.url) {
            vscode.env.openExternal(vscode.Uri.parse(message.url));
          }
          break;
        }

        case 'abort': {
          if (currentAgent) currentAgent.abort();
          break;
        }

        case 'clearChat': {
          if (activeSession) {
            activeSession.messages = [];
            activeSession.updatedAt = Date.now();
            await saveStoredSessions(this.context, sessions);
          }
          if (currentAgent) currentAgent.clearHistory();
          webview.postMessage({ type: 'cleared' });
          break;
        }

        case 'saveConfig': {
          const newCfg = message.config || {};
          const configTarget = vscode.ConfigurationTarget.Global;
          const vsCfg = vscode.workspace.getConfiguration('gemini4Argon');
          if (newCfg.projectId) await vsCfg.update('projectId', newCfg.projectId, configTarget);
          if (newCfg.location) await vsCfg.update('location', newCfg.location, configTarget);
          if (newCfg.thinkingLevel) await vsCfg.update('thinkingLevel', newCfg.thinkingLevel, configTarget);
          if (newCfg.authMethod) await vsCfg.update('authMethod', newCfg.authMethod, configTarget);
          if (newCfg.serviceAccountKeyPath !== undefined) await vsCfg.update('serviceAccountKeyPath', newCfg.serviceAccountKeyPath, configTarget);
          if (newCfg.apiKey !== undefined) await vsCfg.update('apiKey', newCfg.apiKey, configTarget);
          if (newCfg.provider !== undefined) await vsCfg.update('provider', newCfg.provider, configTarget);
          if (newCfg.modelId !== undefined) await vsCfg.update('modelId', newCfg.modelId, configTarget);
          if (newCfg.claudeApiKey !== undefined) await vsCfg.update('claudeApiKey', newCfg.claudeApiKey, configTarget);
          if (newCfg.openAiApiKey !== undefined) await vsCfg.update('openAiApiKey', newCfg.openAiApiKey, configTarget);

          currentAgent.updateConfig(getExtensionConfig());
          webview.postMessage({
            type: 'configSaved',
            config: getExtensionConfig()
          });
          vscode.window.showInformationMessage('Configuration updated successfully.');
          break;
        }

        case 'testConnection': {
          const cfg = message.config || getExtensionConfig();
          webview.postMessage({ type: 'testingConnection' });
          const res = await testConnectionMulti(cfg);
          webview.postMessage({
            type: 'connectionTestResult',
            success: res.success,
            message: res.message,
            latencyMs: res.latencyMs
          });
          break;
        }

        case 'selectKeyFile': {
          const files = await vscode.window.showOpenDialog({
            canSelectMany: false,
            openLabel: 'Select Service Account Key',
            filters: { 'JSON Files': ['json'] }
          });
          if (files && files.length > 0) {
            webview.postMessage({
              type: 'keyFileSelected',
              path: files[0].fsPath
            });
          }
          break;
        }
      }
    });
  }

  getHtmlForWebview(webview) {
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.file(path.join(this.context.extensionPath, 'media', 'main.js'))
    );
    const styleUri = webview.asWebviewUri(
      vscode.Uri.file(path.join(this.context.extensionPath, 'media', 'main.css'))
    );
    const iconUri = webview.asWebviewUri(
      vscode.Uri.file(path.join(this.context.extensionPath, 'media', 'icon.svg'))
    );

    const htmlPath = path.join(this.context.extensionPath, 'media', 'main.html');
    let html = fs.readFileSync(htmlPath, 'utf8');

    html = html.replace(/{{scriptUri}}/g, scriptUri.toString());
    html = html.replace(/{{styleUri}}/g, styleUri.toString());
    html = html.replace(/{{iconUri}}/g, iconUri.toString());

    return html;
  }
}

function activate(context) {
  const provider = new GeminiChatViewProvider(context);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider('gemini-4-argon.chatView', provider, {
      webviewOptions: { retainContextWhenHidden: true }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('gemini-4-argon.openChat', () => {
      vscode.commands.executeCommand('workbench.view.extension.gemini-4-argon-container');
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('gemini-4-argon.auditWorkspace', () => {
      vscode.commands.executeCommand('workbench.view.extension.gemini-4-argon-container');
      if (provider.view) {
        provider.view.webview.postMessage({
          type: 'externalPrompt',
          prompt: 'Audit the full workspace for bugs, security vulnerabilities, and architectural bottlenecks.'
        });
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('gemini-4-argon.auditCurrentFile', () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showWarningMessage('No active editor file to audit.');
        return;
      }
      const filename = path.basename(editor.document.fileName);
      vscode.commands.executeCommand('workbench.view.extension.gemini-4-argon-container');
      if (provider.view) {
        provider.view.webview.postMessage({
          type: 'externalPrompt',
          prompt: `Audit the file "${filename}" for logic issues, performance improvements, and edge-case testing.`
        });
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('gemini-4-argon.configureCredentials', () => {
      vscode.commands.executeCommand('workbench.view.extension.gemini-4-argon-container');
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('gemini-4-argon.openGuide', () => {
      vscode.commands.executeCommand('workbench.view.extension.gemini-4-argon-container');
    })
  );
}

function deactivate() {
  if (currentAgent) {
    currentAgent.abort();
  }
}

module.exports = { activate, deactivate };
