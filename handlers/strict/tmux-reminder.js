'use strict';

const extractCmd = require('../../lib/utils').extractCmd;

const LONG_RUNNING = [
  /^npm\s+run\s+dev/,
  /^npm\s+start/,
  /^cargo\s+run/,
  /^cargo\s+watch/,
  /^pnpm\s+dev/,
  /^yarn\s+dev/,
  /^python\s+-m\s+http\.server/,
  /^npx\s+vite/,
  /^next\s+dev/,
];

function isLongRunning(cmd) {
  return LONG_RUNNING.some(function(re) { return re.test(cmd); });
}

function inTmux() {
  return process.env.TMUX !== undefined && process.env.TMUX !== '';
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
