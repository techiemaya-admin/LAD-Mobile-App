const { spawn } = require('node:child_process');
const path = require('node:path');

const EXPO_CLI = path.join(process.cwd(), 'node_modules', 'expo', 'bin', 'cli');
const args = process.argv.slice(2);
const isWebStart = args.includes('--web');
const commandArgs = isWebStart
  ? [path.join(process.cwd(), 'scripts', 'start-web.js'), ...(args.includes('--clear') ? ['--clear'] : [])]
  : [EXPO_CLI, ...args];

const child = spawn(process.execPath, commandArgs, {
  cwd: process.cwd(),
  env: {
    ...process.env,
    EXPO_NO_TELEMETRY: '1',
    EXPO_NO_DEPENDENCY_VALIDATION: '1',
    EXPO_NO_METRO_LAZY: '1',
    NODE_ENV: process.env.NODE_ENV || 'development',
  },
  stdio: 'inherit',
  shell: false,
});

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code || 0);
});
