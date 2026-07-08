const http = require('node:http');

const DEFAULT_BACKEND_URL = 'https://lad-backend-develop-160078175457.us-central1.run.app';
const DEFAULT_AUTH_BACKEND_URL = 'https://lad-backend-develop-160078175457.us-central1.run.app';
const DEFAULT_BNI_SERVICE_URL = 'https://lad-waba-comms-develop-asia-160078175457.asia-south1.run.app';
const DEFAULT_WAPA_SERVICE_URL = 'https://lad-wapa-comms-develop-asia-160078175457.asia-south1.run.app';
const DEFAULT_MASTER_AGENT_URL = 'https://lad-master-agent-develop-asia-160078175457.asia-south1.run.app';
const DEFAULT_INSTAGRAM_SERVICE_URL = 'https://lad-instagram-comms-develop-asia-160078175457.asia-south1.run.app';
const DEFAULT_EMAIL_COMMS_SERVICE_URL = 'https://lad-email-comms-develop-asia-160078175457.asia-south1.run.app';
const PORT = Number(process.env.AUTH_PROXY_PORT || 8091);
const REQUEST_TIMEOUT_MS = Number(process.env.AUTH_PROXY_TIMEOUT_MS || 300000);
const REQUEST_RETRIES = Number(process.env.AUTH_PROXY_RETRIES || 2);
const PROXY_VERSION = 'master-agent-prospects-v4';

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

const wapaServiceUrl = (
  process.env.EXPO_PUBLIC_WAPA_SERVICE_URL ||
  process.env.NEXT_PUBLIC_WAPA_SERVICE_URL ||
  process.env.WAPA_SERVICE_URL ||
  process.env.WAPA_SERVICE_INTERNAL_URL ||
  DEFAULT_WAPA_SERVICE_URL
).replace(/\/+$/, '');

const masterAgentUrl = (
  process.env.MASTER_AGENT_URL ||
  process.env.NEXT_PUBLIC_MASTER_AGENT_URL ||
  DEFAULT_MASTER_AGENT_URL
).replace(/\/+$/, '');

const instagramServiceUrl = (
  process.env.EXPO_PUBLIC_INSTAGRAM_API_URL ||
  process.env.NEXT_PUBLIC_INSTAGRAM_API_URL ||
  process.env.INSTAGRAM_SERVICE_URL ||
  DEFAULT_INSTAGRAM_SERVICE_URL
).replace(/\/+$/, '');

const emailCommsServiceUrl = (
  process.env.EXPO_PUBLIC_EMAIL_COMMS_URL ||
  process.env.NEXT_PUBLIC_EMAIL_COMMS_URL ||
  process.env.EMAIL_COMMS_SERVICE_URL ||
  DEFAULT_EMAIL_COMMS_SERVICE_URL
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
      wapaServiceUrl,
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

    // Explicitly set Content-Length for non-GET requests so the upstream Python server
    // (uvicorn/FastAPI) knows the exact body size. Without it, some servers close the
    // connection before sending a response, causing a network-level error (→ 502 from proxy).
    if (body.length > 0 && req.method !== 'GET' && req.method !== 'HEAD') {
      forwardHeaders['Content-Length'] = String(body.length);
    }

    // WABA admin accounts — mirrors lad-frontend-2's dedicated
    // admin/whatsapp-accounts/route.ts. These accounts can live in EITHER the
    // Node backend's social_whatsapp_accounts table OR the Python BNI service's
    // own store depending on how the tenant was onboarded, so a plain single-target
    // forward under-reports connections. GET merges both sources; writes
    // (create/update/delete) are owned exclusively by the Python BNI service.
    const isAdminWhatsAppAccountsRoute = /^\/api\/whatsapp-conversations\/admin\/whatsapp-accounts(\/|\?|$)/.test(req.url);
    if (isAdminWhatsAppAccountsRoute) {
      const isListRoute = /^\/api\/whatsapp-conversations\/admin\/whatsapp-accounts(\?|$)/.test(req.url);
      const tenantIdForWaba = resolveTenantId(req);

      const normalizeAccounts = (payload) => {
        if (payload && payload.success && Array.isArray(payload.data)) return payload.data;
        if (Array.isArray(payload && payload.accounts)) return payload.accounts;
        if (Array.isArray(payload)) return payload;
        return [];
      };

      if (req.method === 'GET' && isListRoute) {
        const [nodeAccounts, bniAccounts] = await Promise.all([
          fetchWithRetry(`${backendUrl}/api/whatsapp-conversations/admin/whatsapp-accounts`, {
            method: 'GET',
            headers: forwardHeaders,
          })
            .then((r) => r.json())
            .then(normalizeAccounts)
            .catch(() => []),
          tenantIdForWaba
            ? fetchWithRetry(
                `${bniServiceUrl}/admin/whatsapp-accounts?tenant_id=${encodeURIComponent(tenantIdForWaba)}`,
                { method: 'GET', headers: forwardHeaders },
              )
                .then((r) => r.json())
                .then(normalizeAccounts)
                .catch(() => [])
            : Promise.resolve([]),
        ]);

        const seen = new Set();
        const merged = [];
        for (const acc of [...nodeAccounts, ...bniAccounts]) {
          const key = acc && (acc.slug || acc.id);
          if (key && !seen.has(key)) {
            seen.add(key);
            merged.push(acc);
          }
        }

        writeJson(res, 200, headers, { success: true, data: merged, accounts: merged });
        return;
      }

      const bniUrl = new URL(req.url.replace('/api/whatsapp-conversations', ''), bniServiceUrl);
      if (tenantIdForWaba && !bniUrl.searchParams.get('tenant_id')) {
        bniUrl.searchParams.set('tenant_id', tenantIdForWaba);
      }

      const response = await fetchWithRetry(bniUrl.toString(), {
        method: req.method,
        headers: forwardHeaders,
        body: body.length ? body : undefined,
      });

      const responseBody = Buffer.from(await response.arrayBuffer());
      res.writeHead(response.status, {
        ...headers,
        'Content-Type': response.headers.get('content-type') || 'application/json',
      });
      res.end(responseBody);
      return;
    }

    const rawUrl = new URL(req.url, 'http://localhost');
    const channel =
      rawUrl.searchParams.get('channel') ||
      (Array.isArray(whatsappChannel) ? whatsappChannel[0] : whatsappChannel) ||
      'personal';
    // Personal WhatsApp always lives on the WAPA service — mirrors apiClient.ts's
    // native-platform routing and LAD-Frontend-2's getServiceUrlForFeature().
    const isPersonalWhatsappRoute = req.url.startsWith('/api/personal-whatsapp/');
    const isBniRoute = req.url.startsWith('/api/bni/');
    const isConversationRoute =
      req.url === '/api/conversations' ||
      req.url.startsWith('/api/conversations?') ||
      /^\/api\/conversations\/[^/]+\/(?:messages|read|notes)(?:\?|$)/.test(req.url) ||
      // Bulk actions + starred messages — mirror lad-frontend-2's bulk and
      // starred-messages proxies (waba → BNI /api/conversations/bulk/<action>,
      // personal → WAPA /api/whatsapp-conversations/conversations/bulk/<action>).
      req.url.startsWith('/api/conversations/bulk/') ||
      req.url === '/api/conversations/starred-messages' ||
      req.url.startsWith('/api/conversations/starred-messages?') ||
      // Conversation detail (GET /api/conversations/:id) must reach the WABA/WAPA
      // service — it resets unread_count server-side as a side effect, which is how
      // mark-as-read is persisted (mirrors lad-frontend-2's markConversationRead).
      /^\/api\/conversations\/[^/]+(?:\?|$)/.test(req.url);
    const isWhatsAppConversationsRoute = req.url.startsWith('/api/whatsapp-conversations/');
    // Chat groups + labels — mirror lad-frontend-2's chat-groups/labels proxies:
    //   channel=personal → WAPA /api/whatsapp-conversations/<path>
    //   else (waba)      → BNI  /api/<path>
    const isChatGroupsRoute =
      req.url === '/api/chat-groups' ||
      req.url.startsWith('/api/chat-groups?') ||
      req.url.startsWith('/api/chat-groups/');
    const isLabelsRoute =
      req.url === '/api/labels' ||
      req.url.startsWith('/api/labels?') ||
      req.url.startsWith('/api/labels/');
    // Email conversations — mirrors lad-frontend-2's email-conversations proxy:
    // contacts/messages live on the WABA (BNI) service under /api/email/*.
    const isEmailConversationsRoute = req.url.startsWith('/api/email-conversations/');
    // Chat settings — mirrors lad-frontend-2's chat-settings proxy:
    //   channel=waba → BNI /api/settings, personal → backend /api/personal-whatsapp/chat-settings
    const isChatSettingsRoute = req.url === '/api/settings' || req.url.startsWith('/api/settings?');
    // Instagram conversations — mirrors lad-frontend-2's instagram-conversations
    // catch-all proxy: /api/instagram-conversations/<path> → LAD-Instagram-Comms /api/<path>.
    const isInstagramRoute = req.url.startsWith('/api/instagram-conversations/');
    // LAD-Email-Comms broadcasts — mirrors lad-frontend-2's email-comms proxies:
    // /api/email-comms/<path> → /api/email-broadcast/<path> ('broadcast/' collapses).
    const isEmailCommsRoute = req.url.startsWith('/api/email-comms/');
    const isThreadRoute =
      req.url === '/api/team/workload' ||
      req.url.startsWith('/api/team/workload?') ||
      req.url === '/api/threads/team/workload' ||
      req.url.startsWith('/api/threads/team/workload?') ||
      /^\/api\/threads\/[^/]+\/(?:assignment|assign|unassign)(?:\?|$)/.test(req.url);

    // Smart media routing — mirrors lad-frontend-2's /api/whatsapp-conversations/conversations/media/[mediaId]/route.ts
    // pwa_ prefix = personal WA (WAPA service); anything else = WABA (BNI service)
    const mediaFetchMatch = /^\/api\/whatsapp-conversations\/conversations\/media\/([^/?]+)/.exec(req.url);
    const isMediaFetchRoute = !!mediaFetchMatch;
    const mediaFetchId = mediaFetchMatch ? mediaFetchMatch[1] : '';
    const isPersonalMediaFetch = mediaFetchId.startsWith('pwa_');

    // Upload-media routing — determine backend based on channel
    const isMediaUploadRoute = /^\/api\/whatsapp-conversations\/conversations\/(?:templates\/)?upload-media/.test(req.url);
    // Normalise channel for upload: treat 'whatsapp' (generic chat channel) as 'personal'
    const uploadChannel = channel === 'waba' ? 'waba' : 'personal';

    const targetBackendUrl = isPersonalWhatsappRoute
      ? wapaServiceUrl
      : isBniRoute
      ? bniServiceUrl
      : isChatGroupsRoute || isLabelsRoute
        ? channel === 'personal'
          ? wapaServiceUrl
          : bniServiceUrl
      : isChatSettingsRoute
        ? channel === 'waba'
          ? bniServiceUrl
          // personal → WAPA /api/personal-whatsapp/chat-settings (path-aware
          // "backend" channel in lad-frontend-2's python-proxy resolves there)
          : wapaServiceUrl
      : isEmailConversationsRoute
        ? bniServiceUrl
      : isInstagramRoute
        ? instagramServiceUrl
      : isEmailCommsRoute
        ? emailCommsServiceUrl
      : isMediaFetchRoute
        ? (isPersonalMediaFetch ? wapaServiceUrl : bniServiceUrl)
      : isMediaUploadRoute
        ? (uploadChannel === 'waba' ? bniServiceUrl : wapaServiceUrl)
      : isThreadRoute
        ? channel === 'personal'
          ? wapaServiceUrl
          : bniServiceUrl
      : isConversationRoute
        ? channel === 'waba'
          ? bniServiceUrl
          : channel === 'personal'
            ? wapaServiceUrl
            : backendUrl
      : isWhatsAppConversationsRoute
        ? channel === 'personal'
          ? wapaServiceUrl
          : channel === 'waba'
            ? bniServiceUrl
            : backendUrl
      : req.url.startsWith('/api/auth/')
        ? authBackendUrl
        : backendUrl;
    let targetPath = isBniRoute ? `/api/${req.url.slice('/api/bni/'.length)}` : req.url;

    // Rewrite path for WABA media: /api/whatsapp-conversations/conversations/media/{id} → /api/conversations/media/{id}
    if (isMediaFetchRoute && !isPersonalMediaFetch) {
      const qs = req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : '';
      targetPath = `/api/conversations/media/${mediaFetchId}${qs}`;
    }

    // Rewrite path for WABA upload-media: strip /whatsapp-conversations/conversations prefix
    // and remove channel param (WABA service doesn't need it and may reject unknown params)
    if (isMediaUploadRoute && uploadChannel === 'waba') {
      const uploadUrl = new URL(req.url, 'http://localhost');
      uploadUrl.searchParams.delete('channel');
      const cleanedPathname = uploadUrl.pathname
        .replace('/api/whatsapp-conversations/conversations/upload-media', '/api/conversations/upload-media')
        .replace('/api/whatsapp-conversations/conversations/templates/upload-media', '/api/conversations/upload-media');
      const remainingQs = uploadUrl.searchParams.toString();
      targetPath = cleanedPathname + (remainingQs ? `?${remainingQs}` : '');
    }

    if (isThreadRoute) {
      const threadUrl = new URL(req.url, 'http://localhost');
      threadUrl.searchParams.delete('channel');
      const query = threadUrl.searchParams.toString();
      const pathWithoutApi = threadUrl.pathname === '/api/team/workload'
        ? '/threads/team/workload'
        : threadUrl.pathname.replace(/^\/api/, '');
      const resolvedThreadPath = channel === 'personal'
        ? `/api/whatsapp-conversations${pathWithoutApi}`
        : pathWithoutApi;
      targetPath = `${resolvedThreadPath}${query ? `?${query}` : ''}`;
    }
    if (isConversationRoute && channel !== 'waba') {
      const conversationPath = req.url.replace(/^\/api/, '');
      targetPath = channel === 'linkedin'
        ? `/api/linkedin-conversations${conversationPath}`
        : `/api/whatsapp-conversations${conversationPath}`;
    }
    if (isChatGroupsRoute || isLabelsRoute) {
      const groupUrl = new URL(req.url, 'http://localhost');
      groupUrl.searchParams.delete('channel');
      const query = groupUrl.searchParams.toString();
      const resolvedGroupPath = channel === 'personal'
        ? `/api/whatsapp-conversations${groupUrl.pathname.replace(/^\/api/, '')}`
        : groupUrl.pathname;
      targetPath = `${resolvedGroupPath}${query ? `?${query}` : ''}`;
    }
    if (isEmailConversationsRoute) {
      // /api/email-conversations/contacts → BNI /api/email/contacts (same for messages, groups, …)
      targetPath = req.url.replace('/api/email-conversations/', '/api/email/');
    }
    if (isChatSettingsRoute) {
      const settingsUrl = new URL(req.url, 'http://localhost');
      settingsUrl.searchParams.delete('channel');
      const query = settingsUrl.searchParams.toString();
      targetPath = channel === 'waba'
        ? `/api/settings${query ? `?${query}` : ''}`
        : `/api/personal-whatsapp/chat-settings${query ? `?${query}` : ''}`;
    }
    if (isInstagramRoute) {
      // /api/instagram-conversations/<path> → Instagram service /api/<path>
      targetPath = req.url.replace('/api/instagram-conversations/', '/api/');
    }
    if (isEmailCommsRoute) {
      // /api/email-comms/groups → /api/email-broadcast/groups
      // /api/email-comms/broadcast/runs → /api/email-broadcast/runs
      targetPath = req.url
        .replace('/api/email-comms/broadcast/', '/api/email-broadcast/')
        .replace('/api/email-comms/', '/api/email-broadcast/');
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
  console.log(`Forwarding /api/threads* to ${bniServiceUrl}/threads*`);
  console.log(`Forwarding personal /api/threads* to ${wapaServiceUrl}/api/whatsapp-conversations/threads*`);
  console.log(`Forwarding /api/prospects* to ${masterAgentUrl}`);
});



