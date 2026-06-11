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

const NO_VERIFY = /--no-verify/;
const NO_GPG_SIGN = /--no-gpg-sign/;

console.log('\n=== block-no-verify.js ===\n');

// ---- --no-verify detection ----

test('detects --no-verify in git commit', () => {
  assert.ok(NO_VERIFY.test('git commit -m "msg" --no-verify'));
});

test('detects --no-verify in git push', () => {
  assert.ok(NO_VERIFY.test('git push --no-verify'));
});

test('detects --no-verify without space prefix', () => {
  assert.ok(NO_VERIFY.test('git commit --no-verify'));
});

test('--no-verify regex does not match verify (without no-)', () => {
  assert.ok(!NO_VERIFY.test('git commit --verify'));
});

test('--no-verify regex does not match unrelated text', () => {
  assert.ok(!NO_VERIFY.test('git commit -m "hello"'));
});

// ---- --no-gpg-sign detection ----

test('detects --no-gpg-sign in git commit', () => {
  assert.ok(NO_GPG_SIGN.test('git commit -m "msg" --no-gpg-sign'));
});

test('detects --no-gpg-sign in git tag', () => {
  assert.ok(NO_GPG_SIGN.test('git tag -a v1.0 --no-gpg-sign'));
});

test('--no-gpg-sign regex does not match gpg-sign (without no-)', () => {
  assert.ok(!NO_GPG_SIGN.test('git commit --gpg-sign'));
});

test('--no-gpg-sign regex does not match unrelated text', () => {
  assert.ok(!NO_GPG_SIGN.test('git commit -m "hello"'));
});

// ---- composed ----

test('detects both --no-verify and --no-gpg-sign in same command', () => {
  const cmd = 'git push --no-verify --no-gpg-sign';
  assert.ok(NO_VERIFY.test(cmd) && NO_GPG_SIGN.test(cmd));
});

test('neither flag matched in clean git commit', () => {
  const cmd = 'git commit -m "fix: update dependencies"';
  assert.ok(!NO_VERIFY.test(cmd) && !NO_GPG_SIGN.test(cmd));
});

// ---- edge cases ----

test('--no-verify in middle of command is detected', () => {
  assert.ok(NO_VERIFY.test('git commit --no-verify -m "msg"'));
});

test('--no-gpg-sign at start is detected', () => {
  assert.ok(NO_GPG_SIGN.test('--no-gpg-sign git commit'));
});

test('extra characters after --no-verify detected (substring match)', () => {
  assert.ok(NO_VERIFY.test('git commit --no-verify-foo'));
});

test('extra characters after --no-gpg-sign detected (substring match)', () => {
  assert.ok(NO_GPG_SIGN.test('git commit --no-gpg-sign-foo'));
});

// ---- Summary ----

const total = passed + failed;
console.log('\nblock-no-verify.test.js: ' + passed + '/' + total + ' passed, ' + failed + ' failed\n');
process.exit(failed > 0 ? 1 : 0);
