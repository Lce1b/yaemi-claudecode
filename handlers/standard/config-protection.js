'use strict';

/**
 * Config Protection — blocks edits to linter/formatter config files.
 *
 * Forces AI to fix the code itself instead of weakening linting rules
 * or disabling formatters. Inspired by ECC's config-protection hook.
 *
 * Priority: 5 (before other edit handlers)
 * Profile: standard, strict
 */

const path = require('path');
const config = require('../../lib/config');

const PROTECTED = new Set(config.PROTECTED_CONFIGS);

function isProtected(filePath) {
  const base = path.basename(filePath);
  if (PROTECTED.has(base)) return true;
  if (/^tsconfig\..*\.json$/.test(base)) return true;
  return false;
}

module.exports = {
  on: 'PreToolUse',
  match: (event) => {
    const tool = String(event.tool_name || '').toLowerCase();
    if (tool !== 'write' && tool !== 'edit' && tool !== 'multiedit') return false;
    const fp = (event.tool_input && event.tool_input.file_path) || '';
    return isProtected(fp);
  },
  priority: 5,
  profile: ['standard', 'strict'],

  async run(event, ctx) {
    const fp = (event.tool_input && event.tool_input.file_path) || '';
    const base = path.basename(fp);
    return {
      exitCode: 2,
      stderr: [
        '[Config Protection]',
        'Modifying "' + base + '" is blocked.',
        'Fix the code itself rather than weakening linting/building rules.',
        'Override: add "config-protection" to YAEMI_HOOK_DISABLED.',
      ].join('\n'),
    };
  },
};
