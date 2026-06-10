'use strict';

/**
 * Unit tests for hooks/lib/formatter.js
 *
 * Tests the pure logic in detectProjectRoot by creating temporary directories.
 * Skips: commandExists (subprocess), formatFile/formatJsSingle/formatPythonSingle (subprocess + I/O)
 */

const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const os = require('os');
const formatter = require('../lib/formatter');

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

/**
 * Create a temp directory with an optional marker file (package.json / pyproject.toml)
 */
function setupTempProject(markerFile) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'yae-miko-test-'));
  if (markerFile) {
    fs.writeFileSync(path.join(tmpDir, markerFile), '{}', 'utf8');
  }
  return tmpDir;
}

function cleanupTempDir(dir) {
  try {
    fs.rmSync(dir, { recursive: true, force: true });
  } catch (_) { /* best-effort */ }
}

console.log('\n=== formatter.js ===\n');

// ---- detectProjectRoot ----

test('detectProjectRoot finds JS project root with package.json', () => {
  const tmpDir = setupTempProject('package.json');
  try {
    const subDir = path.join(tmpDir, 'src', 'components');
    fs.mkdirSync(subDir, { recursive: true });
    const testFile = path.join(subDir, 'Button.tsx');

    const result = formatter.detectProjectRoot(testFile);
    assert.ok(result !== null, 'Expected project root to be detected');
    assert.strictEqual(result.root, tmpDir);
    assert.strictEqual(result.type, 'js');
  } finally {
    cleanupTempDir(tmpDir);
  }
});

test('detectProjectRoot finds Python project root with pyproject.toml', () => {
  const tmpDir = setupTempProject('pyproject.toml');
  try {
    const subDir = path.join(tmpDir, 'my_package', 'utils');
    fs.mkdirSync(subDir, { recursive: true });
    const testFile = path.join(subDir, 'helpers.py');

    const result = formatter.detectProjectRoot(testFile);
    assert.ok(result !== null, 'Expected project root to be detected');
    assert.strictEqual(result.root, tmpDir);
    assert.strictEqual(result.type, 'py');
  } finally {
    cleanupTempDir(tmpDir);
  }
});

test('detectProjectRoot returns null for directory with no project marker', () => {
  const tmpDir = setupTempProject(null); // no marker file
  try {
    const testFile = path.join(tmpDir, 'orphan.js');
    fs.writeFileSync(testFile, '', 'utf8');

    const result = formatter.detectProjectRoot(testFile);
    // Should be null since there's no package.json or pyproject.toml
    assert.strictEqual(result, null);
  } finally {
    cleanupTempDir(tmpDir);
  }
});

test('detectProjectRoot walks up from deep subdirectory', () => {
  const tmpDir = setupTempProject('package.json');
  try {
    const deepDir = path.join(tmpDir, 'a', 'b', 'c', 'd', 'e');
    fs.mkdirSync(deepDir, { recursive: true });
    const testFile = path.join(deepDir, 'deep.ts');

    const result = formatter.detectProjectRoot(testFile);
    assert.ok(result !== null, 'Expected project root to be detected from deep path');
    assert.strictEqual(result.root, tmpDir);
    assert.strictEqual(result.type, 'js');
  } finally {
    cleanupTempDir(tmpDir);
  }
});

test('detectProjectRoot prefers nearest package.json', () => {
  const outerDir = setupTempProject('package.json');
  try {
    // Create a nested project with its own package.json
    const innerDir = path.join(outerDir, 'packages', 'inner');
    fs.mkdirSync(innerDir, { recursive: true });
    fs.writeFileSync(path.join(innerDir, 'package.json'), '{}', 'utf8');
    const testFile = path.join(innerDir, 'index.ts');

    const result = formatter.detectProjectRoot(testFile);
    assert.ok(result !== null);
    // Should find the inner (nearest) package.json
    assert.strictEqual(result.root, innerDir);
    assert.strictEqual(result.type, 'js');
  } finally {
    cleanupTempDir(outerDir);
  }
});

// ---- Summary ----

const total = passed + failed;
console.log(`\nformatter.test.js: ${passed}/${total} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
