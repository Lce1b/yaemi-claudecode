'use strict';

var test = require('node:test');
var assert = require('node:assert');
var path = require('path');

var registry = require('../lib/registry');

// --- scanHandlers ---

test('scanHandlers returns non-empty array', function() {
  var handlersDir = path.resolve(path.join(__dirname, '..', 'handlers'));
  var handlers = registry.scanHandlers(handlersDir);
  assert.ok(Array.isArray(handlers));
  assert.ok(handlers.length > 0, 'expected at least one handler');
});

test('scanHandlers entries have required fields', function() {
  var handlersDir = path.resolve(path.join(__dirname, '..', 'handlers'));
  var handlers = registry.scanHandlers(handlersDir);
  handlers.forEach(function(h) {
    assert.ok(typeof h.id === 'string', 'handler missing id: ' + JSON.stringify(h));
    assert.ok(typeof h.on === 'string', 'handler missing on: ' + h.id);
    assert.ok(typeof h.match === 'function', 'handler missing match: ' + h.id);
    assert.ok(typeof h.priority === 'number', 'handler missing priority: ' + h.id);
    assert.ok(typeof h.run === 'function', 'handler missing run: ' + h.id);
  });
});

// --- isNewContract ---

test('isNewContract returns true for new-contract module', function() {
  var mod = {
    on: 'PreToolUse',
    match: function() { return true; },
    priority: 50,
    profile: ['standard', 'strict'],
    run: async function(event, ctx) { return { exitCode: 0 }; },
  };
  assert.ok(registry.isNewContract(mod));
});

test('isNewContract returns false for legacy module (only run)', function() {
  var mod = { run: function(rawInput) { return { raw: rawInput, exitCode: 0 }; } };
  assert.ok(!registry.isNewContract(mod));
});

test('isNewContract returns false for null', function() {
  assert.ok(!registry.isNewContract(null));
});

test('isNewContract returns false for object missing on', function() {
  var mod = { match: function() { return true; }, run: function() {} };
  assert.ok(!registry.isNewContract(mod));
});

test('isNewContract requires on to be a valid event', function() {
  var mod = {
    on: 'InvalidEvent',
    match: function() { return true; },
    run: function() {},
  };
  assert.ok(!registry.isNewContract(mod));
});

// --- isLegacyContract ---

test('isLegacyContract returns true for module with only run', function() {
  var mod = { run: function(rawInput) { return { raw: rawInput, exitCode: 0 }; } };
  assert.ok(registry.isLegacyContract(mod));
});

test('isLegacyContract returns false for new-contract module', function() {
  var mod = {
    on: 'PreToolUse',
    match: function() { return true; },
    run: function() {},
  };
  assert.ok(!registry.isLegacyContract(mod));
});

test('isLegacyContract returns false for null', function() {
  assert.ok(!registry.isLegacyContract(null));
});

test('isLegacyContract returns false for empty object', function() {
  assert.ok(!registry.isLegacyContract({}));
});

// --- filterByProfile ---

test('filterByProfile filters handlers by active profile', function() {
  var oldProfile = process.env.YAEMI_HOOK_PROFILE;
  process.env.YAEMI_HOOK_PROFILE = 'minimal';
  var handlers = [
    { id: 'a', profile: ['minimal'] },
    { id: 'b', profile: ['standard', 'strict'] },
    { id: 'c', profile: ['minimal', 'standard', 'strict'] },
  ];
  // Force re-require to pick up env change — profile module caches at load time,
  // so we test filterByProfile logic directly by mocking profile.
  process.env.YAEMI_HOOK_PROFILE = oldProfile;
  // Actually, getHookProfile is cached. Let's test filterByProfile with
  // handlers that have different profile arrays, relying on the default env.
  // The default profile is 'standard' when env is not set.
  // So minimal-only should be filtered out.

  var filtered = registry.filterByProfile(handlers);
  // b has ['standard','strict'] → included
  // c has ['minimal','standard','strict'] → included
  // a has ['minimal'] → excluded (default is standard)
  assert.equal(filtered.length, 2);
  assert.equal(filtered[0].id, 'b');
  assert.equal(filtered[1].id, 'c');
});

// --- forEvent ---

test('forEvent filters by event name and sorts by priority', function() {
  var handlers = [
    { on: 'PreToolUse', priority: 100, profile: ['standard', 'strict'], run: function() {} },
    { on: 'PostToolUse', priority: 50, profile: ['standard', 'strict'], run: function() {} },
    { on: 'PreToolUse', priority: 10, profile: ['standard', 'strict'], run: function() {} },
  ];
  var result = registry.forEvent(handlers, 'PreToolUse');
  assert.equal(result.length, 2);
  assert.equal(result[0].priority, 10);
  assert.equal(result[1].priority, 100);
});

test('forEvent returns empty array when no handlers match', function() {
  var handlers = [
    { on: 'PostToolUse', priority: 50, profile: ['standard', 'strict'], run: function() {} },
  ];
  var result = registry.forEvent(handlers, 'PreToolUse');
  assert.equal(result.length, 0);
});

// --- wrapLegacyHandler ---

test('wrapLegacyHandler produces new-contract wrapper', function() {
  var mod = { run: function(rawInput) { return { raw: rawInput, exitCode: 0 }; } };
  var filePath = '/some/path/post-tool-use-failure.js';
  var wrapped = registry.wrapLegacyHandler(mod, filePath);
  assert.equal(wrapped.on, 'PostToolUseFailure');
  assert.equal(typeof wrapped.match, 'function');
  assert.equal(typeof wrapped.run, 'function');
  assert.equal(wrapped._legacy, true);
});

// --- VALID_EVENTS ---

test('VALID_EVENTS contains expected event names', function() {
  assert.ok(registry.VALID_EVENTS.has('PreToolUse'));
  assert.ok(registry.VALID_EVENTS.has('PostToolUse'));
  assert.ok(registry.VALID_EVENTS.has('Stop'));
  assert.ok(registry.VALID_EVENTS.has('PreCompact'));
});

// --- normalizeId ---

test('normalizeId cleans and normalizes IDs', function() {
  assert.equal(registry.normalizeId('  Foo Bar  '), 'foo-bar');
  assert.equal(registry.normalizeId('bash:block-no-verify'), 'bash-block-no-verify');
  assert.equal(registry.normalizeId(''), '');
  assert.equal(registry.normalizeId(null), '');
});
