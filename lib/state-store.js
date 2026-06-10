'use strict';

const fs = require('fs');
const path = require('path');

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function atomicWrite(filePath, data) {
  const dir = path.dirname(filePath);
  ensureDir(dir);
  const tmp = filePath + '.tmp.' + process.pid + '.' + Date.now();
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8');
  try {
    // Windows: renameSync fails if target exists; remove first
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    fs.renameSync(tmp, filePath);
  } catch (e) {
    // Fallback: copy content and delete tmp (handles locked dest)
    try {
      fs.writeFileSync(filePath, fs.readFileSync(tmp));
    } finally {
      try { fs.unlinkSync(tmp); } catch (_) { /* best-effort cleanup */ }
    }
  }
}

function readJSON(filePath, fallback) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (_) {
    return fallback !== undefined ? fallback : null;
  }
}

function cleanupOldFiles(dir, maxAgeMs) {
  ensureDir(dir);
  const now = Date.now();
  let files;
  try { files = fs.readdirSync(dir); } catch (_) { return; }
  for (const f of files) {
    const fp = path.join(dir, f);
    try {
      const stat = fs.statSync(fp);
      if (now - stat.mtimeMs > maxAgeMs) fs.unlinkSync(fp);
    } catch (_) { /* skip locked files */ }
  }
}

module.exports = { ensureDir, atomicWrite, readJSON, cleanupOldFiles };
