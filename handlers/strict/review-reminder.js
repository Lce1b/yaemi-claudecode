'use strict';

/**
 * Review Reminder + Auto-Review — PostToolUse handler.
 *
 * Tracks edits per session. When thresholds are met:
 *   1. Always: warns to consider /code-review
 *   2. If YAEMI_REVIEW_API_KEY is set: auto-runs LLM review (async, non-blocking)
 *
 * Thresholds: 3+ files + 200+ lines, or 6+ files, or 400+ lines
 * Cooldown: 5 edits between reminders
 */

const fs = require('fs');
const path = require('path');
const config = require('../../lib/config');
const { runReview } = require('../../lib/auto-review');

const REVIEW_STATE_DIR = path.join(config.DATA_DIR, 'review-state');
const FILE_THRESHOLD = 3;
const LINE_THRESHOLD = 200;
const COOLDOWN_EDITS = 5;

function loadState(sid) {
  try { fs.mkdirSync(REVIEW_STATE_DIR, { recursive: true }); } catch (_) {}
  const fp = path.join(REVIEW_STATE_DIR, 'state-' + sid + '.json');
  try { return JSON.parse(fs.readFileSync(fp, 'utf8')); }
  catch (_) { return { files: {}, totalLines: 0, lastReminderAt: 0, callCount: 0, reminderCount: 0 }; }
}

function saveState(sid, state) {
  try { fs.mkdirSync(REVIEW_STATE_DIR, { recursive: true }); } catch (_) {}
  try { fs.writeFileSync(path.join(REVIEW_STATE_DIR, 'state-' + sid + '.json'), JSON.stringify(state, null, 2), 'utf8'); } catch (_) {}
}

function countLinesInEdit(edit) {
  if (!edit || !edit.new_string) return 0;
  return (edit.new_string.match(/\n/g) || []).length;
}

module.exports = {
  on: 'PostToolUse',
  match: function(event) {
    const t = event.tool_name || '';
    return t === 'Write' || t === 'Edit' || t === 'MultiEdit';
  },
  priority: 400,
  profile: ['standard', 'strict'],

  async run(event, ctx) {
    const tn = event.tool_name || '';
    const ti = event.tool_input || {};
    const sid = event.session_id || 'unknown';
    const state = loadState(sid);

    const fp = ti.file_path || '';
    let files = [fp];
    let totalNew = 0;
    if (tn === 'MultiEdit') {
      const edits = ti.edits || [];
      files = [];
      for (let i = 0; i < edits.length; i++) {
        files.push(edits[i].file_path || '');
        totalNew += countLinesInEdit(edits[i]);
      }
    } else {
      totalNew = countLinesInEdit(ti);
      if (tn === 'Write') totalNew = ((ti.content || '').match(/\n/g) || []).length;
    }

    for (let f = 0; f < files.length; f++) { if (files[f]) state.files[files[f]] = true; }
    state.totalLines += totalNew;

    state.callCount = (state.callCount || 0) + 1;
    const fc = Object.keys(state.files).length;
    let triggered = false;
    let reason = '';
    if (fc >= FILE_THRESHOLD && state.totalLines >= LINE_THRESHOLD) {
      reason = fc + ' files, ' + state.totalLines + ' lines'; triggered = true;
    } else if (fc >= FILE_THRESHOLD * 2) {
      reason = fc + ' files'; triggered = true;
    } else if (state.totalLines >= LINE_THRESHOLD * 2) {
      reason = state.totalLines + ' lines'; triggered = true;
    }

    if (triggered && (state.callCount - state.lastReminderAt) < COOLDOWN_EDITS) triggered = false;

    if (triggered) {
      state.lastReminderAt = state.callCount;
      state.reminderCount++;
      saveState(sid, state);
      ctx.sink.fire('/api/hook/review-suggestion', { session_id: sid, file_count: fc, total_lines: state.totalLines, reason: reason });
      ctx.warn('[yaemi] Review reminder: edited ' + reason + ' — consider running /code-review to audit code quality');

      // Auto-review (async, non-blocking)
      if (process.env.YAEMI_REVIEW_API_KEY) {
        ctx.log('[AutoReview] triggering review...');
        runReview(ctx).then(function (result) {
          if (result) {
            const out = '\n=== Auto Review ===\n' + result + '\n=== End ===\n';
            process.stderr.write(out);
          }
        }).catch(function (e) {
          ctx.log('[AutoReview] error: ' + (e.message || e));
        });
      }
    } else {
      saveState(sid, state);
    }

    return { exitCode: 0 };
  },
};
