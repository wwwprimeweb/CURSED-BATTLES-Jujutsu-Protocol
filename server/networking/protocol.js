"use strict";

function safeParse(raw) {
  try {
    return JSON.parse(raw);
  } catch (err) {
    return null;
  }
}

function sanitizeName(name, maxLength) {
  if (typeof name !== "string") {
    return "Sorcerer";
  }
  const clean = name.replace(/[^a-zA-Z0-9 _\-]/g, "").trim();
  if (!clean) {
    return "Sorcerer";
  }
  return clean.slice(0, maxLength);
}

function sanitizeInput(payload) {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const keys = payload.keys || {};
  return {
    seq: Number.isFinite(payload.seq) ? Math.max(0, Math.floor(payload.seq)) : 0,
    up: Boolean(keys.up),
    down: Boolean(keys.down),
    left: Boolean(keys.left),
    right: Boolean(keys.right),
    m1: Boolean(keys.m1),
    q: Boolean(keys.q),
    e: Boolean(keys.e),
    r: Boolean(keys.r),
    space: Boolean(keys.space),
    f: Boolean(keys.f),
    dodge: Boolean(keys.dodge),
    aimX: Number.isFinite(payload.aimX) ? payload.aimX : 0,
    aimY: Number.isFinite(payload.aimY) ? payload.aimY : 0,
  };
}

module.exports = {
  safeParse,
  sanitizeName,
  sanitizeInput,
};
