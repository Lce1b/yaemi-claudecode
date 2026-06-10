'use strict';

const { extractCmd } = require('../../lib/utils');

const READONLY_CMD = /^(git\s+(status|diff|log|show|branch|stash\s+list|remote|ls-remote|rev-parse)|ls|dir|cat|head|tail|echo|pwd|whoami|date|which|where|type|find|rg|grep|wc|sort|uniq|node\s+-v|npm\s+-v|yarn\s+-v|pnpm\s+-v|python\s+--version|rustc\s+--version|cargo\s+--version|cargo\s+check|cargo\s+fmt\s+--check|cargo\s+clippy|gh\s+pr\s+view|gh\s+pr\s+list|gh\s+issue|netstat|tasklist)/i;

// bash-guard serves as a gate: it detects readonly commands and allows them
// without triggering the blocking/safety handlers at higher priority levels.
// Non-readonly commands pass through — the individual bash/ sub-handlers
// (block-no-verify, block-destructive, tmux-reminder, etc.) match and enforce
// their own rules independently.
module.exports = {
  on: 'PreToolUse',
  match: function(e) { return e.tool_name === 'Bash'; },
  priority: 50,
  profile: ['minimal', 'standard', 'strict'],
  run: async function(event, ctx) {
    var cmd = extractCmd(JSON.stringify(event));
    if (cmd && READONLY_CMD.test(cmd)) {
      return { exitCode: 0 };
    }
    // Non-readonly: passthrough — individual bash/ handlers enforce rules
    return { exitCode: 0 };
  },
};
