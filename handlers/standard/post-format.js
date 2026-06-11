'use strict';

const fs = require('fs');
const path = require('path');
const { isHookEnabled } = require('../../lib/profile');
const { formatFile } = require('../../lib/formatter');
const { debugLog } = require('../../lib/utils');
const config = require('../../lib/config');

function tryFormatFile(fp) {
  if (!fp || !config.TRACKED_EXT.test(fp)) return;
  if (!fs.existsSync(path.resolve(fp))) return;
  try {
    const start = Date.now();
    formatFile(fp, { timeoutMs: config.FORMAT_TIMEOUT_MS });
    const elapsed = Date.now() - start;
    if (elapsed > 100) debugLog('Formatted ' + path.basename(fp) + ' (' + elapsed + 'ms)');
  } catch (e) {
    debugLog('post-format error: ' + (e.message || e));
  }
}

module.exports = {
  on: 'PostToolUse',
  match: (event) => {
    const t = event.tool_name || '';
    return t === 'Write' || t === 'Edit' || t === 'MultiEdit';
  },
  priority: 100,
  profile: ['standard', 'strict'],
  async run(event, ctx) {
    if (!isHookEnabled('post-format', 'standard,strict')) return { exitCode: 0 };
    const ti = event.tool_input || {};
    if ((event.tool_name || '') === 'MultiEdit') {
      const edits = ti.edits || [];
      for (let i = 0; i < edits.length; i++) tryFormatFile(edits[i].file_path);
    } else {
      tryFormatFile(ti.file_path);
    }
    return { exitCode: 0 };
  },
};
