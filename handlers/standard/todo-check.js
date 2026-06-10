'use strict';

/**
 * PreToolUse Hook: Warn about new TODO / FIXME / HACK markers
 *
 * Scans the content of Edit/Write operations and emits a warning
 * when TODO, FIXME, or HACK is detected in the incoming code.
 * Non-blocking — always returns exitCode 0.
 */

const TODO_RE = /TODO|FIXME|HACK/i;

function extractContent(toolName, toolInput) {
  if (toolName === 'Edit') return toolInput.new_string || '';
  if (toolName === 'Write') return toolInput.content || '';
  if (toolName === 'MultiEdit') {
    if (Array.isArray(toolInput.contents)) {
      return toolInput.contents.map(c => c.content || c.new_string || '').join('\n');
    }
    if (Array.isArray(toolInput.edits)) {
      return toolInput.edits.map(e => e.new_string || e.content || '').join('\n');
    }
  }
  return '';
}

module.exports = {
  on: 'PreToolUse',
  match: (event) => {
    const toolName = event.tool_name || '';
    return toolName === 'Write' || toolName === 'Edit' || toolName === 'MultiEdit';
  },
  priority: 350,
  profile: ['standard', 'strict'],

  /**
   * @param {Object} event - Parsed hook event
   * @param {Object} ctx - HookContext
   */
  async run(event, ctx) {
    const toolName = event.tool_name || '';
    const toolInput = event.tool_input || {};
    const filePath = toolInput.file_path || '';
    const content = extractContent(toolName, toolInput);

    if (content && TODO_RE.test(content)) {
      ctx.warn('[Hook] New TODO/FIXME/HACK added at ' + String(filePath) + ' — consider creating an issue');
    }

    return { exitCode: 0 };
  },

  // Exported for tests
  TODO_RE,
  extractContent,
};
