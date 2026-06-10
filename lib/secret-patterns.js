'use strict';

const PATTERNS = [
  // API keys
  { name: 'openai-key',   re: /sk-[a-zA-Z0-9_-]{20,}/ },
  { name: 'xai-key',      re: /xai-[a-zA-Z0-9_-]{20,}/ },
  { name: 'google-key',   re: /AIza[0-9A-Za-z_-]{35}/ },
  { name: 'github-pat',   re: /ghp_[0-9a-zA-Z]{36}/ },
  { name: 'github-oauth', re: /gho_[0-9a-zA-Z]{36}/ },
  { name: 'github-server',re: /ghs_[0-9a-zA-Z]{36}/ },
  { name: 'gitlab-token', re: /glpat-[a-zA-Z0-9_-]{20,}/ },
  { name: 'aws-key',      re: /AKIA[0-9A-Z]{16}/ },
  { name: 'slack-webhook',re: /https:\/\/hooks\.slack\.com\/services\/[A-Za-z0-9\/]+/ },
  { name: 'npm-token',    re: /_authToken\s*=\s*['"]?npm_[A-Za-z0-9]+/ },
  // Private keys
  { name: 'private-key',  re: /-----BEGIN (RSA |EC |DSA |OPENSSH |)?PRIVATE KEY-----/ },
  // Tokens
  { name: 'jwt',          re: /eyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}/ },
  // Hardcoded credentials (quote-optional — catches both `KEY = "val"` and `KEY = val`)
  { name: 'password',     re: /(?:password|passwd|pwd|secret)\s*[=:]\s*(?!(?:process\.env|getEnv\(|config\.|import\.meta\.env\.))['"]?\S{1,80}/i },
  { name: 'api-key-var',  re: /(?:api[_-]?key|apikey|api[_-]?secret)\s*[=:]\s*(?!(?:process\.env|getEnv\(|config\.|import\.meta\.env\.))['"]?\S{1,80}/i },
  { name: 'access-token', re: /(?:access[_-]?token|auth[_-]?token|token)\s*[=:]\s*(?!(?:process\.env|getEnv\(|config\.|import\.meta\.env\.))['"]?\S{1,80}/i },
];

function scan(text) {
  if (!text || typeof text !== 'string') return [];
  const found = [];
  for (const p of PATTERNS) {
    const m = p.re.exec(text);
    if (m) found.push({ name: p.name, preview: m[0].substring(0, 40) + '...' });
  }
  return found;
}

module.exports = { PATTERNS, scan };
