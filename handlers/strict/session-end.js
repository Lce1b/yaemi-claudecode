'use strict';

const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const config = require('../../lib/config');
const { debugLog } = require('../../lib/utils');
const { ensureDir, atomicWrite, cleanupOldFiles } = require('../../lib/state-store');

const SESSION_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
const MAX_USER_MSGS = 20;
const MAX_TOOLS = 30;

function tryExtractText(entry) {
  if (entry.type !== 'user' && entry.role !== 'user') return null;
  if (entry.content == null) return null;
  var text = typeof entry.content === 'string' ? entry.content : Array.isArray(entry.content) ? entry.content.map(function(c){return (c&&c.text)||'';}).join(' ') : '';
  return text.trim() || null;
}

function tryExtractNested(entry) {
  if (!entry.message || entry.message.role !== 'user' || entry.message.content == null) return null;
  var text = typeof entry.message.content === 'string' ? entry.message.content : Array.isArray(entry.message.content) ? entry.message.content.map(function(c){return (c&&c.text)||'';}).join(' ') : '';
  return text.trim() || null;
}

function extractTranscriptSummary(tp) {
  var content; try { content = fs.readFileSync(tp, 'utf8'); } catch (_) { return null; }
  var lines = content.split('\n').filter(Boolean);
  if (lines.length === 0) return null;
  var userMessages = [], toolsUsed = new Set(), filesModified = new Set();
  for (var li = 0; li < lines.length; li++) {
    try {
      var entry = JSON.parse(lines[li]);
      var text = tryExtractText(entry) || tryExtractNested(entry);
      if (text) userMessages.push(text.substring(0, 300));
      if (entry.type === 'tool_use' || entry.tool_name) { var tn = entry.tool_name || entry.name || ''; if (tn) toolsUsed.add(tn); var fp = entry.tool_input ? entry.tool_input.file_path : (entry.input ? entry.input.file_path : ''); if (fp && (tn === 'Edit' || tn === 'Write')) filesModified.add(fp); }
      if (entry.type === 'assistant' && entry.message && Array.isArray(entry.message.content)) { for (var bi = 0; bi < entry.message.content.length; bi++) { var block = entry.message.content[bi]; if (block.type === 'tool_use') { var bTn = block.name || ''; if (bTn) toolsUsed.add(bTn); var bFp = block.input ? block.input.file_path : ''; if (bFp && (bTn === 'Edit' || bTn === 'Write')) filesModified.add(bFp); } } }
    } catch (_) {}
  }
  if (userMessages.length === 0) return null;
  return { userMessages: userMessages.slice(-MAX_USER_MSGS), toolsUsed: Array.from(toolsUsed).slice(0, MAX_TOOLS), filesModified: Array.from(filesModified).slice(0, 30) };
}

function persistSession(event) {
  var tp = event.transcript_path;
  if (!tp || typeof tp !== 'string' || !fs.existsSync(tp)) return null;
  var summary = extractTranscriptSummary(tp);
  if (!summary) return null;
  var now = new Date(), dateStr = now.toISOString().substring(0, 10);
  var hash = crypto.createHash('sha256').update(tp + '-' + now.getTime()).digest('hex').substring(0, 8);
  var session = { id: dateStr + '-' + hash, timestamp: now.toISOString(), cwd: event.cwd || process.cwd(), project: path.basename(event.cwd || process.cwd()), userMessages: summary.userMessages, toolsUsed: summary.toolsUsed, filesModified: summary.filesModified, summary: (summary.userMessages[0] || '').substring(0, 120) };
  var sessionsDir = config.DATA_DIR + '/sessions';
  ensureDir(sessionsDir);
  atomicWrite(path.join(sessionsDir, session.id + '.json'), session);
  try { cleanupOldFiles(sessionsDir, SESSION_RETENTION_MS); } catch (_) {}
  return session;
}

module.exports = {
  on: 'Stop', match: () => true, priority: 50, profile: ['minimal', 'standard', 'strict'],
  async run(event, ctx) { persistSession(event); return { exitCode: 0 }; },
  persistSession,
};
