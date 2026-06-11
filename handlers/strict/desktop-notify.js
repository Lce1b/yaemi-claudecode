'use strict';

/**
 * Desktop Notify — cross-platform desktop notification after responses.
 *
 * Profile: strict
 * macOS: osascript | Windows: PowerShell Toast | Linux: notify-send
 */

const { execFileSync } = require('child_process');

function escAppleScript(s) {
  return String(s).replace(/["\\]/g, function(c) { return '\\' + c; });
}

function escPowerShell(s) {
  return String(s).replace(/[`'"]/g, function(c) { return c === "'" ? "''" : '`' + c; });
}

function notify(title, message) {
  try {
    if (process.platform === 'darwin') {
      execFileSync('osascript', [
        '-e', 'display notification "' + escAppleScript(message) + '" with title "' + escAppleScript(title) + '"'
      ], { timeout: 5000 });
    } else if (process.platform === 'win32') {
      const ps = '$t=[Windows.UI.Notifications.ToastNotificationManager]::GetTemplateContent(1);' +
        '$t.SelectSingleNode("//text[1]").InnerText=\'' + escPowerShell(title) + '\';' +
        '$t.SelectSingleNode("//text[2]").InnerText=\'' + escPowerShell(message) + '\'';
      execFileSync('powershell', ['-Command', ps], { timeout: 5000, windowsHide: true });
    } else {
      execFileSync('notify-send', [title, message], { timeout: 5000 });
    }
  } catch (_) { /* non-blocking */ }
}

module.exports = {
  on: 'Stop',
  match: () => true,
  priority: 900,
  profile: ['strict'],
  async: true,
  timeout: 5,

  async run(event, ctx) {
    const summary = event.summary || '';
    const tokens = event.total_tokens ? ' · ' + event.total_tokens + ' tokens' : '';
    notify('Claude', (summary || 'Response complete') + tokens);
    return { exitCode: 0 };
  },
};
