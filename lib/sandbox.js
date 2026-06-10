'use strict';

const path = require('path');

/**
 * Validate that a handler script path is inside the plugin root.
 * Prevents path traversal attacks from compromised config.
 */
function validateHandlerPath(scriptPath, pluginRoot) {
  const resolvedScript = path.resolve(scriptPath);
  const resolvedRoot = path.resolve(pluginRoot);
  if (!resolvedScript.startsWith(resolvedRoot + path.sep) && resolvedScript !== resolvedRoot) {
    throw new Error('Path traversal rejected: ' + scriptPath);
  }
  return resolvedScript;
}

module.exports = { validateHandlerPath };
