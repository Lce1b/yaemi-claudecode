'use strict';

/**
 * File Size Guard — PreToolUse handler for Write/Edit/MultiEdit
 *
 * Blocks writes that would result in files exceeding FILE_SIZE_LIMIT lines (default 800).
 * Bypasses: .json/.lock/.yaml/.toml/.md/.csv/.svg files, test files, node_modules, .git
 *
 * Profile: minimal, standard, strict (basic safety measure)
 */

const fs = require('fs');
const path = require('path');
const { isHookEnabled } = require('../../lib/profile');
const config = require('../../lib/config');

const FILE_SIZE_LIMIT = config.FILE_SIZE_LIMIT;
const BYPASSED_EXTS = new Set(['.json', '.jsonc', '.yaml', '.yml', '.toml', '.lock', '.md', '.csv', '.svg']);
const BYPASSED_SEGMENTS = ['/node_modules/', '/.git/', '/fixtures/', '/test_', '_test/', '.spec.', '.test.'];

function isBypassed(filePath) {
  const normalized = filePath.replace(/\\/g, '/');
  const ext = path.extname(filePath).toLowerCase();
  const basename = path.basename(filePath);

  if (BYPASSED_EXTS.has(ext)) return true;

  for (const seg of BYPASSED_SEGMENTS) {
    if (normalized.indexOf(seg) !== -1) return true;
  }

  const bypassList = (config.getConfig("gateguard.bypass") || "").split(",").filter(Boolean);
  for (const pattern of bypassList) {
    if (basename === pattern) return true;
    if (pattern.indexOf('/') !== -1 && normalized.indexOf(pattern) !== -1) return true;
  }

  return false;
}

function countWriteLines(toolInput) {
  return (toolInput.content || '').split('\n').length;
}

function countEditLines(toolInput) {
  const filePath = toolInput.file_path;
  if (!filePath) return 0;

  let currentContent;
  try {
    currentContent = fs.readFileSync(path.resolve(filePath), 'utf8');
  } catch (_) {
    currentContent = '';
  }

  const oldStr = toolInput.old_string || '';
  const newStr = toolInput.new_string || '';

  if (!oldStr.trim()) {
    return currentContent.split('\n').length + newStr.split('\n').length - 1;
  }

  const index = currentContent.indexOf(oldStr);
  if (index === -1) {
    return currentContent.split('\n').length + newStr.split('\n').length;
  }

  const result = currentContent.substring(0, index) + newStr + currentContent.substring(index + oldStr.length);
  return result.split('\n').length;
}

function checkFile(toolName, toolInput) {
  const filePath = toolInput.file_path;
  if (!filePath || isBypassed(filePath)) return null;

  let lineCount = 0;
  if (toolName === 'Write') {
    lineCount = countWriteLines(toolInput);
  } else if (toolName === 'Edit') {
    lineCount = countEditLines(toolInput);
  }

  if (lineCount > FILE_SIZE_LIMIT) {
    return '[FileSizeGuard] ' + path.basename(filePath) + ' would be ' + lineCount + ' lines (limit: ' + FILE_SIZE_LIMIT + '). Split into smaller modules.';
  }

  return null;
}

module.exports = {
  on: 'PreToolUse',
  match: (event) => {
    const toolName = event.tool_name || '';
    return toolName === 'Write' || toolName === 'Edit' || toolName === 'MultiEdit';
  },
  priority: 100,
  profile: ['minimal', 'standard', 'strict'],

  /**
   * @param {Object} event - Parsed hook event
   * @param {Object} ctx - HookContext
   */
  async run(event, ctx) {
    if (!isHookEnabled('file-size-guard', 'minimal,standard,strict')) {
      return { exitCode: 0 };
    }

    const toolName = event.tool_name || '';
    const toolInput = event.tool_input || {};

    if (toolName === 'MultiEdit') {
      const edits = toolInput.edits || [];
      for (const edit of edits) {
        const msg = checkFile('Edit', edit);
        if (msg) {
          ctx.error(msg);
          return { exitCode: 2 };
        }
      }
      return { exitCode: 0 };
    }

    const msg = checkFile(toolName, toolInput);
    if (msg) {
      ctx.error(msg);
      return { exitCode: 2 };
    }

    return { exitCode: 0 };
  },

  // Exported for tests
  isBypassed,
  countWriteLines,
  countEditLines,
  checkFile,
};
