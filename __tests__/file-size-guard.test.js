'use strict';

const assert = require('node:assert');
const path = require('path');

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
    error: (msg) => { warnings.push(msg); },
    log: () => {},
  };
}

console.log('\n=== file-size-guard.js ===\n');

// Load module (default settings)
const guard = require('../handlers/standard/file-size-guard');

// ---- New contract ----

test('exports on field as PreToolUse', () => {
  assert.strictEqual(guard.on, 'PreToolUse');
});

test('exports match function', () => {
  assert.strictEqual(typeof guard.match, 'function');
});

test('match returns true for Write', () => {
  assert.strictEqual(guard.match({ tool_name: 'Write' }), true);
});

test('match returns false for Read', () => {
  assert.strictEqual(guard.match({ tool_name: 'Read' }), false);
});

test('exports priority as number', () => {
  assert.strictEqual(typeof guard.priority, 'number');
});

// ---- run with mock ctx ----

test('run blocks oversized Write', async () => {
  const ctx = makeCtx();
  // Override config limit temporarily
  const orig = process.env.YAEMI_FILE_SIZE_LIMIT;
  process.env.YAEMI_FILE_SIZE_LIMIT = '5';
  delete require.cache[require.resolve('../lib/config')];
  delete require.cache[require.resolve('../handlers/standard/file-size-guard')];
  const g = require('../handlers/standard/file-size-guard');

  const event = {
    tool_name: 'Write',
    tool_input: { file_path: '/project/src/test.js', content: 'a\nb\nc\nd\ne\nf' },
  };
  const result = await g.run(event, ctx);
  assert.strictEqual(result.exitCode, 2);
  assert.strictEqual(ctx.warnings.length, 1);
  assert.ok(ctx.warnings[0].includes('FileSizeGuard'));

  if (orig !== undefined) process.env.YAEMI_FILE_SIZE_LIMIT = orig;
  else delete process.env.YAEMI_FILE_SIZE_LIMIT;
  delete require.cache[require.resolve('../lib/config')];
  delete require.cache[require.resolve('../handlers/standard/file-size-guard')];
});

test('run allows normal Write', async () => {
  const ctx = makeCtx();
  const event = {
    tool_name: 'Write',
    tool_input: { file_path: '/project/src/test.js', content: 'const x = 1;' },
  };
  const result = await guard.run(event, ctx);
  assert.strictEqual(result.exitCode, 0);
  assert.strictEqual(ctx.warnings.length, 0);
});

test('run skips non-Write/Edit tools', async () => {
  const ctx = makeCtx();
  const result = await guard.run({ tool_name: 'Read', tool_input: {} }, ctx);
  assert.strictEqual(result.exitCode, 0);
});

// ---- isBypassed ----

test('isBypassed returns true for .json extension', () => {
  assert.strictEqual(guard.isBypassed('/some/project/package.json'), true);
});

test('isBypassed returns true for .md extension', () => {
  assert.strictEqual(guard.isBypassed('/some/project/README.md'), true);
});

test('isBypassed returns true for .yaml extension', () => {
  assert.strictEqual(guard.isBypassed('/some/project/config.yaml'), true);
});

test('isBypassed returns true for .yml extension', () => {
  assert.strictEqual(guard.isBypassed('/some/project/docker-compose.yml'), true);
});

test('isBypassed returns true for .toml extension', () => {
  assert.strictEqual(guard.isBypassed('/some/project/Cargo.toml'), true);
});

test('isBypassed returns true for .lock extension', () => {
  assert.strictEqual(guard.isBypassed('/some/project/package-lock.json'), true);
});

test('isBypassed returns true for .csv extension', () => {
  assert.strictEqual(guard.isBypassed('/some/project/data.csv'), true);
});

test('isBypassed returns true for .svg extension', () => {
  assert.strictEqual(guard.isBypassed('/some/project/icon.svg'), true);
});

test('isBypassed returns true for node_modules paths', () => {
  assert.strictEqual(guard.isBypassed('/project/node_modules/lodash/index.js'), true);
});

test('isBypassed returns true for .git paths', () => {
  assert.strictEqual(guard.isBypassed('/project/.git/config'), true);
});

test('isBypassed returns false for normal .js file', () => {
  assert.strictEqual(guard.isBypassed('/project/src/index.js'), false);
});

test('isBypassed returns false for normal .py file', () => {
  assert.strictEqual(guard.isBypassed('/project/src/main.py'), false);
});

test('isBypassed returns true for test file patterns', () => {
  assert.strictEqual(guard.isBypassed('/project/src/foo.test.js'), true);
  assert.strictEqual(guard.isBypassed('/project/src/foo.spec.ts'), true);
  assert.strictEqual(guard.isBypassed('/project/tests/test_foo.py'), true);
});

test('isBypassed handles Windows-style paths', () => {
  assert.strictEqual(guard.isBypassed('C:\\project\\node_modules\\lodash\\index.js'), true);
  assert.strictEqual(guard.isBypassed('C:\\project\\src\\index.js'), false);
});

test('isBypassed returns true for fixtures paths', () => {
  assert.strictEqual(guard.isBypassed('/project/fixtures/test-data.json'), true);
});

// ---- countWriteLines ----

test('countWriteLines counts lines in content', () => {
  assert.strictEqual(guard.countWriteLines({ content: 'a\nb\nc' }), 3);
});

test('countWriteLines returns 1 for empty content', () => {
  assert.strictEqual(guard.countWriteLines({ content: '' }), 1);
});

test('countWriteLines returns 0 for missing content field', () => {
  assert.strictEqual(guard.countWriteLines({}), 1);
});

test('countWriteLines counts single line', () => {
  assert.strictEqual(guard.countWriteLines({ content: 'hello' }), 1);
});

test('countWriteLines counts many lines', () => {
  const lines = [];
  for (let i = 0; i < 100; i++) lines.push('line ' + i);
  assert.strictEqual(guard.countWriteLines({ content: lines.join('\n') }), 100);
});

// ---- countEditLines ----

test('countEditLines returns 0 when file_path is missing', () => {
  assert.strictEqual(guard.countEditLines({}), 0);
});

test('countEditLines handles insertion (empty oldStr) with non-existent file', () => {
  const result = guard.countEditLines({
    file_path: '/nonexistent/test.js',
    old_string: '',
    new_string: 'a\nb\nc'
  });
  assert.strictEqual(result, 3);
});

test('countEditLines handles replacement (non-empty oldStr) with non-existent file', () => {
  const result = guard.countEditLines({
    file_path: '/nonexistent/test.js',
    old_string: 'foo',
    new_string: 'bar\nbaz'
  });
  // When old_string is not found in non-existent file: Math.max(1, 2) = 2
  assert.strictEqual(result, 2);
});

// ---- checkFile ----

const origLimit = process.env.YAEMI_FILE_SIZE_LIMIT;
process.env.YAEMI_FILE_SIZE_LIMIT = '5';
delete require.cache[require.resolve('../lib/config')];
delete require.cache[require.resolve('../handlers/standard/file-size-guard')];
const guardSmall = require('../handlers/standard/file-size-guard');

test('checkFile returns message string when Write exceeds limit', () => {
  const result = guardSmall.checkFile('Write', {
    file_path: '/project/src/test.js',
    content: 'a\nb\nc\nd\ne\nf' // 6 lines > 5
  });
  assert.ok(result !== null, 'expected result to not be null');
  assert.ok(typeof result === 'string', 'expected string message');
  assert.ok(result.includes('6 lines'), 'expected message to mention line count');
});

test('checkFile returns null for Write when content is under limit', () => {
  const result = guardSmall.checkFile('Write', {
    file_path: '/project/src/test.js',
    content: 'a\nb\nc' // 3 lines <= 5
  });
  assert.strictEqual(result, null);
});

test('checkFile returns null for bypassed file path', () => {
  const result = guardSmall.checkFile('Write', {
    file_path: '/project/package.json',
    content: 'x\n'.repeat(1000)
  });
  assert.strictEqual(result, null);
});

test('checkFile returns null when file_path is missing', () => {
  const result = guardSmall.checkFile('Write', { content: '' });
  assert.strictEqual(result, null);
});

test('checkFile handles Edit tool with oversized result', () => {
  const result = guardSmall.checkFile('Edit', {
    file_path: '/nonexistent/test.js',
    old_string: 'foo',
    new_string: 'a\nb\nc\nd\ne\nf\ng' // 7 lines
  });
  assert.ok(result !== null, 'expected result for 8 > 5');
  assert.ok(typeof result === 'string', 'expected string message');
});

if (origLimit !== undefined) {
  process.env.YAEMI_FILE_SIZE_LIMIT = origLimit;
} else {
  delete process.env.YAEMI_FILE_SIZE_LIMIT;
}

// ---- Summary ----

const total = passed + failed;
console.log('\nfile-size-guard.test.js: ' + passed + '/' + total + ' passed, ' + failed + ' failed\n');
process.exit(failed > 0 ? 1 : 0);
