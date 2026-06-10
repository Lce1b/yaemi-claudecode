// Live integration test for yaemi-claudecode bridge
const { spawn } = require('child_process');
const path = require('path');

const BRIDGE = path.resolve(__dirname, '..', 'bin', 'bridge.js');
const EVENTS = [
  { name: 'Edit .js file', event: { hook_event_name: 'PreToolUse', tool_name: 'Edit', tool_input: { file_path: 'src/app.js', old_string: 'var x', new_string: 'const x' }, session_id: 't1', cwd: process.cwd() } },
  { name: 'Edit .eslintrc (BLOCK)', event: { hook_event_name: 'PreToolUse', tool_name: 'Edit', tool_input: { file_path: '.eslintrc.json', old_string: '"error"', new_string: '"warn"' }, session_id: 't1', cwd: process.cwd() } },
  { name: 'Write file >800 lines', event: { hook_event_name: 'PreToolUse', tool_name: 'Write', tool_input: { file_path: 'src/big.js', content: '// line\n'.repeat(900) }, session_id: 't1', cwd: process.cwd() } },
  { name: 'Bash destructive', event: { hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command: 'rm -rf /tmp/test' }, session_id: 't1', cwd: process.cwd() } },
  { name: 'Git status (normal)', event: { hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command: 'git status' }, session_id: 't1', cwd: process.cwd() } },
  { name: 'PostToolUse after edit', event: { hook_event_name: 'PostToolUse', tool_name: 'Edit', tool_input: { file_path: 'src/app.js' }, session_id: 't1', cwd: process.cwd() } },
  { name: 'Stop event', event: { hook_event_name: 'Stop', session_id: 't1', cwd: process.cwd(), summary: 'Fixed bug', total_tokens: 15000 } },
  { name: 'SessionStart (new)', event: { hook_event_name: 'SessionStart', session_id: 'new-session', cwd: process.cwd() } },
];

async function runTest(name, event) {
  return new Promise((resolve) => {
    const child = spawn('node', [BRIDGE], {
      env: { ...process.env, YAEMI_HOOK_PROFILE: 'standard' },
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    let stdout = '', stderr = '';
    child.stdout.on('data', d => stdout += d);
    child.stderr.on('data', d => stderr += d);
    child.on('close', code => {
      resolve({ name, exitCode: code, stdout: stdout.trim().substring(0, 200), stderr: stderr.trim().substring(0, 300) });
    });
    child.stdin.write(JSON.stringify(event));
    child.stdin.end();
  });
}

(async () => {
  console.log('=== Yaemi Claudecode Live Test ===\n');
  for (const { name, event } of EVENTS) {
    const r = await runTest(name, event);
    const icon = r.exitCode === 2 ? 'BLOCK' : r.exitCode === 0 ? 'PASS' : 'WARN';
    console.log('[' + icon + '] ' + name + ' (exit=' + r.exitCode + ')');
    if (r.stderr) console.log('  stderr: ' + r.stderr.replace(/\n/g, '\\n'));
    console.log('');
  }
  console.log('=== Done ===');
})();
