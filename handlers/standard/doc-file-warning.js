'use strict';

/**
 * PreToolUse Hook: Warn about ad-hoc / temporary documentation filenames.
 * Non-blocking — always returns exitCode 0.
 */

const path = require('path');

function isSuspiciousDocPath(filePath) {
  if (!filePath) return false;
  const normalized = String(filePath).replace(/\\/g, '/');
  const basename = path.basename(normalized);
  if (basename === 'NOTES.md' || basename === 'TODO.md') return true;
  if (/^TEMP_/i.test(basename)) return true;
  if (/^temp_/i.test(basename)) return true;
  if (/^Untitled/i.test(basename)) return true;
  if (/^scratch\./i.test(basename)) return true;
  if (basename === 'test.js' || basename === 'test.ts') return true;
  return false;
}

module.exports = {
  on: 'PreToolUse',
  match: (event) => event.tool_name === 'Write',
  priority: 370,
  profile: ['standard', 'strict'],

  async run(event, ctx) {
    const filePath = String(event.tool_input && event.tool_input.file_path || '');
    if (filePath && isSuspiciousDocPath(filePath)) {
      const basename = path.basename(filePath.replace(/\\/g, '/'));
      ctx.warn('[Hook] Temporary filename (' + basename + ') — consider a permanent name.');
    }
    return { exitCode: 0 };
  },

  isSuspiciousDocPath,
};
