'use strict';

const path = require('path');
const fs = require('fs');
const { isHookEnabled } = require('../../lib/profile');
const { atomicWrite, readJSON, cleanupOldFiles } = require('../../lib/state-store');
const config = require('../../lib/config');
const GATEGUARD_DIR = path.join(config.DATA_DIR, 'gateguard');
const SESSION_TIMEOUT_MS = 30 * 60 * 1000;
const MAX_FILE_KEYS = 500;

function isBypassed(fp) {
  const list = (config.getConfig("gateguard.bypass") || "").split(",").filter(Boolean);
  if (list.length === 0) return false;
  const n = fp.replace(/\\/g, '/');
  const b = path.basename(fp);
  for (let i = 0; i < list.length; i++) {
    if (b === list[i]) return true;
    if (list[i].includes('/') && n.includes(list[i])) return true;
  }
  return false;
}

function getSessionId(event) { return String((event && event.session_id) || '').trim().replace(/[^a-zA-Z0-9_-]/g, '_') || 'default'; }
function stateFilePath(sid) { return path.join(GATEGUARD_DIR, 'state-' + sid + '.json'); }

function loadGateState(sid) {
  const fp = stateFilePath(sid);
  const state = readJSON(fp, null);
  if (state && typeof state === 'object') {
    try {
      if (fs.existsSync(fp)) {
        const st = fs.statSync(fp);
        if (Date.now() - st.mtimeMs > SESSION_TIMEOUT_MS) {
          const fresh = { checked: [], lastActive: Date.now() };
          atomicWrite(fp, fresh);
          return fresh;
        }
      }
    } catch (_) {}
    return {
      checked: Array.isArray(state.checked) ? state.checked : [],
      lastActive: typeof state.lastActive === 'number' ? state.lastActive : Date.now(),
    };
  }
  return { checked: [], lastActive: Date.now() };
}

function saveGateState(sid, state) {
  const fp = stateFilePath(sid);
  const checked = state.checked.length > MAX_FILE_KEYS ? state.checked.slice(-MAX_FILE_KEYS) : [...state.checked];
  const updated = { checked: checked, lastActive: Date.now() };
  atomicWrite(fp, updated);
}
function isFileChecked(sid, fp) { return loadGateState(sid).checked.indexOf(fp) !== -1; }
function markFileChecked(sid, fp) {
  const state = loadGateState(sid);
  if (state.checked.indexOf(fp) === -1) {
    state.checked.push(fp);
    saveGateState(sid, state);
  }
}
function gateMsg() { return '[GateGuard] Before editing, present these facts:\n\n1. List ALL files that import/require this file (use Grep)\n2. List the public API affected by this change\n3. Show the data model/schema this file relies on\n4. Quote the user\'s current instruction verbatim\n\nPresent the facts, then retry the same operation.'; }
const TEST_FILE_PATTERNS = [/\.test\./, /\.spec\./, /_test\./, /_spec\./, /^test_/, /^spec_/, /\/tests\//, /\/spec\//, /\/__tests__\//];

function isTestFile(fp) {
  if (!fp) return false;
  const n = fp.replace(/\\/g, '/');
  const b = path.basename(n);
  for (let i = 0; i < TEST_FILE_PATTERNS.length; i++) {
    if (TEST_FILE_PATTERNS[i].test(n) || TEST_FILE_PATTERNS[i].test(b)) return true;
  }
  return false;
}

const FILE_READ_BUF = 65536;
const SMALL_LINE_LIMIT = 50;
const MEDIUM_LINE_LIMIT = 200;

function classifyFileSize(fp) {
  if (!fp) return 'absent';
  try {
    const r = path.resolve(fp);
    if (!fs.existsSync(r)) return 'absent';
    const fd = fs.openSync(r, 'r');
    try {
      const buf = Buffer.alloc(FILE_READ_BUF);
      let bytes = 0;
      let newlines = 0;
      while ((bytes = fs.readSync(fd, buf, 0, buf.length, null)) > 0) {
        for (let i = 0; i < bytes; i++) {
          if (buf[i] === 10) {
            newlines++;
            if (newlines > MEDIUM_LINE_LIMIT) return 'large';
          }
        }
      }
      const lines = newlines + 1;
      if (lines < SMALL_LINE_LIMIT) return 'small';
      if (lines <= MEDIUM_LINE_LIMIT) return 'medium';
      return 'large';
    } finally {
      fs.closeSync(fd);
    }
  } catch (_) { return 'absent'; }
}
function gateMsgMedium() { return '[GateGuard] Before editing, provide brief context:\n\n1. Show the data model/schema this change affects\n2. Quote the user\'s current instruction verbatim\n\nProvide context, then retry the same operation.'; }

function checkSingleFile(fp, sid) {
  if (isBypassed(fp)) return null;
  const prevState = loadGateState(sid);
  if (prevState.checked.indexOf(fp) !== -1) return null;

  if (isTestFile(fp)) {
    saveGateState(sid, { checked: [...prevState.checked, fp], lastActive: prevState.lastActive });
    return null;
  }
  const sc = classifyFileSize(fp);
  if (sc === 'small') {
    saveGateState(sid, { checked: [...prevState.checked, fp], lastActive: prevState.lastActive });
    return null;
  }
  if (sc === 'medium') {
    saveGateState(sid, { checked: [...prevState.checked, fp], lastActive: prevState.lastActive });
    return gateMsgMedium();
  }
  saveGateState(sid, { checked: [...prevState.checked, fp], lastActive: prevState.lastActive });
  return gateMsg();
}

module.exports = {
  on: 'PreToolUse',
  match: function(e) { const t = e.tool_name || ''; return t === 'Write' || t === 'Edit' || t === 'MultiEdit'; },
  priority: 80, profile: ['standard', 'strict'],
  run: async function(event, ctx) {
    if (!isHookEnabled('gateguard', 'standard,strict')) return { exitCode: 0 };
    const tn = event.tool_name || '';
    const ti = event.tool_input || {};
    const sid = getSessionId(event);
    cleanupOldFiles(GATEGUARD_DIR, SESSION_TIMEOUT_MS);

    if (tn === 'MultiEdit') {
      const edits = ti.edits || [];
      for (let i = 0; i < edits.length; i++) {
        const fp = edits[i].file_path || '';
        if (fp) {
          const m = checkSingleFile(fp, sid);
          if (m) { ctx.error(m); return { exitCode: 2 }; }
        }
      }
      return { exitCode: 0 };
    }

    const fp = ti.file_path || '';
    if (!fp) return { exitCode: 0 };
    const msg = checkSingleFile(fp, sid);
    if (msg) { ctx.error(msg); return { exitCode: 2 }; }
    return { exitCode: 0 };
  },
  isBypassed: isBypassed, isTestFile: isTestFile, checkSingleFile: checkSingleFile, classifyFileSize: classifyFileSize,
};
