'use strict';

/**
 * Unit tests for hooks/lib/profile.js
 *
 * Tests the pure functions: normalizeId, parseProfiles
 * Tests env-dependent functions: getHookProfile, getDisabledHookIds, isHookEnabled
 *   by controlling process.env
 */

const assert = require('node:assert');
const profile = require('../lib/profile');

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

console.log('\n=== profile.js ===\n');

// ---- VALID_PROFILES ----

test('VALID_PROFILES contains minimal, standard, strict', () => {
  assert.ok(profile.VALID_PROFILES.has('minimal'));
  assert.ok(profile.VALID_PROFILES.has('standard'));
  assert.ok(profile.VALID_PROFILES.has('strict'));
  assert.strictEqual(profile.VALID_PROFILES.size, 3);
});

// ---- normalizeId ----

test('normalizeId trims and lowercases', () => {
  assert.strictEqual(profile.normalizeId(' Standard '), 'standard');
});

test('normalizeId handles empty string', () => {
  assert.strictEqual(profile.normalizeId(''), '');
});

test('normalizeId handles null', () => {
  assert.strictEqual(profile.normalizeId(null), '');
});

test('normalizeId handles undefined', () => {
  assert.strictEqual(profile.normalizeId(undefined), '');
});

test('normalizeId handles mixed case', () => {
  assert.strictEqual(profile.normalizeId('MiNiMaL'), 'minimal');
});

// ---- parseProfiles ----

test('parseProfiles parses comma-separated string', () => {
  const result = profile.parseProfiles('minimal,standard');
  assert.deepStrictEqual(result, ['minimal', 'standard']);
});

test('parseProfiles returns fallback for empty string input', () => {
  const result = profile.parseProfiles('', ['strict']);
  assert.deepStrictEqual(result, ['strict']);
});

test('parseProfiles returns fallback for null input', () => {
  const result = profile.parseProfiles(null, ['standard', 'strict']);
  assert.deepStrictEqual(result, ['standard', 'strict']);
});

test('parseProfiles filters invalid profiles', () => {
  const result = profile.parseProfiles('invalid,standard,nonexistent', ['strict']);
  assert.deepStrictEqual(result, ['standard']);
});

test('parseProfiles handles array input', () => {
  const result = profile.parseProfiles(['minimal'], ['strict']);
  assert.deepStrictEqual(result, ['minimal']);
});

test('parseProfiles returns default fallback when not provided (falsy input)', () => {
  const result = profile.parseProfiles('');
  assert.deepStrictEqual(result, ['standard', 'strict']);
});

test('parseProfiles trims whitespace in comma-separated input', () => {
  const result = profile.parseProfiles(' minimal , standard ');
  assert.deepStrictEqual(result, ['minimal', 'standard']);
});

// ---- getHookProfile (env-dependent) ----

test('getHookProfile returns default when env is not set', () => {
  const orig = process.env.YAEMI_HOOK_PROFILE;
  delete process.env.YAEMI_HOOK_PROFILE;
  try {
    assert.strictEqual(profile.getHookProfile(), 'standard');
  } finally {
    if (orig !== undefined) process.env.YAEMI_HOOK_PROFILE = orig;
  }
});

test('getHookProfile returns value from env when valid', () => {
  const orig = process.env.YAEMI_HOOK_PROFILE;
  process.env.YAEMI_HOOK_PROFILE = 'strict';
  try {
    assert.strictEqual(profile.getHookProfile(), 'strict');
  } finally {
    if (orig !== undefined) process.env.YAEMI_HOOK_PROFILE = orig; else delete process.env.YAEMI_HOOK_PROFILE;
  }
});

test('getHookProfile returns default for invalid env value', () => {
  const orig = process.env.YAEMI_HOOK_PROFILE;
  process.env.YAEMI_HOOK_PROFILE = 'garbage';
  try {
    assert.strictEqual(profile.getHookProfile(), 'standard');
  } finally {
    if (orig !== undefined) process.env.YAEMI_HOOK_PROFILE = orig; else delete process.env.YAEMI_HOOK_PROFILE;
  }
});

test('getHookProfile returns minimal', () => {
  const orig = process.env.YAEMI_HOOK_PROFILE;
  process.env.YAEMI_HOOK_PROFILE = 'minimal';
  try {
    assert.strictEqual(profile.getHookProfile(), 'minimal');
  } finally {
    if (orig !== undefined) process.env.YAEMI_HOOK_PROFILE = orig; else delete process.env.YAEMI_HOOK_PROFILE;
  }
});

// ---- getDisabledHookIds (env-dependent) ----

test('getDisabledHookIds returns empty set when env is not set', () => {
  const orig = process.env.YAEMI_HOOK_DISABLED;
  delete process.env.YAEMI_HOOK_DISABLED;
  try {
    const result = profile.getDisabledHookIds();
    assert.ok(result instanceof Set);
    assert.strictEqual(result.size, 0);
  } finally {
    if (orig !== undefined) process.env.YAEMI_HOOK_DISABLED = orig;
  }
});

test('getDisabledHookIds parses comma-separated hook IDs', () => {
  const orig = process.env.YAEMI_HOOK_DISABLED;
  process.env.YAEMI_HOOK_DISABLED = 'gateguard,governance';
  try {
    const result = profile.getDisabledHookIds();
    assert.ok(result.has('gateguard'));
    assert.ok(result.has('governance'));
    assert.strictEqual(result.size, 2);
  } finally {
    if (orig !== undefined) process.env.YAEMI_HOOK_DISABLED = orig; else delete process.env.YAEMI_HOOK_DISABLED;
  }
});

// ---- isHookEnabled (env-dependent) ----

test('isHookEnabled returns true when profile matches and hook not disabled', () => {
  const origProfile = process.env.YAEMI_HOOK_PROFILE;
  const origDisabled = process.env.YAEMI_HOOK_DISABLED;
  process.env.YAEMI_HOOK_PROFILE = 'standard';
  delete process.env.YAEMI_HOOK_DISABLED;
  // Clear profile module cache to pick up new env
  delete require.cache[require.resolve('../lib/profile')];
  const p2 = require('../lib/profile');
  try {
    assert.strictEqual(p2.isHookEnabled('test-hook', 'standard,strict'), true);
  } finally {
    if (origProfile !== undefined) process.env.YAEMI_HOOK_PROFILE = origProfile; else delete process.env.YAEMI_HOOK_PROFILE;
    if (origDisabled !== undefined) process.env.YAEMI_HOOK_DISABLED = origDisabled; else delete process.env.YAEMI_HOOK_DISABLED;
  }
});

test('isHookEnabled returns false when hook is disabled', () => {
  const origProfile = process.env.YAEMI_HOOK_PROFILE;
  const origDisabled = process.env.YAEMI_HOOK_DISABLED;
  process.env.YAEMI_HOOK_PROFILE = 'standard';
  process.env.YAEMI_HOOK_DISABLED = 'my-hook';
  delete require.cache[require.resolve('../lib/profile')];
  const p2 = require('../lib/profile');
  try {
    assert.strictEqual(p2.isHookEnabled('my-hook', 'standard,strict'), false);
  } finally {
    if (origProfile !== undefined) process.env.YAEMI_HOOK_PROFILE = origProfile; else delete process.env.YAEMI_HOOK_PROFILE;
    if (origDisabled !== undefined) process.env.YAEMI_HOOK_DISABLED = origDisabled; else delete process.env.YAEMI_HOOK_DISABLED;
  }
});

test('isHookEnabled returns false when profile does not match', () => {
  const origProfile = process.env.YAEMI_HOOK_PROFILE;
  const origDisabled = process.env.YAEMI_HOOK_DISABLED;
  process.env.YAEMI_HOOK_PROFILE = 'minimal';
  delete process.env.YAEMI_HOOK_DISABLED;
  delete require.cache[require.resolve('../lib/profile')];
  const p2 = require('../lib/profile');
  try {
    // hook allows 'standard,strict', current profile is 'minimal' -> false
    assert.strictEqual(p2.isHookEnabled('strict-only-hook', 'standard,strict'), false);
  } finally {
    if (origProfile !== undefined) process.env.YAEMI_HOOK_PROFILE = origProfile; else delete process.env.YAEMI_HOOK_PROFILE;
    if (origDisabled !== undefined) process.env.YAEMI_HOOK_DISABLED = origDisabled; else delete process.env.YAEMI_HOOK_DISABLED;
  }
});

test('isHookEnabled returns true for empty hookId', () => {
  assert.strictEqual(profile.isHookEnabled('', 'standard,strict'), true);
});

// ---- Summary ----

const total = passed + failed;
console.log(`\nprofile.test.js: ${passed}/${total} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
