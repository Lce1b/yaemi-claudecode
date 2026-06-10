'use strict';

/**
 * PreToolUse Hook: Remind to write tests for new source files.
 *
 * Covers Rust (.rs under any src/ directory) and JS/TS (.js/.ts under
 * common source directories: src/, lib/, app/, pkg/).
 * Cross-session coverage tracking warns when coverage drops below history.
 *
 * Non-blocking — always returns exitCode 0.
 */

const path = require('path');
const fs = require('fs');
const config = require('../../lib/config');

const COVERAGE_FILE = path.join(config.DATA_DIR, 'coverage-history.json');

const RUST_SRC_RE = /(^|[\\/])src[\\/].+\.rs$/;
const RUST_EXCLUDE_RE = /(_test\.rs|test\.rs|mod\.rs)$/;

const JS_SRC_RE = /(^|[\\/])(src|lib|app|pkg)[\\/].+\.(js|ts|jsx|tsx)$/;
const JS_EXCLUDE_RE = /\.(test|spec)\.(js|ts|jsx|tsx)$/;

function findTestFile(filePath) {
  const parsed = path.parse(filePath);
  const dir = parsed.dir;
  const name = parsed.name;

  const rustTest = path.join(dir, name + '_test.rs');
  if (fs.existsSync(rustTest)) return rustTest;

  const jsTest1 = path.join(dir, name + '.test.js');
  if (fs.existsSync(jsTest1)) return jsTest1;
  const jsTest2 = path.join(dir, '__tests__', name + '.js');
  if (fs.existsSync(jsTest2)) return jsTest2;

  return null;
}

function loadCoverageHistory() {
  try { return JSON.parse(fs.readFileSync(COVERAGE_FILE, 'utf8')); }
  catch (_) { return { sessions: [], lastCoverage: null }; }
}

module.exports = {
  on: 'PreToolUse',
  match: (event) => event.tool_name === 'Write',
  priority: 360,
  profile: ['standard', 'strict'],

  async run(event, ctx) {
    const filePath = String(event.tool_input && event.tool_input.file_path || '');
    const normalised = filePath.replace(/\\/g, '/');

    const isRust = RUST_SRC_RE.test(normalised) && !RUST_EXCLUDE_RE.test(normalised);
    const isJS = JS_SRC_RE.test(normalised) && !JS_EXCLUDE_RE.test(normalised);

    if (!isRust && !isJS) return { exitCode: 0 };

    const testFile = findTestFile(filePath);
    if (testFile) return { exitCode: 0 };

    const lang = isRust ? 'Rust' : 'JS/TS';
    const testHint = isRust
      ? path.basename(filePath, '.rs') + '_test.rs'
      : path.basename(filePath).replace(/\.\w+$/, '.test.js');

    const history = loadCoverageHistory();
    let covWarning = '';
    if (history.lastCoverage !== null && history.lastCoverage < 80) {
      covWarning = ' (historical coverage ' + history.lastCoverage + '% < 80%)';
    }

    ctx.warn('[Hook] New ' + lang + ' file ' + filePath + ' — consider adding test: ' + testHint + covWarning);

    return { exitCode: 0 };
  },

  findTestFile,
  loadCoverageHistory,
  RUST_SRC_RE,
  RUST_EXCLUDE_RE,
  JS_SRC_RE,
  JS_EXCLUDE_RE,
};
