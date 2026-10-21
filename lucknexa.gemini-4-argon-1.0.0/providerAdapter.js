/**
 * providerAdapter.js
 * Multi-Model Provider Engine for Gemini 4 Argon and Anthropic Claude (Vertex AI Model Garden)
 * Author: Lucky Kuntal (https://github.com/ffzlucky7-coder)
 * 
 * Supported Providers & Model Tiers:
 *  1. Google Vertex AI (Default): Gemini 4 Argon Flagship Reasoning (100% Free via $300 Credits)
 *  2. Anthropic Claude (Google Cloud Vertex AI Model Garden):
 *     - Claude Opus 5.5 (Model Garden Flagship Deep Reasoning)
 *     - Claude Opus 5 (Model Garden Autonomous Agentic Engineering)
 *     - Claude Opus 4.8 (Model Garden Deep Reasoning & Architecture)
 *     - Claude Opus 4.7 (Model Garden High Precision Production Coding)
 *     - Claude Sonnet 5.5 (Model Garden Coding Workhorse)
 *     - Claude Haiku 5.5 (Model Garden Fast Iteration & Lookups)
 */

const { getAuthHeaders } = require('./authProvider');
const { vertexAIToolDeclarations, executeTool } = require('./tools');

// Convert tool definitions to Anthropic format
function getAnthropicTools() {
  return vertexAIToolDeclarations.map(decl => ({
    name: decl.name,
    description: decl.description,
    input_schema: decl.parameters
  }));
}

// Model registry metadata
const MODEL_TIERS = {
  vertex: [
    { id: 'gemini-4-argon', name: 'Gemini 4 Argon (Vertex AI Flagship)', default: true }
  ],
  claude: [
    { id: 'claude-opus-5.5', name: 'Claude Opus 5.5 (Model Garden Flagship)', default: true },
    { id: 'claude-opus-5', name: 'Claude Opus 5 (Model Garden Autonomous)' },
    { id: 'claude-opus-4.8', name: 'Claude Opus 4.8 (Model Garden Deep Reasoning)' },
    { id: 'claude-opus-4.7', name: 'Claude Opus 4.7 (Model Garden Production)' },
    { id: 'claude-sonnet-5.5', name: 'Claude Sonnet 5.5 (Model Garden Coding Workhorse)' },
    { id: 'claude-haiku-5.5', name: 'Claude Haiku 5.5 (Model Garden Fast Iteration)' }
  ]
};

class ProviderAdapter {
  constructor(config, workspaceRoot) {
    this.config = config || {};
    this.workspaceRoot = workspaceRoot || process.cwd();
  }

  updateConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };
  }

  getProvider() {
    return (this.config.provider || 'vertex').toLowerCase();
  }

  getModelId() {
    const provider = this.getProvider();
    if (this.config.modelId) return this.config.modelId;
    const tier = MODEL_TIERS[provider] || MODEL_TIERS.vertex;
    return tier[0].id;
  }

  /**
   * Dispatches a generation request to the selected provider
   */
  async executeTurn({ history, systemInstruction, thinkingLevel, attachments, signal, onEvent }) {
    const provider = this.getProvider();

    if (provider === 'claude') {
      return this.executeClaudeTurn({ history, systemInstruction, thinkingLevel, attachments, signal, onEvent });
    } else {
      return this.executeVertexTurn({ history, systemInstruction, thinkingLevel, attachments, signal, onEvent });
    }
  }

  // ==========================================================================
  // 1. GOOGLE VERTEX AI (GEMINI 4 ARGON)
  // ==========================================================================
  async executeVertexTurn({ history, systemInstruction, thinkingLevel, attachments, signal, onEvent }) {
    const headers = await getAuthHeaders(this.config);
    const projectId = this.config.projectId || process.env.GEMINI_PROJECT_ID;
    if (!projectId) {
      throw new Error('Google Cloud Project ID is not configured. Please enter your Project ID in Settings (⚙️).');
    }

    const location = this.config.location || 'global';
    const endpointHost = location === 'global' ? 'aiplatform.googleapis.com' : `${location}-aiplatform.googleapis.com`;
    const modelEndpoint = `https://${endpointHost}/v1/projects/${projectId}/locations/${location}/publishers/google/models/gemini-4-argon:generateContent`;

    // Map thinking level to Vertex AI budget
    let thinkingBudget = 8192;
    if (thinkingLevel === 'low') thinkingBudget = 2048;
    else if (thinkingLevel === 'medium') thinkingBudget = 8192;
    else if (thinkingLevel === 'high') thinkingBudget = 24576;

    const requestBody = {
      contents: history,
      systemInstruction: {
        role: 'system',
        parts: [{ text: systemInstruction }]
      },
      tools: [{ functionDeclarations: vertexAIToolDeclarations }],
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 16384,
        thinkingConfig: {
          thinkingBudget: thinkingBudget
        }
      }
    };

    const maxRetries = 4;
    let attempt = 0;
    let lastError = null;

    while (attempt < maxRetries) {
      attempt++;
      try {
        const resp = await fetch(modelEndpoint, {
          method: 'POST',
          headers: {
            ...headers,
            'Content-Type': 'application/json; charset=utf-8'
          },
          body: JSON.stringify(requestBody),
          signal: signal
        });

        if (resp.ok) {
          const data = await resp.json();
          const candidate = data.candidates?.[0];
          if (!candidate) {
            throw new Error('No candidate returned from Gemini 4 Argon.');
          }

          const parts = candidate.content?.parts || [];
          let text = '';
          const functionCalls = [];

          for (const p of parts) {
            if (p.text) text += p.text;
            if (p.functionCall) functionCalls.push(p.functionCall);
          }

          return {
            text,
            functionCalls,
            rawParts: parts,
            provider: 'vertex',
            model: 'gemini-4-argon'
          };
        }

        const errText = await resp.text();
        lastError = new Error(`Vertex AI HTTP ${resp.status}: ${errText}`);

        // Rate Limit Handling (HTTP 429) - Automatic Backoff
        if (resp.status === 429 || resp.status === 503) {
          if (attempt < maxRetries) {
            const delaySec = 20 * attempt;
            for (let rem = delaySec; rem > 0; rem--) {
              if (signal && signal.aborted) throw new Error('Request cancelled.');
              if (onEvent) {
                onEvent({
                  type: 'status',
                  status: 'thinking',
                  message: `Rate limit hit. Cooling down for ${rem}s before resuming Gemini 4 Argon...`
                });
              }
              await new Promise(r => setTimeout(r, 1000));
            }
            if (onEvent) {
              onEvent({
                type: 'status',
                status: 'thinking',
                message: `Cooldown complete! Resuming Gemini 4 Argon execution...`
              });
            }
            continue;
          }
        }
        break;
      } catch (fetchErr) {
        if (signal && signal.aborted) throw fetchErr;
        lastError = fetchErr;
        if (attempt < maxRetries) {
          const sec = 5;
          for (let rem = sec; rem > 0; rem--) {
            if (signal && signal.aborted) throw new Error('Request cancelled.');
            await new Promise(r => setTimeout(r, 1000));
          }
          continue;
        }
        break;
      }
    }

    throw lastError || new Error('Failed to get response from Gemini 4 Argon on Vertex AI.');
  }

  // ==========================================================================
  // 2. ANTHROPIC CLAUDE (VERTEX AI MODEL GARDEN / DIRECT ANTHROPIC)
  // ==========================================================================
  async executeClaudeTurn({ history, systemInstruction, thinkingLevel, attachments, signal, onEvent }) {
    const modelId = this.getModelId() || 'claude-opus-5.5';
    const directApiKey = this.config.claudeApiKey || process.env.ANTHROPIC_API_KEY;

    // Format messages for Claude Messages API
    const messages = [];
    for (const h of history) {
      if (h.role === 'user') {
        const content = [];
        if (Array.isArray(h.parts)) {
          for (const p of h.parts) {
            if (p.text) content.push({ type: 'text', text: p.text });
            if (p.inlineData) {
              content.push({
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: p.inlineData.mimeType,
                  data: p.inlineData.data
                }
              });
            }
          }
        }
        messages.push({ role: 'user', content: content.length > 0 ? content : 'Continue' });
      } else if (h.role === 'model') {
        const content = [];
        if (Array.isArray(h.parts)) {
          for (const p of h.parts) {
            if (p.text) content.push({ type: 'text', text: p.text });
            if (p.functionCall) {
              content.push({
                type: 'tool_use',
                id: p.functionCall.id || `toolu_${Date.now()}`,
                name: p.functionCall.name,
                input: p.functionCall.args || {}
              });
            }
          }
        }
        messages.push({ role: 'assistant', content: content.length > 0 ? content : '...' });
      }
    }

    let endpoint = 'https://api.anthropic.com/v1/messages';
    let headers = {
      'Content-Type': 'application/json'
    };
    let requestBody = {
      model: modelId,
      max_tokens: 8192,
      system: systemInstruction,
      messages: messages,
      tools: getAnthropicTools()
    };

    if (directApiKey) {
      // Direct Anthropic API
      headers['x-api-key'] = directApiKey;
      headers['anthropic-version'] = '2023-06-01';
    } else {
      // 100% FREE via Google Cloud Vertex AI Model Garden ($300 Credits)
      const projectId = this.config.projectId || process.env.GEMINI_PROJECT_ID;
      if (!projectId) {
        throw new Error('To use Claude via Google Cloud $300 Free Credits, please configure your Project ID in ⚙️ Settings (or provide an Anthropic API Key).');
      }
      const gcpHeaders = await getAuthHeaders(this.config);
      headers = {
        ...gcpHeaders,
        'Content-Type': 'application/json; charset=utf-8'
      };
      const region = this.config.location && this.config.location !== 'global' ? this.config.location : 'us-east5';
      endpoint = `https://${region}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${region}/publishers/anthropic/models/${modelId}:rawPredict`;
      requestBody = {
        anthropic_version: 'vertex-2023-10-16',
        messages: messages,
        max_tokens: 8192,
        system: systemInstruction,
        tools: getAnthropicTools()
      };
    }

    const resp = await fetch(endpoint, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(requestBody),
      signal: signal
    });

    if (!resp.ok) {
      const errText = await resp.text();
      throw new Error(`Claude API Error (${resp.status}): ${errText}`);
    }

    const data = await resp.json();
    let text = '';
    const functionCalls = [];

    if (Array.isArray(data.content)) {
      for (const item of data.content) {
        if (item.type === 'text') text += item.text + '\n';
        if (item.type === 'tool_use') {
          functionCalls.push({
            name: item.name,
            args: item.input,
            id: item.id
          });
        }
      }
    }

    return {
      text: text.trim(),
      functionCalls: functionCalls,
      rawParts: [{ text: text.trim() }],
      provider: 'claude',
      model: modelId
    };
  }
}

module.exports = { ProviderAdapter, MODEL_TIERS };
