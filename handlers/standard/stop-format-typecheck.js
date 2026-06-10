'use strict';

const fs = require('fs');
const path = require('path');
const { getAccumFile } = require('../../lib/utils');
const { formatPythonBatch, formatJsBatch, detectProjectRoot } = require('../../lib/formatter');
const TOTAL_BUDGET_MS = 270000;

module.exports = {
  on: 'Stop', match: () => true, priority: 100, profile: ['standard', 'strict'],
  async run(event, ctx) {
    var sid = event.session_id || '', accumFile = getAccumFile(sid);
    var raw; try { raw = fs.readFileSync(accumFile, 'utf8'); } catch (_) { return { exitCode: 0 }; }
    try { fs.unlinkSync(accumFile); } catch (_) {}
    var lines = raw.split('\n').map(function(l){return l.trim();}).filter(Boolean);
    if (lines.length === 0) return { exitCode: 0 };
    var seen = {}, files = [];
    for (var i = 0; i < lines.length; i++) { if (!seen[lines[i]]) { seen[lines[i]] = true; files.push(lines[i]); } }
    var pyRoots = {}, jsRoots = {};
    for (var j = 0; j < files.length; j++) { var f = path.resolve(files[j]); if (!fs.existsSync(f)) continue; var ext = path.extname(f).toLowerCase(); var info = detectProjectRoot(f); if (!info) continue; if (info.type === 'py' && ext === '.py') { if (!pyRoots[info.root]) pyRoots[info.root] = []; pyRoots[info.root].push(f); } else if (info.type === 'js' && ['.js','.ts','.jsx','.tsx'].indexOf(ext) !== -1) { if (!jsRoots[info.root]) jsRoots[info.root] = []; jsRoots[info.root].push(f); } }
    var totalBatches = Object.keys(pyRoots).length + Object.keys(jsRoots).length;
    var perBatch = totalBatches > 0 ? Math.floor(TOTAL_BUDGET_MS / totalBatches) : 120000;
    for (var pr in pyRoots) { if (pyRoots.hasOwnProperty(pr)) { ctx.log('Formatting Python files in ' + pr); formatPythonBatch(pr, pyRoots[pr], perBatch); } }
    for (var jr in jsRoots) { if (jsRoots.hasOwnProperty(jr)) { ctx.log('Formatting JS/TS files in ' + jr); formatJsBatch(jr, jsRoots[jr], perBatch); } }
    return { exitCode: 0 };
  },
};
