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

const { execFileSync, execSync } = require('child_process');
const https = require('https');
const http = require('http');
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
    var result = (staged + unstaged).trim();
    if (result.length > MAX_DIFF_CHARS) result = result.substring(0, MAX_DIFF_CHARS) + '\n... (truncated)';
    return result;
  } catch (_) { return ''; }
}

function getChangedFilesFromDiff(diff) {
  if (!diff) return [];
  var re = /^diff --git a\/(.+) b\/(.+)$/gm;
  var files = new Set();
  var m;
  while ((m = re.exec(diff)) !== null) {
    files.add(m[1]);
    files.add(m[2]);
  }
  return [...files].filter(function (f) {
    try {
      var fullPath = path.resolve(f);
      var stat = fs.statSync(fullPath);
      return stat.isFile() && stat.size < 500 * 1024;
    } catch (_) { return false; }
  });
}

function readFileSafe(filePath) {
  try {
    var fullPath = path.resolve(filePath);
    if (!fs.existsSync(fullPath)) return null;
    var content = fs.readFileSync(fullPath, 'utf8');
    if (content.length > MAX_FILE_CHARS) content = content.substring(0, MAX_FILE_CHARS) + '\n... (truncated)';
    return { path: filePath, content: content };
  } catch (_) { return null; }
}

// ---- CodeGraph ----

function codegraphAvailable() {
  try {
    execSync('codegraph status', { stdio: 'ignore', timeout: 5000, windowsHide: true });
    return true;
  } catch (_) { return false; }
}

function getCodeGraphContext(filePath) {
  try {
    var abs = path.resolve(filePath);
    var base = path.basename(abs);
    var query = execSync('codegraph query ' + JSON.stringify(base), {
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
    var config = getLLMConfig();
    if (!config.key) { resolve(null); return; }

    var body = JSON.stringify({
      model: config.model,
      max_tokens: config.maxTokens,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    });

    var url = new URL(config.url);
    var transport = url.protocol === 'https:' ? https : http;

    var req = transport.request({
      hostname: url.hostname,
      port: url.port,
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
      var data = '';
      res.on('data', function (chunk) { data += chunk; });
      res.on('end', function () {
        try {
          var json = JSON.parse(data);
          var content = json.content || [];
          var textBlock = content.find(function (b) { return b.type === 'text'; });
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

var SYSTEM_PROMPT = [
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
  var parts = [];

  if (diff) parts.push('## Git Diff\n```diff\n' + diff + '\n```');

  if (changedFiles.length > 0) {
    var fileContents = [];
    for (var i = 0; i < changedFiles.length; i++) {
      var f = readFileSafe(changedFiles[i]);
      if (f) fileContents.push('### ' + f.path + '\n```\n' + f.content + '\n```');
    }
    if (fileContents.length > 0) parts.push('## Full Files (for cross-reference)\n' + fileContents.join('\n\n'));
  }

  if (hasCodeGraph && changedFiles.length > 0) {
    var cgParts = [];
    var limit = Math.min(changedFiles.length, 3);
    for (var j = 0; j < limit; j++) {
      var cg = getCodeGraphContext(changedFiles[j]);
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
  var config = getLLMConfig();
  if (!config.key) {
    log(ctx, '[AutoReview] YAEMI_REVIEW_API_KEY not set — skip');
    return null;
  }

  var diff = getGitDiff();
  var changedFiles = getChangedFilesFromDiff(diff);
  var hasCodeGraph = codegraphAvailable();

  log(ctx, '[AutoReview] ' + changedFiles.length + ' changed files, codegraph=' + hasCodeGraph);

  var contextText = buildDiffContext(diff, changedFiles, hasCodeGraph);
  if (!contextText) {
    log(ctx, '[AutoReview] No diff or files to review');
    return null;
  }

  var userPrompt = contextText;
  if (!hasCodeGraph) {
    userPrompt += '\n\n(Note: codegraph not available. Cross-file analysis limited. Run /code-review for full AST-level review.)';
  } else {
    userPrompt += '\n\n(Note: codegraph CLI provides symbol-level context. For callers/callees/impact analysis, use /code-review which leverages the MCP server.)';
  }

  var result = await callLLM(SYSTEM_PROMPT, userPrompt);
  log(ctx, '[AutoReview] done, ' + (result ? result.length : 0) + ' chars');
  return result;
}

module.exports = { runReview, getGitDiff, getChangedFilesFromDiff, codegraphAvailable, getLLMConfig };
