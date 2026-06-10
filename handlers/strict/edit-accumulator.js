'use strict';

const fs = require('fs');
const { getAccumFile } = require('../../lib/utils');
const TRACKED_EXT = /\.(py|js|ts|jsx|tsx)$/i;

function appendPath(fp, accumFile) { if (!fp || !TRACKED_EXT.test(fp)) return; try { var existing = []; if (fs.existsSync(accumFile)) existing = fs.readFileSync(accumFile, 'utf8').split('\\n').filter(Boolean); for (var i = 0; i < existing.length; i++) { if (existing[i].trim() === fp) return; } existing.push(fp); fs.writeFileSync(accumFile, existing.join('\\n') + '\\n', 'utf8'); } catch (_) {} }

module.exports = {
  on: 'PostToolUse',
  match: (event) => { var t = event.tool_name || ''; return t === 'Write' || t === 'Edit' || t === 'MultiEdit'; },
  priority: 10, profile: ['minimal', 'standard', 'strict'],
  async run(event, ctx) { var sid = event.session_id || '', af = getAccumFile(sid), ti = event.tool_input || {}; appendPath(ti.file_path, af); var edits = ti.edits; if (Array.isArray(edits)) { for (var i = 0; i < edits.length; i++) appendPath(edits[i].file_path, af); } return { exitCode: 0 }; },
  appendPath,
};
