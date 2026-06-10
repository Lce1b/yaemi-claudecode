'use strict';

const fs = require('fs');
const path = require('path');
const config = require('../../lib/config');
const { debugLog } = require('../../lib/utils');

const OBSERVE_DIR = path.join(config.DATA_DIR, 'observations');
const MAX_OBSERVATIONS = 500;
const DEDUP_WINDOW_MS = 5000;
const OBSERVE_TOOLS = new Set(['Edit', 'Write', 'Bash', 'Agent', 'MultiEdit']);

module.exports = {
  on: 'PreToolUse',
  match: (event) => OBSERVE_TOOLS.has(event.tool_name || ''),
  priority: 900, profile: ['standard', 'strict'],
  async run(event, ctx) {
    if (process.env.YAEMI_OBSERVE !== '1') return { exitCode: 0 };
    try {
      var toolName = event.tool_name || '';
      if (!fs.existsSync(OBSERVE_DIR)) fs.mkdirSync(OBSERVE_DIR, { recursive: true });
      try { if (fs.readdirSync(OBSERVE_DIR).filter(function(f){return f.endsWith('.json')}).length >= MAX_OBSERVATIONS) return { exitCode: 0 }; } catch (_) {}
      var prefix = toolName + '_pre_';
      try { var files = fs.readdirSync(OBSERVE_DIR).filter(function(f){return f.startsWith(prefix)&&f.endsWith('.json')}).sort().reverse(); if (files.length > 0 && Date.now() - fs.statSync(path.join(OBSERVE_DIR, files[0])).mtimeMs < DEDUP_WINDOW_MS) return { exitCode: 0 }; } catch (_) {}
      var ts = new Date().toISOString().replace(/[:.]/g, '-');
      fs.writeFileSync(path.join(OBSERVE_DIR, toolName + '_pre_' + ts + '.json'), JSON.stringify({ phase: 'pre', tool_name: toolName, timestamp: new Date().toISOString(), cwd: event.cwd || process.cwd(), tool_input: event.tool_input || {} }, null, 2), 'utf8');
    } catch (_) { debugLog('observe-runner error: ' + (_.message || _)); }
    return { exitCode: 0 };
  },
};
