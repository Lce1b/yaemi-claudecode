'use strict';

const VALID_PROFILES = new Set(['minimal', 'standard', 'strict']);

function normalizeId(value) {
  return String(value || '').trim().toLowerCase();
}

function getHookProfile() {
  const raw = String(process.env.YAEMI_HOOK_PROFILE || 'standard').trim().toLowerCase();
  return VALID_PROFILES.has(raw) ? raw : 'standard';
}

function getDisabledHookIds() {
  const raw = String(process.env.YAEMI_HOOK_DISABLED || '');
  if (!raw.trim()) return new Set();
  return new Set(raw.split(',').map(v => normalizeId(v)).filter(Boolean));
}

function parseProfiles(rawProfiles, fallback) {
  const fb = fallback || ['standard', 'strict'];
  if (!rawProfiles) return [...fb];
  if (Array.isArray(rawProfiles)) {
    const parsed = rawProfiles.map(v => String(v || '').trim().toLowerCase()).filter(v => VALID_PROFILES.has(v));
    return parsed.length > 0 ? parsed : [...fb];
  }
  const parsed = String(rawProfiles).split(',').map(v => v.trim().toLowerCase()).filter(v => VALID_PROFILES.has(v));
  return parsed.length > 0 ? parsed : [...fb];
}

function isHookEnabled(hookId, profiles) {
  const id = normalizeId(hookId);
  if (!id) return true;
  const disabled = getDisabledHookIds();
  if (disabled.has(id)) return false;
  const profile = getHookProfile();
  const allowedProfiles = parseProfiles(profiles);
  return allowedProfiles.includes(profile);
}

module.exports = { VALID_PROFILES, normalizeId, getHookProfile, getDisabledHookIds, parseProfiles, isHookEnabled };
