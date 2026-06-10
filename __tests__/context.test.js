'use strict';

var test = require('node:test');
var assert = require('node:assert');

var { HookContext, createContext } = require('../lib/context');

// --- HookContext constructor ---

test('HookContext sets all constructor fields', function() {
  var sink = { call: function() {} };
  var config = { foo: 'bar' };
  var ctx = new HookContext({
    sink: sink,
    config: config,
    eventName: 'PreToolUse',
    sessionId: 'sess-123',
    cwd: '/test/dir',
  });
  assert.equal(ctx.sink, sink);
  assert.equal(ctx.config, config);
  assert.equal(ctx.eventName, 'PreToolUse');
  assert.equal(ctx.sessionId, 'sess-123');
  assert.equal(ctx.cwd, '/test/dir');
});

test('HookContext defaults for missing opts', function() {
  var ctx = new HookContext({});
  assert.equal(ctx.sink, null);
  assert.deepStrictEqual(ctx.config, {});
  assert.equal(ctx.eventName, '');
  assert.equal(ctx.sessionId, '');
  assert.equal(ctx.cwd, process.cwd());
});

// --- warn ---

test('warn accumulates warning messages', function() {
  var ctx = new HookContext({});
  ctx.warn('warning 1');
  ctx.warn('warning 2');
  assert.equal(ctx.getWarnings(), 'warning 1\nwarning 2');
});

test('warn ignores empty/falsy messages', function() {
  var ctx = new HookContext({});
  ctx.warn('');
  ctx.warn(null);
  ctx.warn(undefined);
  assert.equal(ctx.getWarnings(), '');
});

// --- error ---

test('error accumulates error messages', function() {
  var ctx = new HookContext({});
  ctx.error('error 1');
  ctx.error('error 2');
  assert.equal(ctx.getErrors(), 'error 1\nerror 2');
});

test('error ignores empty/falsy messages', function() {
  var ctx = new HookContext({});
  ctx.error('');
  ctx.error(null);
  assert.equal(ctx.getErrors(), '');
});

// --- hasErrors ---

test('hasErrors returns true when errors exist', function() {
  var ctx = new HookContext({});
  assert.equal(ctx.hasErrors(), false);
  ctx.error('something broke');
  assert.equal(ctx.hasErrors(), true);
});

test('hasErrors returns false when only warnings', function() {
  var ctx = new HookContext({});
  ctx.warn('just a warning');
  assert.equal(ctx.hasErrors(), false);
});

// --- getWarnings / getErrors ---

test('getWarnings returns empty string when no warnings', function() {
  var ctx = new HookContext({});
  assert.equal(ctx.getWarnings(), '');
});

test('getErrors returns empty string when no errors', function() {
  var ctx = new HookContext({});
  assert.equal(ctx.getErrors(), '');
});

// --- flushStderr ---

test('flushStderr combines warnings and errors', function() {
  var ctx = new HookContext({});
  ctx.warn('w1');
  ctx.error('e1');
  assert.equal(ctx.flushStderr(), 'w1\ne1');
});

test('flushStderr returns empty string when nothing accumulated', function() {
  var ctx = new HookContext({});
  assert.equal(ctx.flushStderr(), '');
});

test('flushStderr only includes errors when no warnings', function() {
  var ctx = new HookContext({});
  ctx.error('e1');
  assert.equal(ctx.flushStderr(), 'e1');
});

// --- createContext factory ---

test('createContext returns HookContext instance', function() {
  var ctx = createContext({ eventName: 'Stop' });
  assert.ok(ctx instanceof HookContext);
  assert.equal(ctx.eventName, 'Stop');
});

test('createContext with no args returns valid context', function() {
  var ctx = createContext();
  assert.equal(ctx.eventName, '');
  assert.equal(ctx.hasErrors(), false);
});
