'use strict';

const fs = require('fs');
const path = require('path');
const { isHookEnabled } = require('../../lib/profile');
const { formatFile } = require('../../lib/formatter');
const { debugLog } = require('../../lib/utils');
const config = require('../../lib/config');

module.exports = {
  on: 'PostToolUse',
  match: (event) => { var t = event.tool_name || ''; return t === 'Write' || t === 'Edit' || t === 'MultiEdit'; },
  priority: 100, profile: ['standard', 'strict'],
  async run(event, ctx) {
    if (!isHookEnabled('post-format', 'standard,strict')) return { exitCode: 0 };
    var ti = event.tool_input || {};
    function tryFormat(fp) { if (!fp || !config.TRACKED_EXT.test(fp)) return; if (!fs.existsSync(path.resolve(fp))) return; try { var start = Date.now(); formatFile(fp, { timeoutMs: config.FORMAT_TIMEOUT_MS }); var elapsed = Date.now() - start; if (elapsed > 100) ctx.log('Formatted ' + path.basename(fp) + ' (' + elapsed + 'ms)'); } catch (e) { debugLog('post-format error: ' + (e.message || e)); } }
    if ((event.tool_name || '') === 'MultiEdit') { var edits = ti.edits || []; for (var i = 0; i < edits.length; i++) tryFormat(edits[i].file_path); }
    else tryFormat(ti.file_path);
    return { exitCode: 0 };
  },
};
