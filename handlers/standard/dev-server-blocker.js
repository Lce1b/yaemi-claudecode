'use strict';

const extractCmd = require('../../lib/utils').extractCmd;

const DEV_SERVERS = [
  /^npm\s+run\s+dev/,
  /^npm\s+start/,
  /^cargo\s+run/,
  /^pnpm\s+dev/,
  /^yarn\s+dev/,
  /^npx\s+vite/,
  /^next\s+dev/,
  /^python\s+-m\s+http\.server/,
  /^python\s+-m\s+uvicorn/,
  /^flask\s+run/,
];

function isDevServer(cmd) {
  return DEV_SERVERS.some(function(re) { return re.test(cmd); });
}

function inTmux() {
  return process.env.TMUX !== undefined && process.env.TMUX !== '';
}

module.exports = {
  on: 'PreToolUse',
  match: function(e) { return e.tool_name === 'Bash'; },
  priority: 58,
  profile: ['strict'],
  run: async function(event, ctx) {
    var cmd = extractCmd(event);
    if (!cmd || !isDevServer(cmd) || inTmux()) return { exitCode: 0 };

    ctx.error('[Hook] BLOCKED: Dev server outside tmux. Run in tmux first so you don\'t lose log access: tmux new -s dev\n');
    return { exitCode: 2 };
  },
};
