/**
 * tools.js
 * Full-power workspace autonomous tools for Gemini 4 Argon:
 *  - read_file
 *  - write_file (with .argon_bak backup)
 *  - edit_file (precise search & replace with backup)
 *  - list_dir (recursive or flat listing)
 *  - search_code (codebase-wide regex / substring search)
 *  - run_command (terminal execution with timeout)
 *  - get_workspace_structure (tree view of project)
 */

const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

const IGNORED_DIRS = new Set([
  'node_modules',
  '.git',
  '.antigravity',
  '.gemini',
  '__pycache__',
  '.pytest_cache',
  '.venv',
  'venv',
  'dist',
  'build',
  '.next',
  '.turbo',
  '.idea',
  '.vscode'
]);

function resolveWorkspacePath(targetPath, workspaceRoot) {
  if (!targetPath) return workspaceRoot;
  if (path.isAbsolute(targetPath)) return path.normalize(targetPath);
  return path.normalize(path.join(workspaceRoot, targetPath));
}

// 1. read_file
async function readFileTool(args, workspaceRoot) {
  const filePath = resolveWorkspacePath(args.path, workspaceRoot);
  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${args.path}`);
  }
  const stat = fs.statSync(filePath);
  if (stat.isDirectory()) {
    throw new Error(`Path is a directory, not a file: ${args.path}. Use list_dir instead.`);
  }

  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split(/\r?\n/);
  const totalLines = lines.length;

  let startLine = parseInt(args.start_line, 10);
  let endLine = parseInt(args.end_line, 10);

  if (isNaN(startLine) || startLine < 1) startLine = 1;
  if (isNaN(endLine) || endLine > totalLines) endLine = totalLines;
  if (endLine < startLine) endLine = startLine;

  const selectedLines = lines.slice(startLine - 1, endLine);
  const numberedContent = selectedLines
    .map((line, idx) => `${startLine + idx}: ${line}`)
    .join('\n');

  return {
    path: path.relative(workspaceRoot, filePath) || path.basename(filePath),
    totalLines,
    startLine,
    endLine,
    content: numberedContent
  };
}

// 2. write_file
async function writeFileTool(args, workspaceRoot) {
  const filePath = resolveWorkspacePath(args.path, workspaceRoot);
  const dir = path.dirname(filePath);

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  let backupCreated = false;
  if (fs.existsSync(filePath)) {
    const backupPath = `${filePath}.argon_bak`;
    fs.copyFileSync(filePath, backupPath);
    backupCreated = true;
  }

  const content = args.content || '';
  fs.writeFileSync(filePath, content, 'utf8');

  return {
    success: true,
    path: path.relative(workspaceRoot, filePath) || path.basename(filePath),
    bytesWritten: Buffer.byteLength(content, 'utf8'),
    backupCreated,
    message: `File written successfully (${backupCreated ? 'backup created at .argon_bak' : 'new file created'}).`
  };
}

// 3. edit_file (Resilient CRLF/LF & Whitespace Normalized Matching)
async function editFileTool(args, workspaceRoot) {
  const filePath = resolveWorkspacePath(args.path, workspaceRoot);
  if (!fs.existsSync(filePath)) {
    throw new Error(`Cannot edit file - file does not exist: ${args.path}`);
  }

  const target = args.target;
  const replacement = args.replacement !== undefined ? args.replacement : '';

  if (!target) {
    throw new Error('target parameter is required for edit_file.');
  }

  const originalContent = fs.readFileSync(filePath, 'utf8');
  const hasCRLF = originalContent.includes('\r\n');

  let updatedContent = null;

  // 1. Exact string match
  if (originalContent.includes(target)) {
    updatedContent = originalContent.replaceAll(target, replacement);
  } else {
    // 2. CRLF vs LF Normalized match
    const normOriginal = originalContent.replace(/\r\n/g, '\n');
    const normTarget = target.replace(/\r\n/g, '\n');
    const normReplacement = replacement.replace(/\r\n/g, '\n');

    if (normOriginal.includes(normTarget)) {
      const replacedNorm = normOriginal.replaceAll(normTarget, normReplacement);
      updatedContent = hasCRLF ? replacedNorm.replace(/\n/g, '\r\n') : replacedNorm;
    } else {
      // 3. Trimmed block match (ignoring boundary whitespace differences)
      const trimTarget = normTarget.trim();
      if (trimTarget.length > 0 && normOriginal.includes(trimTarget)) {
        const replacedNorm = normOriginal.replace(trimTarget, normReplacement.trim());
        updatedContent = hasCRLF ? replacedNorm.replace(/\n/g, '\r\n') : replacedNorm;
      }
    }
  }

  if (updatedContent === null) {
    const snippet = originalContent.slice(0, 300);
    throw new Error(`Target text not found in ${args.path}. (Preview of file: ${snippet}...)`);
  }

  // Backup original file
  const backupPath = `${filePath}.argon_bak`;
  fs.copyFileSync(filePath, backupPath);

  fs.writeFileSync(filePath, updatedContent, 'utf8');

  return {
    success: true,
    path: path.relative(workspaceRoot, filePath) || path.basename(filePath),
    backupCreated: true,
    message: `File ${args.path} edited successfully. Backup saved as .argon_bak.`
  };
}

// 4. list_dir
async function listDirTool(args, workspaceRoot) {
  const targetDir = resolveWorkspacePath(args.path || '.', workspaceRoot);
  if (!fs.existsSync(targetDir)) {
    throw new Error(`Directory does not exist: ${args.path || '.'}`);
  }

  const recursive = Boolean(args.recursive);
  const maxDepth = parseInt(args.max_depth, 10) || 3;
  const entries = [];

  function walk(currentDir, currentDepth) {
    if (currentDepth > maxDepth) return;
    let items = [];
    try {
      items = fs.readdirSync(currentDir, { withFileTypes: true });
    } catch (e) {
      return;
    }

    for (const item of items) {
      if (IGNORED_DIRS.has(item.name)) continue;
      const fullPath = path.join(currentDir, item.name);
      const relPath = path.relative(workspaceRoot, fullPath);

      if (item.isDirectory()) {
        entries.push({
          name: item.name,
          path: relPath,
          type: 'directory'
        });
        if (recursive) {
          walk(fullPath, currentDepth + 1);
        }
      } else if (item.isFile()) {
        let size = 0;
        try {
          size = fs.statSync(fullPath).size;
        } catch (_) {}
        entries.push({
          name: item.name,
          path: relPath,
          type: 'file',
          size
        });
      }
    }
  }

  walk(targetDir, 1);
  return {
    basePath: path.relative(workspaceRoot, targetDir) || '.',
    totalEntries: entries.length,
    entries: entries.slice(0, 300)
  };
}

// 5. search_code
async function searchCodeTool(args, workspaceRoot) {
  const query = args.query;
  if (!query) throw new Error('query parameter is required for search_code.');

  const searchPath = resolveWorkspacePath(args.path || '.', workspaceRoot);
  const fileExt = args.file_pattern ? args.file_pattern.toLowerCase() : null;
  const matches = [];
  const MAX_MATCHES = 100;

  function scanDir(dir) {
    if (matches.length >= MAX_MATCHES) return;
    let items = [];
    try {
      items = fs.readdirSync(dir, { withFileTypes: true });
    } catch (_) {
      return;
    }

    for (const item of items) {
      if (matches.length >= MAX_MATCHES) break;
      if (IGNORED_DIRS.has(item.name)) continue;

      const fullPath = path.join(dir, item.name);
      if (item.isDirectory()) {
        scanDir(fullPath);
      } else if (item.isFile()) {
        if (fileExt && !item.name.toLowerCase().endsWith(fileExt)) continue;
        try {
          const stat = fs.statSync(fullPath);
          if (stat.size > 2 * 1024 * 1024) continue; // skip files > 2MB

          const content = fs.readFileSync(fullPath, 'utf8');
          const lines = content.split(/\r?\n/);
          for (let i = 0; i < lines.length; i++) {
            if (lines[i].toLowerCase().includes(query.toLowerCase())) {
              matches.push({
                file: path.relative(workspaceRoot, fullPath),
                line: i + 1,
                snippet: lines[i].trim().slice(0, 200)
              });
              if (matches.length >= MAX_MATCHES) break;
            }
          }
        } catch (_) {}
      }
    }
  }

  scanDir(searchPath);
  return {
    query,
    totalFound: matches.length,
    matches
  };
}

// 6. run_command
async function runCommandTool(args, workspaceRoot) {
  const cmd = args.command;
  if (!cmd) throw new Error('command parameter is required for run_command.');

  const timeoutMs = parseInt(args.timeout_ms, 10) || 60000;

  return new Promise((resolve) => {
    const isWindows = process.platform === 'win32';
    const shell = isWindows ? 'powershell.exe' : '/bin/bash';

    const child = exec(cmd, {
      cwd: workspaceRoot,
      shell: shell,
      timeout: timeoutMs,
      maxBuffer: 5 * 1024 * 1024
    }, (err, stdout, stderr) => {
      resolve({
        command: cmd,
        exitCode: err ? (err.code !== undefined ? err.code : 1) : 0,
        stdout: stdout || '',
        stderr: stderr || (err && !stdout ? err.message : ''),
        timedOut: err ? err.killed : false
      });
    });
  });
}

// 7. get_workspace_structure
async function getWorkspaceStructureTool(args, workspaceRoot) {
  const maxDepth = parseInt(args.max_depth, 10) || 3;
  const lines = [];

  function buildTree(dir, prefix = '', depth = 1) {
    if (depth > maxDepth) return;
    let items = [];
    try {
      items = fs.readdirSync(dir, { withFileTypes: true });
    } catch (_) {
      return;
    }

    const filtered = items.filter(i => !IGNORED_DIRS.has(i.name));
    filtered.sort((a, b) => {
      if (a.isDirectory() && !b.isDirectory()) return -1;
      if (!a.isDirectory() && b.isDirectory()) return 1;
      return a.name.localeCompare(b.name);
    });

    for (let i = 0; i < filtered.length; i++) {
      const item = filtered[i];
      const isLast = i === filtered.length - 1;
      const marker = isLast ? '└── ' : '├── ';
      const subPrefix = isLast ? '    ' : '│   ';

      lines.push(`${prefix}${marker}${item.name}${item.isDirectory() ? '/' : ''}`);

      if (item.isDirectory() && depth < maxDepth) {
        buildTree(path.join(dir, item.name), `${prefix}${subPrefix}`, depth + 1);
      }
    }
  }

  lines.push(path.basename(workspaceRoot) + '/');
  buildTree(workspaceRoot, '', 1);

  return {
    structure: lines.join('\n')
  };
}

// Vertex AI Declarations
const vertexAIToolDeclarations = [
  {
    name: 'read_file',
    description: 'Reads contents of a file in the workspace with line numbers. Supports reading specific line ranges.',
    parameters: {
      type: 'OBJECT',
      properties: {
        path: { type: 'STRING', description: 'Path to file (relative to workspace or absolute).' },
        start_line: { type: 'INTEGER', description: '1-based starting line number (optional).' },
        end_line: { type: 'INTEGER', description: '1-based ending line number (optional).' }
      },
      required: ['path']
    }
  },
  {
    name: 'write_file',
    description: 'Creates a new file or completely replaces an existing file. Automatically backs up existing file to .argon_bak.',
    parameters: {
      type: 'OBJECT',
      properties: {
        path: { type: 'STRING', description: 'Path to file to write.' },
        content: { type: 'STRING', description: 'The exact content to write into the file.' }
      },
      required: ['path', 'content']
    }
  },
  {
    name: 'edit_file',
    description: 'Performs precise search-and-replace modification on an existing file. Automatically creates a .argon_bak backup.',
    parameters: {
      type: 'OBJECT',
      properties: {
        path: { type: 'STRING', description: 'Path to the file to edit.' },
        target: { type: 'STRING', description: 'The exact text block to find and replace.' },
        replacement: { type: 'STRING', description: 'The new text to replace the target with.' }
      },
      required: ['path', 'target', 'replacement']
    }
  },
  {
    name: 'list_dir',
    description: 'Lists files and folders in a workspace directory. Supports recursive traversal.',
    parameters: {
      type: 'OBJECT',
      properties: {
        path: { type: 'STRING', description: 'Directory to list (defaults to workspace root ".").' },
        recursive: { type: 'BOOLEAN', description: 'Whether to list recursively.' },
        max_depth: { type: 'INTEGER', description: 'Max depth for recursive listing (default 3).' }
      }
    }
  },
  {
    name: 'search_code',
    description: 'Searches for text or symbols across files in the workspace.',
    parameters: {
      type: 'OBJECT',
      properties: {
        query: { type: 'STRING', description: 'The search query or keyword.' },
        path: { type: 'STRING', description: 'Subdirectory to search in (optional).' },
        file_pattern: { type: 'STRING', description: 'File extension filter (e.g. .py, .ts, .json).' }
      },
      required: ['query']
    }
  },
  {
    name: 'run_command',
    description: 'Executes any shell or terminal command in the workspace directory (e.g. pytest, npm test, python -m ..., git status).',
    parameters: {
      type: 'OBJECT',
      properties: {
        command: { type: 'STRING', description: 'The command string to execute.' },
        timeout_ms: { type: 'INTEGER', description: 'Execution timeout in milliseconds (default: 60000).' }
      },
      required: ['command']
    }
  },
  {
    name: 'get_workspace_structure',
    description: 'Returns a visual directory tree structure of the workspace for understanding project architecture.',
    parameters: {
      type: 'OBJECT',
      properties: {
        max_depth: { type: 'INTEGER', description: 'Tree depth (default 3).' }
      }
    }
  }
];

async function executeTool(name, args, workspaceRoot) {
  switch (name) {
    case 'read_file':
      return await readFileTool(args, workspaceRoot);
    case 'write_file':
      return await writeFileTool(args, workspaceRoot);
    case 'edit_file':
      return await editFileTool(args, workspaceRoot);
    case 'list_dir':
      return await listDirTool(args, workspaceRoot);
    case 'search_code':
      return await searchCodeTool(args, workspaceRoot);
    case 'run_command':
      return await runCommandTool(args, workspaceRoot);
    case 'get_workspace_structure':
      return await getWorkspaceStructureTool(args, workspaceRoot);
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

module.exports = {
  vertexAIToolDeclarations,
  executeTool
};
