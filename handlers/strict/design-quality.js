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

function detectSignals(content) { var found = []; for (var i = 0; i < SIGNALS.length; i++) { if (SIGNALS[i].pattern.test(content)) found.push(SIGNALS[i].label); } return found; }

module.exports = {
  on: 'PostToolUse',
  match: (event) => { var t = event.tool_name || ''; return t === 'Write' || t === 'Edit' || t === 'MultiEdit'; },
  priority: 200, profile: ['standard', 'strict'],
  async run(event, ctx) {
    if (!isHookEnabled('design-quality')) return { exitCode: 0 };
    var ti = event.tool_input || {};
    var filePaths = ti.file_path ? [String(ti.file_path)] : Array.isArray(ti.edits) ? ti.edits.map(function(e){return e&&e.file_path?String(e.file_path):'';}).filter(Boolean) : [];
    var fp = [];
    for (var i = 0; i < filePaths.length; i++) { if (FRONTEND_EXT.test(filePaths[i])) fp.push(filePaths[i]); }
    if (fp.length === 0) return { exitCode: 0 };
    var findings = [];
    for (var j = 0; j < fp.length; j++) { try { findings = findings.concat(detectSignals(fs.readFileSync(path.resolve(fp[j]), 'utf8'))); } catch (_) {} }
    var seen = {}, unique = [];
    for (var k = 0; k < findings.length; k++) { if (!seen[findings[k]]) { seen[findings[k]] = true; unique.push(findings[k]); } }
    if (unique.length < 2) return { exitCode: 0 };
    ctx.warn('[Hook] DESIGN CHECK: Generic/template signals detected: ' + unique.join(', ') + ' in ' + fp.join(', '));
    return { exitCode: 0 };
  },
  detectSignals,
};
