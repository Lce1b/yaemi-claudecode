'use strict';

/**
 * Unit tests for hooks/handlers/governance.js
 *
 * Tests the pure functions: scanForSecrets, truncateText
 * Skips: check, run, writeGovernanceEvent (file I/O), isGovernanceDisabled (env-dependent)
 */

const assert = require('node:assert');
const { scanForSecrets, truncateText } = require('../handlers/standard/governance');

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

console.log('\n=== governance.js ===\n');

// ---- scanForSecrets ----

test('scanForSecrets detects sk- API key pattern', () => {
  // Regex requires 20+ alphanumeric chars after sk- (no hyphens allowed)
  const result = scanForSecrets('sk-abc123def456ghi789jklmnopqr');
  assert.ok(result.includes('sk-key'), 'expected sk-key to be detected, got: ' + JSON.stringify(result));
});

test('scanForSecrets detects api_key assignment', () => {
  const result = scanForSecrets('api_key = sk-abc123def456');
  assert.ok(result.length > 0, 'expected at least one pattern match');
});

test('scanForSecrets detects api-key assignment', () => {
  const result = scanForSecrets('export API_KEY=sk-abc123');
  assert.ok(result.length > 0, 'expected api-key pattern to match');
});

test('scanForSecrets detects token assignment', () => {
  const result = scanForSecrets('GITHUB_TOKEN = ghp_abc123def456');
  assert.ok(result.includes('credential'), 'expected credential pattern to match, got: ' + JSON.stringify(result));
});

test('scanForSecrets detects secret assignment', () => {
  const result = scanForSecrets('MY_SECRET = "super-secret-value"');
  assert.ok(result.includes('credential'), 'expected credential pattern to match, got: ' + JSON.stringify(result));
});

test('scanForSecrets detects password assignment', () => {
  const result = scanForSecrets('DB_PASSWORD = hunter2');
  assert.ok(result.includes('credential'), 'expected credential pattern to match, got: ' + JSON.stringify(result));
});

test('scanForSecrets returns empty array for clean text', () => {
  const result = scanForSecrets('const greeting = "hello world";');
  assert.deepStrictEqual(result, []);
});

test('scanForSecrets returns empty array for non-string input', () => {
  assert.deepStrictEqual(scanForSecrets(null), []);
  assert.deepStrictEqual(scanForSecrets(undefined), []);
  assert.deepStrictEqual(scanForSecrets(123), []);
  assert.deepStrictEqual(scanForSecrets({}), []);
});

test('scanForSecrets can detect multiple patterns in one text', () => {
  const result = scanForSecrets('sk-abc123 and API_KEY=xyz and SECRET=top');
  assert.ok(result.length >= 2, 'expected multiple patterns, got: ' + JSON.stringify(result));
});

test('scanForSecrets returns empty for empty string', () => {
  assert.deepStrictEqual(scanForSecrets(''), []);
});

test('scanForSecrets detects api-key with colons', () => {
  const result = scanForSecrets('api-key: "abcdef123456"');
  assert.ok(result.length > 0, 'expected api-key with colon to match');
});

// ---- truncateText ----

test('truncateText returns same string when under limit', () => {
  assert.strictEqual(truncateText('hello', 10), 'hello');
});

test('truncateText returns same string at exact limit', () => {
  assert.strictEqual(truncateText('12345', 5), '12345');
});

test('truncateText truncates and adds ellipsis when over limit', () => {
  const result = truncateText('hello world this is long', 10);
  assert.strictEqual(result, 'hello worl...');
  assert.strictEqual(result.length, 13); // 10 chars + '...'
});

test('truncateText returns empty string for null', () => {
  assert.strictEqual(truncateText(null, 100), '');
});

test('truncateText returns empty string for undefined', () => {
  assert.strictEqual(truncateText(undefined, 100), '');
});

test('truncateText returns empty string for empty input', () => {
  assert.strictEqual(truncateText('', 100), '');
});

// ---- Summary ----

const total = passed + failed;
console.log(`\ngovernance.test.js: ${passed}/${total} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
