'use strict';

/**
 * Handler Registry — scans handlers/ directory, validates exports,
 * sorts by priority, and filters by active profile.
 *
 * Supports TWO handler formats:
 *
 * === New contract (preferred) ===
 *   { on, match, priority, profile, async?, timeout?, run }
 *
 * === Legacy contract (backward-compatible) ===
 *   { run } — auto-wrapped with inferred metadata
 */

const fs = require('fs');
const path = require('path');
const { getHookProfile, getDisabledHookIds } = require('./profile');
const { validateHandlerPath } = require('./sandbox');

const VALID_EVENTS = new Set([
  'PreToolUse', 'PostToolUse', 'PostToolUseFailure',
  'Notification', 'Stop', 'SessionStart', 'UserPromptSubmit',
  'PreCompact',
]);

const NAME_TO_EVENT = {
  'post-tool-use-failure': 'PostToolUseFailure',
  'notification':          'Notification',
  'session-start':         'SessionStart',
};

function normalizeId(name) {
  return String(name || '').trim().toLowerCase().replace(/[^a-z0-9_-]/g, '-');
}

function isNewContract(mod) {
  return mod && typeof mod === 'object'
    && typeof mod.on === 'string'
    && VALID_EVENTS.has(mod.on)
    && typeof mod.match === 'function'
    && typeof mod.run === 'function';
}

function isLegacyContract(mod) {
  return mod && typeof mod === 'object'
    && typeof mod.run === 'function'
    && typeof mod.on !== 'string';
}

function inferEventName(filePath) {
  const key = path.basename(filePath, '.js');
  if (NAME_TO_EVENT[key]) return NAME_TO_EVENT[key];
  const dirName = path.basename(path.dirname(filePath));
  if (NAME_TO_EVENT[dirName]) return NAME_TO_EVENT[dirName];
  return null;
}

function wrapLegacyHandler(mod, filePath) {
  const name = path.basename(filePath, '.js');
  const eventName = inferEventName(filePath);
  return {
    on: eventName || 'PreToolUse',
    match: () => true,
    priority: 500,
    profile: ['standard', 'strict'],
    _legacy: true,
    run: async (event, ctx) => {
      const rawInput = JSON.stringify(event);
      let result;
      try {
        result = await mod.run(rawInput);
      } catch (e) {
        ctx.log('legacy handler ' + name + ' error: ' + (e.message || e));
        return { exitCode: 0 };
      }
      if (result && typeof result === 'object' && !Array.isArray(result)) {
        if (result.stderr) ctx.warn(result.stderr);
        return { exitCode: Number.isInteger(result.exitCode) ? result.exitCode : 0 };
      }
      return { exitCode: 0 };
    },
  };
}

function scanHandlers(handlersDir, pluginRoot) {
  const handlers = [];
  const root = pluginRoot || handlersDir;

  function walk(dir) {
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); }
    catch (_) { return; }

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (entry.name.endsWith('.js') && entry.name !== 'index.js') {
        try {
          const resolvedPath = path.resolve(fullPath);
          if (pluginRoot) validateHandlerPath(resolvedPath, root);

          const mod = require(resolvedPath);

          let handler;
          if (isNewContract(mod)) {
            handler = {
              id: normalizeId(path.relative(handlersDir, fullPath).replace(/\.js$/, '').replace(/[/\\]/g, ':')),
              file: fullPath,
              name: path.basename(fullPath, '.js'),
              on: mod.on,
              match: mod.match,
              priority: typeof mod.priority === 'number' ? mod.priority : 500,
              profile: mod.profile || ['standard', 'strict'],
              async: mod.async === true,
              timeout: typeof mod.timeout === 'number' ? mod.timeout : null,
              run: mod.run,
            };
          } else if (isLegacyContract(mod)) {
            const eventName = inferEventName(fullPath);
            if (eventName) {
              handler = wrapLegacyHandler(mod, fullPath);
              handler.id = normalizeId(path.relative(handlersDir, fullPath).replace(/\.js$/, '').replace(/[/\\]/g, ':'));
              handler.file = fullPath;
              handler.name = path.basename(fullPath, '.js');
            }
          }

          if (handler) handlers.push(handler);
        } catch (e) {
          process.stderr.write('[yaemi-registry] Failed to load ' + fullPath + ': ' + e.message + '\n');
        }
      }
    }
  }

  walk(handlersDir);
  return handlers;
}

function filterByProfile(handlers) {
  const activeProfile = getHookProfile();
  const disabledIds = getDisabledHookIds();

  return handlers.filter(h => {
    if (disabledIds.has(h.id)) return false;
    const profiles = Array.isArray(h.profile) ? h.profile
      : typeof h.profile === 'string' ? h.profile.split(',').map(s => s.trim())
      : ['standard', 'strict'];
    return profiles.includes(activeProfile);
  });
}

function sortByPriority(handlers) {
  return [...handlers].sort((a, b) => a.priority - b.priority);
}

function forEvent(handlers, eventName) {
  return sortByPriority(filterByProfile(handlers)).filter(h => h.on === eventName);
}

module.exports = {
  scanHandlers, isNewContract, isLegacyContract,
  wrapLegacyHandler, inferEventName,
  filterByProfile, sortByPriority, forEvent,
  VALID_EVENTS, normalizeId,
};
