/**
 * providerAdapter.js
 * Multi-Model Provider Engine for Gemini 4 Argon, Claude 5.x, and GPT-6
 * Author: Lucky Kuntal (https://github.com/ffzlucky7-coder)
 * 
 * Supported Providers & Model Tiers:
 *  1. Google Vertex AI (Default): Gemini 4 Argon Flagship Reasoning
 *  2. Anthropic Claude 5.x:
 *     - Claude Opus 5.5 (Flagship deep reasoning & complex agentic)
 *     - Claude Sonnet 5.5 (High-effort workhorse coding)
 *     - Claude Fable 5.1 (Mythos class frontier)
 *     - Claude Haiku 5.5 (Fastest & most affordable)
 *  3. OpenAI GPT-6:
 *     - GPT-6 Astra (Flagship reasoning & software engineering)
 *     - GPT-6.1 Sol (Near-Astra heavy coding)
 *     - GPT-6 Luna (Cost-efficient high volume)
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

// Convert tool definitions to OpenAI format
function getOpenAITools() {
  return vertexAIToolDeclarations.map(decl => ({
    type: 'function',
    function: {
      name: decl.name,
      description: decl.description,
      parameters: decl.parameters
    }
  }));
}

// Model registry metadata
const MODEL_TIERS = {
  vertex: [
    { id: 'gemini-4-argon', name: 'Gemini 4 Argon (Vertex AI Flagship)', default: true }
  ],
  claude: [
    { id: 'claude-opus-5.5', name: 'Claude Opus 5.5 (Deep Reasoning Flagship)', default: true },
    { id: 'claude-sonnet-5.5', name: 'Claude Sonnet 5.5 (Coding Workhorse)' },
    { id: 'claude-fable-5.1', name: 'Claude Fable 5.1 (Mythos Class Frontier)' },
    { id: 'claude-haiku-5.5', name: 'Claude Haiku 5.5 (Fast & Affordable)' }
  ],
  openai: [
    { id: 'gpt-6-astra', name: 'GPT-6 Astra (Flagship Reasoning & Software Eng)', default: true },
    { id: 'gpt-6.1-sol', name: 'GPT-6.1 Sol (Heavy Coding Tier)' },
    { id: 'gpt-6-luna', name: 'GPT-6 Luna (Fast Everyday)' }
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
    } else if (provider === 'openai') {
      return this.executeOpenAITurn({ history, systemInstruction, thinkingLevel, attachments, signal, onEvent });
    } else {
      return this.executeVertexTurn({ history, systemInstruction, thinkingLevel, attachments, signal, onEvent });
    }
  }

  // ==========================================================================
  // 1. GOOGLE VERTEX AI (GEMINI 4 ARGON)
  // ==========================================================================
  async executeVertexTurn({ history, systemInstruction, thinkingLevel, attachments, signal, onEvent }) {
    const projectId = this.config.projectId || process.env.GEMINI_PROJECT_ID || process.env.GCP_PROJECT_ID || '';
    if (!projectId) {
      throw new Error('Google Cloud Project ID is required. Please set your Project ID in ⚙️ Settings or set GEMINI_PROJECT_ID.');
    }
    const location = this.config.location || 'global';
    const level = (thinkingLevel || this.config.thinkingLevel || 'high').toLowerCase();

    const headers = await getAuthHeaders(this.config);
    const model = 'gemini-4-argon'; // STRICT: NO FALLBACK, NO SWITCHING

    const baseUrl = location === 'global' ? 'https://aiplatform.googleapis.com' : `https://${location}-aiplatform.googleapis.com`;
    const url = `${baseUrl}/v1/projects/${projectId}/locations/${location}/publishers/google/models/${model}:generateContent`;

    const requestBody = {
      systemInstruction: { parts: [{ text: systemInstruction }] },
      contents: history,
      tools: [{ functionDeclarations: vertexAIToolDeclarations }],
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 8192,
        thinkingConfig: { thinkingLevel: level }
      }
    };

    // Retry schedule for Google Cloud 60s sliding quota window: 10s, 15s, 25s, 40s, 60s
    const backoffSchedule = [10, 15, 25, 40, 60];
    const maxRetries = backoffSchedule.length;
    let lastError = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      if (signal && signal.aborted) throw new Error('Request cancelled.');

      try {
        const resp = await fetch(url, {
          method: 'POST',
          headers: headers,
          body: JSON.stringify(requestBody),
          signal: signal
        });

        if (resp.ok) {
          const data = await resp.json();
          const candidate = data.candidates?.[0];
          if (!candidate || !candidate.content || !candidate.content.parts) {
            throw new Error('Empty response received from Gemini 4 Argon.');
          }

          const parts = candidate.content.parts;
          const functionCalls = parts.filter(p => p.functionCall).map(p => ({
            name: p.functionCall.name,
            args: p.functionCall.args,
            id: p.functionCall.id || `call_${Date.now()}`
          }));

          const textParts = parts.filter(p => p.text).map(p => p.text).join('\n');

          return {
            text: textParts,
            functionCalls: functionCalls,
            rawParts: parts,
            provider: 'vertex',
            model: 'gemini-4-argon'
          };
        }

        const status = resp.status;
        const errJson = await resp.json().catch(() => ({}));
        const errMsg = errJson.error?.message || `HTTP ${status}: ${resp.statusText}`;
        lastError = new Error(`Vertex AI Error [Gemini 4 Argon] (${status}): ${errMsg}`);

        if (status === 429 || status === 503) {
          if (attempt < maxRetries) {
            const totalSec = backoffSchedule[attempt] || 15;
            
            // Live countdown timer second-by-second so user sees exact active progress
            for (let rem = totalSec; rem > 0; rem--) {
              if (signal && signal.aborted) throw new Error('Request cancelled.');
              if (onEvent) {
                onEvent({
                  type: 'status',
                  status: 'thinking',
                  message: `Google Cloud Rate Limit (429). Cooldown: auto-resuming Gemini 4 Argon in ${rem}s (Attempt ${attempt + 1}/${maxRetries})...`
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
  // 2. ANTHROPIC CLAUDE 5.x (OPUS 5.5 / SONNET 5.5 / FABLE 5.1 / HAIKU 5.5)
  // ==========================================================================
  async executeClaudeTurn({ history, systemInstruction, thinkingLevel, attachments, signal, onEvent }) {
    const apiKey = this.config.claudeApiKey || process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error('Anthropic API Key is required for Claude models. Please configure it in ⚙️ Settings.');
    }

    const modelId = this.getModelId() || 'claude-opus-5.5';

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

    const requestBody = {
      model: modelId,
      max_tokens: 8192,
      system: systemInstruction,
      messages: messages,
      tools: getAnthropicTools()
    };

    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
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

  // ==========================================================================
  // 3. OPENAI GPT-6 (ASTRA / SOL / LUNA)
  // ==========================================================================
  async executeOpenAITurn({ history, systemInstruction, thinkingLevel, attachments, signal, onEvent }) {
    const apiKey = this.config.openAiApiKey || process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OpenAI API Key is required for GPT-6 models. Please configure it in ⚙️ Settings.');
    }

    const modelId = this.getModelId() || 'gpt-6-astra';

    const messages = [{ role: 'system', content: systemInstruction }];

    for (const h of history) {
      if (h.role === 'user') {
        const content = [];
        if (Array.isArray(h.parts)) {
          for (const p of h.parts) {
            if (p.text) content.push({ type: 'text', text: p.text });
            if (p.inlineData) {
              content.push({
                type: 'image_url',
                image_url: {
                  url: `data:${p.inlineData.mimeType};base64,${p.inlineData.data}`
                }
              });
            }
          }
        }
        messages.push({ role: 'user', content: content.length > 0 ? content : 'Continue' });
      } else if (h.role === 'model') {
        const textParts = (h.parts || []).filter(p => p.text).map(p => p.text).join('\n');
        messages.push({ role: 'assistant', content: textParts || '...' });
      }
    }

    const requestBody = {
      model: modelId,
      messages: messages,
      tools: getOpenAITools()
    };

    const resp = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify(requestBody),
      signal: signal
    });

    if (!resp.ok) {
      const errText = await resp.text();
      throw new Error(`OpenAI API Error (${resp.status}): ${errText}`);
    }

    const data = await resp.json();
    const choice = data.choices?.[0];
    const msg = choice?.message;

    const functionCalls = [];
    if (msg?.tool_calls) {
      for (const tc of msg.tool_calls) {
        let parsedArgs = {};
        try {
          parsedArgs = JSON.parse(tc.function.arguments);
        } catch (_) {}
        functionCalls.push({
          name: tc.function.name,
          args: parsedArgs,
          id: tc.id
        });
      }
    }

    return {
      text: msg?.content || '',
      functionCalls: functionCalls,
      rawParts: [{ text: msg?.content || '' }],
      provider: 'openai',
      model: modelId
    };
  }
}

module.exports = { ProviderAdapter, MODEL_TIERS };
