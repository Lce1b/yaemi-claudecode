'use strict';

/**
 * PreToolUse Hook: Track edit count and suggest /compact at threshold
 *
 * Uses a file-based counter (scoped to session_id) so the count persists
 * across separated hook invocations. At the threshold (~50 edits), warns.
 *
 * Non-blocking — always returns exitCode 0.
 */

const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');

const DEFAULT_THRESHOLD = 50;
const REMINDER_INTERVAL = 25;

function getSessionId(event) {
  if (event && event.session_id) {
    return String(event.session_id).replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64);
  }
  const envId = process.env.CLAUDE_SESSION_ID;
  if (envId) return String(envId).replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64);
  return crypto.createHash('sha1').update(process.cwd()).digest('hex').slice(0, 12);
}

function readCounter(counterFile) {
  try {
    const raw = fs.readFileSync(counterFile, 'utf8').trim();
    if (!raw) return 0;
    const parsed = parseInt(raw, 10);
    if (isFinite(parsed) && parsed > 0 && parsed <= 1000000) return parsed;
  } catch (_) { /* best-effort */ }
  return 0;
}

function writeCounter(counterFile, count) {
  try {
    fs.writeFileSync(counterFile, String(count), 'utf8');
  } catch (_) { /* best-effort */ }
}

module.exports = {
  on: 'PreToolUse',
  match: (event) => event.tool_name === 'Write',
  priority: 380,
  profile: ['strict'],

  /**
   * @param {Object} event - Parsed hook event
   * @param {Object} ctx - HookContext
   */
  async run(event, ctx) {
    const sessionId = getSessionId(event) || 'default';
    const counterFile = path.join(os.tmpdir(), 'yaemi-edit-count-' + sessionId + '.txt');

    let count = readCounter(counterFile) + 1;
    if (count < 1) count = 1;
    writeCounter(counterFile, count);

    if (count === DEFAULT_THRESHOLD) {
      ctx.warn('[Hook] Edited ~ ' + DEFAULT_THRESHOLD + '  times — consider running /compact to free context');
    } else if (count > DEFAULT_THRESHOLD && (count - DEFAULT_THRESHOLD) % REMINDER_INTERVAL === 0) {
      ctx.warn('[Hook] Edited ' + count + '  times — if context is stale, run /compact to free context');
    }

    return { exitCode: 0 };
  },

  // Exported for tests
  getSessionId,
  readCounter,
  writeCounter,
  DEFAULT_THRESHOLD,
  REMINDER_INTERVAL,
};
