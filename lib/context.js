'use strict';

/**
 * Execution context passed to every handler's run(event, ctx).
 *
 * Provides:
 *   ctx.log(msg)    — write to debug log
 *   ctx.warn(msg)   — accumulate non-blocking warning (goes to stderr)
 *   ctx.error(msg)  — accumulate blocking error (goes to stderr, exitCode=2)
 *   ctx.deny(msg)   — permissionDecision: deny (forces Claude to explain)
 *   ctx.sink        — EventSink instance (fire-and-forget + call)
 *   ctx.config      — resolved config
 *   ctx.eventName   — the hook event name
 */

const { debugLog } = require('./utils');

class HookContext {
  constructor(opts) {
    this._warnings = [];
    this._errors = [];
    this._denyReason = null;
    this.sink = opts.sink || null;
    this.config = opts.config || {};
    this.eventName = opts.eventName || '';
    this.sessionId = opts.sessionId || '';
    this.cwd = opts.cwd || process.cwd();
  }

  log(msg) { debugLog(msg); }

  warn(msg) { if (msg) this._warnings.push(String(msg)); }

  error(msg) { if (msg) this._errors.push(String(msg)); }

  /**
   * Request a permissionDecision: deny.
   * Unlike exitCode=2 (block), this tells Claude to explain itself
   * before retrying — similar to ECC's GateGuard fact-forcing gate.
   */
  deny(reason) { this._denyReason = String(reason || ''); }

  getDenyReason() { return this._denyReason; }
  hasDeny() { return !!this._denyReason; }

  getWarnings() { return this._warnings.length > 0 ? this._warnings.join('\n') : ''; }
  getErrors() { return this._errors.length > 0 ? this._errors.join('\n') : ''; }
  hasErrors() { return this._errors.length > 0; }

  flushStderr() {
    const parts = [];
    if (this._warnings.length > 0) parts.push(this._warnings.join('\n'));
    if (this._errors.length > 0) parts.push(this._errors.join('\n'));
    this._warnings = [];
    this._errors = [];
    return parts.join('\n');
  }
}

function createContext(opts) {
  return new HookContext(opts || {});
}

module.exports = { HookContext, createContext };
