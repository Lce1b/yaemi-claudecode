'use strict';

const path = require('path');
const fs = require('fs');
const { isHookEnabled } = require('../../lib/profile');
const { debugLog } = require('../../lib/utils');
const { ensureDir } = require('../../lib/state-store');
const { scanForSecrets, truncateText, isGovernanceDisabled, MAX_TEXT_LENGTH } = require('./governance');
const config = require('../../lib/config');
const GOV_DIR = path.join(config.DATA_DIR, 'governance');

function getDatedFile() { return path.join(GOV_DIR, new Date().toISOString().slice(0, 10) + '.jsonl'); }

module.exports = {
  on: 'PostToolUse',
  match: function(e) { const t = e.tool_name || ''; return t === 'Bash' || t === 'Write' || t === 'Edit' || t === 'MultiEdit'; },
  priority: 300, profile: ['standard', 'strict'],
  run: async function(event, ctx) {
    if (isGovernanceDisabled()) return { exitCode: 0 };
    if (!isHookEnabled('governance', 'standard,strict')) return { exitCode: 0 };
    const output = typeof event.tool_output === 'string' ? event.tool_output : '';
    const secrets = scanForSecrets(output);
    if (secrets.length > 0) {
      ensureDir(GOV_DIR);
      const fp = getDatedFile();
      for (let i = 0; i < secrets.length; i++) {
        try { fs.appendFileSync(fp, JSON.stringify({ eventType: 'secret_detected', phase: 'post', toolName: event.tool_name, pattern: secrets[i], textPreview: truncateText(output, MAX_TEXT_LENGTH), timestamp: new Date().toISOString() }) + '\n', 'utf8'); } catch (_) {}
      }
    }
    return { exitCode: 0 };
  },
};
