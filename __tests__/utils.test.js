'use strict';

/**
 * Unit tests for hooks/lib/utils.js
 *
 * Tests the pure functions: extractCmd, getAccumFile
 * Skips: readStdinSync (stdin I/O), debugLog (file I/O), getGitDiff (subprocess)
 */

const assert = require('node:assert');
const path = require('path');
const os = require('os');
const utils = require('../lib/utils');

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

console.log('\n=== utils.js ===\n');

// ---- extractCmd ----

test('extractCmd returns command from valid JSON', () => {
  const input = JSON.stringify({ tool_input: { command: 'npm install' } });
  assert.strictEqual(utils.extractCmd(input), 'npm install');
});

test('extractCmd returns empty string for empty input', () => {
  assert.strictEqual(utils.extractCmd(''), '');
});

test('extractCmd returns empty string for invalid JSON', () => {
  assert.strictEqual(utils.extractCmd('not json'), '');
});

test('extractCmd returns empty string when command field is missing', () => {
  const input = JSON.stringify({ tool_input: { file_path: '/tmp/x' } });
  assert.strictEqual(utils.extractCmd(input), '');
});

test('extractCmd returns empty string when tool_input is missing', () => {
  const input = JSON.stringify({ tool_name: 'Bash' });
  assert.strictEqual(utils.extractCmd(input), '');
});

test('extractCmd trims whitespace from command', () => {
  const input = JSON.stringify({ tool_input: { command: '  npm install  ' } });
  assert.strictEqual(utils.extractCmd(input), 'npm install');
});

test('extractCmd handles null tool_input gracefully', () => {
  const input = JSON.stringify({ tool_input: null });
  assert.strictEqual(utils.extractCmd(input), '');
});

// ---- getAccumFile ----

test('getAccumFile uses provided sessionId', () => {
  const result = utils.getAccumFile('my-session-123');
  assert.ok(result.includes('my-session-123'), 'expected session ID in path, got: ' + result);
  assert.ok(result.startsWith(os.tmpdir()), 'expected tmpdir prefix, got: ' + result);
  assert.ok(result.endsWith('.txt'), 'expected .txt extension, got: ' + result);
});

test('getAccumFile sanitizes unsafe characters in sessionId', () => {
  const result = utils.getAccumFile('bad/chars:here*nope');
  const basename = path.basename(result);
  assert.ok(!basename.includes('/'), 'path should not contain slash: ' + basename);
  assert.ok(!basename.includes(':'), 'path should not contain colon: ' + basename);
  assert.ok(!basename.includes('*'), 'path should not contain asterisk: ' + basename);
});

test('getAccumFile limits sessionId to 64 characters', () => {
  const longId = 'a'.repeat(200);
  const result = utils.getAccumFile(longId);
  const basename = path.basename(result);
  // basename is 'yaemi-edit-<id>.txt' so the id part should be <= 64
  const idPart = basename.replace('yaemi-edit-', '').replace('.txt', '');
  assert.ok(idPart.length <= 64, 'ID part should be <= 64 chars, got ' + idPart.length);
});

// ---- Summary ----

const total = passed + failed;
console.log(`\nutils.test.js: ${passed}/${total} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
