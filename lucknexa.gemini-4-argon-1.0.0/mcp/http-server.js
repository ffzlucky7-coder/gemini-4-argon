#!/usr/bin/env node
/**
 * Gemini 4 Argon HTTP & SSE MCP Server
 * Compatible with ChatGPT Desktop, ChatGPT Custom MCP, Claude Desktop, and Remote Clients
 * Author: Lucky Kuntal (https://github.com/ffzlucky7-coder)
 */

const http = require('http');
const url = require('url');
const crypto = require('crypto');
const { handleMessage, MCP_TOOLS, SERVER_VERSION } = require('./server');

const PORT = parseInt(process.env.PORT || '3333', 10);
const HOST = process.env.HOST || '0.0.0.0';

const activeSessions = new Map();

function setCorsHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, HEAD');
  res.setHeader('Access-Control-Allow-Headers', '*');
  res.setHeader('Access-Control-Expose-Headers', '*');
}

const server = http.createServer(async (req, res) => {
  setCorsHeaders(res);

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname || '/';

  // 1. Health / Overview Endpoint
  if (req.method === 'GET' && pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'online',
      server: 'gemini-4-argon-mcp',
      version: SERVER_VERSION,
      tools: MCP_TOOLS.map(t => ({ name: t.name, description: t.description }))
    }, null, 2));
    return;
  }

  // 2. SSE Stream Handshake (GET /sse, GET /mcp, or GET /)
  if (req.method === 'GET') {
    const sessionId = crypto.randomUUID();

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no'
    });
    res.flushHeaders();

    activeSessions.set(sessionId, res);

    const proto = req.headers['x-forwarded-proto'] || 'http';
    const host = req.headers.host || `localhost:${PORT}`;
    const endpointUrl = `${proto}://${host}/message?sessionId=${sessionId}`;

    // Immediately push endpoint event with flush
    res.write(`event: endpoint\ndata: ${endpointUrl}\n\n`);

    // Keep-alive ping every 10 seconds
    const pingTimer = setInterval(() => {
      try {
        res.write(': ping\n\n');
      } catch (_) {}
    }, 10000);

    req.on('close', () => {
      clearInterval(pingTimer);
      activeSessions.delete(sessionId);
    });
    return;
  }

  // 3. Message & JSON-RPC Handling (POST /message, POST /mcp, POST /)
  if (req.method === 'POST') {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
    });

    req.on('end', async () => {
      try {
        const payload = JSON.parse(body || '{}');
        const sessionId = parsedUrl.query.sessionId;

        const response = await handleMessage(payload);

        // Push to SSE stream if session is tracked
        if (sessionId && activeSessions.has(sessionId)) {
          const sseRes = activeSessions.get(sessionId);
          if (response) {
            sseRes.write(`event: message\ndata: ${JSON.stringify(response)}\n\n`);
          }
        }

        // Always return JSON-RPC response in HTTP body as well
        if (response) {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(response));
        } else {
          res.writeHead(204);
          res.end();
        }
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          jsonrpc: '2.0',
          id: null,
          error: { code: -32700, message: `Parse error: ${err.message}` }
        }));
      }
    });
    return;
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not Found' }));
});

server.listen(PORT, HOST, () => {
  console.log(`[Gemini 4 Argon MCP SSE] Server running at http://${HOST}:${PORT}`);
});
