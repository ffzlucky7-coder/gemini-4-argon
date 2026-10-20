/**
 * agentLoop.js
 * Multi-turn autonomous agent execution loop supporting Gemini 4 Argon, Claude 5.x, and GPT-6
 * Features:
 *  - Full workspace autonomous tool orchestration
 *  - Multimodal media/file attachments (Images, Audio, PDF, Code)
 *  - Dynamic Thinking Level control (Low, Medium, High)
 *  - Multi-provider dispatching (Vertex AI, Anthropic Claude, OpenAI)
 *  - Real-time event streaming to Webview UI
 *  - Automatic error recovery and abort handling
 * 
 * Author: Lucky Kuntal (https://github.com/ffzlucky7-coder)
 */

const { executeTool } = require('./tools');
const { ProviderAdapter } = require('./providerAdapter');

const SYSTEM_INSTRUCTION = `You are Gemini 4 Argon, Google's flagship reasoning AI model, operating as an autonomous software engineer and architect inside the Antigravity IDE.
You have FULL autonomous access to the user's workspace:
- You can inspect files (read_file), search the codebase (search_code), and explore directories (list_dir, get_workspace_structure).
- You can edit existing code (edit_file) and create new files (write_file). Backups are created automatically (.argon_bak).
- You can run terminal commands (run_command) such as running test suites (pytest, npm test), linters, git commands, and builds.
- You are natively multimodal: you can inspect attached screenshots, UI mockups, diagrams, documents, and data files.

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
    this.providerAdapter = new ProviderAdapter(this.config, workspaceRoot);
  }

  updateConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };
    this.providerAdapter.updateConfig(this.config);
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

  async run(prompt, onEvent, attachments = []) {
    this.abortController = new AbortController();
    const signal = this.abortController.signal;

    const thinkingLevel = (this.config.thinkingLevel || 'high').toLowerCase();
    const provider = (this.config.provider || 'vertex').toLowerCase();
    const modelId = this.providerAdapter.getModelId();

    // Construct user parts with text and optional multimodal attachments
    const userParts = [];
    if (prompt && prompt.trim()) {
      userParts.push({ text: prompt.trim() });
    }

    if (Array.isArray(attachments) && attachments.length > 0) {
      for (const att of attachments) {
        const b64 = att.base64Data || att.data;
        if (b64 && att.mimeType) {
          userParts.push({
            inlineData: {
              mimeType: att.mimeType,
              data: b64
            }
          });
        }
      }
    }

    if (userParts.length === 0) {
      userParts.push({ text: 'Continue' });
    }

    // Append new user message to conversation history
    this.history.push({
      role: 'user',
      parts: userParts
    });

    const modelDisplayName = provider === 'claude'
      ? `Claude (${modelId})`
      : provider === 'openai'
      ? `OpenAI (${modelId})`
      : `Gemini 4 Argon`;

    onEvent({
      type: 'status',
      status: 'thinking',
      message: `${modelDisplayName} is reasoning (${thinkingLevel.toUpperCase()} mode)...`
    });

    const MAX_TURNS = 25;
    let turnCount = 0;

    while (turnCount < MAX_TURNS) {
      turnCount++;

      if (signal.aborted) {
        onEvent({ type: 'error', error: 'Execution cancelled by user.' });
        return;
      }

      let turnResult;
      try {
        turnResult = await this.providerAdapter.executeTurn({
          history: this.history,
          systemInstruction: SYSTEM_INSTRUCTION,
          thinkingLevel: thinkingLevel,
          attachments: attachments,
          signal: signal,
          onEvent: onEvent
        });
      } catch (turnErr) {
        if (signal.aborted) {
          onEvent({ type: 'error', error: 'Request was cancelled.' });
          return;
        }
        onEvent({ type: 'error', error: turnErr.message });
        return;
      }

      // Record model response into history
      this.history.push({
        role: 'model',
        parts: turnResult.rawParts || [{ text: turnResult.text }]
      });

      const functionCalls = turnResult.functionCalls || [];

      // If no function calls, the model produced its final response
      if (functionCalls.length === 0) {
        onEvent({
          type: 'text',
          content: turnResult.text,
          model: turnResult.model,
          provider: turnResult.provider
        });
        onEvent({ type: 'status', status: 'idle', message: 'Ready' });
        return;
      }

      // Execute each function call autonomously
      const responseParts = [];

      for (const call of functionCalls) {
        if (signal.aborted) return;

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
              content: toolResult
            }
          }
        };

        if (call.id) {
          funcRespPart.functionResponse.id = call.id;
        }

        responseParts.push(funcRespPart);
      }

      // Append all tool execution responses to history for next model turn
      this.history.push({
        role: 'user',
        parts: responseParts
      });
    }

    onEvent({
      type: 'error',
      error: `Autonomous loop exceeded max turn limit (${MAX_TURNS}).`
    });
  }
}

module.exports = { GeminiAgent, SYSTEM_INSTRUCTION };
