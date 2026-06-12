'use strict';

const fs = require('fs');
const path = require('path');

const CYAN = '\x1b[36m';
const BLUE = '\x1b[34m';
const MAGENTA = '\x1b[35m';
const DIM = '\x1b[2m';
const BOLD = '\x1b[1m';
const RST = '\x1b[0m';

const LINES = [
  '██╗   ██╗ █████╗ ███████╗███╗   ███╗██╗',
  '╚██╗ ██╔╝██╔══██╗██╔════╝████╗ ████║██║',
  ' ╚████╔╝ ███████║█████╗  ██╔████╔██║██║',
  '  ╚██╔╝  ██╔══██║██╔══╝  ██║╚██╔╝██║██║',
  '   ██║   ██║  ██║███████╗██║ ╚═╝ ██║██║',
  '   ╚═╝   ╚═╝  ╚═╝╚══════╝╚═╝     ╚═╝╚═╝',
];

const GRADIENT = [CYAN, CYAN, BLUE, BLUE, MAGENTA, MAGENTA];

function getVersion() {
  try {
    const v = fs.readFileSync(path.join(__dirname, '..', 'VERSION'), 'utf8').trim();
    return v || '0.0.0';
  } catch (_) {
    return '0.0.0';
  }
}

function show() {
  const version = getVersion();
  const width = 58;

  const hr = DIM + '━'.repeat(width) + RST;

  console.log('');
  console.log(hr);
  console.log('');
  for (let i = 0; i < LINES.length; i++) {
    console.log('  ' + GRADIENT[i] + BOLD + LINES[i] + RST);
  }
  console.log('');
  console.log(
    '  ' + DIM + 'Claude Code Hook System' + RST +
    '  ' + DIM + '·' + RST +
    '  v' + version
  );
  console.log('');
  console.log(hr);
  console.log('');
}

module.exports = { show };
