'use strict';

const assert = require('node:assert');
const { extractCmd } = require('../lib/utils');
const { PATTERNS } = require('../lib/secret-patterns');

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

// Replicate the handler's scanForSecrets (returns [{label, preview}, ...])
function scanForSecrets(text) {
  var found = [];
  for (var i = 0; i < PATTERNS.length; i++) {
    var m = PATTERNS[i].re.exec(text);
    if (m) found.push({ label: PATTERNS[i].name, preview: m[0].substring(0, 40) + '...' });
  }
  return found;
}

console.log('\n=== block-secrets.js ===\n');

// ---- scanForSecrets ----

test('detects openai-key in commit command', () => {
  var cmd = K('git commit -m "add feature -- sk-', 'abc123def456ghi789jklmnopqrstuv');
  var result = scanForSecrets(cmd);
  assert.ok(result.length > 0);
  assert.ok(result.some(function(r) { return r.label === 'openai-key'; }));
});

test('detects github token in commit command', () => {
  var cmd = K('git commit -m "ci: update -- ghp_', '1A2b3C4d5E6f7G8h9I0j1K2l3M4n5O6p7Q8r9S0');
  var result = scanForSecrets(cmd);
  assert.ok(result.some(function(r) { return r.label === 'github-pat'; }));
});

test('detects password in commit command', () => {
  var cmd = K('git commit -m "P', 'ASSWORD=hunter2"');
  var result = scanForSecrets(cmd);
  assert.ok(result.length > 0);
});

test('returns empty for clean commit command', () => {
  var result = scanForSecrets('git commit -m "fix: update dependencies"');
  assert.deepStrictEqual(result, []);
});

test('returns empty for non-git command with clean text', () => {
  var result = scanForSecrets('npm install express');
  assert.deepStrictEqual(result, []);
});

test('each finding has label and preview', () => {
  var cmd = K('git commit -m "sk-', 'abc123def456ghi789jklmnopqrstuv"');
  var result = scanForSecrets(cmd);
  assert.ok(result.length > 0);
  assert.ok(typeof result[0].label === 'string');
  assert.ok(typeof result[0].preview === 'string');
  assert.ok(result[0].preview.endsWith('...'));
});

// ---- extractCmd (used by handler) ----

test('extractCmd extracts command from event object', () => {
  var event = { tool_input: { command: 'git commit -m "fix"' } };
  assert.strictEqual(extractCmd(event), 'git commit -m "fix"');
});

test('extractCmd extracts command from JSON string', () => {
  var json = JSON.stringify({ tool_input: { command: 'git status' } });
  assert.strictEqual(extractCmd(json), 'git status');
});

test('extractCmd returns empty for null', () => {
  assert.strictEqual(extractCmd(null), '');
});

// ---- runner integration (simulated) ----

test('runner: clean commit passes through', () => {
  var event = { tool_name: 'Bash', tool_input: { command: 'git commit -m "fix: bug"' } };
  var cmd = extractCmd(event);
  assert.ok(cmd && cmd.includes('git commit'));
  var secrets = scanForSecrets(cmd);
  assert.deepStrictEqual(secrets, []);
});

test('runner: commit with secret is blocked', () => {
  var cmd = K('git commit -m "sk-', 'abc123def456ghi789jklmnopqrstuv"');
  var secrets = scanForSecrets(cmd);
  assert.ok(secrets.length > 0);
});

test('runner: non-commit bash command passes through', () => {
  var cmd = 'npm test';
  assert.ok(!cmd.includes('git commit'));
  var secrets = scanForSecrets(cmd);
  assert.deepStrictEqual(secrets, []);
});

// ---- Summary ----

var total = passed + failed;
console.log('\nblock-secrets.test.js: ' + passed + '/' + total + ' passed, ' + failed + ' failed\n');
process.exit(failed > 0 ? 1 : 0);
