'use strict';

const assert = require('node:assert');
const path = require('path');
const config = require('../lib/config');

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

var PROTECTED = new Set(config.PROTECTED_CONFIGS);

function isProtected(filePath) {
  var base = path.basename(filePath);
  if (PROTECTED.has(base)) return true;
  if (/^tsconfig\..*\.json$/.test(base)) return true;
  return false;
}

console.log('\n=== config-protection.js ===\n');

// ---- ESLint configs ----

test('blocks .eslintrc', () => {
  assert.ok(isProtected('/project/.eslintrc'));
});

test('blocks .eslintrc.js', () => {
  assert.ok(isProtected('/project/.eslintrc.js'));
});

test('blocks .eslintrc.json', () => {
  assert.ok(isProtected('/project/.eslintrc.json'));
});

test('blocks .eslintrc.yaml', () => {
  assert.ok(isProtected('/project/.eslintrc.yaml'));
});

// ---- Prettier configs ----

test('blocks .prettierrc', () => {
  assert.ok(isProtected('/project/.prettierrc'));
});

test('blocks .prettierrc.js', () => {
  assert.ok(isProtected('/project/.prettierrc.js'));
});

test('blocks prettier.config.js', () => {
  assert.ok(isProtected('/project/prettier.config.js'));
});

test('blocks prettier.config.cjs', () => {
  assert.ok(isProtected('/project/prettier.config.cjs'));
});

// ---- Biome ----

test('blocks biome.json', () => {
  assert.ok(isProtected('/project/biome.json'));
});

test('blocks biome.jsonc', () => {
  assert.ok(isProtected('/project/biome.jsonc'));
});

// ---- Python / Rust ----

test('blocks ruff.toml', () => {
  assert.ok(isProtected('/project/ruff.toml'));
});

test('blocks pyproject.toml', () => {
  assert.ok(isProtected('/project/pyproject.toml'));
});

test('blocks Cargo.toml', () => {
  assert.ok(isProtected('/project/Cargo.toml'));
});

// ---- tsconfig ----

test('blocks tsconfig.json', () => {
  assert.ok(isProtected('/project/tsconfig.json'));
});

test('blocks tsconfig.base.json', () => {
  assert.ok(isProtected('/project/tsconfig.base.json'));
});

test('blocks tsconfig.build.json', () => {
  assert.ok(isProtected('/project/tsconfig.build.json'));
});

// ---- non-protected files ----

test('allows regular .js file', () => {
  assert.ok(!isProtected('/project/src/index.js'));
});

test('allows regular .ts file', () => {
  assert.ok(!isProtected('/project/src/index.ts'));
});

test('allows regular .json file (not config)', () => {
  assert.ok(!isProtected('/project/package.json'));
});

test('allows README.md', () => {
  assert.ok(!isProtected('/project/README.md'));
});

test('allows .env (not in protected list)', () => {
  assert.ok(!isProtected('/project/.env'));
});

// ---- deep paths ----

test('blocks protected file in deep path', () => {
  assert.ok(isProtected('/project/packages/sub/deep/.eslintrc'));
});

test('allows non-protected file in deep path', () => {
  assert.ok(!isProtected('/project/packages/sub/deep/utils.js'));
});

// ---- Summary ----

var total = passed + failed;
console.log('\nconfig-protection.test.js: ' + passed + '/' + total + ' passed, ' + failed + ' failed\n');
process.exit(failed > 0 ? 1 : 0);
