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

const READONLY_CMD = /^(git\s+(status|diff|log|show|branch|stash\s+list|remote|ls-remote|rev-parse)|ls|dir|cat|head|tail|echo|pwd|whoami|date|which|where|type|find|rg|grep|wc|sort|uniq|node\s+-v|npm\s+-v|yarn\s+-v|pnpm\s+-v|python\s+--version|rustc\s+--version|cargo\s+--version|cargo\s+check|cargo\s+fmt\s+--check|cargo\s+clippy|gh\s+pr\s+view|gh\s+pr\s+list|gh\s+issue|netstat|tasklist)/i;

console.log('\n=== bash-guard.js ===\n');

// ---- git readonly commands ----

test('allows git status', () => {
  assert.ok(READONLY_CMD.test('git status'));
});

test('allows git diff', () => {
  assert.ok(READONLY_CMD.test('git diff'));
});

test('allows git log', () => {
  assert.ok(READONLY_CMD.test('git log --oneline -3'));
});

test('allows git show', () => {
  assert.ok(READONLY_CMD.test('git show HEAD'));
});

test('allows git branch', () => {
  assert.ok(READONLY_CMD.test('git branch -a'));
});

test('allows git stash list', () => {
  assert.ok(READONLY_CMD.test('git stash list'));
});

test('allows git remote', () => {
  assert.ok(READONLY_CMD.test('git remote -v'));
});

test('allows git ls-remote', () => {
  assert.ok(READONLY_CMD.test('git ls-remote origin'));
});

test('allows git rev-parse', () => {
  assert.ok(READONLY_CMD.test('git rev-parse HEAD'));
});

// ---- filesystem readonly commands ----

test('allows ls', () => {
  assert.ok(READONLY_CMD.test('ls -la'));
});

test('allows dir', () => {
  assert.ok(READONLY_CMD.test('dir /s'));
});

test('allows cat', () => {
  assert.ok(READONLY_CMD.test('cat file.txt'));
});

test('allows head', () => {
  assert.ok(READONLY_CMD.test('head -n 10 file.txt'));
});

test('allows tail', () => {
  assert.ok(READONLY_CMD.test('tail -f log.txt'));
});

test('allows find', () => {
  assert.ok(READONLY_CMD.test('find . -name "*.js"'));
});

test('allows rg', () => {
  assert.ok(READONLY_CMD.test('rg pattern --glob "*.js"'));
});

test('allows grep', () => {
  assert.ok(READONLY_CMD.test('grep -r pattern .'));
});

test('allows wc', () => {
  assert.ok(READONLY_CMD.test('wc -l file.txt'));
});

// ---- info commands ----

test('allows pwd', () => {
  assert.ok(READONLY_CMD.test('pwd'));
});

test('allows echo', () => {
  assert.ok(READONLY_CMD.test('echo hello'));
});

test('allows whoami', () => {
  assert.ok(READONLY_CMD.test('whoami'));
});

test('allows date', () => {
  assert.ok(READONLY_CMD.test('date'));
});

test('allows which', () => {
  assert.ok(READONLY_CMD.test('which node'));
});

// ---- version commands ----

test('allows node -v', () => {
  assert.ok(READONLY_CMD.test('node -v'));
});

test('allows npm -v', () => {
  assert.ok(READONLY_CMD.test('npm -v'));
});

test('allows yarn -v', () => {
  assert.ok(READONLY_CMD.test('yarn -v'));
});

test('allows pnpm -v', () => {
  assert.ok(READONLY_CMD.test('pnpm -v'));
});

test('allows rustc --version', () => {
  assert.ok(READONLY_CMD.test('rustc --version'));
});

test('allows cargo --version', () => {
  assert.ok(READONLY_CMD.test('cargo --version'));
});

// ---- cargo check commands ----

test('allows cargo check', () => {
  assert.ok(READONLY_CMD.test('cargo check'));
});

test('allows cargo fmt --check', () => {
  assert.ok(READONLY_CMD.test('cargo fmt --check'));
});

test('allows cargo clippy', () => {
  assert.ok(READONLY_CMD.test('cargo clippy -- -D warnings'));
});

// ---- gh readonly commands ----

test('allows gh pr view', () => {
  assert.ok(READONLY_CMD.test('gh pr view 123'));
});

test('allows gh pr list', () => {
  assert.ok(READONLY_CMD.test('gh pr list'));
});

test('allows gh issue', () => {
  assert.ok(READONLY_CMD.test('gh issue list'));
});

// ---- netstat / tasklist ----

test('allows netstat', () => {
  assert.ok(READONLY_CMD.test('netstat -an'));
});

test('allows tasklist', () => {
  assert.ok(READONLY_CMD.test('tasklist | findstr node'));
});

// ---- non-readonly commands ----

test('does NOT allow git commit', () => {
  assert.ok(!READONLY_CMD.test('git commit -m "fix"'));
});

test('does NOT allow git push', () => {
  assert.ok(!READONLY_CMD.test('git push origin main'));
});

test('does NOT allow npm install', () => {
  assert.ok(!READONLY_CMD.test('npm install'));
});

test('does NOT allow rm', () => {
  assert.ok(!READONLY_CMD.test('rm -rf node_modules'));
});

test('does NOT allow cargo build', () => {
  assert.ok(!READONLY_CMD.test('cargo build'));
});

test('does NOT allow gh pr create', () => {
  assert.ok(!READONLY_CMD.test('gh pr create --title "feat"'));
});

// ---- case insensitivity ----

test('case insensitive: GIT STATUS works', () => {
  assert.ok(READONLY_CMD.test('GIT STATUS'));
});

test('case insensitive: Git Status works', () => {
  assert.ok(READONLY_CMD.test('Git Status'));
});

// ---- Summary ----

const total = passed + failed;
console.log('\nbash-guard.test.js: ' + passed + '/' + total + ' passed, ' + failed + ' failed\n');
process.exit(failed > 0 ? 1 : 0);
