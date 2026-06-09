const http = require('node:http');

const DEFAULT_BACKEND_URL = 'https://lad-backend-develop-160078175457.us-central1.run.app';
const DEFAULT_AUTH_BACKEND_URL = 'https://lad-backend-develop-160078175457.us-central1.run.app';
const DEFAULT_BNI_SERVICE_URL = 'https://lad-waba-comms-develop-asia-160078175457.asia-south1.run.app';
const DEFAULT_MASTER_AGENT_URL = 'https://lad-master-agent-develop-asia-160078175457.asia-south1.run.app';
const PORT = Number(process.env.AUTH_PROXY_PORT || 8091);
const REQUEST_TIMEOUT_MS = Number(process.env.AUTH_PROXY_TIMEOUT_MS || 300000);
const REQUEST_RETRIES = Number(process.env.AUTH_PROXY_RETRIES || 2);
const PROXY_VERSION = 'master-agent-prospects-v3';

function readEnvFile() {
  try {
    const fs = require('node:fs');
    const path = require('node:path');
    const envPath = path.join(process.cwd(), '.env.local');
    const content = fs.readFileSync(envPath, 'utf8');

    for (const line of content.split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
      if (!match || process.env[match[1]]) {
        continue;
      }

      process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, '');
    }
  } catch {
    // .env.local is optional for the proxy.
  }
}

function corsHeaders(origin) {
  return {
    'Access-Control-Allow-Origin': origin || 'http://localhost:8082',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization,Content-Type,X-Requested-With,X-Tenant-ID,X-WhatsApp-Channel',
    'Access-Control-Allow-Credentials': 'true',
    Vary: 'Origin',
  };
}

function collectBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];

    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function delay(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function fetchWithRetry(url, options) {
  let lastError;

  for (let attempt = 0; attempt <= REQUEST_RETRIES; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      return await fetch(url, {
        ...options,
        signal: controller.signal,
      });
    } catch (error) {
      lastError = error;

      if (attempt < REQUEST_RETRIES) {
        await delay(250 * (attempt + 1));
      }
    } finally {
      clearTimeout(timeout);
    }
  }

  throw lastError;
}

function writeJson(res, status, headers, payload) {
  res.writeHead(status, { ...headers, 'Content-Type': 'application/json' });
  res.end(JSON.stringify(payload));
}

function extractTenantIdFromJwt(token) {
  try {
    const parts = String(token || '').split('.');
    if (parts.length !== 3) {
      return null;
    }

    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
    return (
      payload.tenantId ||
      payload.tenant_id ||
      payload.organizationId ||
      payload.organization_id ||
      payload.orgId ||
      null
    );
  } catch {
    return null;
  }
}

function parseCookies(cookieHeader) {
  const cookies = {};
  if (!cookieHeader) {
    return cookies;
  }

  for (const part of String(cookieHeader).split(';')) {
    const index = part.indexOf('=');
    if (index === -1) {
      continue;
    }
    const key = part.slice(0, index).trim();
    const value = part.slice(index + 1).trim();
    if (key) {
      cookies[key] = decodeURIComponent(value);
    }
  }

  return cookies;
}

function resolveTenantId(req) {
  if (process.env.NODE_ENV === 'development' && process.env.DEV_TENANT_OVERRIDE) {
    return process.env.DEV_TENANT_OVERRIDE;
  }

  const headerTenant = req.headers['x-tenant-id'];
  if (headerTenant) {
    return Array.isArray(headerTenant) ? headerTenant[0] : headerTenant;
  }

  const authorization = req.headers.authorization;
  if (authorization) {
    const token = (Array.isArray(authorization) ? authorization[0] : authorization).replace(/^Bearer\s+/i, '');
    const tenantId = extractTenantIdFromJwt(token);
    if (tenantId) {
      return tenantId;
    }
  }

  const cookies = parseCookies(req.headers.cookie);
  for (const key of ['access_token', 'token']) {
    const tenantId = extractTenantIdFromJwt(cookies[key]);
    if (tenantId) {
      return tenantId;
    }
  }

  return null;
}

readEnvFile();

const backendUrl = (
  process.env.BACKEND_INTERNAL_URL ||
  process.env.BACKEND_URL ||
  process.env.EXPO_PUBLIC_BACKEND_URL ||
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  DEFAULT_BACKEND_URL
).replace(/\/+$/, '');

const authBackendUrl = (
  process.env.AUTH_BACKEND_URL ||
  process.env.EXPO_PUBLIC_AUTH_BACKEND_URL ||
  backendUrl ||
  DEFAULT_AUTH_BACKEND_URL
).replace(/\/+$/, '');

const bniServiceUrl = (
  process.env.EXPO_PUBLIC_WHATSAPP_API_URL ||
  process.env.NEXT_PUBLIC_WHATSAPP_API_URL ||
  process.env.EXPO_PUBLIC_BNI_SERVICE_URL ||
  process.env.NEXT_PUBLIC_BNI_SERVICE_URL ||
  process.env.BNI_SERVICE_URL ||
  DEFAULT_BNI_SERVICE_URL
).replace(/\/+$/, '');

const masterAgentUrl = (
  process.env.MASTER_AGENT_URL ||
  process.env.NEXT_PUBLIC_MASTER_AGENT_URL ||
  DEFAULT_MASTER_AGENT_URL
).replace(/\/+$/, '');

const masterAgentServiceToken = process.env.LAD_MASTER_AGENT_SERVICE_TOKEN || '';

const server = http.createServer(async (req, res) => {
  const origin = req.headers.origin || 'http://localhost:8082';
  const headers = corsHeaders(origin);

  if (req.url === '/__health') {
    writeJson(res, 200, headers, {
      ok: true,
      backendUrl,
      port: PORT,
      timeoutMs: REQUEST_TIMEOUT_MS,
      retries: REQUEST_RETRIES,
      authBackendUrl,
      bniServiceUrl,
      masterAgentUrl,
      masterAgentConfigured: Boolean(masterAgentServiceToken),
      proxyVersion: PROXY_VERSION,
    });
    return;
  }

  if (req.method === 'OPTIONS') {
    res.writeHead(204, headers);
    res.end();
    return;
  }

  if (!req.url || !req.url.startsWith('/api/')) {
    res.writeHead(404, { ...headers, 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Proxy only supports /api/* routes.' }));
    return;
  }

  try {
    const body = await collectBody(req);
    const forwardHeaders = {};
    const contentType = req.headers['content-type'];
    const authorization = req.headers.authorization;
    const tenantId = req.headers['x-tenant-id'];
    const whatsappChannel = req.headers['x-whatsapp-channel'];

    if (contentType) {
      forwardHeaders['Content-Type'] = Array.isArray(contentType) ? contentType[0] : contentType;
    }

    if (authorization) {
      forwardHeaders.Authorization = Array.isArray(authorization) ? authorization[0] : authorization;
    }

    if (tenantId) {
      forwardHeaders['X-Tenant-ID'] = Array.isArray(tenantId) ? tenantId[0] : tenantId;
    }

    if (whatsappChannel) {
      forwardHeaders['X-WhatsApp-Channel'] = Array.isArray(whatsappChannel) ? whatsappChannel[0] : whatsappChannel;
    }

    const rawUrl = new URL(req.url, 'http://localhost');
    const channel =
      rawUrl.searchParams.get('channel') ||
      (Array.isArray(whatsappChannel) ? whatsappChannel[0] : whatsappChannel) ||
      'personal';
    const isBniRoute = req.url.startsWith('/api/bni/');
    const isConversationRoute =
      req.url === '/api/conversations' ||
      req.url.startsWith('/api/conversations?') ||
      /^\/api\/conversations\/[^/]+\/messages(?:\?|$)/.test(req.url);
    const targetBackendUrl = isBniRoute
      ? bniServiceUrl
      : isConversationRoute
        ? channel === 'waba'
          ? bniServiceUrl
          : backendUrl
      : req.url.startsWith('/api/auth/')
        ? authBackendUrl
        : backendUrl;
    let targetPath = isBniRoute ? `/api/${req.url.slice('/api/bni/'.length)}` : req.url;
    if (isConversationRoute && channel !== 'waba') {
      const conversationPath = req.url.replace(/^\/api/, '');
      targetPath = channel === 'linkedin'
        ? `/api/linkedin-conversations${conversationPath}`
        : `/api/whatsapp-conversations${conversationPath}`;
    }
    if (targetPath === '/api/voice-agent/available-numbers' || targetPath.startsWith('/api/voice-agent/available-numbers?')) {
      targetPath = targetPath.replace('/api/voice-agent/available-numbers', '/api/voice-agent/user/available-numbers');
    }

    const isProspectsRoute =
      req.url === '/api/prospects' ||
      req.url.startsWith('/api/prospects?') ||
      req.url.startsWith('/api/prospects/');

    if (isProspectsRoute) {
      if (!masterAgentServiceToken) {
        writeJson(res, 503, headers, {
          error: 'master_agent_service_token_missing',
          detail: 'LAD_MASTER_AGENT_SERVICE_TOKEN is not configured for the local proxy.',
          proxyVersion: PROXY_VERSION,
        });
        return;
      }

      const tenantIdForMasterAgent = resolveTenantId(req);
      if (!tenantIdForMasterAgent) {
        writeJson(res, 401, headers, {
          error: 'missing_tenant',
          detail: 'Could not resolve tenant_id from request.',
          proxyVersion: PROXY_VERSION,
        });
        return;
      }

      const inboundUrl = new URL(req.url, 'http://localhost');
      const masterPath = inboundUrl.pathname.replace(/^\/api\/prospects/, '/prospects');
      const upstream = new URL(masterPath, masterAgentUrl);
      inboundUrl.searchParams.forEach((value, key) => {
        if (key !== 'tenant_id') {
          upstream.searchParams.set(key, value);
        }
      });
      upstream.searchParams.set('tenant_id', tenantIdForMasterAgent);

      const masterHeaders = {
        'Content-Type': 'application/json',
        'X-Service-Token': masterAgentServiceToken,
      };
      const debugTraceId = req.headers['x-debug-trace-id'];
      if (debugTraceId) {
        masterHeaders['X-Debug-Trace-Id'] = Array.isArray(debugTraceId) ? debugTraceId[0] : debugTraceId;
      }

      const response = await fetchWithRetry(upstream.toString(), {
        method: req.method,
        headers: masterHeaders,
        body: body.length && !['GET', 'HEAD'].includes(req.method) ? body : undefined,
      });

      const responseBody = Buffer.from(await response.arrayBuffer());
      res.writeHead(response.status, {
        ...headers,
        'Content-Type': response.headers.get('content-type') || 'application/json',
      });
      res.end(responseBody);
      return;
    }

    const response = await fetchWithRetry(`${targetBackendUrl}${targetPath}`, {
      method: req.method,
      headers: forwardHeaders,
      body: body.length ? body : undefined,
    });

    const responseHeaders = {
      ...headers,
      'Content-Type': response.headers.get('content-type') || 'application/json',
      'Access-Control-Expose-Headers': 'Authorization,X-Access-Token',
    };

    const responseAuthorization = response.headers.get('authorization');
    if (responseAuthorization) {
      responseHeaders.Authorization = responseAuthorization;
    }

    if (targetPath.includes('/api/voice-agent/calls/stream') || responseHeaders['Content-Type'].includes('text/event-stream')) {
      res.writeHead(response.status, {
        ...responseHeaders,
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      });

      if (!response.body) {
        res.end();
        return;
      }

      const reader = response.body.getReader();
      req.on('close', () => {
        reader.cancel().catch(() => undefined);
      });

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          res.write(Buffer.from(value));
        }
      } finally {
        res.end();
      }
      return;
    }

    const responseBody = Buffer.from(await response.arrayBuffer());
    res.writeHead(response.status, responseHeaders);
    res.end(responseBody);
  } catch (error) {
    const isAbort = error.name === 'AbortError';

    writeJson(res, 502, headers, {
      error: 'Proxy request failed.',
      message: isAbort
        ? `Backend request timed out after ${REQUEST_TIMEOUT_MS}ms.`
        : 'Unable to reach the configured backend from the local proxy.',
      details: error.message,
      cause: error.cause?.code || error.cause?.message,
      backendUrl,
      authBackendUrl,
      bniServiceUrl,
      masterAgentUrl,
      proxyVersion: PROXY_VERSION,
    });
  }
});

server.listen(PORT, () => {
  console.log(`Auth/API proxy running on http://localhost:${PORT}`);
  console.log(`Forwarding /api/* to ${backendUrl}`);
  console.log(`Forwarding /api/auth/* to ${authBackendUrl}`);
  console.log(`Forwarding /api/bni/* to ${bniServiceUrl}/api/*`);
  console.log(`Forwarding /api/prospects* to ${masterAgentUrl}`);
});



