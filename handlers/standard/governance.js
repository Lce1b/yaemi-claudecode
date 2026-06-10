'use strict';

var path = require('path');
var fs = require('fs');
var { isHookEnabled } = require('../../lib/profile');
var { debugLog } = require('../../lib/utils');
var { ensureDir } = require('../../lib/state-store');
var config = require('../../lib/config');

var GOVERNANCE_DIR = path.join(config.DATA_DIR, 'governance');
var SECRET_PATTERNS = [
  { name: 'sk-key', re: /sk-[a-zA-Z0-9]{20,}/ },
  { name: 'api-key', re: /(?:api_key|apikey|api-key)\s*[=:]\s*(?!(?:process\.env|getEnv\(|config\.|import\.meta\.env\.))['"]?\S{1,80}/i },
  { name: 'credential', re: /(?:token|secret|password)\s*[=:]\s*(?!(?:process\.env|getEnv\(|config\.|import\.meta\.env\.))['"]?\S{1,80}/i }
];
var MAX_TEXT_LENGTH = 220;

function isGovernanceDisabled() { return String(process.env.YAEMI_GOVERNANCE_CAPTURE || '').trim().toLowerCase() === '0'; }

function scanForSecrets(text) {
  if (!text || typeof text !== 'string') return [];
  var findings = [];
  for (var i = 0; i < SECRET_PATTERNS.length; i++) { if (SECRET_PATTERNS[i].re.test(text)) findings.push(SECRET_PATTERNS[i].name); }
  return findings;
}

function truncateText(text, maxLen) { if (!text) return ''; if (text.length <= maxLen) return text; return text.substring(0, maxLen) + '...'; }

function serializeToolInput(ti) { if (!ti) return ''; if (typeof ti === 'object') { try { return JSON.stringify(ti); } catch (_) { return String(ti); } } return String(ti); }

module.exports = {
  on: 'PreToolUse',
  match: (event) => { var t = event.tool_name || ''; return t === 'Bash' || t === 'Write' || t === 'Edit' || t === 'MultiEdit'; },
  priority: 200, profile: ['standard', 'strict'],
  async run(event, ctx) {
    if (isGovernanceDisabled()) return { exitCode: 0 };
    if (!isHookEnabled('governance', 'standard,strict')) return { exitCode: 0 };
    var inputText = serializeToolInput(event.tool_input || {});
    var secrets = scanForSecrets(inputText);
    if (secrets.length > 0) {
      ensureDir(GOVERNANCE_DIR);
      var fp = path.join(GOVERNANCE_DIR, new Date().toISOString().slice(0, 10) + '.jsonl');
      for (var i = 0; i < secrets.length; i++) {
        try { fs.appendFileSync(fp, JSON.stringify({ eventType: 'secret_detected', phase: 'pre', toolName: event.tool_name, pattern: secrets[i], textPreview: truncateText(inputText, MAX_TEXT_LENGTH), timestamp: new Date().toISOString() }) + '\n', 'utf8'); } catch (_) {}
      }
      return { exitCode: 2 };
    }
    return { exitCode: 0 };
  },
  scanForSecrets, truncateText, SECRET_PATTERNS,
};
