'use strict';

const fs = require('fs');
const http = require('http');
const path = require('path');
const config = require('../../lib/config');
const { extractMcpTarget } = require('../../lib/utils');
const { atomicWrite, readJSON } = require('../../lib/state-store');

const STATE_FILE = path.join(config.DATA_DIR, 'mcp-health.json');
const TTL_MS = 300000;
const BACKOFF_BASE_MS = 30000;
const BACKOFF_MAX_MS = 600000;
const PROBE_TIMEOUT_MS = 5000;
const HEALTHY_HTTP_CODES = new Set([200, 201, 202, 204, 301, 302, 303, 307]);

function getKnownServers() {
  var servers = {};
  for (var key in process.env) {
    if (process.env.hasOwnProperty(key) && /^MCP_[A-Z0-9_]+_URL$/.test(key)) {
      var name = key.replace(/^MCP_/, '').replace(/_URL$/, '').toLowerCase();
      servers[name] = { type: 'http', url: String(process.env[key]) };
    }
  }
  return servers;
}

function loadState() {
  var state = readJSON(STATE_FILE, null);
  if (!state || typeof state !== 'object' || Array.isArray(state)) return { version: 1, servers: {} };
  if (!state.servers || typeof state.servers !== 'object' || Array.isArray(state.servers)) state.servers = {};
  return state;
}

function markHealthy(state, serverName, now, details) {
  state.servers[serverName] = { status: 'healthy', checkedAt: now, expiresAt: now + TTL_MS, failureCount: 0, lastError: null, lastFailureCode: null, nextRetryAt: now, lastRestoredAt: details && details.lastRestoredAt ? details.lastRestoredAt : now };
}

function markUnhealthy(state, serverName, now, failureCode, errorMessage) {
  var prev = state.servers[serverName] || {};
  var failCount = (Number(prev.failureCount) || 0) + 1;
  var delay = Math.min(BACKOFF_BASE_MS * Math.pow(2, Math.max(failCount - 1, 0)), BACKOFF_MAX_MS);
  state.servers[serverName] = { status: 'unhealthy', checkedAt: now, expiresAt: now, failureCount: failCount, lastError: String(errorMessage || '') || null, lastFailureCode: failureCode || null, nextRetryAt: now + delay, lastRestoredAt: prev.lastRestoredAt || null };
}

function probeHttp(urlString, timeoutMs) {
  return new Promise(function (resolve) {
    var settled = false;
    try {
      var url = new URL(urlString);
      var client = url.protocol === 'https:' ? require('https') : http;
      var req = client.request(url, { method: 'HEAD', timeout: timeoutMs }, function (res) {
        if (settled) return; settled = true; res.resume();
        resolve({ ok: HEALTHY_HTTP_CODES.has(res.statusCode), statusCode: res.statusCode, reason: 'HTTP ' + res.statusCode });
      });
      req.on('error', function (err) { if (settled) return; settled = true; resolve({ ok: false, statusCode: null, reason: err.message }); });
      req.on('timeout', function () { if (settled) return; settled = true; req.destroy(); resolve({ ok: false, statusCode: null, reason: 'request timed out' }); });
      req.end();
    } catch (err) { if (!settled) resolve({ ok: false, statusCode: null, reason: err.message }); }
  });
}

async function probeServer(serverName) {
  var known = getKnownServers();
  var serverInfo = known[serverName];
  if (!serverInfo || serverInfo.type !== 'http' || !serverInfo.url) return { ok: null, failureCode: null, reason: 'unknown server type' };
  var result = await probeHttp(serverInfo.url, PROBE_TIMEOUT_MS);
  return { ok: result.ok, failureCode: result.statusCode === 401 || result.statusCode === 403 || result.statusCode === 503 ? result.statusCode : null, reason: result.reason };
}

module.exports = {
  on: 'PreToolUse',
  match: (event) => (event.tool_name || '').startsWith('mcp__'),
  priority: 150, profile: ['standard', 'strict'],

  async run(event, ctx) {
    var target = extractMcpTarget(event);
    if (!target) return { exitCode: 0 };
    var now = Date.now(), state = loadState(), prev = state.servers[target.server] || {};

    // Still healthy — skip
    if (prev.status === 'healthy' && Number(prev.expiresAt || 0) > now) return { exitCode: 0 };

    // Known unhealthy, still in backoff — block
    if (prev.status === 'unhealthy' && Number(prev.nextRetryAt || 0) > now) {
      ctx.error('[MCPHealth] ' + target.server + ' is unavailable');
      return { exitCode: 2 };
    }

    // Cache expired but previously healthy — allow through, probe in background
    if (prev.status === 'healthy' && Number(prev.expiresAt || 0) <= now) {
      probeServer(target.server).then(function(probe) {
        var bgState = loadState();
        var bgPrev = bgState.servers[target.server] || {};
        if (probe.ok) {
          markHealthy(bgState, target.server, Date.now(), { lastRestoredAt: bgPrev.lastRestoredAt });
        } else {
          markUnhealthy(bgState, target.server, Date.now(), probe.failureCode, probe.reason);
        }
        atomicWrite(STATE_FILE, bgState);
      }).catch(function() {});
      return { exitCode: 0 };
    }

    // Unknown server — probe synchronously (first time)
    var probe = await probeServer(target.server);
    if (probe.ok === null) {
      markHealthy(state, target.server, now, { lastRestoredAt: prev.lastRestoredAt });
      atomicWrite(STATE_FILE, state);
      return { exitCode: 0 };
    }
    if (probe.ok) {
      if (prev.status === 'unhealthy') ctx.log('[MCPHealth] ' + target.server + ' connection restored');
      markHealthy(state, target.server, now, { lastRestoredAt: prev.lastRestoredAt });
      atomicWrite(STATE_FILE, state);
      return { exitCode: 0 };
    }
    markUnhealthy(state, target.server, now, probe.failureCode, probe.reason);
    atomicWrite(STATE_FILE, state);
    ctx.error('[MCPHealth] ' + target.server + ' is unavailable (' + probe.reason + ')');
    return { exitCode: 2 };
  },
  markUnhealthy, loadState,
};
