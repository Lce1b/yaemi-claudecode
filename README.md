# Yaemi Claudecode

Hook system for Claude Code. Middleware pipeline, profile-gated, zero dependencies.

35 handlers across 7 events in 3 profiles (minimal/standard/strict).

## Quick Start

npm install -g yaemi-claudecode
yhk install

## Profiles

minimal: 4 handlers (security baseline)
standard: 18 handlers (+ quality gates)
strict: 35 handlers (+ auto-review, desktop notify)

## CLI

yhk install / yhk install --local / yhk uninstall / yhk status

## Configuration

Env vars: YAEMI_HOOK_PROFILE, YAEMI_HOOK_DISABLED, YAEMI_HOOK_SINK

## Links

GitHub: https://github.com/Lce1b/yaemi-claudecode
npm: https://www.npmjs.com/package/yaemi-claudecode