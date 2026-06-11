'use strict';

/**
 * Auto-Review — LLM-powered code review triggered after large edits.
 *
 * Three tiers:
 *   None:     no YAEMI_REVIEW_API_KEY — reminder only
 *   Basic:    key set, no codegraph — git diff + full files + LLM
 *   Full:     key set + codegraph CLI — + callers/callees/impact
 *
 * Async, non-blocking. Results go to stderr.
 */

const { execFileSync } = require('child_process');
const https = require('https');
const fs = require('fs');
const path = require('path');

const DEFAULT_MODEL = 'deepseek-v4-flash';
const DEFAULT_MAX_TOKENS = 1024;
const DEFAULT_TIMEOUT = 30000;
const MAX_DIFF_CHARS = 8000;
const MAX_FILE_CHARS = 4000;

// ---- Git ----

function getGitDiff() {
  try {
    const staged = execFileSync('git', ['diff', '--staged'], {
      encoding: 'utf8', timeout: 10000, windowsHide: true,
    });
    const unstaged = execFileSync('git', ['diff'], {
      encoding: 'utf8', timeout: 10000, windowsHide: true,
    });
    let result = (staged + unstaged).trim();
    if (result.length > MAX_DIFF_CHARS) result = result.substring(0, MAX_DIFF_CHARS) + '\n... (truncated)';
    return result;
  } catch (_) { return ''; }
}

function getChangedFilesFromDiff(diff) {
  if (!diff) return [];
  const re = /^diff --git a\/(.+) b\/(.+)$/gm;
  const files = new Set();
  let m;
  while ((m = re.exec(diff)) !== null) {
    files.add(m[1]);
    files.add(m[2]);
  }
  return [...files].filter(function (f) {
    try {
      const fullPath = path.resolve(f);
      const stat = fs.statSync(fullPath);
      return stat.isFile() && stat.size < 500 * 1024;
    } catch (_) { return false; }
  });
}

function readFileSafe(filePath) {
  try {
    const fullPath = path.resolve(filePath);
    if (!fs.existsSync(fullPath)) return null;
    let content = fs.readFileSync(fullPath, 'utf8');
    if (content.length > MAX_FILE_CHARS) content = content.substring(0, MAX_FILE_CHARS) + '\n... (truncated)';
    return { path: filePath, content: content };
  } catch (_) { return null; }
}

// ---- CodeGraph ----

function codegraphAvailable() {
  try {
    execFileSync('codegraph', ['status'], { stdio: 'ignore', timeout: 5000, windowsHide: true });
    return true;
  } catch (_) { return false; }
}

function getCodeGraphContext(filePath) {
  try {
    const abs = path.resolve(filePath);
    const base = path.basename(abs);
    let query = execFileSync('codegraph', ['query', base], {
      encoding: 'utf8', timeout: 5000, windowsHide: true,
    }).trim();
    if (query && query.length > 1500) query = query.substring(0, 1500) + '\n... (truncated)';
    return query || '';
  } catch (_) { return ''; }
}

// ---- LLM ----

function getLLMConfig() {
  return {
    key: process.env.YAEMI_REVIEW_API_KEY || '',
    url: process.env.YAEMI_REVIEW_API_URL || 'https://api.deepseek.com/anthropic/v1/messages',
    model: process.env.YAEMI_REVIEW_MODEL || DEFAULT_MODEL,
    maxTokens: parseInt(process.env.YAEMI_REVIEW_MAX_TOKENS || String(DEFAULT_MAX_TOKENS), 10),
  };
}

function callLLM(systemPrompt, userPrompt) {
  return new Promise(function (resolve) {
    const config = getLLMConfig();
    if (!config.key) { resolve(null); return; }

    const body = JSON.stringify({
      model: config.model,
      max_tokens: config.maxTokens,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    });

    const url = new URL(config.url);
    if (url.protocol !== 'https:') {
      console.warn('[AutoReview] WARNING: YAEMI_REVIEW_API_URL uses plain HTTP — skipping to avoid sending API key in the clear');
      resolve(null);
      return;
    }

    const req = https.request({
      hostname: url.hostname,
      port: url.port || 443,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': config.key,
        'anthropic-version': '2023-06-01',
        'Content-Length': Buffer.byteLength(body),
      },
      timeout: DEFAULT_TIMEOUT,
    }, function (res) {
      let data = '';
      res.on('data', function (chunk) { data += chunk; });
      res.on('end', function () {
        try {
          const json = JSON.parse(data);
          const content = json.content || [];
          const textBlock = content.find(function (b) { return b.type === 'text'; });
          resolve(textBlock ? textBlock.text : null);
        } catch (_) { resolve(null); }
      });
    });

    req.on('error', function () { resolve(null); });
    req.on('timeout', function () { req.destroy(); resolve(null); });
    req.write(body);
    req.end();
  });
}

// ---- Prompt ----

const SYSTEM_PROMPT = [
  'You are a code reviewer. Review the following code changes for bugs, security issues, and quality problems.',
  'Be concise. Flag only real issues, not style preferences.',
  'Output format:',
  '  [CRITICAL] — security vulns, data loss, crash risks',
  '  [HIGH] — bugs, wrong behavior',
  '  [MEDIUM] — confusing code, missing edge cases',
  '  If no issues found, reply: "No issues found."',
  'Do NOT suggest adding comments, docs, or tests — focus on correctness and safety only.',
].join('\n');

function buildDiffContext(diff, changedFiles, hasCodeGraph) {
  const parts = [];

  if (diff) parts.push('## Git Diff\n```diff\n' + diff + '\n```');

  if (changedFiles.length > 0) {
    const fileContents = [];
    for (let i = 0; i < changedFiles.length; i++) {
      const f = readFileSafe(changedFiles[i]);
      if (f) fileContents.push('### ' + f.path + '\n```\n' + f.content + '\n```');
    }
    if (fileContents.length > 0) parts.push('## Full Files (for cross-reference)\n' + fileContents.join('\n\n'));
  }

  if (hasCodeGraph && changedFiles.length > 0) {
    const cgParts = [];
    const limit = Math.min(changedFiles.length, 3);
    for (let j = 0; j < limit; j++) {
      const cg = getCodeGraphContext(changedFiles[j]);
      if (cg) cgParts.push('### CodeGraph: ' + changedFiles[j] + '\n' + cg);
    }
    if (cgParts.length > 0) parts.push('## CodeGraph Context\n' + cgParts.join('\n\n'));
  }

  if (!diff && changedFiles.length === 0) return null;
  return parts.join('\n\n');
}

// ---- Main ----

function log(ctx, msg) {
  if (ctx && typeof ctx.log === 'function') ctx.log(msg);
}

async function runReview(ctx) {
  const config = getLLMConfig();
  if (!config.key) {
    log(ctx, '[AutoReview] YAEMI_REVIEW_API_KEY not set — skip');
    return null;
  }

  const diff = getGitDiff();
  const changedFiles = getChangedFilesFromDiff(diff);
  const hasCodeGraph = codegraphAvailable();

  log(ctx, '[AutoReview] ' + changedFiles.length + ' changed files, codegraph=' + hasCodeGraph);

  const contextText = buildDiffContext(diff, changedFiles, hasCodeGraph);
  if (!contextText) {
    log(ctx, '[AutoReview] No diff or files to review');
    return null;
  }

  let userPrompt = contextText;
  if (!hasCodeGraph) {
    userPrompt += '\n\n(Note: codegraph not available. Cross-file analysis limited. Run /code-review for full AST-level review.)';
  } else {
    userPrompt += '\n\n(Note: codegraph CLI provides symbol-level context. For callers/callees/impact analysis, use /code-review which leverages the MCP server.)';
  }

  const result = await callLLM(SYSTEM_PROMPT, userPrompt);
  log(ctx, '[AutoReview] done, ' + (result ? result.length : 0) + ' chars');
  return result;
}

module.exports = { runReview, getGitDiff, getChangedFilesFromDiff, codegraphAvailable, getLLMConfig };
