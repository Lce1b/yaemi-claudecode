'use strict';

const extractCmd = require('../../lib/utils').extractCmd;

const DESTRUCTIVE = [
  { pattern: /rm\s+-r[fd]?\s/,        msg: 'rm -rf is irreversible' },
  { pattern: /git\s+reset\s+--hard/,   msg: 'git reset --hard discards all uncommitted changes' },
  { pattern: /git\s+push\s+--force/,   msg: 'git push --force may overwrite remote history' },
  { pattern: /git\s+clean\s+-[fdx]+/,  msg: 'git clean permanently deletes untracked files' },
  { pattern: /del\s+\/f\s+\/s/,        msg: 'del /f /s recursive force delete' },
  { pattern: /rmdir\s+\/s\s+\/q/,      msg: 'rmdir /s /q recursive silent delete' },
];

module.exports = {
  on: 'PreToolUse',
  match: function(e) { return e.tool_name === 'Bash'; },
  priority: 54,
  profile: ['standard', 'strict'],
  run: async function(event, ctx) {
    var cmd = extractCmd(JSON.stringify(event));
    if (!cmd) return { exitCode: 0 };

    for (var i = 0; i < DESTRUCTIVE.length; i++) {
      if (DESTRUCTIVE[i].pattern.test(cmd)) {
        ctx.error('[yaemi] BLOCKED: ' + DESTRUCTIVE[i].msg + '. Use --dangerously-allow-destructive to override.');
        return { exitCode: 2 };
      }
    }

    return { exitCode: 0 };
  },
};
