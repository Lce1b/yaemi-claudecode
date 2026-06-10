'use strict';

const assert = require('node:assert');
const mod = require('../handlers/strict/debug-check');
const { scanContent, DEBUG_PATTERNS, TRACKED_EXT } = mod;

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

function makeCtx() {
  const warnings = [];
  return {
    warnings,
    warn: (msg) => { warnings.push(msg); },
    log: () => {},
    error: (msg) => { warnings.push(msg); },
  };
}

console.log('\n=== debug-check.js ===\n');

// ---- New contract ----

test('exports on field as PostToolUse', () => {
  assert.strictEqual(mod.on, 'PostToolUse');
});

test('exports match function', () => {
  assert.strictEqual(typeof mod.match, 'function');
});

test('match returns true for Write', () => {
  assert.strictEqual(mod.match({ tool_name: 'Write' }), true);
});

test('match returns true for Edit', () => {
  assert.strictEqual(mod.match({ tool_name: 'Edit' }), true);
});

test('match returns true for MultiEdit', () => {
  assert.strictEqual(mod.match({ tool_name: 'MultiEdit' }), true);
});

test('match returns false for Read', () => {
  assert.strictEqual(mod.match({ tool_name: 'Read' }), false);
});

test('match returns false for Bash', () => {
  assert.strictEqual(mod.match({ tool_name: 'Bash' }), false);
});

test('match returns false for empty tool_name', () => {
  assert.strictEqual(mod.match({}), false);
});

test('exports priority as number', () => {
  assert.strictEqual(typeof mod.priority, 'number');
});

test('exports profile array', () => {
  assert.ok(Array.isArray(mod.profile));
  assert.ok(mod.profile.includes('standard'));
});

// ---- run with mock ctx ----

test('run returns exitCode 0 for non-Write/Edit tool', async () => {
  const ctx = makeCtx();
  const result = await mod.run({ tool_name: 'Read', tool_input: {} }, ctx);
  assert.strictEqual(result.exitCode, 0);
  assert.strictEqual(ctx.warnings.length, 0);
});

test('run detects console.log in Write content', async () => {
  const ctx = makeCtx();
  const event = {
    tool_name: 'Write',
    tool_input: { file_path: '/test/app.js', content: 'console.log("test");' },
  };
  const result = await mod.run(event, ctx);
  assert.strictEqual(result.exitCode, 0);
  assert.strictEqual(ctx.warnings.length, 1);
  assert.ok(ctx.warnings[0].includes('DEBUG CHECK'));
  assert.ok(ctx.warnings[0].includes('console.log('));
});

test('run returns no warning for clean content', async () => {
  const ctx = makeCtx();
  const event = {
    tool_name: 'Write',
    tool_input: { file_path: '/test/app.js', content: 'const x = 1;' },
  };
  const result = await mod.run(event, ctx);
  assert.strictEqual(result.exitCode, 0);
  assert.strictEqual(ctx.warnings.length, 0);
});

test('run detects debugger in Edit new_string', async () => {
  const ctx = makeCtx();
  const event = {
    tool_name: 'Edit',
    tool_input: { file_path: '/test/app.js', new_string: 'debugger;\nconst x = 1;' },
  };
  const result = await mod.run(event, ctx);
  assert.strictEqual(result.exitCode, 0);
  assert.strictEqual(ctx.warnings.length, 1);
  assert.ok(ctx.warnings[0].includes('debugger'));
});

// ---- DEBUG_PATTERNS structure ----

test('DEBUG_PATTERNS has 4 patterns', () => {
  assert.strictEqual(DEBUG_PATTERNS.length, 4);
  const labels = DEBUG_PATTERNS.map(p => p.label);
  assert.ok(labels.includes('console.log('));
  assert.ok(labels.includes('console.debug('));
  assert.ok(labels.includes('debugger'));
  assert.ok(labels.includes('print('));
});

test('TRACKED_EXT matches .js files', () => {
  assert.ok(TRACKED_EXT.test('file.js'));
  assert.ok(TRACKED_EXT.test('file.ts'));
  assert.ok(TRACKED_EXT.test('file.jsx'));
  assert.ok(TRACKED_EXT.test('file.tsx'));
  assert.ok(TRACKED_EXT.test('file.py'));
  assert.ok(!TRACKED_EXT.test('file.css'));
  assert.ok(!TRACKED_EXT.test('file.html'));
  assert.ok(!TRACKED_EXT.test('file.rs'));
});

// ---- scanContent ----

test('scanContent detects console.log(', () => {
  const results = scanContent('console.log("hello");\nconst x = 1;', '/test/file.js');
  assert.strictEqual(results.length, 1);
  assert.strictEqual(results[0].label, 'console.log(');
  assert.strictEqual(results[0].lineNum, 1);
  assert.strictEqual(results[0].file, '/test/file.js');
});

test('scanContent detects console.debug(', () => {
  const results = scanContent('console.debug("debug info");', '/test/file.js');
  assert.strictEqual(results.length, 1);
  assert.strictEqual(results[0].label, 'console.debug(');
});

test('scanContent detects debugger statement', () => {
  const results = scanContent('function foo() {\n  debugger;\n}', '/test/file.js');
  assert.strictEqual(results.length, 1);
  assert.strictEqual(results[0].label, 'debugger');
  assert.strictEqual(results[0].lineNum, 2);
});

test('scanContent detects print( at line start (Python)', () => {
  const results = scanContent('print("hello")\nx = 1\n', '/test/file.py');
  assert.strictEqual(results.length, 1);
  assert.strictEqual(results[0].label, 'print(');
});

test('scanContent ignores console.log in single-line comments', () => {
  const results = scanContent('// console.log("commented out");\nconst x = 1;', '/test/file.js');
  assert.strictEqual(results.length, 0);
});

test('scanContent ignores console.log when on same line as /* opener', () => {
  const results = scanContent('/* console.log("in single-line block comment"); */\nconst x = 1;', '/test/file.js');
  assert.strictEqual(results.length, 0);
});

test('scanContent ignores print( in Python comments', () => {
  const results = scanContent('# print("commented")\nx = 1', '/test/file.py');
  assert.strictEqual(results.length, 0);
});

test('scanContent returns empty array for clean code with no debug statements', () => {
  const results = scanContent(
    'const x = 1;\nfunction add(a, b) { return a + b; }\nmodule.exports = { add };',
    '/test/file.js'
  );
  assert.strictEqual(results.length, 0);
});

test('scanContent detects multiple debug statements in one file', () => {
  const results = scanContent(
    'console.log("start");\nconst x = 1;\nconsole.debug("mid");\ndebugger;\n',
    '/test/file.js'
  );
  assert.strictEqual(results.length, 3);
  const labels = results.map(r => r.label);
  assert.ok(labels.includes('console.log('));
  assert.ok(labels.includes('console.debug('));
  assert.ok(labels.includes('debugger'));
});

test('scanContent truncates long lines in results', () => {
  const longCall = 'console.log("' + 'x'.repeat(200) + '");';
  const results = scanContent(longCall, '/test/file.js');
  assert.strictEqual(results.length, 1);
  assert.ok(results[0].text.length <= 83, 'expected truncated text, got length ' + results[0].text.length);
  assert.ok(results[0].text.endsWith('...'), 'expected ellipsis suffix');
});

test('scanContent does not detect print( mid-line (only line-start)', () => {
  const results = scanContent('x = print("hello")\n', '/test/file.py');
  assert.strictEqual(results.length, 0, 'print( mid-line should not match');
});

test('scanContent returns empty for empty content', () => {
  const results = scanContent('', '/test/file.js');
  assert.strictEqual(results.length, 0);
});

// ---- Summary ----

const total = passed + failed;
console.log('\ndebug-check.test.js: ' + passed + '/' + total + ' passed, ' + failed + ' failed\n');
process.exit(failed > 0 ? 1 : 0);
