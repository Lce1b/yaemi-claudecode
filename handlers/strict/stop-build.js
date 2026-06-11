'use strict';

const fs = require('fs'), path = require('path'), { execFileSync } = require('child_process');
const { isHookEnabled } = require('../../lib/profile');
const BUILD_TIMEOUT_MS = 120000;

const MAX_UPWARD_DEPTH = 20;

function detectBuildConfig(cwd) {
  let dir = cwd || process.cwd();
  const root = path.parse(dir).root;
  let depth = 0;

  while (dir !== root && depth < MAX_UPWARD_DEPTH) {
    if (fs.existsSync(path.join(dir, 'Cargo.toml'))) {
      return { type: 'rust', root: dir, buildCmd: 'cargo', buildArgs: ['check'] };
    }
    if (fs.existsSync(path.join(dir, 'package.json'))) {
      if (fs.existsSync(path.join(dir, 'pnpm-lock.yaml'))) {
        return { type: 'node', root: dir, buildCmd: 'pnpm', buildArgs: ['build'] };
      }
      if (fs.existsSync(path.join(dir, 'yarn.lock'))) {
        return { type: 'node', root: dir, buildCmd: 'yarn', buildArgs: ['build'] };
      }
      return { type: 'node', root: dir, buildCmd: 'npm', buildArgs: ['run', 'build'] };
    }
    if (fs.existsSync(path.join(dir, 'pyproject.toml'))) {
      return { type: 'python', root: dir, buildCmd: null, buildArgs: null };
    }
    dir = path.dirname(dir);
    depth++;
  }
  return null;
}

module.exports = {
  on: 'Stop', match: () => true, priority: 400, profile: ['strict'],
  async run(event, ctx) {
    if (!isHookEnabled('stop-build', 'strict')) return { exitCode: 0 };
    const cwd = event.cwd || process.cwd();
    const bc = detectBuildConfig(cwd);
    if (!bc || !bc.buildCmd) return { exitCode: 0 };
    try {
      execFileSync(bc.buildCmd, bc.buildArgs, {
        cwd: bc.root, stdio: ['pipe', 'pipe', 'pipe'],
        timeout: BUILD_TIMEOUT_MS, windowsHide: true,
      });
      return { exitCode: 0 };
    } catch (e) {
      const stderr = e.stderr ? String(e.stderr).slice(0, 800) : (e.message || 'unknown');
      ctx.sink.fire('/api/hook/build-failure', { type: bc.type, root: bc.root, error: stderr });
      const lines = stderr.split('\n').filter(Boolean);
      ctx.warn('[StopBuild] ' + bc.type + ' build FAILED in ' + bc.root + '\n' + lines.slice(0, 3).join('\n'));
      return { exitCode: 0 };
    }
  },
};
