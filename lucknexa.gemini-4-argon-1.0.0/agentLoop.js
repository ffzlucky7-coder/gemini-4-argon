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

const SYSTEM_INSTRUCTION = `You are Gemini 4 Argon, Google's flagship reasoning AI model, operating as an autonomous principal software engineer and architect inside the Antigravity IDE.
You have FULL autonomous access to the user's workspace:
- You can inspect files (read_file), search the codebase (search_code), and explore directories (list_dir, get_workspace_structure).
- You can edit existing code (edit_file) and create new files (write_file). Backups are created automatically (.argon_bak).
- You can run terminal commands (run_command) such as running test suites (pytest, npm test), linters, git commands, and builds.

ELITE ENGINEERING & FAST-TRACK RULES:
1. DECISIVE & FAST EXECUTION: Never spend more than 1 or 2 turns reading files. Within 2 turns, you MUST proceed to write/edit the code. Never loop repeatedly on read_file.
2. FULL ADVANCED IMPLEMENTATION: Write high-quality, production-grade, complete code. Never leave placeholders or "// TODO" comments.
3. COMMUNICATE EVERY STEP: Always write a concise explanation of what you are analyzing and refactoring in your text alongside tool calls so the user sees live progress in chat.
4. BATCH TOOL CALLS: When refactoring multiple files, invoke all tool calls simultaneously in the same turn. Do not edit 1 file per turn.
5. ALWAYS DELIVER SAVED FILES: When writing or editing, use write_file or edit_file directly so files are saved to the workspace.`;

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

      // Stream model's explanation to chat immediately so user never sits in silence
      if (turnResult.text && turnResult.text.trim().length > 0) {
        onEvent({
          type: 'text',
          content: turnResult.text,
          model: turnResult.model,
          provider: turnResult.provider
        });
      }

      // If no function calls, the model has completed all actions
      if (functionCalls.length === 0) {
        onEvent({ type: 'status', status: 'idle', message: 'Ready' });
        return;
      }

      // Execute each function call autonomously
      const responseParts = [];

      for (const call of functionCalls) {
        if (signal.aborted) return;

        const callId = call.id || `call_${Date.now()}`;

        const targetName = call.args?.path ? call.args.path.split(/[\\/]/).pop() : (call.args?.command ? call.args.command.slice(0, 30) : '');
        onEvent({
          type: 'tool_start',
          tool: call.name,
          args: call.args,
          id: callId,
          target: targetName
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

      // Pacing delay to avoid burst RPM rate-limits on Vertex AI
      await new Promise(r => setTimeout(r, 2000));
    }

    onEvent({
      type: 'error',
      error: `Autonomous loop exceeded max turn limit (${MAX_TURNS}).`
    });
  }
}

module.exports = { GeminiAgent, SYSTEM_INSTRUCTION };
