'use strict';

/**
 * EventSink — decouples hook handlers from output destinations.
 *
 * Built-in:
 *   StdoutSink  — writes structured JSON to stdout (default)
 *   NullSink    — no-op (for headless / quiet mode)
 *
 * External injection:
 *   registerSink(name, impl) — register a custom sink
 *   createSink(mode)         — resolve by name or env var
 */

const _customSinks = Object.create(null);

function registerSink(name, impl) {
  if (!name || typeof name !== 'string') throw new Error('registerSink: name required');
  if (!impl || typeof impl.fire !== 'function') throw new Error('registerSink: impl must have fire()');
  _customSinks[name] = impl;
}

class StdoutSink {
  fire(endpoint, body) {
    process.stdout.write(JSON.stringify({ sink: 'stdout', endpoint, body }) + '\n');
  }
  call(endpoint, body, _timeout) {
    process.stdout.write(JSON.stringify({ sink: 'stdout', endpoint, body }) + '\n');
    return Promise.resolve(null);
  }
}

class NullSink {
  fire() {}
  call() { return Promise.resolve(null); }
}

function createSink(mode) {
  const sinkName = (mode || '').trim();
  if (sinkName && _customSinks[sinkName]) return _customSinks[sinkName];
  switch (sinkName) {
    case 'null':   return new NullSink();
    case 'stdout':
    default:       return new StdoutSink();
  }
}

module.exports = { StdoutSink, NullSink, createSink, registerSink };
