'use strict';

/**
 * PostToolUseFailure — handler for tool execution failures.
 *
 * 1. Updates pet visual state to 'error'
 * 2. Marks MCP servers unhealthy on mcp__* tool failure
 *
 * Priority: 10
 * Profile: minimal, standard, strict
 */

const path = require('path');
const fs = require('fs');
const config = require('../../lib/config');

const STATE_FILE = path.join(config.DATA_DIR, 'mcp-health.json');

function loadState() {
  try {
    if (fs.existsSync(STATE_FILE)) return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
  } catch (_) {}
  return { servers: {} };
}

function markUnhealthy(state, server, now, reason, detail) {
  if (!state.servers) state.servers = {};
  if (!state.servers[server]) state.servers[server] = {};
  const s = state.servers[server];
  s.consecutiveFailures = (s.consecutiveFailures || 0) + 1;
  s.lastFailure = now;
  s.lastFailureReason = reason;
  if (detail) s.lastFailureDetail = detail.substring(0, 500);
  s.status = 'unhealthy';
}

function atomicWrite(filePath, data) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const tmp = filePath + '.tmp.' + process.pid + '.' + Date.now();
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8');
  try {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    fs.renameSync(tmp, filePath);
  } catch (e) {
    try { fs.writeFileSync(filePath, fs.readFileSync(tmp)); } finally {
      try { fs.unlinkSync(tmp); } catch (_) {}
    }
  }
}

function extractMcpTarget(input) {
  const toolName = String(input.tool_name || input.name || '');
  if (!toolName.startsWith('mcp__')) return null;
  const segments = toolName.slice(5).split('__');
  if (segments.length < 1 || !segments[0]) return null;
  return { server: segments[0], tool: segments.slice(1).join('__') };
}

module.exports = {
  on: 'PostToolUseFailure',
  match: () => true,
  priority: 10,
  profile: ['minimal', 'standard', 'strict'],

  async run(event, ctx) {
    ctx.sink.fire('/api/hook/state', { s: 'error' });

    const target = extractMcpTarget(event);
    if (target) {
      const now = Date.now();
      const state = loadState();

      let errorMsg = '';
      const output = event.tool_output;
      if (typeof event.error === 'string') errorMsg = event.error;
      else if (typeof event.message === 'string') errorMsg = event.message;
      else if (typeof output === 'string') errorMsg = output;
      else if (output && typeof output.stderr === 'string') errorMsg = output.stderr;
      else if (output && typeof output.output === 'string') errorMsg = output.output;

      markUnhealthy(state, target.server, now, 'failure', errorMsg.slice(0, 500));
      atomicWrite(STATE_FILE, state);
      ctx.log('[MCPHealth] ' + target.server + ' marked unhealthy (PostToolUseFailure)');
    }

    return { exitCode: 0 };
  },
};
