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

// Replicate handler's pure functions
var FILE_THRESHOLD = 3;
var LINE_THRESHOLD = 200;
var COOLDOWN_EDITS = 5;

function countLinesInEdit(edit) {
  if (!edit || !edit.new_string) return 0;
  return (edit.new_string.match(/\n/g) || []).length;
}

function shouldTrigger(state) {
  var fc = Object.keys(state.files).length;
  var reason = '';
  if (fc >= FILE_THRESHOLD && state.totalLines >= LINE_THRESHOLD) {
    reason = fc + ' files, ' + state.totalLines + ' lines';
    return reason;
  }
  if (fc >= FILE_THRESHOLD * 2) {
    reason = fc + ' files';
    return reason;
  }
  if (state.totalLines >= LINE_THRESHOLD * 2) {
    reason = state.totalLines + ' lines';
    return reason;
  }
  return null;
}

function isInCooldown(state) {
  return (state.callCount - state.lastReminderAt) < COOLDOWN_EDITS;
}

console.log('\n=== review-reminder.js ===\n');

// ---- countLinesInEdit ----

test('counts newlines in edit.new_string', () => {
  var edit = { new_string: 'line1\nline2\nline3\n' };
  assert.strictEqual(countLinesInEdit(edit), 3);
});

test('returns 0 for single-line edit', () => {
  var edit = { new_string: 'single line' };
  assert.strictEqual(countLinesInEdit(edit), 0);
});

test('returns 0 for null edit', () => {
  assert.strictEqual(countLinesInEdit(null), 0);
});

test('returns 0 for edit without new_string', () => {
  assert.strictEqual(countLinesInEdit({ old_string: 'x' }), 0);
});

test('counts many lines correctly', () => {
  var lines = [];
  for (var i = 0; i < 100; i++) lines.push('line ' + i);
  var edit = { new_string: lines.join('\n') };
  assert.strictEqual(countLinesInEdit(edit), 99);
});

// ---- threshold logic: files + lines ----

test('triggers when files >= 3 AND lines >= 200', () => {
  var state = {
    files: { 'a.js': true, 'b.ts': true, 'c.py': true },
    totalLines: 250,
  };
  assert.ok(shouldTrigger(state) !== null);
});

test('triggers when files >= 6 (2x threshold)', () => {
  var state = {
    files: { 'a.js': true, 'b.ts': true, 'c.py': true, 'd.tsx': true, 'e.js': true, 'f.ts': true },
    totalLines: 10,
  };
  assert.ok(shouldTrigger(state) !== null);
});

test('triggers when lines >= 400 (2x threshold)', () => {
  var state = {
    files: { 'a.js': true },
    totalLines: 500,
  };
  assert.ok(shouldTrigger(state) !== null);
});

test('does NOT trigger with 2 files and 100 lines', () => {
  var state = {
    files: { 'a.js': true, 'b.ts': true },
    totalLines: 100,
  };
  assert.strictEqual(shouldTrigger(state), null);
});

test('does NOT trigger with 4 files and 150 lines', () => {
  var state = {
    files: { 'a.js': true, 'b.ts': true, 'c.py': true, 'd.tsx': true },
    totalLines: 150,
  };
  assert.strictEqual(shouldTrigger(state), null);
});

test('does NOT trigger with 1 file and 300 lines', () => {
  var state = {
    files: { 'a.js': true },
    totalLines: 300,
  };
  assert.strictEqual(shouldTrigger(state), null);
});

// ---- cooldown ----

test('cooldown active when callCount - lastReminderAt < 5', () => {
  var state = { callCount: 10, lastReminderAt: 8 };
  assert.ok(isInCooldown(state));
});

test('cooldown NOT active when callCount - lastReminderAt >= 5', () => {
  var state = { callCount: 10, lastReminderAt: 5 };
  assert.ok(!isInCooldown(state));
});

test('cooldown NOT active at boundary (difference = 5)', () => {
  var state = { callCount: 10, lastReminderAt: 5 };
  assert.ok(!isInCooldown(state));
});

test('cooldown active at boundary minus 1 (difference = 4)', () => {
  var state = { callCount: 10, lastReminderAt: 6 };
  assert.ok(isInCooldown(state));
});

test('initial state (lastReminderAt = 0) not in cooldown after 5 calls', () => {
  var state = { callCount: 5, lastReminderAt: 0 };
  assert.ok(!isInCooldown(state));
});

// ---- edge cases ----

test('empty files and below double line threshold does not trigger', () => {
  var state = { files: {}, totalLines: 350 };
  assert.strictEqual(shouldTrigger(state), null);
});

test('zero lines does not trigger with 3 files', () => {
  var state = {
    files: { 'a.js': true, 'b.ts': true, 'c.py': true },
    totalLines: 0,
  };
  assert.strictEqual(shouldTrigger(state), null);
});

test('trigger reason includes file count and line count', () => {
  var state = {
    files: { 'a.js': true, 'b.ts': true, 'c.py': true },
    totalLines: 250,
  };
  var reason = shouldTrigger(state);
  assert.ok(reason.includes('3 files'));
  assert.ok(reason.includes('250 lines'));
});

// ---- Summary ----

var total = passed + failed;
console.log('\nreview-reminder.test.js: ' + passed + '/' + total + ' passed, ' + failed + ' failed\n');
process.exit(failed > 0 ? 1 : 0);
