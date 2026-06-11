'use strict';

const assert = require('node:assert');
const { PATTERNS, scan } = require('../lib/secret-patterns');

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

function K(p, s) { return p + s; }

console.log('\n=== secret-patterns.js ===\n');

// ---- scan() ----

test('scan returns empty for null', () => {
  assert.deepStrictEqual(scan(null), []);
});

test('scan returns empty for undefined', () => {
  assert.deepStrictEqual(scan(undefined), []);
});

test('scan returns empty for non-string (number)', () => {
  assert.deepStrictEqual(scan(123), []);
});

test('scan returns empty for non-string (object)', () => {
  assert.deepStrictEqual(scan({}), []);
});

test('scan returns empty for empty string', () => {
  assert.deepStrictEqual(scan(''), []);
});

test('scan returns empty for clean text', () => {
  assert.deepStrictEqual(scan('const greeting = "hello world";'), []);
});

// ---- individual patterns ----

test('detects openai-key', () => {
  var s = K('sk-', 'abc123def456ghi789jklmnopqrstuv');
  var result = scan(s);
  assert.ok(result.some(function(r) { return r.name === 'openai-key'; }));
});

test('detects xai-key', () => {
  var s = K('xai-', 'abc123def456ghi789jklmnopqrstuv');
  var result = scan(s);
  assert.ok(result.some(function(r) { return r.name === 'xai-key'; }));
});

test('detects google-key', () => {
  var s = K('AIza', 'SyD4kE5K89n5W6N9O6g4D2f3O3K5p8F1aB2cDe');
  var result = scan(s);
  assert.ok(result.some(function(r) { return r.name === 'google-key'; }));
});

test('detects github-pat', () => {
  var s = K('ghp_', '1A2b3C4d5E6f7G8h9I0j1K2l3M4n5O6p7Q8r9S0');
  var result = scan(s);
  assert.ok(result.some(function(r) { return r.name === 'github-pat'; }));
});

test('detects github-oauth', () => {
  var s = K('gho_', '1A2b3C4d5E6f7G8h9I0j1K2l3M4n5O6p7Q8r9S');
  var result = scan(s);
  assert.ok(result.some(function(r) { return r.name === 'github-oauth'; }));
});

test('detects gitlab-token', () => {
  var s = K('glpat-', 'abcdefghijklmnopqrstu');
  var result = scan(s);
  assert.ok(result.some(function(r) { return r.name === 'gitlab-token'; }));
});

test('detects aws-key', () => {
  var s = K('AKIA', '1234567890ABCDEF');
  var result = scan(s);
  assert.ok(result.some(function(r) { return r.name === 'aws-key'; }));
});

test('detects slack-webhook', () => {
  var s = K('https://hooks.slack.com/services/', 'T00000000/B00000000/xxxxxxxxxx');
  var result = scan(s);
  assert.ok(result.some(function(r) { return r.name === 'slack-webhook'; }));
});

test('detects npm-token', () => {
  var s = K('_auth', K('T', 'oken=npm_AbCdEfGhIjKlMnOpQrStUvWxYz'));
  var result = scan(s);
  assert.ok(result.some(function(r) { return r.name === 'npm-token'; }));
});

test('detects private-key header', () => {
  var result = scan(K('-----BEGIN ', 'PRIVATE KEY-----'));
  assert.ok(result.some(function(r) { return r.name === 'private-key'; }));
});

test('detects RSA private key', () => {
  var result = scan(K('-----BEGIN RSA ', 'PRIVATE KEY-----'));
  assert.ok(result.some(function(r) { return r.name === 'private-key'; }));
});

test('detects EC private key', () => {
  var result = scan(K('-----BEGIN EC ', 'PRIVATE KEY-----'));
  assert.ok(result.some(function(r) { return r.name === 'private-key'; }));
});

test('detects OPENSSH private key', () => {
  var result = scan(K('-----BEGIN OPENSSH ', 'PRIVATE KEY-----'));
  assert.ok(result.some(function(r) { return r.name === 'private-key'; }));
});

test('detects JWT token', () => {
  var s = K('eyJhbGciOiJIUzI1NiJ9.', 'eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w');
  var result = scan(s);
  assert.ok(result.some(function(r) { return r.name === 'jwt'; }));
});

test('detects password assignment', () => {
  var s = K('p', 'assword = hunter2');
  var result = scan(s);
  assert.ok(result.some(function(r) { return r.name === 'password'; }));
});

test('detects password with colon', () => {
  var s = K('DB_P', 'ASSWORD: "super-secret"');
  var result = scan(s);
  assert.ok(result.some(function(r) { return r.name === 'password'; }));
});

test('detects api-key assignment', () => {
  var s = K('API_', 'KEY = abcdefghij');
  var result = scan(s);
  assert.ok(result.some(function(r) { return r.name === 'api-key-var'; }));
});

test('detects api-key with colon', () => {
  var s = K('api-', 'key: "abcdef123456"');
  var result = scan(s);
  assert.ok(result.some(function(r) { return r.name === 'api-key-var'; }));
});

test('detects access-token assignment', () => {
  var s = K('ACCE', K('SS_', K('TOK', 'EN = xyz-value-here')));
  var result = scan(s);
  assert.ok(result.some(function(r) { return r.name === 'access-token'; }));
});

test('detects access-token with colon', () => {
  var s = K('acc', K('ess-', K('tok', 'en: "my-val"')));
  var result = scan(s);
  assert.ok(result.some(function(r) { return r.name === 'access-token'; }));
});

test('detects multiple patterns in one text', () => {
  var s = K('sk-', 'abc123def456ghi789jklmnopqrstuv') + ' and ' + K('P', 'ASSWORD=top');
  var result = scan(s);
  assert.ok(result.length >= 2, 'expected >= 2 patterns, got ' + JSON.stringify(result));
});

// ---- exclusion patterns (must NOT flag env/config references) ----

test('does NOT flag password from process.env', () => {
  var result = scan('const pass = process.env.DB_PASSWORD;');
  assert.deepStrictEqual(result, []);
});

test('does NOT flag api-key from process.env', () => {
  var result = scan('const key = process.env.API_KEY;');
  assert.deepStrictEqual(result, []);
});

test('does NOT flag token from config', () => {
  var result = scan('const tok = config.authToken;');
  assert.deepStrictEqual(result, []);
});

test('does NOT flag secret from import.meta.env', () => {
  var result = scan('const sec = import.meta.env.VITE_API_SECRET;');
  assert.deepStrictEqual(result, []);
});

// ---- PATTERNS array ----

test('PATTERNS is a non-empty array', () => {
  assert.ok(Array.isArray(PATTERNS), 'PATTERNS should be an array');
  assert.ok(PATTERNS.length > 0, 'PATTERNS should not be empty');
});

test('each PATTERN has name and re', () => {
  for (var i = 0; i < PATTERNS.length; i++) {
    assert.ok(typeof PATTERNS[i].name === 'string', 'pattern ' + i + ' missing name');
    assert.ok(PATTERNS[i].re instanceof RegExp, 'pattern ' + i + ' missing re');
  }
});

// ---- Summary ----

var total = passed + failed;
console.log('\nsecret-patterns.test.js: ' + passed + '/' + total + ' passed, ' + failed + ' failed\n');
process.exit(failed > 0 ? 1 : 0);
