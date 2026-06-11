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

var TRACKED_EXT = /\.(py|js|ts|jsx|tsx)$/i;

function appendPath(fp, accumFile) {
  if (!fp || !TRACKED_EXT.test(fp)) return;
  try {
    var raw = fs.existsSync(accumFile) ? fs.readFileSync(accumFile, 'utf8') : '';
    var existing = raw ? raw.split('\n').filter(Boolean) : [];
    var seen = new Set(existing);
    if (seen.has(fp)) return;
    existing.push(fp);
    fs.writeFileSync(accumFile, existing.join('\n') + '\n', 'utf8');
  } catch (_) {}
}

function setupAccumFile() {
  return path.join(os.tmpdir(), 'yaemi-test-accum-' + Date.now() + '.txt');
}

console.log('\n=== edit-accumulator.js ===\n');

// ---- appendPath ----

test('appends a tracked file path', () => {
  var af = setupAccumFile();
  try {
    appendPath('/project/src/index.js', af);
    var content = fs.readFileSync(af, 'utf8');
    assert.strictEqual(content.trim(), '/project/src/index.js');
  } finally {
    try { fs.unlinkSync(af); } catch (_) {}
  }
});

test('appends multiple file paths', () => {
  var af = setupAccumFile();
  try {
    appendPath('/project/src/a.js', af);
    appendPath('/project/src/b.ts', af);
    var lines = fs.readFileSync(af, 'utf8').trim().split('\n');
    assert.strictEqual(lines.length, 2);
    assert.strictEqual(lines[0], '/project/src/a.js');
    assert.strictEqual(lines[1], '/project/src/b.ts');
  } finally {
    try { fs.unlinkSync(af); } catch (_) {}
  }
});

test('deduplicates file paths', () => {
  var af = setupAccumFile();
  try {
    appendPath('/project/src/a.js', af);
    appendPath('/project/src/a.js', af);
    var lines = fs.readFileSync(af, 'utf8').trim().split('\n');
    assert.strictEqual(lines.length, 1);
  } finally {
    try { fs.unlinkSync(af); } catch (_) {}
  }
});

test('skips null file path', () => {
  var af = setupAccumFile();
  try {
    appendPath(null, af);
    assert.ok(!fs.existsSync(af));
  } finally {
    try { fs.unlinkSync(af); } catch (_) {}
  }
});

test('skips empty file path', () => {
  var af = setupAccumFile();
  try {
    appendPath('', af);
    assert.ok(!fs.existsSync(af));
  } finally {
    try { fs.unlinkSync(af); } catch (_) {}
  }
});

test('skips non-tracked extension (.md)', () => {
  var af = setupAccumFile();
  try {
    appendPath('/project/README.md', af);
    assert.ok(!fs.existsSync(af));
  } finally {
    try { fs.unlinkSync(af); } catch (_) {}
  }
});

test('skips non-tracked extension (.json)', () => {
  var af = setupAccumFile();
  try {
    appendPath('/project/package.json', af);
    assert.ok(!fs.existsSync(af));
  } finally {
    try { fs.unlinkSync(af); } catch (_) {}
  }
});

test('accepts Python files', () => {
  var af = setupAccumFile();
  try {
    appendPath('/project/src/main.py', af);
    assert.ok(fs.existsSync(af));
  } finally {
    try { fs.unlinkSync(af); } catch (_) {}
  }
});

test('accepts JSX/TSX files', () => {
  var af = setupAccumFile();
  try {
    appendPath('/project/src/App.tsx', af);
    appendPath('/project/src/Header.jsx', af);
    var lines = fs.readFileSync(af, 'utf8').trim().split('\n');
    assert.strictEqual(lines.length, 2);
  } finally {
    try { fs.unlinkSync(af); } catch (_) {}
  }
});

test('preserves order of insertion', () => {
  var af = setupAccumFile();
  try {
    var files = ['/a.js', '/b.ts', '/c.py', '/d.tsx'];
    for (var i = 0; i < files.length; i++) appendPath(files[i], af);
    var lines = fs.readFileSync(af, 'utf8').trim().split('\n');
    for (var j = 0; j < files.length; j++) {
      assert.strictEqual(lines[j], files[j]);
    }
  } finally {
    try { fs.unlinkSync(af); } catch (_) {}
  }
});

// ---- Summary ----

var total = passed + failed;
console.log('\nedit-accumulator.test.js: ' + passed + '/' + total + ' passed, ' + failed + ' failed\n');
process.exit(failed > 0 ? 1 : 0);
