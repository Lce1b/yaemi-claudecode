'use strict';

const extractCmd = require('../../lib/utils').extractCmd;

const { DEV_SERVER_PATTERNS } = require('../../lib/config');

function isDevServer(cmd) {
  return DEV_SERVER_PATTERNS.some(function(re) { return re.test(cmd); });
}

function inTmux() {
  return process.env.TMUX !== undefined && process.env.TMUX !== '';
}

module.exports = {
  on: 'PreToolUse',
  match: function(e) { return e.tool_name === 'Bash'; },
  priority: 58,
  profile: ['standard', 'strict'],
  run: async function(event, ctx) {
    var cmd = extractCmd(event);
    if (!cmd || !isDevServer(cmd) || inTmux()) return { exitCode: 0 };

    ctx.error('[Hook] BLOCKED: Dev server outside tmux. Run in tmux first so you don\'t lose log access: tmux new -s dev\n');
    return { exitCode: 2 };
  },
};
