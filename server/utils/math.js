"use strict";

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function distanceSq(ax, ay, bx, by) {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy;
}

function distance(ax, ay, bx, by) {
  return Math.sqrt(distanceSq(ax, ay, bx, by));
}

function normalize(x, y) {
  const len = Math.sqrt(x * x + y * y);
  if (len < 0.0001) {
    return { x: 0, y: 0, len: 0 };
  }
  return { x: x / len, y: y / len, len };
}

function dot(ax, ay, bx, by) {
  return ax * bx + ay * by;
}

function angleBetween(ax, ay, bx, by) {
  const nA = normalize(ax, ay);
  const nB = normalize(bx, by);
  const d = clamp(dot(nA.x, nA.y, nB.x, nB.y), -1, 1);
  return Math.acos(d);
}

function circleIntersectsRect(cx, cy, radius, rect) {
  const nearestX = clamp(cx, rect.x, rect.x + rect.w);
  const nearestY = clamp(cy, rect.y, rect.y + rect.h);
  return distanceSq(cx, cy, nearestX, nearestY) <= radius * radius;
}

function segmentIntersectsRect(x1, y1, x2, y2, rect) {
  const steps = 16;
  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps;
    const x = lerp(x1, x2, t);
    const y = lerp(y1, y2, t);
    if (x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h) {
      return true;
    }
  }
  return false;
}

function distancePointToSegment(px, py, x1, y1, x2, y2) {
  const vx = x2 - x1;
  const vy = y2 - y1;
  const wx = px - x1;
  const wy = py - y1;

  const c1 = vx * wx + vy * wy;
  if (c1 <= 0) {
    return distance(px, py, x1, y1);
  }
  const c2 = vx * vx + vy * vy;
  if (c2 <= c1) {
    return distance(px, py, x2, y2);
  }
  const b = c1 / c2;
  const bx = x1 + b * vx;
  const by = y1 + b * vy;
  return distance(px, py, bx, by);
}

module.exports = {
  clamp,
  lerp,
  distance,
  distanceSq,
  normalize,
  dot,
  angleBetween,
  circleIntersectsRect,
  segmentIntersectsRect,
  distancePointToSegment,
};
