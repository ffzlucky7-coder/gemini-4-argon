#!/usr/bin/env node
/**
 * Gemini 4 Argon Model Context Protocol (MCP) Server
 * Standard: JSON-RPC 2.0 over Stdio (Compatible with Claude Desktop, Claude Code, Cursor, and Codex)
 * Author: Lucky Kuntal (https://github.com/ffzlucky7-coder)
 */

const readline = require('readline');
const path = require('path');
const fs = require('fs');

// Import workspace tools
const {
  readFileTool,
  writeFileTool,
  editFileTool,
  listDirTool,
  getWorkspaceStructureTool,
  searchCodeTool,
  runCommandTool
} = require('../tools');

const { getAuthHeaders, getAdcFilePath } = require('../authProvider');

const SERVER_NAME = 'gemini-4-argon-mcp';
const SERVER_VERSION = '1.1.0';

// Default configuration from environment or ADC
const config = {
  projectId: process.env.GEMINI_PROJECT_ID || process.env.GCP_PROJECT_ID || '',
  location: process.env.GEMINI_LOCATION || 'global',
  authMethod: process.env.GEMINI_AUTH_METHOD || 'adc',
  serviceAccountKeyPath: process.env.GEMINI_SA_KEY_PATH || '',
  apiKey: process.env.GEMINI_API_KEY || ''
};

const WORKSPACE_ROOT = process.cwd();

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
        endLine: { type: 'number', description: 'Optional 1-based end line number.' }
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
        content: { type: 'string', description: 'Full content to write.' }
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
        replacement: { type: 'string', description: 'Exact replacement string.' }
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
        path: { type: 'string', description: 'Directory path (defaults to workspace root).' }
      }
    }
  },
  {
    name: 'get_workspace_structure',
    description: 'Recursively map the workspace directory tree, ignoring common build and git artifacts.',
    inputSchema: {
      type: 'object',
      properties: {
        maxDepth: { type: 'number', description: 'Maximum recursion depth (default: 4).' }
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
        fileExtension: { type: 'string', description: 'Optional extension filter (e.g. .js, .py).' }
      },
      required: ['query']
    }
  },
  {
    name: 'run_command',
    description: 'Execute shell commands, test suites (pytest, npm test), linters, and git inside the workspace.',
    inputSchema: {
      type: 'object',
      properties: {
        command: { type: 'string', description: 'Terminal command to execute.' },
        timeoutSeconds: { type: 'number', description: 'Timeout in seconds (default: 60).' }
      },
      required: ['command']
    }
  }
];

// Execute Gemini 4 Argon Direct Query
async function callGemini4Argon(prompt, thinkingLevel = 'high') {
  const headers = await getAuthHeaders(config);
  const url = `https://aiplatform.googleapis.com/v1/projects/${config.projectId}/locations/${config.location}/publishers/google/models/gemini-4-argon:generateContent`;

  const requestBody = {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.2,
      maxOutputTokens: 8192,
      thinkingConfig: {
        thinkingLevel: thinkingLevel.toLowerCase()
      }
    }
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: headers,
    body: JSON.stringify(requestBody)
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Vertex AI error (${response.status}): ${errText}`);
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.map(p => p.text).filter(Boolean).join('\n') || '';
  return text;
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
            tools: {
              listChanged: false
            }
          }
        }
      };

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
      const toolName = params?.name;
      const toolArgs = params?.arguments || {};

      try {
        let resultText = '';

        if (toolName === 'gemini_4_argon_reason') {
          resultText = await callGemini4Argon(toolArgs.prompt, toolArgs.thinkingLevel || 'high');
        } else if (toolName === 'read_file') {
          const res = readFileTool(toolArgs.path, toolArgs.startLine, toolArgs.endLine, WORKSPACE_ROOT);
          resultText = res.content || JSON.stringify(res);
        } else if (toolName === 'write_file') {
          const res = writeFileTool(toolArgs.path, toolArgs.content, WORKSPACE_ROOT);
          resultText = JSON.stringify(res);
        } else if (toolName === 'edit_file') {
          const res = editFileTool(toolArgs.path, toolArgs.target, toolArgs.replacement, WORKSPACE_ROOT);
          resultText = JSON.stringify(res);
        } else if (toolName === 'list_dir') {
          const res = listDirTool(toolArgs.path, WORKSPACE_ROOT);
          resultText = JSON.stringify(res, null, 2);
        } else if (toolName === 'get_workspace_structure') {
          const res = getWorkspaceStructureTool(WORKSPACE_ROOT, toolArgs.maxDepth || 4);
          resultText = res.structure || JSON.stringify(res);
        } else if (toolName === 'search_code') {
          const res = searchCodeTool(toolArgs.query, toolArgs.fileExtension, WORKSPACE_ROOT);
          resultText = JSON.stringify(res, null, 2);
        } else if (toolName === 'run_command') {
          const res = await runCommandTool(toolArgs.command, WORKSPACE_ROOT, toolArgs.timeoutSeconds || 60);
          resultText = JSON.stringify(res, null, 2);
        } else {
          return {
            jsonrpc: '2.0',
            id,
            error: {
              code: -32601,
              message: `Unknown tool: ${toolName}`
            }
          };
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

  rl.on('line', async (line) => {
    const trimmed = line.trim();
    if (!trimmed) return;

    try {
      const request = JSON.parse(trimmed);
      const response = await handleMessage(request);
      if (response) {
        process.stdout.write(JSON.stringify(response) + '\n');
      }
    } catch (parseErr) {
      process.stdout.write(JSON.stringify({
        jsonrpc: '2.0',
        id: null,
        error: {
          code: -32700,
          message: `Parse error: ${parseErr.message}`
        }
      }) + '\n');
    }
  });

  // Log startup to stderr (never pollute stdout which is reserved for JSON-RPC)
  process.stderr.write(`[Gemini 4 Argon MCP] Server started on stdio (v${SERVER_VERSION})\n`);
}

if (require.main === module) {
  start();
}

module.exports = { handleMessage, MCP_TOOLS };
