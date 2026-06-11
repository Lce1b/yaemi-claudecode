'use strict';

const fs = require('fs');
const path = require('path');

const os = require('os');

const DATA_DIR = process.env.YAEMI_DATA_DIR || path.join(os.homedir(), '.yaemi');

const FILE_SIZE_LIMIT = parseInt(process.env.YAEMI_FILE_SIZE_LIMIT || '800', 10);
const FORMAT_TIMEOUT_MS = parseInt(process.env.YAEMI_FORMAT_TIMEOUT || '30000', 10);
const TRACKED_EXT = /\.(py|js|ts|jsx|tsx)$/i;

const PROTECTED_CONFIGS = [
  '.eslintrc', '.eslintrc.js', '.eslintrc.json', '.eslintrc.yaml', '.eslintrc.yml',
  '.prettierrc', '.prettierrc.js', '.prettierrc.json', '.prettierrc.yaml', '.prettierrc.yml',
  'prettier.config.js', 'prettier.config.cjs', 'prettier.config.mjs',
  'biome.json', 'biome.jsonc',
  'ruff.toml', '.ruff.toml',
  '.stylelintrc', '.stylelintrc.js', '.stylelintrc.json',
  '.markdownlint.json', '.markdownlint.jsonc', '.markdownlint.yaml',
  'tsconfig.json', 'tsconfig.*.json',
  'Cargo.toml', 'pyproject.toml',
];

const DEV_SERVER_PATTERNS = [
  /^npm\s+run\s+dev/,
  /^npm\s+start/,
  /^cargo\s+run/,
  /^cargo\s+watch/,
  /^pnpm\s+dev/,
  /^yarn\s+dev/,
  /^npx\s+vite/,
  /^next\s+dev/,
  /^python\s+-m\s+http\.server/,
  /^python\s+-m\s+uvicorn/,
  /^flask\s+run/,
];

function loadHookRc() {
  const candidates = [
    path.join(process.cwd(), '.hookrc.json'),
    path.join(process.cwd(), '.yaemi', 'hookrc.json'),
  ];
  for (const p of candidates) {
    try {
      if (fs.existsSync(p)) return JSON.parse(fs.readFileSync(p, 'utf8'));
    } catch (_) { /* skip */ }
  }
  return {};
}

const _hookRc = loadHookRc();

function getConfig(key, fallback) {
  const envKey = 'YAEMI_' + key.replace(/\./g, '_').toUpperCase();
  if (process.env[envKey] !== undefined) return process.env[envKey];
  if (_hookRc[key] !== undefined) return _hookRc[key];
  return fallback;
}

module.exports = {
  DATA_DIR,
  DEV_SERVER_PATTERNS,
  FILE_SIZE_LIMIT,
  FORMAT_TIMEOUT_MS,
  TRACKED_EXT,
  PROTECTED_CONFIGS,
  getConfig,
};
