'use strict';

const { extractCmd, inTmux } = require('../../lib/utils');
const { DEV_SERVER_PATTERNS } = require('../../lib/config');

function isDevServer(cmd) {
  return DEV_SERVER_PATTERNS.some(function(re) { return re.test(cmd); });
}

module.exports = {
  on: 'PreToolUse',
  match: function(e) { return e.tool_name === 'Bash'; },
  priority: 58,
  profile: ['standard', 'strict'],
  run: async function(event, ctx) {
    const cmd = extractCmd(event);
    if (!cmd || !isDevServer(cmd) || inTmux()) return { exitCode: 0 };

    ctx.error('[Hook] BLOCKED: Dev server outside tmux. Run in tmux first so you don\'t lose log access: tmux new -s dev\n');
    return { exitCode: 2 };
  },
};
