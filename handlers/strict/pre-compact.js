'use strict';

const path = require('path');
const config = require('../../lib/config');
const { debugLog } = require('../../lib/utils');
const { atomicWrite, ensureDir } = require('../../lib/state-store');

module.exports = {
  on: 'PreCompact',
  match: function() { return true; },
  priority: 50,
  profile: ['standard', 'strict'],
  run: async function(event, ctx) {
    var sessionId = event.session_id || 'unknown';
    var cwd = event.cwd || process.cwd();

    var lastUserMessage = '';
    if (event.last_user_message) {
      lastUserMessage = String(event.last_user_message).substring(0, 500);
    } else if (event.prompt) {
      lastUserMessage = String(event.prompt).substring(0, 500);
    }

    var snapshot = {
      timestamp: new Date().toISOString(),
      session_id: sessionId,
      cwd: cwd,
      last_user_message: lastUserMessage,
      event_name: 'PreCompact',
    };

    var snapshotsDir = config.DATA_DIR + '/sessions';
    ensureDir(snapshotsDir);

    var filePath = path.join(snapshotsDir, '.compact-snapshot.json');
    atomicWrite(filePath, snapshot);

    debugLog('PreCompact snapshot saved (session: ' + sessionId + ')');

    return { exitCode: 0 };
  },
};
