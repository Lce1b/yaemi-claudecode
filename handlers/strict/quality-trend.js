'use strict';

var fs = require('fs');
var path = require('path');
var config = require('../../lib/config');
var { getAccumFile } = require('../../lib/utils');
var TREND_FILE = path.join(config.DATA_DIR, 'quality-trends.json'), MAX_HISTORY = 20;

function loadTrends() { try { return JSON.parse(fs.readFileSync(TREND_FILE, 'utf8')); } catch (_) { return { sessions: [], summary: { totalSessions: 0, avgFilesEdited: 0 } }; } }
function saveTrends(d) { try { fs.mkdirSync(path.dirname(TREND_FILE), { recursive: true }); fs.writeFileSync(TREND_FILE, JSON.stringify(d, null, 2), 'utf8'); } catch (_) {} }

module.exports = {
  on: 'Stop', match: () => true, priority: 300, profile: ['standard', 'strict'],
  async run(event, ctx) {
    var trends = loadTrends(), sid = event.session_id || 'unknown';
    var usage = event.usage || {}, tIn = usage.input_tokens || 0, tOut = usage.output_tokens || 0;
    var editedCount = 0, accumFile = getAccumFile(sid);
    try { if (fs.existsSync(accumFile)) editedCount = fs.readFileSync(accumFile, 'utf8').split('\n').filter(Boolean).length; } catch (_) {}
    var qs = Math.min(100, Math.round((editedCount * 10) + (Math.log2(Math.max(1, tIn + tOut)) * 5)));
    var rec = { date: new Date().toISOString().slice(0, 10), session_id: sid.slice(0, 8), files_edited: editedCount, tokens_in: tIn, tokens_out: tOut, quality_score: qs };
    trends.sessions.push(rec); if (trends.sessions.length > MAX_HISTORY) trends.sessions = trends.sessions.slice(-MAX_HISTORY);
    trends.summary.totalSessions = (trends.summary.totalSessions || 0) + 1;
    var sum = 0; for (var i = 0; i < trends.sessions.length; i++) sum += trends.sessions[i].files_edited;
    trends.summary.avgFilesEdited = trends.sessions.length > 0 ? Math.round(sum / trends.sessions.length) : 0;
    trends.summary.lastQualityScore = qs;
    var lt = trends.sessions.slice(-3); if (lt.length >= 3) { var sc = lt.map(function(s){return s.quality_score||0;}); trends.summary.trendWarning = sc[0] > sc[1] && sc[1] > sc[2] ? 'quality_declining' : null; }
    saveTrends(trends);
    ctx.sink.fire('/api/hook/quality-trend', { session: rec, summary: trends.summary });
    if (trends.summary.trendWarning === 'quality_declining') ctx.warn('[Hook] Quality scores have been declining over the last 3 sessions. Consider slowing down and focusing on quality.');
    return { exitCode: 0 };
  },
};
