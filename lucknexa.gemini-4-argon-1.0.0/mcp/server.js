#!/usr/bin/env node
/**
 * Gemini 4 Argon Model Context Protocol (MCP) Server
 * Standard: JSON-RPC 2.0 over Stdio (Compatible with Claude Desktop, Claude Code, Cursor, and Codex)
 * Author: Lucky Kuntal (https://github.com/ffzlucky7-coder)
 */

const readline = require('readline');
const path = require('path');
const fs = require('fs');

// Import workspace tools executor
const { executeTool } = require('../tools');
const { getAuthHeaders } = require('../authProvider');

const SERVER_NAME = 'gemini-4-argon-mcp';
const SERVER_VERSION = '1.1.0';

// Default configuration from environment
const config = {
  projectId: process.env.GEMINI_PROJECT_ID || process.env.GCP_PROJECT_ID || '',
  location: process.env.GEMINI_LOCATION || 'global',
  authMethod: process.env.GEMINI_AUTH_METHOD || 'adc',
  serviceAccountKeyPath: process.env.GEMINI_SA_KEY_PATH || '',
  apiKey: process.env.GEMINI_API_KEY || ''
};

// Configurable workspace root (defaults to env or current working directory)
const WORKSPACE_ROOT = process.env.GEMINI_WORKSPACE_ROOT || process.env.WORKSPACE_ROOT || process.cwd();

// MCP Tool Definitions
const MCP_TOOLS = [
  {
    name: 'gemini_4_argon_reason',
    description: "Consult Google's flagship Gemini 4 Argon AI model for deep reasoning, complex code generation, architecture design, and root-cause debugging.",
    inputSchema: {
      type: 'object',
      properties: {
        prompt: {
          type: 'string',
          description: 'The task, problem, or question for Gemini 4 Argon.'
        },
        thinkingLevel: {
          type: 'string',
          enum: ['low', 'medium', 'high'],
          description: 'Reasoning depth level (low: eco/fast, medium: balanced, high: deep reasoning).'
        }
      },
      required: ['prompt']
    }
  },
  {
    name: 'read_file',
    description: 'Read the UTF-8 contents of a file within the workspace with line-level precision.',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Relative or absolute file path.' },
        startLine: { type: 'number', description: 'Optional 1-based start line number.' },
        endLine: { type: 'number', description: 'Optional 1-based end line number.' },
        workspaceRoot: { type: 'string', description: 'Optional workspace directory path override.' }
      },
      required: ['path']
    }
  },
  {
    name: 'write_file',
    description: 'Create or overwrite a file with automatic parent directory generation and safety backup (.argon_bak).',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Relative or absolute file path.' },
        content: { type: 'string', description: 'Full content to write.' },
        workspaceRoot: { type: 'string', description: 'Optional workspace directory path override.' }
      },
      required: ['path', 'content']
    }
  },
  {
    name: 'edit_file',
    description: 'Surgically search and replace an exact string block in an existing file with automatic backup.',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'File path.' },
        target: { type: 'string', description: 'Exact string block to find.' },
        replacement: { type: 'string', description: 'Exact replacement string.' },
        workspaceRoot: { type: 'string', description: 'Optional workspace directory path override.' }
      },
      required: ['path', 'target', 'replacement']
    }
  },
  {
    name: 'list_dir',
    description: 'List contents of a directory with file sizes and type indicators.',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Directory path (defaults to workspace root).' },
        workspaceRoot: { type: 'string', description: 'Optional workspace directory path override.' }
      }
    }
  },
  {
    name: 'get_workspace_structure',
    description: 'Recursively map the workspace directory tree, ignoring common build and git artifacts.',
    inputSchema: {
      type: 'object',
      properties: {
        maxDepth: { type: 'number', description: 'Maximum recursion depth (default: 4).' },
        workspaceRoot: { type: 'string', description: 'Optional workspace directory path override.' }
      }
    }
  },
  {
    name: 'search_code',
    description: 'Search for text or regex patterns across all workspace files.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search term or regex pattern.' },
        fileExtension: { type: 'string', description: 'Optional extension filter (e.g. .js, .py).' },
        workspaceRoot: { type: 'string', description: 'Optional workspace directory path override.' }
      },
      required: ['query']
    }
  },
  {
    name: 'run_command',
    description: 'Execute shell commands, test suites (pytest, npm test, cargo), linters, and git inside the workspace.',
    inputSchema: {
      type: 'object',
      properties: {
        command: { type: 'string', description: 'Terminal command to execute.' },
        timeoutSeconds: { type: 'number', description: 'Timeout in seconds (default: 60).' },
        workspaceRoot: { type: 'string', description: 'Optional workspace directory path override.' }
      },
      required: ['command']
    }
  }
];

function getAutoProjectId() {
  if (config.projectId && config.projectId.trim()) return config.projectId.trim();
  if (process.env.GEMINI_PROJECT_ID) return process.env.GEMINI_PROJECT_ID.trim();
  if (process.env.GCP_PROJECT_ID) return process.env.GCP_PROJECT_ID.trim();
  try {
    const appData = process.env.APPDATA || path.join(process.env.USERPROFILE || '', 'AppData', 'Roaming');
    const adcPath = path.join(appData, 'gcloud', 'application_default_credentials.json');
    if (fs.existsSync(adcPath)) {
      const c = JSON.parse(fs.readFileSync(adcPath, 'utf8'));
      if (c.quota_project_id) return c.quota_project_id.trim();
    }
  } catch (_) {}
  return '';
}

// Execute Gemini 4 Argon Direct Query with Resilient Auto-Failover
async function callGemini4Argon(prompt, thinkingLevel = 'high') {
  const projectId = getAutoProjectId();
  if (!projectId) {
    throw new Error('GEMINI_PROJECT_ID is not configured. Please set GEMINI_PROJECT_ID in your MCP client environment settings.');
  }

  const headers = await getAuthHeaders(config);
  const location = config.location || 'global';
  const model = 'gemini-4-argon'; // STRICT: NO FALLBACK, NO SWITCHING
  const baseUrl = location === 'global' ? 'https://aiplatform.googleapis.com' : `https://${location}-aiplatform.googleapis.com`;
  const url = `${baseUrl}/v1/projects/${projectId}/locations/${location}/publishers/google/models/${model}:generateContent`;

  const body = {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.2,
      maxOutputTokens: 8192,
      thinkingConfig: { thinkingLevel: thinkingLevel || 'high' }
    }
  };

  const maxRetries = 4;
  let lastError = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(body)
      });

      if (response.ok) {
        const data = await response.json();
        const text = data.candidates?.[0]?.content?.parts?.map(p => p.text).filter(Boolean).join('\n') || '';
        if (text) return text;
      } else {
        const errText = await response.text();
        lastError = new Error(`Vertex AI error [Gemini 4 Argon] (${response.status}): ${errText}`);
        if (response.status === 429 || response.status === 503) {
          if (attempt < maxRetries) {
            const backoffSec = (attempt + 1) * 3;
            process.stderr.write(`[Gemini 4 Argon MCP] 429 rate limit. Waiting ${backoffSec}s to retry Gemini 4 Argon exclusively...\n`);
            await new Promise(r => setTimeout(r, backoffSec * 1000));
            continue;
          }
        }
        break;
      }
    } catch (err) {
      lastError = err;
      if (attempt < maxRetries) {
        await new Promise(r => setTimeout(r, 3000));
        continue;
      }
      break;
    }
  }

  throw lastError || new Error('Failed to generate response from Gemini on Vertex AI.');
}

// Handle JSON-RPC Message Dispatch
async function handleMessage(request) {
  const { id, method, params } = request;

  switch (method) {
    case 'initialize':
      return {
        jsonrpc: '2.0',
        id,
        result: {
          protocolVersion: '2024-11-05',
          serverInfo: {
            name: SERVER_NAME,
            version: SERVER_VERSION
          },
          capabilities: {
            tools: { listChanged: false },
            resources: { subscribe: false, listChanged: false },
            prompts: { listChanged: false }
          }
        }
      };

    case 'resources/list':
      return {
        jsonrpc: '2.0',
        id,
        result: {
          resources: [
            {
              uri: 'gemini://workspace/overview',
              name: 'Workspace Architecture Overview',
              description: 'Summary of the current workspace directory, active git branch, and project files.',
              mimeType: 'text/markdown'
            },
            {
              uri: 'gemini://models/status',
              name: 'Vertex AI Model Status & Quotas',
              description: 'Live configuration status of Google Vertex AI endpoint, project ID, and model tiers.',
              mimeType: 'application/json'
            }
          ]
        }
      };

    case 'resources/read': {
      const uri = params?.uri;
      if (uri === 'gemini://models/status') {
        const projectId = getAutoProjectId();
        return {
          jsonrpc: '2.0',
          id,
          result: {
            contents: [
              {
                uri,
                mimeType: 'application/json',
                text: JSON.stringify({
                  server: SERVER_NAME,
                  version: SERVER_VERSION,
                  projectId: projectId || 'Not configured',
                  location: config.location || 'global',
                  authMethod: config.authMethod || 'adc',
                  defaultModel: 'gemini-4-argon',
                  failoverTiers: ['gemini-2.5-pro', 'gemini-2.5-flash']
                }, null, 2)
              }
            ]
          }
        };
      } else if (uri === 'gemini://workspace/overview') {
        const targetWorkspace = params?.workspaceRoot || WORKSPACE_ROOT;
        const toolResult = await executeTool('get_workspace_structure', { max_depth: 3 }, targetWorkspace);
        return {
          jsonrpc: '2.0',
          id,
          result: {
            contents: [
              {
                uri,
                mimeType: 'text/markdown',
                text: `# Workspace Overview: ${path.basename(targetWorkspace)}\n\nRoot: \`${targetWorkspace}\`\n\n\`\`\`\n${typeof toolResult === 'string' ? toolResult : JSON.stringify(toolResult, null, 2)}\n\`\`\``
              }
            ]
          }
        };
      }
      return {
        jsonrpc: '2.0',
        id,
        error: { code: -32602, message: `Resource not found: ${uri}` }
      };
    }

    case 'prompts/list':
      return {
        jsonrpc: '2.0',
        id,
        result: {
          prompts: [
            {
              name: 'gemini_architectural_design',
              description: 'Formulate an enterprise-grade architectural design for a new feature or system refactor using Gemini 4 Argon deep reasoning.',
              arguments: [
                { name: 'requirements', description: 'Detailed feature requirements and technical constraints.', required: true }
              ]
            },
            {
              name: 'gemini_deep_debug',
              description: 'Perform hypothesis-driven root cause debugging for a failing component or test.',
              arguments: [
                { name: 'errorDetails', description: 'Error stack trace, failing test output, or unexpected behavior.', required: true }
              ]
            }
          ]
        }
      };

    case 'prompts/get': {
      const promptName = params?.name;
      const args = params?.arguments || {};
      if (promptName === 'gemini_architectural_design') {
        return {
          jsonrpc: '2.0',
          id,
          result: {
            description: 'Architectural Design Prompt',
            messages: [
              {
                role: 'user',
                content: {
                  type: 'text',
                  text: `You are Gemini 4 Argon, a frontier software architect. Produce a comprehensive, enterprise-ready system architecture design for the following requirements:\n\n${args.requirements || 'System Architecture Request'}\n\nInclude: Component Boundaries, Data Flow, Sequence/ER Mermaid Diagrams, Security/Auth model, and File Structure.`
                }
              }
            ]
          }
        };
      } else if (promptName === 'gemini_deep_debug') {
        return {
          jsonrpc: '2.0',
          id,
          result: {
            description: 'Root Cause Debugging Prompt',
            messages: [
              {
                role: 'user',
                content: {
                  type: 'text',
                  text: `You are Gemini 4 Argon. Conduct a rigorous, hypothesis-driven debugging investigation for this issue:\n\n${args.errorDetails || 'Bug Description'}\n\nIsolate the exact failing line, explain the root-cause mechanics, and provide a surgical, drop-in code fix with regression prevention tests.`
                }
              }
            ]
          }
        };
      }
      return {
        jsonrpc: '2.0',
        id,
        error: { code: -32602, message: `Prompt not found: ${promptName}` }
      };
    }

    case 'notifications/initialized':
      return null; // Notifications expect no response

    case 'tools/list':
      return {
        jsonrpc: '2.0',
        id,
        result: {
          tools: MCP_TOOLS
        }
      };

    case 'tools/call': {
      const toolName = params?.name || params?.tool;
      const toolArgs = params?.arguments || params?.input || {};

      try {
        let resultText = '';

        if (toolName === 'gemini_4_argon_reason') {
          resultText = await callGemini4Argon(toolArgs.prompt, toolArgs.thinkingLevel || 'high');
        } else {
          // Normalize parameters across snake_case and camelCase
          const normalizedArgs = { ...toolArgs };
          if (toolArgs.startLine !== undefined && toolArgs.start_line === undefined) {
            normalizedArgs.start_line = toolArgs.startLine;
          }
          if (toolArgs.endLine !== undefined && toolArgs.end_line === undefined) {
            normalizedArgs.end_line = toolArgs.endLine;
          }
          if (toolArgs.maxDepth !== undefined && toolArgs.max_depth === undefined) {
            normalizedArgs.max_depth = toolArgs.maxDepth;
          }
          if (toolArgs.fileExtension !== undefined && toolArgs.file_pattern === undefined) {
            normalizedArgs.file_pattern = toolArgs.fileExtension;
          }
          if (toolArgs.timeoutSeconds !== undefined && toolArgs.timeout_ms === undefined) {
            normalizedArgs.timeout_ms = toolArgs.timeoutSeconds * 1000;
          }

          const targetWorkspace = toolArgs.workspaceRoot || toolArgs.workspace_root || WORKSPACE_ROOT;
          const toolResult = await executeTool(toolName, normalizedArgs, targetWorkspace);
          resultText = typeof toolResult === 'string' ? toolResult : JSON.stringify(toolResult, null, 2);
        }

        return {
          jsonrpc: '2.0',
          id,
          result: {
            content: [
              {
                type: 'text',
                text: typeof resultText === 'string' ? resultText : JSON.stringify(resultText)
              }
            ]
          }
        };
      } catch (err) {
        return {
          jsonrpc: '2.0',
          id,
          result: {
            isError: true,
            content: [
              {
                type: 'text',
                text: `Error executing ${toolName}: ${err.message}`
              }
            ]
          }
        };
      }
    }

    default:
      if (id !== undefined) {
        return {
          jsonrpc: '2.0',
          id,
          error: {
            code: -32601,
            message: `Method not found: ${method}`
          }
        };
      }
      return null;
  }
}

// Start Stdio JSON-RPC Loop
function start() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: false
  });

  process.stderr.write(`[Gemini 4 Argon MCP] Server started on stdio (v${SERVER_VERSION})\n`);

  rl.on('line', async (line) => {
    const trimmed = line.trim();
    if (!trimmed) return;

    try {
      const request = JSON.parse(trimmed);
      const response = await handleMessage(request);
      if (response) {
        process.stdout.write(JSON.stringify(response) + '\n');
      }
    } catch (err) {
      process.stderr.write(`[Gemini 4 Argon MCP Error] ${err.message}\n`);
      const errorResponse = {
        jsonrpc: '2.0',
        id: null,
        error: {
          code: -32700,
          message: 'Parse error: invalid JSON'
        }
      };
      process.stdout.write(JSON.stringify(errorResponse) + '\n');
    }
  });

  rl.on('close', () => {
    process.exit(0);
  });
}

if (require.main === module) {
  start();
}

module.exports = {
  handleMessage,
  MCP_TOOLS,
  SERVER_VERSION,
  callGemini4Argon
};

