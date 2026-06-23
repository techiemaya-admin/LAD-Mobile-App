const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

function parseEnv(content) {
  for (const line of content.split(/\r?\n/)) {
    const match = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!match) continue;

    const key = match[1];
    if (process.env[key]) continue;

    let value = match[2].trim();
    const commentIndex = value.match(/\s#/);
    if (commentIndex?.index != null) {
      value = value.slice(0, commentIndex.index).trim();
    }

    process.env[key] = value.replace(/^['"]|['"]$/g, '');
  }
}

function loadEnvFiles(rootDir) {
  [
    '.env',
    '.env.local',
    '.env.development',
    '.env.development.local',
    '.env.production',
    '.env.production.local',
  ].forEach((name) => {
    const filePath = path.join(rootDir, name);
    if (fs.existsSync(filePath)) {
      parseEnv(fs.readFileSync(filePath, 'utf8'));
    }
  });
}

const [, , entry, ...args] = process.argv;

if (!entry) {
  console.error('with-env-node requires a Node entry file.');
  process.exit(1);
}

const projectRoot = path.resolve(__dirname, '..');
loadEnvFiles(projectRoot);
process.env.NODE_ENV ||= 'development';

const result = spawnSync(process.execPath, [entry, ...args], {
  cwd: process.cwd(),
  env: process.env,
  stdio: 'inherit',
});

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}

process.exit(result.status ?? 0);
