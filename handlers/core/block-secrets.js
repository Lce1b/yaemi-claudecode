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

const SECRET_PATTERNS = [
  { re: /sk-[a-zA-Z0-9_-]{20,}/,                                label: 'OpenAI/Anthropic API key' },
  { re: /xai-[a-zA-Z0-9_-]{20,}/,                               label: 'xAI API key' },
  { re: /AIza[0-9A-Za-z_-]{35}/,                                label: 'Google API key' },
  { re: /ghp_[0-9a-zA-Z]{36}/,                                  label: 'GitHub personal access token' },
  { re: /gho_[0-9a-zA-Z]{36}/,                                  label: 'GitHub OAuth token' },
  { re: /ghs_[0-9a-zA-Z]{36}/,                                  label: 'GitHub server token' },
  { re: /-----BEGIN (RSA |EC |DSA |OPENSSH |)?PRIVATE KEY-----/, label: 'Private key' },
  { re: /eyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}/, label: 'JWT token' },
  { re: /(?:password|passwd|pwd|secret)\s*[=:]\s*['"][^'"]{8,}['"]/i, label: 'Hardcoded password/secret' },
  { re: /(?:api[_-]?key|apikey|api[_-]?secret)\s*[=:]\s*['"][^'"]{8,}['"]/i, label: 'Hardcoded API key/secret' },
  { re: /(?:access[_-]?token|auth[_-]?token)\s*[=:]\s*['"][^'"]{8,}['"]/i, label: 'Hardcoded access token' },
];

function scanForSecrets(text) {
  var found = [];
  for (var i = 0; i < SECRET_PATTERNS.length; i++) {
    var m = SECRET_PATTERNS[i].re.exec(text);
    if (m) found.push({ label: SECRET_PATTERNS[i].label, preview: m[0].substring(0, 40) + '...' });
  }
  return found;
}

module.exports = {
  on: 'PreToolUse',
  match: function(e) { return e.tool_name === 'Bash'; },
  priority: 45,
  profile: ['minimal', 'standard', 'strict'],

  async run(event, ctx) {
    var cmd = extractCmd(JSON.stringify(event));
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
