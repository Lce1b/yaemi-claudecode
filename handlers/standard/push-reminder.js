'use strict';

const extractCmd = require('../../lib/utils').extractCmd;

module.exports = {
  on: 'PreToolUse',
  match: function(e) { return e.tool_name === 'Bash'; },
  priority: 62,
  profile: ['standard', 'strict'],
  run: async function(event, ctx) {
    var cmd = extractCmd(event);
    if (!cmd || !/git\s+push/.test(cmd)) return { exitCode: 0 };

    var m = cmd.match(/git\s+push\s+(\S+)\s+(\S+)/);
    if (m) {
      ctx.warn('[yaemi] Pushing to ' + m[1] + '/' + m[2] + '. Verify the target is correct.');
    } else {
      ctx.warn('[yaemi] Before pushing, verify the remote and branch.');
    }

    return { exitCode: 0 };
  },
};
