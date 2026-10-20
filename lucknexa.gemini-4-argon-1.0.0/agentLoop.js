/**
 * agentLoop.js
 * Multi-turn autonomous agent execution loop powered by Google Gemini 4 Argon.
 * Features:
 *  - Full workspace autonomous tool orchestration
 *  - Low / Medium / High Thinking Level control
 *  - Real-time event streaming to Webview UI
 *  - Automatic error recovery and abort handling
 */

const { getAuthHeaders } = require('./authProvider');
const { vertexAIToolDeclarations, executeTool } = require('./tools');

const SYSTEM_INSTRUCTION = `You are Gemini 4 Argon, Google's flagship reasoning AI model, operating as an autonomous software engineer and architect inside the Antigravity IDE.
You have FULL autonomous access to the user's workspace:
- You can inspect files (read_file), search the codebase (search_code), and explore directories (list_dir, get_workspace_structure).
- You can edit existing code (edit_file) and create new files (write_file). Backups are created automatically.
- You can run terminal commands (run_command) such as running test suites (pytest, npm test), linters, git commands, and builds.

GUIDELINES:
1. Always investigate the codebase first using your tools before jumping to conclusions.
2. When asked to audit or debug, read the relevant files, search for usages, run tests if appropriate, and identify exact root causes.
3. When writing or editing code, write clean, production-grade, bug-free implementations.
4. When presenting information about the project or files, provide clear, structured, readable Markdown with concise headings and bullet points. Never display raw shell commands or internal tool noise; present the clean, direct synthesis and findings to the user.
5. Keep the user informed with clear, structured explanations of what you found and what changes you made.`;

class GeminiAgent {
  constructor(workspaceRoot, config) {
    this.workspaceRoot = workspaceRoot;
    this.config = config || {};
    this.history = [];
    this.abortController = null;
  }

  updateConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };
  }

  clearHistory() {
    this.history = [];
  }

  abort() {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
  }

  async run(prompt, onEvent) {
    this.abortController = new AbortController();
    const signal = this.abortController.signal;

    const projectId = this.config.projectId || 'planar-hangout-510114-u1';
    const location = this.config.location || 'global';
    const thinkingLevel = (this.config.thinkingLevel || 'high').toLowerCase();

    const url = `https://aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/publishers/google/models/gemini-4-argon:generateContent`;

    // Append new user message to conversation history
    this.history.push({
      role: 'user',
      parts: [{ text: prompt }]
    });

    onEvent({
      type: 'status',
      status: 'thinking',
      message: `Gemini 4 Argon is thinking (${thinkingLevel.toUpperCase()} reasoning mode)...`
    });

    const MAX_TURNS = 25;
    let turnCount = 0;

    while (turnCount < MAX_TURNS) {
      turnCount++;

      if (signal.aborted) {
        onEvent({ type: 'error', error: 'Execution cancelled by user.' });
        return;
      }

      let headers;
      try {
        headers = await getAuthHeaders(this.config);
      } catch (authErr) {
        onEvent({ type: 'error', error: `Authentication failed: ${authErr.message}` });
        return;
      }

      const requestBody = {
        systemInstruction: {
          parts: [{ text: SYSTEM_INSTRUCTION }]
        },
        contents: this.history,
        tools: [
          {
            functionDeclarations: vertexAIToolDeclarations
          }
        ],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 8192,
          thinkingConfig: {
            thinkingLevel: thinkingLevel
          }
        }
      };

      let resp;
      try {
        resp = await fetch(url, {
          method: 'POST',
          headers: headers,
          body: JSON.stringify(requestBody),
          signal: signal
        });
      } catch (fetchErr) {
        if (signal.aborted) {
          onEvent({ type: 'error', error: 'Request was cancelled.' });
          return;
        }
        onEvent({ type: 'error', error: `Network error connecting to Gemini 4 Argon: ${fetchErr.message}` });
        return;
      }

      if (!resp.ok) {
        const errJson = await resp.json().catch(() => ({}));
        const msg = errJson.error?.message || `HTTP ${resp.status}: ${resp.statusText}`;
        onEvent({ type: 'error', error: `Vertex AI Error (${resp.status}): ${msg}` });
        return;
      }

      const responseData = await resp.json();
      const candidate = responseData.candidates?.[0];

      if (!candidate || !candidate.content || !candidate.content.parts) {
        onEvent({ type: 'error', error: 'Empty response received from Gemini 4 Argon.' });
        return;
      }

      const parts = candidate.content.parts;
      const functionCalls = parts.filter(p => p.functionCall);

      // Record model response into history
      this.history.push({
        role: 'model',
        parts: parts
      });

      // If no function calls, the model produced final text response
      if (functionCalls.length === 0) {
        const textParts = parts.filter(p => p.text).map(p => p.text).join('\n');
        onEvent({
          type: 'text',
          content: textParts,
          usage: responseData.usageMetadata
        });
        onEvent({ type: 'status', status: 'idle', message: 'Ready' });
        return;
      }

      // Execute each function call autonomously
      const responseParts = [];

      for (const part of functionCalls) {
        if (signal.aborted) return;

        const call = part.functionCall;
        const callId = call.id || `call_${Date.now()}`;

        onEvent({
          type: 'tool_start',
          tool: call.name,
          args: call.args,
          id: callId
        });

        let toolResult;
        try {
          toolResult = await executeTool(call.name, call.args || {}, this.workspaceRoot);
          onEvent({
            type: 'tool_end',
            tool: call.name,
            id: callId,
            success: true,
            result: toolResult
          });
        } catch (toolErr) {
          toolResult = { error: toolErr.message };
          onEvent({
            type: 'tool_end',
            tool: call.name,
            id: callId,
            success: false,
            error: toolErr.message
          });
        }

        const funcRespPart = {
          functionResponse: {
            name: call.name,
            response: {
              result: toolResult
            }
          }
        };
        if (call.id) {
          funcRespPart.functionResponse.id = call.id;
        }
        responseParts.push(funcRespPart);
      }

      // In Gemini API, all parallel tool responses must be returned in a single turn matching the call parts
      this.history.push({
        role: 'user',
        parts: responseParts
      });

      onEvent({
        type: 'status',
        status: 'thinking',
        message: `Gemini 4 Argon is reasoning over tool results...`
      });
    }

    onEvent({
      type: 'text',
      content: '⚠️ Maximum autonomous agent turn limit (25 turns) reached.'
    });
    onEvent({ type: 'status', status: 'idle', message: 'Ready' });
  }
}

module.exports = {
  GeminiAgent
};
