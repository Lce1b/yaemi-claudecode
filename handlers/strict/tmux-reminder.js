'use strict';

const { extractCmd, inTmux } = require('../../lib/utils');
const { DEV_SERVER_PATTERNS } = require('../../lib/config');

function isLongRunning(cmd) {
  return DEV_SERVER_PATTERNS.some(function(re) { return re.test(cmd); });
}

module.exports = {
  on: 'PreToolUse',
  match: function(e) { return e.tool_name === 'Bash'; },
  priority: 56,
  profile: ['standard', 'strict'],
  run: async function(event, ctx) {
    const cmd = extractCmd(event);
    if (!cmd || !isLongRunning(cmd) || inTmux()) return { exitCode: 0 };

    ctx.warn('[Hook] Long-running command detected outside tmux. If this blocks, you\'ll lose log access. Consider running in tmux.\n');
    return { exitCode: 0 };
  },
};
