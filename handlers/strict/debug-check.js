'use strict';

/**
 * PostToolUse Hook: Scan edited content for debug statements
 *
 * Scans the content being written/edited (from tool_input.content or
 * tool_input.new_string) and the target file itself for common debug
 * statements: console.log(), console.debug(), print(), debugger.
 *
 * Profile: standard, strict
 * exitCode is always 0 (warns only, never blocks).
 */

const fs = require('fs');
const path = require('path');
const { isHookEnabled } = require('../../lib/profile');

const DEBUG_PATTERNS = [
  { pattern: /console\.log\s*\(/,       label: 'console.log(' },
  { pattern: /console\.debug\s*\(/,     label: 'console.debug(' },
  { pattern: /\bdebugger\b/,            label: 'debugger' },
  { pattern: /^\s*print\s*\(/,          label: 'print(' },
];
const TRACKED_EXT = /\.(js|ts|jsx|tsx|py)$/i;

function scanContent(content, filePath) {
  const results = [];
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (/^\s*\/\//.test(line) || /^\s*#/.test(line)) continue;
    if (/^\s*\/\*/.test(line) || /^\s*\*/.test(line)) continue;

    for (let p = 0; p < DEBUG_PATTERNS.length; p++) {
      if (DEBUG_PATTERNS[p].pattern.test(trimmed)) {
        results.push({
          label: DEBUG_PATTERNS[p].label,
          file: filePath,
          lineNum: i + 1,
          text: trimmed.length > 80 ? trimmed.substring(0, 80) + '...' : trimmed,
        });
        break;
      }
    }
  }

  return results;
}

module.exports = {
  on: 'PostToolUse',
  match: (event) => {
    const toolName = event.tool_name || '';
    return toolName === 'Write' || toolName === 'Edit' || toolName === 'MultiEdit';
  },
  priority: 300,
  profile: ['standard', 'strict'],

  /**
   * @param {Object} event - Parsed hook event
   * @param {Object} ctx - HookContext with warn/log/sink
   */
  async run(event, ctx) {
    if (!isHookEnabled('debug-check')) return { exitCode: 0 };

    const toolInput = event.tool_input || {};
    let findings = [];

    if (toolInput.content) {
      const filePath = toolInput.file_path || 'unknown';
      if (TRACKED_EXT.test(filePath)) {
        findings = findings.concat(scanContent(toolInput.content, filePath));
      }
    }

    if (toolInput.new_string) {
      const editPath = toolInput.file_path || 'unknown';
      if (TRACKED_EXT.test(editPath)) {
        findings = findings.concat(scanContent(toolInput.new_string, editPath));
      }
    }

    const diskPath = toolInput.file_path;
    if (diskPath && TRACKED_EXT.test(diskPath)) {
      try {
        const resolved = path.resolve(diskPath);
        if (fs.existsSync(resolved)) {
          const diskContent = fs.readFileSync(resolved, 'utf8');
          findings = findings.concat(scanContent(diskContent, diskPath));
        }
      } catch (_) { /* best-effort */ }
    }

    if (findings.length === 0) return { exitCode: 0 };

    let stderr = '[Hook] DEBUG CHECK: Debug statements detected:\n';
    for (const f of findings) {
      stderr += '  ' + f.file + ':' + f.lineNum + '  ' + f.label + '  ' + f.text + '\n';
    }
    stderr += '[Hook] Remove debug statements before committing.\n';

    ctx.warn(stderr);
    return { exitCode: 0 };
  },

  // Exported for tests
  scanContent,
  DEBUG_PATTERNS,
  TRACKED_EXT,
};
