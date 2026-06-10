'use strict';

const extractCmd = require('../../lib/utils').extractCmd;

module.exports = {
  on: 'PreToolUse',
  match: function(e) { return e.tool_name === 'Bash'; },
  priority: 52,
  profile: ['minimal', 'standard', 'strict'],
  run: async function(event, ctx) {
    var cmd = extractCmd(event);
    if (!cmd) return { exitCode: 0 };

    if (/--no-verify/.test(cmd) || /--no-gpg-sign/.test(cmd)) {
      ctx.error('[yaemi] BLOCKED: --no-verify / --no-gpg-sign not allowed. Let hooks run to ensure quality checks pass.');
      return { exitCode: 2 };
    }

    return { exitCode: 0 };
  },
};
