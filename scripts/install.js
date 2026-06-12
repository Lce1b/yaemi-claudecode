#!/usr/bin/env node
'use strict';

require('../lib/splash').show();

/**
 * yhk install — one-command setup for yaemi-claudecode hooks.
 *
 * Usage:
 *   yhk install              install to ~/.claude/settings.json
 *   yhk install --local      install to ./.claude/settings.json (project)
 *   yhk install --dry-run    show what would be written
 *   yhk uninstall            remove yaemi hooks from settings
 *   yhk status               show current hook status
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

const BRIDGE_CMD = 'node "' + path.join(__dirname, '..', 'bin', 'bridge.js') + '"';

const HOOK_EVENTS = [
  'PreToolUse',
  'PostToolUse',
  'PostToolUseFailure',
  'Stop',
  'SessionStart',
  'PreCompact',
  'Notification',
];

const YAEMI_HOOK_ENTRY = {
  matcher: '',
  hooks: [{ type: 'command', command: BRIDGE_CMD }],
  description: 'Yaemi Claudecode hook pipeline',
};

function getGlobalSettingsPath() {
  return path.join(os.homedir(), '.claude', 'settings.json');
}

function getLocalSettingsPath() {
  return path.join(process.cwd(), '.claude', 'settings.json');
}

function readJSON(fp) {
  try { if (fs.existsSync(fp)) return JSON.parse(fs.readFileSync(fp, 'utf8')); } catch (_) {}
  return {};
}

function writeJSON(fp, data) {
  const dir = path.dirname(fp);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(fp, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

function isYaemiHook(hook) {
  if (!hook || !hook.hooks) return false;
  return hook.hooks.some(function (h) { return h.command && h.command.indexOf('yaemi-claudecode') !== -1; });
}

function installHooks(settingsPath, dryRun) {
  const settings = readJSON(settingsPath);
  if (!settings.hooks) settings.hooks = {};

  let added = 0;
  for (var i = 0; i < HOOK_EVENTS.length; i++) {
    var event = HOOK_EVENTS[i];
    var existing = settings.hooks[event] || [];
    if (existing.some(isYaemiHook)) continue;

    settings.hooks[event] = existing.concat([YAEMI_HOOK_ENTRY]);
    added++;
  }

  if (added === 0) {
    console.log('[yhk] Yaemi hooks already installed in ' + settingsPath);
    return;
  }

  console.log('[yhk] Adding ' + added + ' hook events → ' + settingsPath);
  HOOK_EVENTS.forEach(function (e) { console.log('  + ' + e); });

  if (!dryRun) {
    writeJSON(settingsPath, settings);
    console.log('[yhk] Done. Set YAEMI_HOOK_PROFILE=standard to start.');
    console.log('[yhk] Tip: add "YAEMI_HOOK_PROFILE": "standard" to settings.json env section.');
  } else {
    console.log('[yhk] (dry-run — no changes made)');
  }
}

function uninstallHooks(settingsPath, dryRun) {
  var settings = readJSON(settingsPath);
  if (!settings.hooks) { console.log('[yhk] No hooks found.'); return; }

  var removed = 0;
  var events = Object.keys(settings.hooks);
  for (var i = 0; i < events.length; i++) {
    var ev = events[i];
    var before = settings.hooks[ev].length;
    settings.hooks[ev] = settings.hooks[ev].filter(function (h) { return !isYaemiHook(h); });
    if (settings.hooks[ev].length < before) removed += before - settings.hooks[ev].length;
    if (settings.hooks[ev].length === 0) delete settings.hooks[ev];
  }

  if (removed === 0) { console.log('[yhk] No yaemi hooks found in ' + settingsPath); return; }

  console.log('[yhk] Removing ' + removed + ' yaemi hooks from ' + settingsPath);
  if (!dryRun) { writeJSON(settingsPath, settings); console.log('[yhk] Uninstalled.'); }
  else { console.log('[yhk] (dry-run)'); }
}

function showStatus() {
  var paths = [getGlobalSettingsPath(), getLocalSettingsPath()];
  for (var i = 0; i < paths.length; i++) {
    var p = paths[i];
    if (!fs.existsSync(p)) continue;
    var settings = readJSON(p);
    var hooks = settings.hooks || {};
    var events = Object.keys(hooks).filter(function (e) { return hooks[e].some(isYaemiHook); });
    console.log('[yhk] ' + p);
    console.log('  Profile: ' + (process.env.YAEMI_HOOK_PROFILE || 'standard'));
    console.log('  Events: ' + (events.length > 0 ? events.join(', ') : '(none)'));
    if (events.length === 0) console.log('  Run "yhk install" to set up.');
    console.log('');
  }
}

function ensureDataDir() {
  var dir = path.join(os.homedir(), '.yaemi');
  if (!fs.existsSync(dir)) { fs.mkdirSync(dir, { recursive: true }); console.log('[yhk] Created ' + dir); }
}

var args = process.argv.slice(2);
var cmd = args[0] || 'install';
var flags = args.slice(1);
var isLocal = flags.indexOf('--local') !== -1 || flags.indexOf('-l') !== -1;
var isDryRun = flags.indexOf('--dry-run') !== -1 || flags.indexOf('-n') !== -1;

switch (cmd) {
  case 'install':
    var sp = isLocal ? getLocalSettingsPath() : getGlobalSettingsPath();
    ensureDataDir();
    installHooks(sp, isDryRun);
    break;
  case 'uninstall': case 'remove':
    uninstallHooks(isLocal ? getLocalSettingsPath() : getGlobalSettingsPath(), isDryRun);
    break;
  case 'status': case 'info':
    showStatus();
    break;
  default:
    console.log([
      'Yaemi Claudecode — Hook Installer',
      '',
      '  yhk install            install to ~/.claude/settings.json',
      '  yhk install --local    install to ./.claude/settings.json (project)',
      '  yhk install --dry-run  preview changes without writing',
      '  yhk uninstall          remove yaemi hooks',
      '  yhk status             show current hook status',
    ].join('\n'));
}
