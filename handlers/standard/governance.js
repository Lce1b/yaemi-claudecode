'use strict';

const path = require('path');
const fs = require('fs');
const { isHookEnabled } = require('../../lib/profile');
const { debugLog } = require('../../lib/utils');
const { ensureDir } = require('../../lib/state-store');
const config = require('../../lib/config');
const { PATTERNS } = require('../../lib/secret-patterns');

const GOVERNANCE_DIR = path.join(config.DATA_DIR, 'governance');
const MAX_TEXT_LENGTH = 220;

function isGovernanceDisabled() { return String(process.env.YAEMI_GOVERNANCE_CAPTURE || '').trim().toLowerCase() === '0'; }

function scanForSecrets(text) {
  if (!text || typeof text !== 'string') return [];
  const findings = [];
  for (let i = 0; i < PATTERNS.length; i++) { if (PATTERNS[i].re.test(text)) findings.push(PATTERNS[i].name); }
  return findings;
}

function truncateText(text, maxLen) { if (!text) return ''; if (text.length <= maxLen) return text; return text.substring(0, maxLen) + '...'; }

function serializeToolInput(ti) { if (!ti) return ''; if (typeof ti === 'object') { try { return JSON.stringify(ti); } catch (_) { return String(ti); } } return String(ti); }

module.exports = {
  on: 'PreToolUse',
  match: (event) => { const t = event.tool_name || ''; return t === 'Bash' || t === 'Write' || t === 'Edit' || t === 'MultiEdit'; },
  priority: 200, profile: ['standard', 'strict'],
  async run(event, ctx) {
    if (isGovernanceDisabled()) return { exitCode: 0 };
    if (!isHookEnabled('governance', 'standard,strict')) return { exitCode: 0 };
    const inputText = serializeToolInput(event.tool_input || {});
    const secrets = scanForSecrets(inputText);
    if (secrets.length > 0) {
      ensureDir(GOVERNANCE_DIR);
      const fp = path.join(GOVERNANCE_DIR, new Date().toISOString().slice(0, 10) + '.jsonl');
      for (let i = 0; i < secrets.length; i++) {
        try { fs.appendFileSync(fp, JSON.stringify({ eventType: 'secret_detected', phase: 'pre', toolName: event.tool_name, pattern: secrets[i], textPreview: truncateText(inputText, MAX_TEXT_LENGTH), timestamp: new Date().toISOString() }) + '\n', 'utf8'); } catch (_) {}
      }
      return { exitCode: 2 };
    }
    return { exitCode: 0 };
  },
  scanForSecrets, truncateText,
};
