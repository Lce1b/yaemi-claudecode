'use strict';

const fs = require('fs');
const path = require('path');
const config = require('../../lib/config');
const { ensureDir } = require('../../lib/state-store');
const { debugLog } = require('../../lib/utils');

var MODEL_RATES = { haiku: { input: 0.8, output: 4.0 }, sonnet: { input: 3.0, output: 15.0 }, opus: { input: 15.0, output: 75.0 } };

function toNumber(v) { var n = Number(v); return Number.isFinite(n) ? n : 0; }
function formatTokens(n) { return n >= 1000 ? (n / 1000).toFixed(1) + 'K' : String(n); }

function estimateCost(model, inputTokens, outputTokens) {
  var norm = String(model || '').toLowerCase();
  var rates = MODEL_RATES.sonnet;
  if (norm.includes('haiku')) rates = MODEL_RATES.haiku;
  if (norm.includes('sonnet')) rates = MODEL_RATES.sonnet;
  if (norm.includes('opus')) rates = MODEL_RATES.opus;
  return Math.round(((inputTokens / 1e6) * rates.input + (outputTokens / 1e6) * rates.output) * 1e6) / 1e6;
}

function extractUsage(event) {
  var usage = event.usage || event.token_usage || {};
  return { inputTokens: toNumber(usage.input_tokens || usage.prompt_tokens || 0), outputTokens: toNumber(usage.output_tokens || usage.completion_tokens || 0) };
}

module.exports = {
  on: 'Stop', match: function() { return true; }, priority: 200, profile: ['standard', 'strict'],
  run: async function(event, ctx) {
    var usage = extractUsage(event);
    if (usage.inputTokens === 0 && usage.outputTokens === 0) return { exitCode: 0 };
    var model = String(event.model || process.env.LLM_MODEL || 'unknown');
    var cost = estimateCost(model, usage.inputTokens, usage.outputTokens);
    var row = { timestamp: new Date().toISOString(), session_id: event.session_id || 'unknown', model: model, input_tokens: usage.inputTokens, output_tokens: usage.outputTokens, estimated_cost_usd: cost };
    ensureDir(config.DATA_DIR);
    try { fs.appendFileSync(path.join(config.DATA_DIR, 'cost-log.jsonl'), JSON.stringify(row) + '\n', 'utf8'); } catch (_) {}
    ctx._costSummary = '$' + cost.toFixed(4) + ' (' + formatTokens(usage.inputTokens) + ' in / ' + formatTokens(usage.outputTokens) + ' out)';
    return { exitCode: 0 };
  },
  estimateCost: estimateCost,
};
