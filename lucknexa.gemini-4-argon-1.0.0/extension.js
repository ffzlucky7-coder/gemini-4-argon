/**
 * extension.js
 * Main entry point for the Gemini 4 Argon Autonomous Agent Extension.
 * Creator: Lucky Kuntal
 * Features:
 *  - Persistent Multi-Session Chat History & Memory
 *  - Autonomous Workspace Tools & Terminal Execution
 *  - Adaptive Thinking Mode (Low / Medium / High)
 *  - Universal GCP Multi-Auth (ADC, Service Account, API Key)
 */

const vscode = require('vscode');
const path = require('path');
const fs = require('fs');
const { GeminiAgent } = require('./agentLoop');
const { testConnection, getAdcFilePath } = require('./authProvider');

const SESSIONS_STORAGE_KEY = 'gemini4argon_sessions_store_v1';
const CURRENT_SESSION_ID_KEY = 'gemini4argon_active_session_id';

let currentAgent = null;

function getExtensionConfig() {
  const cfg = vscode.workspace.getConfiguration('gemini4Argon');
  return {
    projectId: cfg.get('projectId') || 'planar-hangout-510114-u1',
    location: cfg.get('location') || 'global',
    thinkingLevel: cfg.get('thinkingLevel') || 'high',
    authMethod: cfg.get('authMethod') || 'adc',
    serviceAccountKeyPath: cfg.get('serviceAccountKeyPath') || '',
    apiKey: cfg.get('apiKey') || ''
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
      thinkingLevel: 'high'
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

          // Sync agent's memory with active session
          if (activeSession && activeSession.messages && activeSession.messages.length > 0) {
            currentAgent.history = activeSession.messages.map(m => ({
              role: m.role,
              parts: [{ text: m.content }]
            }));
          } else {
            currentAgent.clearHistory();
          }

          webview.postMessage({
            type: 'initState',
            config: getExtensionConfig(),
            workspaceRoot: workspaceRoot,
            adcDetected: Boolean(adcFile),
            adcPath: adcFile || 'Not detected',
            sessions: sessions.map(s => ({
              id: s.id,
              title: s.title,
              createdAt: s.createdAt,
              updatedAt: s.updatedAt,
              messageCount: (s.messages || []).length,
              thinkingLevel: s.thinkingLevel || 'high'
            })),
            currentSession: activeSession
          });
          break;
        }

        case 'sendMessage': {
          if (!message.text || !message.text.trim()) return;
          const userPrompt = message.text.trim();
          const thinkingLevel = message.thinkingLevel || activeSession.thinkingLevel || 'high';

          currentAgent.updateConfig({ thinkingLevel });

          // Record user message into session
          activeSession.messages.push({
            role: 'user',
            content: userPrompt,
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
          });

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
            thinkingLevel: getExtensionConfig().thinkingLevel || 'high'
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
            if (target.messages && target.messages.length > 0) {
              currentAgent.history = target.messages.map(m => ({
                role: m.role,
                parts: [{ text: m.content }]
              }));
            } else {
              currentAgent.clearHistory();
            }

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
          const newCfg = message.config;
          const configTarget = vscode.ConfigurationTarget.Global;
          const vsCfg = vscode.workspace.getConfiguration('gemini4Argon');
          if (newCfg.projectId) await vsCfg.update('projectId', newCfg.projectId, configTarget);
          if (newCfg.location) await vsCfg.update('location', newCfg.location, configTarget);
          if (newCfg.thinkingLevel) await vsCfg.update('thinkingLevel', newCfg.thinkingLevel, configTarget);
          if (newCfg.authMethod) await vsCfg.update('authMethod', newCfg.authMethod, configTarget);
          if (newCfg.serviceAccountKeyPath !== undefined) await vsCfg.update('serviceAccountKeyPath', newCfg.serviceAccountKeyPath, configTarget);
          if (newCfg.apiKey !== undefined) await vsCfg.update('apiKey', newCfg.apiKey, configTarget);

          currentAgent.updateConfig(getExtensionConfig());
          webview.postMessage({
            type: 'configSaved',
            config: getExtensionConfig()
          });
          vscode.window.showInformationMessage('Gemini 4 Argon configuration updated.');
          break;
        }

        case 'testConnection': {
          const cfg = message.config || getExtensionConfig();
          webview.postMessage({ type: 'testingConnection' });
          const res = await testConnection(cfg);
          webview.postMessage({
            type: 'testConnectionResult',
            result: res
          });
          break;
        }

        case 'selectKeyFile': {
          const fileUris = await vscode.window.showOpenDialog({
            canSelectMany: false,
            openLabel: 'Select Service Account JSON Key',
            filters: { 'JSON Files': ['json'] }
          });
          if (fileUris && fileUris[0]) {
            webview.postMessage({
              type: 'keyFileSelected',
              path: fileUris[0].fsPath
            });
          }
          break;
        }
      }
    });
  }

  sendPrompt(prompt) {
    if (this.view) {
      this.view.show(true);
      this.view.webview.postMessage({
        type: 'externalPrompt',
        prompt: prompt
      });
    }
  }

  getHtmlForWebview(webview) {
    const mediaPath = path.join(this.context.extensionPath, 'media');
    const styleUri = webview.asWebviewUri(vscode.Uri.file(path.join(mediaPath, 'main.css')));
    const scriptUri = webview.asWebviewUri(vscode.Uri.file(path.join(mediaPath, 'main.js')));
    const iconUri = webview.asWebviewUri(vscode.Uri.file(path.join(mediaPath, 'icon.svg')));

    const htmlPath = path.join(mediaPath, 'main.html');
    let html = fs.readFileSync(htmlPath, 'utf8');

    html = html.replace(/{{styleUri}}/g, styleUri.toString());
    html = html.replace(/{{scriptUri}}/g, scriptUri.toString());
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

  // Command: Open Chat
  context.subscriptions.push(
    vscode.commands.registerCommand('gemini-4-argon.openChat', () => {
      vscode.commands.executeCommand('gemini-4-argon.chatView.focus');
    })
  );

  // Command: Audit Workspace
  context.subscriptions.push(
    vscode.commands.registerCommand('gemini-4-argon.auditWorkspace', () => {
      const prompt = 'Please perform a comprehensive autonomous audit of this workspace. First use get_workspace_structure and list_dir to discover the architecture, then inspect key files, identify technical debt, bugs, performance bottlenecks, and security considerations, and provide an actionable remediation roadmap.';
      provider.sendPrompt(prompt);
    })
  );

  // Command: Audit Current File
  context.subscriptions.push(
    vscode.commands.registerCommand('gemini-4-argon.auditCurrentFile', () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showWarningMessage('No active file open to audit.');
        return;
      }
      const filePath = editor.document.uri.fsPath;
      const workspaceFolders = vscode.workspace.workspaceFolders;
      const relPath = workspaceFolders ? path.relative(workspaceFolders[0].uri.fsPath, filePath) : filePath;
      const prompt = `Please perform a thorough audit and deep code review of the active file "${relPath}". Use read_file to inspect it, verify edge cases, type safety, algorithmic efficiency, and suggest precise improvements or refactoring.`;
      provider.sendPrompt(prompt);
    })
  );

  // Command: Configure Credentials
  context.subscriptions.push(
    vscode.commands.registerCommand('gemini-4-argon.configureCredentials', () => {
      if (provider.view) {
        provider.view.show(true);
        provider.view.webview.postMessage({ type: 'openSettings' });
      }
    })
  );

  // Command: Open Setup & Free Credits Guide
  context.subscriptions.push(
    vscode.commands.registerCommand('gemini-4-argon.openGuide', () => {
      if (provider.view) {
        provider.view.show(true);
        provider.view.webview.postMessage({ type: 'openGuide' });
      }
    })
  );

  // Sync config updates
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration('gemini4Argon')) {
        const updated = getExtensionConfig();
        if (currentAgent) currentAgent.updateConfig(updated);
        if (provider.view) {
          provider.view.webview.postMessage({
            type: 'configUpdated',
            config: updated
          });
        }
      }
    })
  );
}

function deactivate() {
  if (currentAgent) currentAgent.abort();
}

module.exports = {
  activate,
  deactivate
};
