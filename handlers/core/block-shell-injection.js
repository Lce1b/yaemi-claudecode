'use strict';

const extractCmd = require('../../lib/utils').extractCmd;

var INJECTION_PATTERNS = [
  // ---- pipe-to-shell ----
  {
    re: /curl\s+.*\|\s*(?:sh|bash|dash|zsh|fish|ksh)(?:\s|$)/i,
    label: 'curl-pipe-shell — downloading and piping to shell is a supply-chain risk'
  },
  {
    re: /wget\s+.*\|\s*(?:sh|bash|dash|zsh|fish)(?:\s|$)/i,
    label: 'wget-pipe-shell — downloading and piping to shell is a supply-chain risk'
  },
  {
    re: /wget\s+.*-O\s*-\s*\|/i,
    label: 'wget-stdout-pipe — downloading to stdout and piping is unsafe'
  },
  // ---- process substitution exec ----
  {
    re: /(?:sh|bash|dash|zsh)\s+<\(\s*curl\s+/i,
    label: 'process-substitution-curl — executing remote script via <()'
  },
  {
    re: /(?:sh|bash|dash|zsh)\s+<\(\s*wget\s+/i,
    label: 'process-substitution-wget — executing remote script via <()'
  },
  // ---- base64 decode + exec ----
  {
    re: /base64\s+(?:-d|--decode).*\|\s*(?:sh|bash|dash|zsh)/i,
    label: 'base64-decode-pipe-shell — obfuscated command execution'
  },
  {
    re: /base64\s+(?:-d|--decode)\s*<<<\s*.*\|\s*(?:sh|bash)/i,
    label: 'base64-decode-heredoc-shell — obfuscated command via here-string'
  },
  // ---- reverse shells ----
  {
    re: /(?:nc|netcat|ncat)\s+.*-e\s+\/(?:bin|usr\/bin)\/(?:sh|bash|dash|zsh)/i,
    label: 'reverse-shell-nc — netcat with -e flag is a reverse shell'
  },
  {
    re: /bash\s+.*>\s*\&\s*\/dev\/tcp\//,
    label: 'reverse-shell-bash-tcp — /dev/tcp/ redirect is a reverse shell'
  },
  {
    re: /python[23]?\s+-c\s+['"]import (?:socket|os|subprocess|pty)/i,
    label: 'reverse-shell-python — Python one-liner with socket/os/subprocess'
  },
  {
    re: /perl\s+-e\s+['"].*socket.*\/bin\/sh/i,
    label: 'reverse-shell-perl — Perl reverse shell'
  },
  {
    re: /ruby\s+-e\s+['"].*TCPSocket/i,
    label: 'reverse-shell-ruby — Ruby TCPSocket reverse shell'
  },
  {
    re: /php\s+-r\s+['"].*fsockopen/i,
    label: 'reverse-shell-php — PHP fsockopen reverse shell'
  },
  // ---- privilege escalation ----
  {
    re: /chmod\s+(?:-R\s+)?777\s+(?:\/|\/etc|\/usr|\/var|\/bin|\/sbin|\/opt|\/home\/)/,
    label: 'chmod-777-system — setting world-writable on system directories is dangerous'
  },
  {
    re: /chmod\s+(?:-R\s+)?(?:u\+s|g\+s|o\+s)\s+/i,
    label: 'chmod-setuid — setting setuid/setgid bits is suspicious'
  },
  {
    re: /sudo\s+su\b/,
    label: 'sudo-su — privilege escalation to root shell'
  },
  // ---- env / credential exfiltration ----
  {
    re: /\b(?:env|printenv|set)\s*>\s*(?:\/dev\/tcp\/|\/tmp\/|\/var\/tmp\/)/,
    label: 'env-dump-to-network — exfiltrating environment variables'
  },
  {
    re: /curl\s+.*-F\s+.*[Ff]ile[= ]@\s*(?:\.env|\.aws\/|\.ssh\/|\.git)/,
    label: 'curl-exfil — uploading sensitive files via multipart form'
  },
  {
    re: /curl\s+.*--data\s+.*[$][(](?:cat\s+)?(?:\.env|\.aws|\/etc\/passwd|\/etc\/shadow)/i,
    label: 'curl-exfil-data — sending file contents in POST body'
  },
  // ---- sensitive file access (read attempts) ----
  {
    re: /cat\s+(?:~\/\.ssh\/|~\/\.aws\/|~\/\.config\/|~\/\.claude\/credentials|~\/\.npmrc|~\/\.gitconfig)/,
    label: 'sensitive-file-read — accessing credential/config files'
  },
];

module.exports = {
  on: 'PreToolUse',
  match: function(e) { return e.tool_name === 'Bash'; },
  priority: 46,
  profile: ['minimal', 'standard', 'strict'],

  async run(event, ctx) {
    var cmd = extractCmd(event);
    if (!cmd) return { exitCode: 0 };

    // git commit messages may contain regex-like text; skip injection scan
    if (/^git\s+commit\b/.test(cmd)) return { exitCode: 0 };

    for (var i = 0; i < INJECTION_PATTERNS.length; i++) {
      if (INJECTION_PATTERNS[i].re.test(cmd)) {
        ctx.error('[yaemi] BLOCKED: Shell injection detected — ' + INJECTION_PATTERNS[i].label);
        return { exitCode: 2 };
      }
    }

    return { exitCode: 0 };
  },

  INJECTION_PATTERNS: INJECTION_PATTERNS,
};
