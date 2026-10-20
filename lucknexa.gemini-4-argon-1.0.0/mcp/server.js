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

// Execute Gemini 4 Argon Direct Query
async function callGemini4Argon(prompt, thinkingLevel = 'high') {
  if (!config.projectId) {
    throw new Error('GEMINI_PROJECT_ID is not configured. Please set GEMINI_PROJECT_ID in your MCP client environment settings.');
  }

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

start();
