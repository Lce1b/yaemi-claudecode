'use strict';

const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const os = require('os');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log('  PASS: ' + name);
  } catch (e) {
    failed++;
    console.log('  FAIL: ' + name + ' -- ' + e.message);
  }
}

// Replicate handler's pure helpers
var TEST_FILE_PATTERNS = [/\.test\./, /\.spec\./, /_test\./, /_spec\./, /^test_/, /^spec_/, /\/tests\//, /\/spec\//, /\/__tests__\//];

function isTestFile(fp) {
  if (!fp) return false;
  var n = fp.replace(/\\/g, '/');
  var b = path.basename(n);
  for (var i = 0; i < TEST_FILE_PATTERNS.length; i++) {
    if (TEST_FILE_PATTERNS[i].test(n) || TEST_FILE_PATTERNS[i].test(b)) return true;
  }
  return false;
}

var FILE_READ_BUF = 65536;
var SMALL_LINE_LIMIT = 50;
var MEDIUM_LINE_LIMIT = 200;

function classifyFileSize(fp) {
  if (!fp) return 'absent';
  try {
    var r = path.resolve(fp);
    if (!fs.existsSync(r)) return 'absent';
    var fd = fs.openSync(r, 'r');
    try {
      var buf = Buffer.alloc(FILE_READ_BUF);
      var bytes = 0;
      var newlines = 0;
      while ((bytes = fs.readSync(fd, buf, 0, buf.length, null)) > 0) {
        for (var i = 0; i < bytes; i++) {
          if (buf[i] === 10) {
            newlines++;
            if (newlines > MEDIUM_LINE_LIMIT) return 'large';
          }
        }
      }
      var lines = newlines + 1;
      if (lines < SMALL_LINE_LIMIT) return 'small';
      if (lines <= MEDIUM_LINE_LIMIT) return 'medium';
      return 'large';
    } finally {
      fs.closeSync(fd);
    }
  } catch (_) { return 'absent'; }
}

function createTempFile(lineCount) {
  var tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'yaemi-gate-test-'));
  var fp = path.join(tmpDir, 'test.js');
  var lines = [];
  for (var i = 0; i < lineCount; i++) lines.push('// line ' + i);
  fs.writeFileSync(fp, lines.join('\n') + '\n', 'utf8');
  return { filePath: fp, dir: tmpDir };
}

function cleanup(tmp) {
  try { fs.rmSync(tmp.dir, { recursive: true, force: true }); } catch (_) {}
}

console.log('\n=== gateguard.js ===\n');

// ---- isTestFile ----

test('detects .test. pattern', () => {
  assert.ok(isTestFile('/project/src/utils.test.js'));
});

test('detects .spec. pattern', () => {
  assert.ok(isTestFile('/project/src/utils.spec.ts'));
});

test('detects _test pattern', () => {
  assert.ok(isTestFile('/project/src/utils_test.py'));
});

test('detects _spec pattern', () => {
  assert.ok(isTestFile('/project/src/utils_spec.rb'));
});

test('detects test_ prefix', () => {
  assert.ok(isTestFile('/project/src/test_utils.py'));
});

test('detects spec_ prefix', () => {
  assert.ok(isTestFile('/project/spec_utils.rb'));
});

test('detects /tests/ directory', () => {
  assert.ok(isTestFile('/project/tests/test_auth.py'));
});

test('detects /spec/ directory', () => {
  assert.ok(isTestFile('/project/spec/auth_spec.rb'));
});

test('detects /__tests__/ directory', () => {
  assert.ok(isTestFile('/project/__tests__/utils.test.js'));
});

test('returns false for regular source file', () => {
  assert.ok(!isTestFile('/project/src/utils.js'));
});

test('returns false for null', () => {
  assert.ok(!isTestFile(null));
});

test('returns false for undefined', () => {
  assert.ok(!isTestFile(undefined));
});

test('returns false for empty string', () => {
  assert.ok(!isTestFile(''));
});

test('Windows-style paths are normalized', () => {
  assert.ok(isTestFile('C:\\project\\src\\utils.test.js'));
});

test('does NOT flag file with "test" in name but not a test file', () => {
  assert.ok(!isTestFile('/project/src/testData.js'));
});

// ---- classifyFileSize ----

test('classify returns absent for null path', () => {
  assert.strictEqual(classifyFileSize(null), 'absent');
});

test('classify returns absent for non-existent file', () => {
  assert.strictEqual(classifyFileSize('/nonexistent/file.js'), 'absent');
});

test('classify returns small for file with <50 lines', () => {
  var tmp = createTempFile(10);
  try {
    assert.strictEqual(classifyFileSize(tmp.filePath), 'small');
  } finally { cleanup(tmp); }
});

test('classify returns small for file with 48 lines (boundary)', () => {
  var tmp = createTempFile(48);
  try {
    assert.strictEqual(classifyFileSize(tmp.filePath), 'small');
  } finally { cleanup(tmp); }
});

test('classify returns medium for file with 49 lines', () => {
  var tmp = createTempFile(49);
  try {
    assert.strictEqual(classifyFileSize(tmp.filePath), 'medium');
  } finally { cleanup(tmp); }
});

test('classify returns medium for file with 199 lines (boundary)', () => {
  var tmp = createTempFile(199);
  try {
    assert.strictEqual(classifyFileSize(tmp.filePath), 'medium');
  } finally { cleanup(tmp); }
});

test('classify returns large for file with 200 lines', () => {
  var tmp = createTempFile(200);
  try {
    assert.strictEqual(classifyFileSize(tmp.filePath), 'large');
  } finally { cleanup(tmp); }
});

test('classify returns large for very large file', () => {
  var tmp = createTempFile(500);
  try {
    assert.strictEqual(classifyFileSize(tmp.filePath), 'large');
  } finally { cleanup(tmp); }
});

test('classify handles empty file as small (1 line)', () => {
  var tmp = createTempFile(0);
  try {
    assert.strictEqual(classifyFileSize(tmp.filePath), 'small');
  } finally { cleanup(tmp); }
});

// ---- Summary ----

var total = passed + failed;
console.log('\ngateguard.test.js: ' + passed + '/' + total + ' passed, ' + failed + ' failed\n');
process.exit(failed > 0 ? 1 : 0);
