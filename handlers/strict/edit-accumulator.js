'use strict';

const fs = require('fs');
const { getAccumFile } = require('../../lib/utils');
const TRACKED_EXT = /\.(py|js|ts|jsx|tsx)$/i;

function appendPath(fp, accumFile) {
  if (!fp || !TRACKED_EXT.test(fp)) return;
  try {
    const raw = fs.existsSync(accumFile) ? fs.readFileSync(accumFile, 'utf8') : '';
    const existing = raw ? raw.split('\n').filter(Boolean) : [];
    const seen = new Set(existing);
    if (seen.has(fp)) return;
    existing.push(fp);
    fs.writeFileSync(accumFile, existing.join('\n') + '\n', 'utf8');
  } catch (_) {}
}

module.exports = {
  on: 'PostToolUse',
  match: (event) => { const t = event.tool_name || ''; return t === 'Write' || t === 'Edit' || t === 'MultiEdit'; },
  priority: 10, profile: ['standard', 'strict'],
  async run(event, ctx) {
    const sid = event.session_id || '';
    const af = getAccumFile(sid);
    const ti = event.tool_input || {};
    appendPath(ti.file_path, af);
    const edits = ti.edits;
    if (Array.isArray(edits)) {
      for (let i = 0; i < edits.length; i++) appendPath(edits[i].file_path, af);
    }
    return { exitCode: 0 };
  },
  appendPath,
};
