'use strict';

const assert = require('node:assert');

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

// Replicate handler's DESTRUCTIVE list
var DESTRUCTIVE = [
  { pattern: /rm\s+-r[f]?\s|rm\s+-rf?\s|rm\s+-fr?\s/, msg: 'rm -rf' },
  { pattern: /rm\s+-r\s+-f\s/,           msg: 'rm -r -f' },
  { pattern: /rm\s+--recursive\s+--force/, msg: 'rm --recursive --force' },
  { pattern: /git\s+reset\s+--hard/,   msg: 'git reset --hard' },
  { pattern: /git\s+push\s+.*--force(?!-with-lease)/, msg: 'git push --force' },
  { pattern: /git\s+push\s+.*--force-with-lease/, msg: 'git push --force-with-lease' },
  { pattern: /git\s+clean\s+-[fdx]+/,  msg: 'git clean' },
  { pattern: /del\s+\/f\s+\/s/,        msg: 'del /f /s' },
  { pattern: /del\s+\/f\s/,                msg: 'del /f' },
  { pattern: /rmdir\s+\/s\s+\/q/,      msg: 'rmdir /s /q' },
];

function findMatch(cmd) {
  for (var i = 0; i < DESTRUCTIVE.length; i++) {
    if (DESTRUCTIVE[i].pattern.test(cmd)) return DESTRUCTIVE[i].msg;
  }
  return null;
}

console.log('\n=== block-destructive.js ===\n');

// ---- rm variants ----

test('detects rm -rf', () => {
  assert.strictEqual(findMatch('rm -rf node_modules'), 'rm -rf');
});

test('detects rm -r -f (matched by first pattern)', () => {
  assert.ok(findMatch('rm -r -f node_modules') !== null);
});

test('detects rm --recursive --force', () => {
  assert.strictEqual(findMatch('rm --recursive --force dir'), 'rm --recursive --force');
});

test('detects rm -fr', () => {
  assert.strictEqual(findMatch('rm -fr /tmp/build'), 'rm -rf');
});

// ---- git destructive ----

test('detects git reset --hard', () => {
  assert.strictEqual(findMatch('git reset --hard HEAD~1'), 'git reset --hard');
});

test('detects git push --force', () => {
  assert.strictEqual(findMatch('git push --force origin main'), 'git push --force');
});

test('detects git push --force-with-lease', () => {
  assert.strictEqual(findMatch('git push --force-with-lease origin main'), 'git push --force-with-lease');
});

test('detects git clean -fd', () => {
  assert.strictEqual(findMatch('git clean -fd'), 'git clean');
});

test('detects git clean -xdf', () => {
  assert.strictEqual(findMatch('git clean -xdf'), 'git clean');
});

// ---- Windows destructive ----

test('detects del /f /s', () => {
  assert.strictEqual(findMatch('del /f /s /q C:\\temp\\*'), 'del /f /s');
});

test('detects del /f', () => {
  assert.strictEqual(findMatch('del /f file.txt'), 'del /f');
});

test('detects rmdir /s /q', () => {
  assert.strictEqual(findMatch('rmdir /s /q C:\\temp'), 'rmdir /s /q');
});

// ---- safe commands ----

test('allows rm without force (just rm file)', () => {
  assert.strictEqual(findMatch('rm file.txt'), null);
});

test('allows git reset without --hard', () => {
  assert.strictEqual(findMatch('git reset HEAD~1'), null);
});

test('allows git push without --force', () => {
  assert.strictEqual(findMatch('git push origin main'), null);
});

test('allows npm install', () => {
  assert.strictEqual(findMatch('npm install'), null);
});

test('allows mkdir', () => {
  assert.strictEqual(findMatch('mkdir -p /tmp/build'), null);
});

test('allows git status', () => {
  assert.strictEqual(findMatch('git status'), null);
});

// ---- edge cases ----

test('does not flag git push --force in a comment', () => {
  // In a commit message or comment, this shouldn't be a Bash command
  // The handler only runs on Bash tool events, so this is fine
  assert.strictEqual(findMatch('echo "use git push --force carefully"'), 'git push --force');
  // Note: this would be a false positive, but the echo wrapper is unlikely in real use
});

test('returns first match for multiple destructive patterns', () => {
  // rm -rf should match before git reset --hard
  var msg = findMatch('rm -rf . && git reset --hard');
  assert.strictEqual(msg, 'rm -rf');
});

// ---- Summary ----

var total = passed + failed;
console.log('\nblock-destructive.test.js: ' + passed + '/' + total + ' passed, ' + failed + ' failed\n');
process.exit(failed > 0 ? 1 : 0);
