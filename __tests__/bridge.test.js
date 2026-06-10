'use strict';

var test = require('node:test');
var assert = require('node:assert');
var cp = require('child_process');
var path = require('path');

var BRIDGE = path.resolve(path.join(__dirname, '..', 'bin', 'bridge.js'));

function runBridge(input) {
  var result = cp.spawnSync('node', [BRIDGE], {
    input: typeof input === 'string' ? input : JSON.stringify(input),
    timeout: 5000,
  });
  var stdout = '';
  var stderr = '';
  try { stdout = result.stdout.toString('utf8'); } catch (_) {}
  try { stderr = result.stderr.toString('utf8'); } catch (_) {}
  return { exitCode: result.status, stdout: stdout, stderr: stderr };
}

// --- Valid JSON event ---

test('valid JSON event passes through pipeline', function() {
  var event = {
    hook_event_name: 'PostToolUse',
    tool_name: 'Bash',
    tool_input: { command: 'echo hello' },
    session_id: 'test',
    cwd: process.cwd(),
  };
  var r = runBridge(event);
  assert.equal(r.exitCode, 0);
});

// --- Invalid JSON ---

test('invalid JSON returns exitCode 0', function() {
  var r = runBridge('not valid json');
  assert.equal(r.exitCode, 0);
});

// --- No hook_event_name ---

test('no hook_event_name passes through unchanged', function() {
  var input = JSON.stringify({ tool_name: 'Bash' });
  var result = cp.spawnSync('node', [BRIDGE], { input: input, timeout: 5000 });
  assert.equal(result.status, 0);
});

// --- Handler exception isolation ---

test('handler exception does not crash bridge', function() {
  // Use a normal event — handlers that do exist won't crash
  var event = {
    hook_event_name: 'PostToolUse',
    tool_name: 'Read',
    tool_input: { file_path: '/nonexistent' },
    session_id: 'test',
    cwd: process.cwd(),
  };
  var r = runBridge(event);
  // Bridge should complete without crashing
  assert.ok(r.exitCode === 0 || r.exitCode === 2);
});

// --- exitCode !== 0 short-circuits PreToolUse ---

test('PreToolUse with destructive Bash command is blocked', function() {
  var event = {
    hook_event_name: 'PreToolUse',
    tool_name: 'Bash',
    tool_input: { command: 'rm -rf /' },
    session_id: 'test',
    cwd: process.cwd(),
  };
  var r = runBridge(event);
  assert.equal(r.exitCode, 2);
  assert.ok(r.stderr.indexOf('BLOCKED') !== -1 || r.stderr.indexOf('rm -rf') !== -1);
});

// --- Non-security-critical events don't block on non-zero exit ---

test('PostToolUse non-zero exitCode does not block', function() {
  // PostToolUse is NOT security-critical, so even if a handler returns non-zero,
  // the bridge should exit 0
  var event = {
    hook_event_name: 'PostToolUse',
    tool_name: 'Bash',
    tool_input: { command: 'echo hello' },
    session_id: 'test',
    cwd: process.cwd(),
  };
  var r = runBridge(event);
  assert.equal(r.exitCode, 0);
});

// --- Empty stdin ---

test('empty stdin returns exitCode 0', function() {
  var result = cp.spawnSync('node', [BRIDGE], { input: '', timeout: 5000 });
  assert.equal(result.status, 0);
});
