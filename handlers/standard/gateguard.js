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
  var list = (config.getConfig("gateguard.bypass") || "").split(",").filter(Boolean);
  if (list.length === 0) return false;
  var n = fp.replace(/\\/g, '/');
  var b = path.basename(fp);
  for (var i = 0; i < list.length; i++) {
    if (b === list[i]) return true;
    if (list[i].indexOf('/') !== -1 && n.indexOf(list[i]) !== -1) return true;
  }
  return false;
}

function getSessionId(event) { return String((event && event.session_id) || '').trim().replace(/[^a-zA-Z0-9_-]/g, '_') || 'default'; }
function stateFilePath(sid) { return path.join(GATEGUARD_DIR, 'state-' + sid + '.json'); }

function loadGateState(sid) {
  var fp = stateFilePath(sid);
  var state = readJSON(fp, null);
  if (state && typeof state === 'object') {
    try { if (fs.existsSync(fp)) { var st = fs.statSync(fp); if (Date.now() - st.mtimeMs > SESSION_TIMEOUT_MS) { var fresh = { checked: [], lastActive: Date.now() }; atomicWrite(fp, fresh); return fresh; } } } catch (_) {}
    return { checked: Array.isArray(state.checked) ? state.checked : [], lastActive: typeof state.lastActive === 'number' ? state.lastActive : Date.now() };
  }
  return { checked: [], lastActive: Date.now() };
}

function saveGateState(sid, state) { var fp = stateFilePath(sid); if (state.checked.length > MAX_FILE_KEYS) state.checked = state.checked.slice(-MAX_FILE_KEYS); state.lastActive = Date.now(); atomicWrite(fp, state); }
function isFileChecked(sid, fp) { return loadGateState(sid).checked.indexOf(fp) !== -1; }
function markFileChecked(sid, fp) { var state = loadGateState(sid); if (state.checked.indexOf(fp) === -1) { state.checked.push(fp); saveGateState(sid, state); } }
function gateMsg() { return '[GateGuard] Before editing, present these facts:\n\n1. List ALL files that import/require this file (use Grep)\n2. List the public API affected by this change\n3. Show the data model/schema this file relies on\n4. Quote the user\'s current instruction verbatim\n\nPresent the facts, then retry the same operation.'; }
function isTestFile(fp) { if (!fp) return false; var n = fp.replace(/\\/g, '/'); var b = path.basename(n); var pats = [/\.test\./, /\.spec\./, /_test\./, /_spec\./, /^test_/, /^spec_/, /\/tests\//, /\/spec\//, /\/__tests__\//]; for (var i = 0; i < pats.length; i++) { if (pats[i].test(n) || pats[i].test(b)) return true; } }
function classifyFileSize(fp) { if (!fp) return 'absent'; try { var r = path.resolve(fp); if (!fs.existsSync(r)) return 'absent'; var fd = fs.openSync(r, 'r'); try { var buf = Buffer.alloc(65536); var bytes = 0; var newlines = 0; while ((bytes = fs.readSync(fd, buf, 0, buf.length, null)) > 0) { for (var i = 0; i < bytes; i++) { if (buf[i] === 10) { newlines++; if (newlines > 200) { return 'large'; } } } } var lines = newlines + 1; if (lines < 50) return 'small'; if (lines <= 200) return 'medium'; return 'large'; } finally { fs.closeSync(fd); } } catch (_) { return 'absent'; } }
function gateMsgMedium() { return '[GateGuard] Before editing, provide brief context:\n\n1. Show the data model/schema this change affects\n2. Quote the user\'s current instruction verbatim\n\nProvide context, then retry the same operation.'; }

function checkSingleFile(fp, sid) {
  if (!isBypassed(fp) && !isFileChecked(sid, fp)) {
    if (isTestFile(fp)) { markFileChecked(sid, fp); return null; }
    var sc = classifyFileSize(fp);
    if (sc === 'small') { markFileChecked(sid, fp); return null; }
    if (sc === 'medium') { markFileChecked(sid, fp); return gateMsgMedium(); }
    markFileChecked(sid, fp);
    return gateMsg();
  }
  return null;
}

module.exports = {
  on: 'PreToolUse',
  match: function(e) { var t = e.tool_name || ''; return t === 'Write' || t === 'Edit' || t === 'MultiEdit'; },
  priority: 80, profile: ['standard', 'strict'],
  run: async function(event, ctx) {
    if (!isHookEnabled('gateguard', 'standard,strict')) return { exitCode: 0 };
    var tn = event.tool_name || '', ti = event.tool_input || {}, sid = getSessionId(event);
    cleanupOldFiles(GATEGUARD_DIR, SESSION_TIMEOUT_MS);
    if (tn === 'MultiEdit') { var edits = ti.edits || []; for (var i = 0; i < edits.length; i++) { var fp = edits[i].file_path || ''; if (fp) { var m = checkSingleFile(fp, sid); if (m) { ctx.error(m); return { exitCode: 2 }; } } } return { exitCode: 0 }; }
    var fp = ti.file_path || ''; if (!fp) return { exitCode: 0 };
    var msg = checkSingleFile(fp, sid); if (msg) { ctx.error(msg); return { exitCode: 2 }; }
    return { exitCode: 0 };
  },
  isBypassed: isBypassed, isTestFile: isTestFile, checkSingleFile: checkSingleFile, classifyFileSize: classifyFileSize,
};
