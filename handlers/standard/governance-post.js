'use strict';

const path = require('path');
const fs = require('fs');
const { isHookEnabled } = require('../../lib/profile');
const { debugLog } = require('../../lib/utils');
const { ensureDir } = require('../../lib/state-store');
const { scanForSecrets, truncateText } = require('./governance');
const config = require('../../lib/config');
const GOV_DIR = path.join(config.DATA_DIR, 'governance');

function getDatedFile() { return path.join(GOV_DIR, new Date().toISOString().slice(0, 10) + '.jsonl'); }
function isGovDisabled() { return String(process.env.YAEMI_GOVERNANCE_CAPTURE || '').trim().toLowerCase() === '0'; }

module.exports = {
  on: 'PostToolUse',
  match: function(e) { const t = e.tool_name || ''; return t === 'Bash' || t === 'Write' || t === 'Edit' || t === 'MultiEdit'; },
  priority: 300, profile: ['standard', 'strict'],
  run: async function(event, ctx) {
    if (isGovDisabled()) return { exitCode: 0 };
    if (!isHookEnabled('governance', 'standard,strict')) return { exitCode: 0 };
    const output = typeof event.tool_output === 'string' ? event.tool_output : '';
    const secrets = scanForSecrets(output);
    if (secrets.length > 0) {
      ensureDir(GOV_DIR);
      const fp = getDatedFile();
      for (let i = 0; i < secrets.length; i++) {
        try { fs.appendFileSync(fp, JSON.stringify({ eventType: 'secret_detected', phase: 'post', toolName: event.tool_name, pattern: secrets[i], textPreview: truncateText(output, 220), timestamp: new Date().toISOString() }) + '\n', 'utf8'); } catch (_) {}
      }
    }
    return { exitCode: 0 };
  },
};
