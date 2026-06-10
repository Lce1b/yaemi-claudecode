'use strict';

const path = require('path');
const config = require('../../lib/config');
const stateStore = require('../../lib/state-store');
const { debugLog } = require('../../lib/utils');

const ACTIVITY_FILE = path.join(config.DATA_DIR, 'session-activity.json');
const SESSION_TTL_MS = 24 * 60 * 60 * 1000;

module.exports = {
  on: 'PostToolUse',
  match: () => true,
  priority: 500, profile: ['minimal', 'standard', 'strict'],
  async run(event, ctx) {
    try {
      var tn = event.tool_name || 'Unknown', fp = event.tool_input && event.tool_input.file_path;
      var data = stateStore.readJSON(ACTIVITY_FILE, null);
      if (data) { if (Date.now() - new Date(data.last_activity || 0).getTime() >= SESSION_TTL_MS) data = null; }
      if (!data) data = { session_id: new Date().toISOString().replace(/[:.]/g, '-'), project: path.basename(process.cwd()), tool_calls: {}, total_tool_calls: 0, files_edited: [], last_activity: new Date().toISOString() };
      data.tool_calls[tn] = (data.tool_calls[tn] || 0) + 1;
      data.total_tool_calls = (data.total_tool_calls || 0) + 1;
      data.last_activity = new Date().toISOString();
      if (fp && (tn === 'Edit' || tn === 'Write' || tn === 'MultiEdit')) { if (!data.files_edited) data.files_edited = []; if (!data.files_edited.includes(fp)) data.files_edited.push(fp); }
      stateStore.ensureDir(config.DATA_DIR);
      stateStore.atomicWrite(ACTIVITY_FILE, data);
    } catch (_) { debugLog('session-activity-tracker error: ' + (_.message || _)); }
    return { exitCode: 0 };
  },
};
