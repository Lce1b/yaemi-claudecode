'use strict';

const fs = require('fs');
const path = require('path');
const { isHookEnabled } = require('../../lib/profile');

const FRONTEND_EXT = /\.(html|css|jsx|tsx|vue|svelte|astro)$/i;
const SIGNALS = [
  { pattern: /\bGet Started\b/, label: '"Get Started" CTA' },
  { pattern: /\bLearn More\b/, label: '"Learn More" CTA' },
  { pattern: /\bWelcome to\b/i, label: '"Welcome to"' },
  { pattern: /\bSign Up Now\b/i, label: '"Sign Up Now" CTA' },
  { pattern: /\bgrid-cols-3\b/, label: 'grid-cols-3' },
  { pattern: /\bbg-gradient-to-[trbl]\b/, label: 'bg-gradient-to-*' },
  { pattern: /\brounded-xl\b/, label: 'rounded-xl' },
];

function detectSignals(content) {
  const found = [];
  for (let i = 0; i < SIGNALS.length; i++) {
    if (SIGNALS[i].pattern.test(content)) found.push(SIGNALS[i].label);
  }
  return found;
}

module.exports = {
  on: 'PostToolUse',
  match: (event) => { const t = event.tool_name || ''; return t === 'Write' || t === 'Edit' || t === 'MultiEdit'; },
  priority: 200, profile: ['standard', 'strict'],
  async run(event, ctx) {
    if (!isHookEnabled('design-quality')) return { exitCode: 0 };
    const ti = event.tool_input || {};
    let filePaths;
    if (ti.file_path) {
      filePaths = [String(ti.file_path)];
    } else if (Array.isArray(ti.edits)) {
      filePaths = [];
      for (let ei = 0; ei < ti.edits.length; ei++) {
        const ep = ti.edits[ei] && ti.edits[ei].file_path;
        if (ep) filePaths.push(String(ep));
      }
    } else {
      filePaths = [];
    }
    const fp = [];
    for (let i = 0; i < filePaths.length; i++) { if (FRONTEND_EXT.test(filePaths[i])) fp.push(filePaths[i]); }
    if (fp.length === 0) return { exitCode: 0 };
    let findings = [];
    for (let j = 0; j < fp.length; j++) { try { findings = findings.concat(detectSignals(fs.readFileSync(path.resolve(fp[j]), 'utf8'))); } catch (_) {} }
    const seen = {};
    const unique = [];
    for (let k = 0; k < findings.length; k++) { if (!seen[findings[k]]) { seen[findings[k]] = true; unique.push(findings[k]); } }
    if (unique.length < 2) return { exitCode: 0 };
    ctx.warn('[Hook] DESIGN CHECK: Generic/template signals detected: ' + unique.join(', ') + ' in ' + fp.join(', '));
    return { exitCode: 0 };
  },
  detectSignals,
};
