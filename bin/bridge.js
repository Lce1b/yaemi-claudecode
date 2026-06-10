#!/usr/bin/env node
'use strict';

// CLI command routing: yhk install / status / uninstall
const CLI_CMDS = new Set(['install', 'uninstall', 'remove', 'status', 'info']);
const cliArgs = process.argv.slice(2);
if (cliArgs.length > 0 && (CLI_CMDS.has(cliArgs[0]) || cliArgs[0] === '--help' || cliArgs[0] === '-h')) {
  require('../scripts/install.js');
  return;
}

/**
 * Yaemi Claudecode — Hook Bridge
 *
 * stdin JSON → pipeline → stdout
 */

const path = require('path');
const { readStdinSync, debugLog } = require('../lib/utils');
const { scanHandlers, forEvent } = require('../lib/registry');
const { createContext } = require('../lib/context');
const { createSink } = require('../lib/sink');

const HANDLERS_DIR = path.join(__dirname, '..', 'handlers');
const PLUGIN_ROOT = path.join(__dirname, '..');
const SECURITY_CRITICAL_HOOKS = new Set(['PreToolUse', 'SessionStart']);

let _handlers = null;
function getHandlers() {
  if (!_handlers) {
    _handlers = scanHandlers(HANDLERS_DIR, PLUGIN_ROOT);
    // Also scan project-local custom handlers
    const customDir = path.join(process.cwd(), '.claude', 'hooks', 'custom');
    try {
      const fs = require('fs');
      if (fs.existsSync(customDir) && fs.statSync(customDir).isDirectory()) {
        const custom = scanHandlers(customDir, customDir);
        _handlers = _handlers.concat(custom);
      }
    } catch (_) { /* custom dir not required */ }
  }
  return _handlers;
}

async function executeHandler(handler, event, ctx) {
  try {
    if (!handler.match(event)) return { exitCode: 0 };

    const result = await handler.run(event, ctx);

    if (result && typeof result === 'object' && !Array.isArray(result)) {
      const exitCode = Number.isInteger(result.exitCode) ? result.exitCode : 0;
      if (result.stderr) ctx.warn(result.stderr);
      if (result.deny) ctx.deny(result.deny);
      return { exitCode, stdout: result.stdout };
    }

    return { exitCode: 0 };
  } catch (e) {
    const msg = '[yaemi] handler ' + (handler.id || handler.name) + ' crashed: ' + (e.message || e);
    ctx.log(msg);
    return { exitCode: 0 };
  }
}

async function runPipeline(event, rawInput) {
  const handlers = getHandlers();
  const matching = forEvent(handlers, event.hook_event_name || '');

  const sinkMode = process.env.YAEMI_HOOK_SINK || 'stdout';
  const sink = createSink(sinkMode);
  const ctx = createContext({
    sink,
    config: {},
    eventName: event.hook_event_name,
    sessionId: event.session_id || '',
    cwd: event.cwd || process.cwd(),
  });

  let blockingExitCode = 0;
  let blockingStderr = '';
  let stdoutOverride = null;

  for (const handler of matching) {
    // Async handlers — fire and forget
    if (handler.async) {
      const timeout = handler.timeout || 10;
      const timer = setTimeout(() => {
        ctx.log('handler ' + handler.id + ' timed out after ' + timeout + 's');
      }, timeout * 1000);
      executeHandler(handler, event, ctx).then(() => clearTimeout(timer)).catch(() => {});
      continue;
    }

    const result = await executeHandler(handler, event, ctx);

    // permissionDecision: deny
    if (ctx.hasDeny()) {
      const denyOutput = JSON.stringify({
        hookSpecificOutput: {
          hookEventName: event.hook_event_name,
          permissionDecision: 'deny',
          permissionDecisionReason: ctx.getDenyReason(),
        }
      });
      return { rawInput, stdout: denyOutput, stderr: undefined, exitCode: 0 };
    }

    if (result.exitCode !== 0) {
      blockingExitCode = result.exitCode;
      if (ctx.getErrors()) blockingStderr = ctx.flushStderr();
      else if (ctx.getWarnings()) blockingStderr = ctx.flushStderr();
      break;
    }

    if (result.stdout !== undefined) stdoutOverride = result.stdout;
  }

  const combinedStderr = blockingStderr || ctx.flushStderr();

  return {
    rawInput,
    stdout: stdoutOverride !== null ? stdoutOverride : rawInput,
    stderr: combinedStderr || undefined,
    exitCode: blockingExitCode,
  };
}

async function main() {
  const rawInput = readStdinSync();
  if (!rawInput) { process.exit(0); }

  let event;
  try { event = JSON.parse(rawInput); } catch (_) { process.exit(0); }

  if (!event.hook_event_name) {
    process.stdout.write(rawInput);
    process.exit(0);
  }

  const { stdout, stderr, exitCode } = await runPipeline(event, rawInput);

  if (stderr) process.stderr.write(String(stderr).endsWith('\n') ? stderr : stderr + '\n');
  process.stdout.write(stdout ? String(stdout) : rawInput);

  const isSecCrit = SECURITY_CRITICAL_HOOKS.has(event.hook_event_name);
  if (isSecCrit && exitCode !== 0) {
    process.exit(exitCode);
  }
  process.exit(0);
}

const { registerSink } = require('../lib/sink');
module.exports = { run: main, registerSink };

if (require.main === module) {
  main().catch(e => {
    process.stderr.write('[yaemi-hook] bridge crash: ' + e.message + '\n');
    process.exit(2);
  });
}
