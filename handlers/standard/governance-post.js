'use strict';

var path = require('path');
var fs = require('fs');
var { isHookEnabled } = require('../../lib/profile');
var { debugLog } = require('../../lib/utils');
var { ensureDir } = require('../../lib/state-store');
var { scanForSecrets, truncateText } = require('./governance');
var config = require('../../lib/config');
var GOV_DIR = path.join(config.DATA_DIR, 'governance');

function getDatedFile() { return path.join(GOV_DIR, new Date().toISOString().slice(0, 10) + '.jsonl'); }
function isGovDisabled() { return String(process.env.YAEMI_GOVERNANCE_CAPTURE || '').trim().toLowerCase() === '0'; }

module.exports = {
  on: 'PostToolUse',
  match: function(e) { var t = e.tool_name || ''; return t === 'Bash' || t === 'Write' || t === 'Edit' || t === 'MultiEdit'; },
  priority: 300, profile: ['standard', 'strict'],
  run: async function(event, ctx) {
    if (isGovDisabled()) return { exitCode: 0 };
    if (!isHookEnabled('governance', 'standard,strict')) return { exitCode: 0 };
    var output = typeof event.tool_output === 'string' ? event.tool_output : '';
    var secrets = scanForSecrets(output);
    if (secrets.length > 0) {
      ensureDir(GOV_DIR);
      var fp = getDatedFile();
      for (var i = 0; i < secrets.length; i++) {
        try { fs.appendFileSync(fp, JSON.stringify({ eventType: 'secret_detected', phase: 'post', toolName: event.tool_name, pattern: secrets[i], textPreview: truncateText(output, 220), timestamp: new Date().toISOString() }) + '\n', 'utf8'); } catch (_) {}
      }
    }
    return { exitCode: 0 };
  },
};
