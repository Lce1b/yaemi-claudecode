'use strict';

/**
 * Shared formatting library — extracted from stop-format-typecheck.js
 *
 * Provides both single-file (post-format) and batch (stop batch) formatting.
 * All functions are non-blocking — errors are silently swallowed.
 */

const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Cache for command existence checks — only check once per command
var _commandCache = {};

/**
 * Check if a command is available on the system.
 * Uses `where` on Windows, `which` on Unix.
 */
function commandExists(cmd) {
  if (cmd in _commandCache) return _commandCache[cmd];
  try {
    var shellCmd = process.platform === 'win32' ? 'where' : 'which';
    execFileSync(shellCmd, [cmd], { stdio: 'ignore', timeout: 5000 });
    _commandCache[cmd] = true;
    return true;
  } catch (_) {
    _commandCache[cmd] = false;
    return false;
  }
}

/**
 * Try to find the project root for a given file by looking for
 * package.json (JS/TS) or pyproject.toml (Python) going upward.
 * Returns { root, type } where type is 'js' or 'py', or null.
 */
function detectProjectRoot(filePath) {
  var dir = path.dirname(path.resolve(filePath));
  var root = path.parse(dir).root;
  var depth = 0;
  while (dir !== root && depth < 20) {
    if (fs.existsSync(path.join(dir, 'package.json'))) {
      return { root: dir, type: 'js' };
    }
    if (fs.existsSync(path.join(dir, 'pyproject.toml'))) {
      return { root: dir, type: 'py' };
    }
    dir = path.dirname(dir);
    depth++;
  }
  return null;
}

// ---- Single-file formatters ----

function formatPythonSingle(projectRoot, filePath, timeoutMs) {
  if (!commandExists('ruff')) return;
  if (!fs.existsSync(filePath)) return;

  try {
    execFileSync('ruff', ['check', '--fix', filePath], {
      cwd: projectRoot,
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: timeoutMs,
      windowsHide: true,
    });
  } catch (_) { /* non-blocking */ }

  try {
    execFileSync('ruff', ['format', filePath], {
      cwd: projectRoot,
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: timeoutMs,
      windowsHide: true,
    });
  } catch (_) { /* non-blocking */ }
}

function formatJsSingle(projectRoot, filePath, timeoutMs) {
  if (!fs.existsSync(filePath)) return;

  if (commandExists('biome')) {
    try {
      execFileSync('biome', ['check', '--fix', filePath], {
        cwd: projectRoot,
        stdio: ['pipe', 'pipe', 'pipe'],
        timeout: timeoutMs,
        windowsHide: true,
      });
      return;
    } catch (_) { /* fall through to prettier */ }
  }

  if (commandExists('prettier')) {
    try {
      execFileSync('prettier', ['--write', filePath], {
        cwd: projectRoot,
        stdio: ['pipe', 'pipe', 'pipe'],
        timeout: timeoutMs,
        windowsHide: true,
      });
    } catch (_) { /* non-blocking */ }
  }
}

/**
 * Format a single file. Detects project root and dispatches to the right formatter.
 * Non-blocking — silently returns on any error.
 *
 * @param {string} filePath - Absolute or relative path to the file
 * @param {Object} opts - { timeoutMs?: number }
 */
function formatFile(filePath, opts) {
  var options = opts || {};
  var timeoutMs = options.timeoutMs || 30000;
  var resolved = path.resolve(filePath);

  if (!fs.existsSync(resolved)) return;

  var info = detectProjectRoot(resolved);
  if (!info) return;

  var ext = path.extname(resolved).toLowerCase();
  if (ext === '.py') {
    formatPythonSingle(info.root, resolved, timeoutMs);
  } else if (['.js', '.ts', '.jsx', '.tsx'].indexOf(ext) !== -1) {
    formatJsSingle(info.root, resolved, timeoutMs);
  }
}

// ---- Batch formatters (for stop-format-typecheck.js) ----

function formatPythonBatch(projectRoot, files, timeoutMs) {
  if (!commandExists('ruff')) return;

  var resolvedFiles = files.filter(function (f) { return fs.existsSync(f); });
  if (resolvedFiles.length === 0) return;

  try {
    execFileSync('ruff', ['check', '--fix'].concat(resolvedFiles), {
      cwd: projectRoot,
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: timeoutMs,
      windowsHide: true,
    });
  } catch (_) { /* non-blocking */ }

  try {
    execFileSync('ruff', ['format'].concat(resolvedFiles), {
      cwd: projectRoot,
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: timeoutMs,
      windowsHide: true,
    });
  } catch (_) { /* non-blocking */ }
}

function formatJsBatch(projectRoot, files, timeoutMs) {
  var resolvedFiles = files.filter(function (f) { return fs.existsSync(f); });
  if (resolvedFiles.length === 0) return;

  if (commandExists('biome')) {
    try {
      execFileSync('biome', ['check', '--fix'].concat(resolvedFiles), {
        cwd: projectRoot,
        stdio: ['pipe', 'pipe', 'pipe'],
        timeout: timeoutMs,
        windowsHide: true,
      });
      return;
    } catch (_) { /* fall through to prettier */ }
  }

  if (commandExists('prettier')) {
    try {
      execFileSync('prettier', ['--write'].concat(resolvedFiles), {
        cwd: projectRoot,
        stdio: ['pipe', 'pipe', 'pipe'],
        timeout: timeoutMs,
        windowsHide: true,
      });
    } catch (_) { /* non-blocking */ }
  }
}

module.exports = {
  commandExists,
  detectProjectRoot,
  formatFile,
  formatPythonSingle,
  formatJsSingle,
  formatPythonBatch,
  formatJsBatch,
};
