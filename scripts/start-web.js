const { spawn } = require('node:child_process');
const net = require('node:net');
const path = require('node:path');

const DEFAULT_AUTH_PROXY_PORT = Number(process.env.AUTH_PROXY_PORT || 8091);
const DEFAULT_WEB_PORT = Number(process.env.EXPO_WEB_PORT || process.env.PORT || 8083);
const EXPO_CLI = path.join(process.cwd(), 'node_modules', 'expo', 'bin', 'cli');
const SHOULD_CLEAR = process.argv.includes('--clear');
const REQUIRED_PROXY_VERSION = 'master-agent-prospects-v4';

const children = new Set();
let shuttingDown = false;
let authProxyPort = DEFAULT_AUTH_PROXY_PORT;
let webApiUrl = process.env.EXPO_PUBLIC_WEB_API_URL || `http://localhost:${authProxyPort}`;

function startProcess(name, command, args, env = {}) {
  const child = spawn(command, args, {
    cwd: process.cwd(),
    env: {
      ...process.env,
      AUTH_PROXY_PORT: String(authProxyPort),
      EXPO_PUBLIC_WEB_API_URL: webApiUrl,
      ...env,
    },
    stdio: 'inherit',
    shell: false,
  });

  children.add(child);

  child.on('exit', (code, signal) => {
    children.delete(child);

    if (shuttingDown) {
      return;
    }

    if (code !== 0) {
      console.error(`${name} exited with ${signal || `code ${code}`}.`);
      shutdown(code || 1);
    }
  });

  return child;
}

function shutdown(code = 0) {
  shuttingDown = true;

  for (const child of children) {
    if (!child.killed) {
      child.kill();
    }
  }

  process.exit(code);
}

function isPortAvailable(port) {
  return new Promise((resolve) => {
    const server = net.createServer();

    server.once('error', () => resolve(false));
    server.once('listening', () => {
      server.close(() => resolve(true));
    });
    server.listen(port);
  });
}

async function findAvailablePort(startPort) {
  for (let port = startPort; port < startPort + 20; port += 1) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }

  throw new Error(`No available Expo web port found from ${startPort} to ${startPort + 19}.`);
}

async function checkProxyHealth(port) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 1000);

  try {
    const response = await fetch(`http://localhost:${port}/__health`, {
      signal: controller.signal,
    });

    if (!response.ok) {
      return false;
    }

    const health = await response.json().catch(() => undefined);
    return Boolean(
      health?.ok &&
        health.proxyVersion === REQUIRED_PROXY_VERSION &&
        typeof health.backendUrl === 'string' &&
        health.backendUrl.includes('160078175457') &&
        typeof health.authBackendUrl === 'string' &&
        health.authBackendUrl.includes('160078175457'),
    );
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

async function configureAuthProxy() {
  if (await isPortAvailable(DEFAULT_AUTH_PROXY_PORT)) {
    authProxyPort = DEFAULT_AUTH_PROXY_PORT;
    webApiUrl = `http://localhost:${authProxyPort}`;
    return { shouldStart: true };
  }

  if (await checkProxyHealth(DEFAULT_AUTH_PROXY_PORT)) {
    authProxyPort = DEFAULT_AUTH_PROXY_PORT;
    webApiUrl = `http://localhost:${authProxyPort}`;
    return { shouldStart: false };
  }

  authProxyPort = await findAvailablePort(DEFAULT_AUTH_PROXY_PORT + 1);
  webApiUrl = `http://localhost:${authProxyPort}`;

  console.warn(
    `Port ${DEFAULT_AUTH_PROXY_PORT} is in use by something that is not a healthy auth proxy. ` +
      `Starting a fresh auth proxy on ${webApiUrl}.`,
  );

  return { shouldStart: true };
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

async function main() {
  const webPort = await findAvailablePort(DEFAULT_WEB_PORT);
  const proxy = await configureAuthProxy();

  if (proxy.shouldStart) {
    console.log(`Starting auth proxy on ${webApiUrl}`);
    startProcess('auth-proxy', process.execPath, ['scripts/auth-proxy.js']);
  } else {
    console.log(`Using existing healthy auth proxy on ${webApiUrl}`);
  }

  console.log(`Starting Expo web app on http://localhost:${webPort}`);
  startProcess('expo web', process.execPath, [EXPO_CLI, 'start', '--web', '--offline', '--port', String(webPort)], {
    EXPO_NO_TELEMETRY: '1',
    EXPO_NO_DEPENDENCY_VALIDATION: '1',
    EXPO_NO_METRO_LAZY: '1',
    NODE_ENV: process.env.NODE_ENV || 'development',
  });
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  shutdown(1);
});




