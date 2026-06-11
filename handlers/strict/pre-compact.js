'use strict';

const path = require('path');
const config = require('../../lib/config');
const { debugLog } = require('../../lib/utils');
const { atomicWrite, ensureDir } = require('../../lib/state-store');

module.exports = {
  on: 'PreCompact',
  match: function() { return true; },
  priority: 50,
  profile: ['strict'],
  run: async function(event, ctx) {
    const sessionId = event.session_id || 'unknown';
    const cwd = event.cwd || process.cwd();

    let lastUserMessage = '';
    if (event.last_user_message) {
      lastUserMessage = String(event.last_user_message).substring(0, 500);
    } else if (event.prompt) {
      lastUserMessage = String(event.prompt).substring(0, 500);
    }

    const snapshot = {
      timestamp: new Date().toISOString(),
      session_id: sessionId,
      cwd: cwd,
      last_user_message: lastUserMessage,
      event_name: 'PreCompact',
    };

    const snapshotsDir = config.DATA_DIR + '/sessions';
    ensureDir(snapshotsDir);

    const filePath = path.join(snapshotsDir, '.compact-snapshot.json');
    atomicWrite(filePath, snapshot);

    debugLog('PreCompact snapshot saved (session: ' + sessionId + ')');

    return { exitCode: 0 };
  },
};
