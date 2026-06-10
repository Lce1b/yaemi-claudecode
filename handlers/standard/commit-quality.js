'use strict';

const extractCmd = require('../../lib/utils').extractCmd;

const MIN_SUBJECT = 3;
const MAX_SUBJECT = 72;

const VALID_TYPES = new Set([
  'feat', 'fix', 'refactor', 'docs', 'test', 'chore', 'perf', 'ci',
  'style', 'build', 'revert',
]);

function extractCommitMessage(cmd) {
  var m = cmd.match(/-m\s+"([^"]*)"/) || cmd.match(/-m\s+'([^']*)'/);
  return m ? m[1] : null;
}

module.exports = {
  on: 'PreToolUse',
  match: function(e) { return e.tool_name === 'Bash'; },
  priority: 60,
  profile: ['strict'],
  run: async function(event, ctx) {
    var cmd = extractCmd(event);
    if (!cmd || !cmd.includes('git commit') || !cmd.includes('-m')) {
      return { exitCode: 0 };
    }

    var msg = extractCommitMessage(cmd);
    if (!msg) return { exitCode: 0 };

    var warnings = [];

    var colonIdx = msg.indexOf(':');
    if (colonIdx > 0) {
      var type = msg.substring(0, colonIdx);
      if (!VALID_TYPES.has(type)) {
        warnings.push('Type "' + type + '" is not a conventional commit type. Valid: ' + [...VALID_TYPES].join(', '));
      }
    } else {
      warnings.push('Missing conventional commit format (type: description)');
    }

    var subject = colonIdx > 0 ? msg.substring(colonIdx + 1).trim() : msg;
    if (subject.length < MIN_SUBJECT) {
      warnings.push('Description too short (' + subject.length + '/' + MIN_SUBJECT + ' chars)');
    }
    if (subject.length > MAX_SUBJECT) {
      warnings.push('Description too long (' + subject.length + ' chars, keep <' + MAX_SUBJECT + ')');
    }

    if (warnings.length > 0) {
      ctx.warn('[yaemi] Commit message suggestions:\n' + warnings.map(function(w) { return '  - ' + w; }).join('\n'));
    }

    return { exitCode: 0 };
  },
};
