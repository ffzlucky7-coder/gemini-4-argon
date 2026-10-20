/**
 * authProvider.js
 * Multi-method Google Cloud Authentication for Gemini 4 Argon.
 * Supports:
 *  1. Application Default Credentials (ADC) - Auto-detected from gcloud/APPDATA
 *  2. Service Account JSON key (Zero-dependency RS256 JWT exchange)
 *  3. API Key
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { exec } = require('child_process');

let tokenCache = {
  token: null,
  expiresAt: 0,
  key: ''
};

function getAdcFilePath() {
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS && fs.existsSync(process.env.GOOGLE_APPLICATION_CREDENTIALS)) {
    return process.env.GOOGLE_APPLICATION_CREDENTIALS;
  }
  const isWindows = process.platform === 'win32';
  if (isWindows) {
    const appData = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
    const p = path.join(appData, 'gcloud', 'application_default_credentials.json');
    if (fs.existsSync(p)) return p;
  } else {
    const p = path.join(os.homedir(), '.config', 'gcloud', 'application_default_credentials.json');
    if (fs.existsSync(p)) return p;
  }
  return null;
}

function base64UrlEncode(str) {
  return Buffer.from(str)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

async function getJwtTokenForServiceAccount(saJson) {
  const now = Math.floor(Date.now() / 1000);
  const header = {
    alg: 'RS256',
    typ: 'JWT'
  };
  const payload = {
    iss: saJson.client_email,
    sub: saJson.client_email,
    aud: 'https://oauth2.googleapis.com/token',
    scope: 'https://www.googleapis.com/auth/cloud-platform',
    iat: now,
    exp: now + 3600
  };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const unsignedToken = `${encodedHeader}.${encodedPayload}`;

  const signer = crypto.createSign('RSA-SHA256');
  signer.update(unsignedToken);
  const signature = signer.sign(saJson.private_key, 'base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

  const jwt = `${unsignedToken}.${signature}`;

  const resp = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt
    })
  });

  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`Service Account authentication failed: ${errText}`);
  }

  const data = await resp.json();
  return {
    token: data.access_token,
    expiresIn: data.expires_in || 3600
  };
}

async function getAdcToken() {
  const adcPath = getAdcFilePath();
  if (adcPath) {
    try {
      const raw = fs.readFileSync(adcPath, 'utf8');
      const creds = JSON.parse(raw);
      if (creds.type === 'service_account') {
        return await getJwtTokenForServiceAccount(creds);
      }
      if (creds.refresh_token && creds.client_id && creds.client_secret) {
        const resp = await fetch('https://oauth2.googleapis.com/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            client_id: creds.client_id,
            client_secret: creds.client_secret,
            refresh_token: creds.refresh_token,
            grant_type: 'refresh_token'
          })
        });

        if (resp.ok) {
          const data = await resp.json();
          return {
            token: data.access_token,
            expiresIn: data.expires_in || 3600
          };
        }
      }
    } catch (e) {
      console.warn('Error reading ADC file:', e.message);
    }
  }

  // Fallback to gcloud CLI command
  return new Promise((resolve, reject) => {
    exec('gcloud auth print-access-token', (err, stdout, stderr) => {
      if (err) {
        reject(new Error(`Failed to obtain Google Cloud ADC token. Please run 'gcloud auth application-default login' or configure a Service Account key in Settings. Error: ${stderr || err.message}`));
      } else {
        const tok = stdout.trim();
        if (!tok) {
          reject(new Error('gcloud auth print-access-token returned empty string.'));
        } else {
          resolve({ token: tok, expiresIn: 3600 });
        }
      }
    });
  });
}

async function getAuthHeaders(config) {
  const method = config.authMethod || 'adc';

  if (method === 'apiKey') {
    if (!config.apiKey || !config.apiKey.trim()) {
      throw new Error('API Key is selected but no API Key is configured. Please enter your Vertex AI API Key in Settings.');
    }
    return {
      'x-goog-api-key': config.apiKey.trim(),
      'Content-Type': 'application/json'
    };
  }

  const cacheKey = `${method}:${config.serviceAccountKeyPath || ''}`;
  const now = Date.now();
  if (tokenCache.token && tokenCache.key === cacheKey && tokenCache.expiresAt > now + 60000) {
    return {
      'Authorization': `Bearer ${tokenCache.token}`,
      'Content-Type': 'application/json'
    };
  }

  let result;
  if (method === 'serviceAccount') {
    if (!config.serviceAccountKeyPath || !fs.existsSync(config.serviceAccountKeyPath)) {
      throw new Error(`Service Account key file not found at: ${config.serviceAccountKeyPath}. Please select a valid JSON key file in Settings.`);
    }
    const raw = fs.readFileSync(config.serviceAccountKeyPath, 'utf8');
    const saJson = JSON.parse(raw);
    result = await getJwtTokenForServiceAccount(saJson);
  } else {
    // Default ADC
    result = await getAdcToken();
  }

  tokenCache = {
    token: result.token,
    expiresAt: now + (result.expiresIn * 1000),
    key: cacheKey
  };

  return {
    'Authorization': `Bearer ${result.token}`,
    'Content-Type': 'application/json'
  };
}

async function testConnection(config) {
  const startTime = Date.now();
  const projectId = config.projectId || 'planar-hangout-510114-u1';
  const location = config.location || 'global';

  try {
    const headers = await getAuthHeaders(config);
    const url = `https://aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/publishers/google/models/gemini-4-argon:generateContent`;

    const body = {
      contents: [
        { role: 'user', parts: [{ text: 'Respond with exactly: PONG' }] }
      ],
      generationConfig: {
        maxOutputTokens: 10,
        temperature: 0.1,
        thinkingConfig: {
          thinkingLevel: 'low'
        }
      }
    };

    const resp = await fetch(url, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(body)
    });

    const latencyMs = Date.now() - startTime;
    const data = await resp.json();

    if (!resp.ok) {
      const msg = data.error?.message || `HTTP ${resp.status}: ${resp.statusText}`;
      return {
        success: false,
        error: `Vertex AI Error (${resp.status}): ${msg}`,
        latencyMs
      };
    }

    const reply = data.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('').trim();
    return {
      success: true,
      latencyMs,
      modelVersion: data.modelVersion || 'gemini-4-argon',
      message: `Successfully connected to Gemini 4 Argon in ${latencyMs}ms! Response: "${reply}"`
    };
  } catch (err) {
    return {
      success: false,
      error: err.message,
      latencyMs: Date.now() - startTime
    };
  }
}

module.exports = {
  getAuthHeaders,
  testConnection,
  getAdcFilePath
};
