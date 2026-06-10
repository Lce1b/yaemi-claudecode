'use strict';

/**
 * Secret Scan — block commits containing hardcoded secrets.
 *
 * Scans git commit messages (-m) and command text for:
 *   - API keys (sk-..., xai-..., etc.)
 *   - Passwords in plaintext
 *   - Private keys (-----BEGIN ... PRIVATE KEY-----)
 *   - Tokens (JWT, GitHub, OAuth)
 *
 * Priority: 45 (before commit-quality)
 * Profile: minimal, standard, strict
 */

const extractCmd = require('../../lib/utils').extractCmd;
const { PATTERNS } = require('../../lib/secret-patterns');

function scanForSecrets(text) {
  var found = [];
  for (var i = 0; i < PATTERNS.length; i++) {
    var m = PATTERNS[i].re.exec(text);
    if (m) found.push({ label: PATTERNS[i].name, preview: m[0].substring(0, 40) + '...' });
  }
  return found;
}

module.exports = {
  on: 'PreToolUse',
  match: function(e) { return e.tool_name === 'Bash'; },
  priority: 45,
  profile: ['minimal', 'standard', 'strict'],

  async run(event, ctx) {
    var cmd = extractCmd(event);
    if (!cmd || !cmd.includes('git commit')) return { exitCode: 0 };

    var secrets = scanForSecrets(cmd);
    if (secrets.length > 0) {
      ctx.error('[yaemi] BLOCKED: Secrets detected in commit:\n' +
        secrets.map(function(s) { return '  - ' + s.label + ' (' + s.preview + ')'; }).join('\n') +
        '\nUse environment variables instead of hardcoded secrets.');
      return { exitCode: 2 };
    }

    return { exitCode: 0 };
  },
};
