'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const MAX_STDIN = 1024 * 1024; // 1MB
const DEBUG_LOG_MAX = 1024 * 1024; // 1MB cap before rotation

function resolveDataDir() {
  const env = process.env.YAEMI_DATA_DIR || '';
  if (env) return env;
  return path.join(os.homedir(), '.yaemi');
}

const DATA_DIR = resolveDataDir();

function readStdinSync() {
  try {
    const raw = fs.readFileSync(0, 'utf8');
    return raw.length > MAX_STDIN ? raw.substring(0, MAX_STDIN) : raw;
  } catch (_) {
    return '';
  }
}

// Async stdin reader — uses stream events, reliable on Windows pipes.
// Falls back to readStdinSync if no data arrives within 500ms.
function readStdin() {
  if (process.platform !== 'win32') return Promise.resolve(readStdinSync());
  return new Promise((resolve) => {
    let data = '';
    const timer = setTimeout(() => resolve(data || readStdinSync()), 500);
    process.stdin.setEncoding('utf8');
    process.stdin.resume();
    process.stdin.on('data', chunk => { data += chunk; });
    process.stdin.on('end', () => { clearTimeout(timer); resolve(data || readStdinSync()); });
    process.stdin.on('error', () => { clearTimeout(timer); resolve(data || readStdinSync()); });
  });
}

function debugLog(msg) {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    const logPath = path.join(DATA_DIR, 'hook-debug.log');
    try {
      if (fs.existsSync(logPath) && fs.statSync(logPath).size > DEBUG_LOG_MAX) {
        const oldPath = logPath + '.old';
        if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
        fs.renameSync(logPath, oldPath);
      }
    } catch (_) { /* best-effort rotation */ }
    const line = '[yaemi-hook] ' + new Date().toISOString() + ' ' + msg + '\n';
    fs.appendFileSync(logPath, line, 'utf8');
  } catch (_) { /* silent */ }
}

const crypto = require('crypto');

function getAccumFile(sessionId) {
  const raw = sessionId
    || process.env.CLAUDE_SESSION_ID
    || crypto.createHash('sha1').update(process.cwd()).digest('hex').slice(0, 12);
  const safe = String(raw).replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 64);
  return path.join(os.tmpdir(), 'yaemi-edit-' + safe + '.txt');
}

function extractCmd(input) {
  try {
    let event;
    if (typeof input === 'string') {
      event = JSON.parse(input);
    } else if (input && typeof input === 'object') {
      event = input;
    } else {
      return '';
    }
    const cmd = event.tool_input && event.tool_input.command;
    if (!cmd) return '';
    return String(cmd).trim();
  } catch (_) { return ''; }
}

function extractMcpTarget(input) {
  const toolName = String(input.tool_name || input.name || '');
  if (!toolName.startsWith('mcp__')) return null;
  const segments = toolName.slice(5).split('__');
  if (segments.length < 1 || !segments[0]) return null;
  return { server: segments[0], tool: segments.slice(1).join('__') };
}

function inTmux() {
  return process.env.TMUX !== undefined && process.env.TMUX !== '';
}

module.exports = { readStdinSync, readStdin, debugLog, extractCmd, extractMcpTarget, getAccumFile, inTmux, MAX_STDIN, DATA_DIR };
