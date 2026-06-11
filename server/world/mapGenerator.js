"use strict";

const { Rng } = require("../utils/rng");
const { circleIntersectsRect, distanceSq } = require("../utils/math");

function generateMap(width, height, seed) {
  const rng = new Rng(seed);
  const obstacles = [];
  const hazards = [];
  const disputeZones = [];

  const cx = width * 0.5;
  const cy = height * 0.5;

  const openCoreRadius = 353;
  const obstacleCount = 24;

  for (let i = 0; i < obstacleCount; i += 1) {
    let tries = 0;
    let placed = false;
    while (!placed && tries < 80) {
      tries += 1;
      const w = rng.int(110, 220);
      const h = rng.int(90, 180);
      const x = rng.int(133, width - w - 133);
      const y = rng.int(133, height - h - 133);
      const rect = { id: `o${i}`, x, y, w, h };

      const nearCore = circleIntersectsRect(cx, cy, openCoreRadius, rect);
      if (nearCore) {
        continue;
      }

      let overlaps = false;
      for (let j = 0; j < obstacles.length; j += 1) {
        const other = obstacles[j];
        const gap = 246;
        if (
          x < other.x + other.w + gap &&
          x + w + gap > other.x &&
          y < other.y + other.h + gap &&
          y + h + gap > other.y
        ) {
          overlaps = true;
          break;
        }
      }
      if (!overlaps) {
        obstacles.push(rect);
        placed = true;
      }
    }
  }

  for (let i = 0; i < 7; i += 1) {
    let tries = 0;
    let placed = false;
    while (!placed && tries < 80) {
      tries += 1;
      const radius = rng.int(70, 120);
      const x = rng.int(173, width - 173);
      const y = rng.int(173, height - 173);

      if (distanceSq(x, y, cx, cy) < 313 * 313) {
        continue;
      }

      let collidesObstacle = false;
      for (let j = 0; j < obstacles.length; j += 1) {
        if (circleIntersectsRect(x, y, radius + 30, obstacles[j])) {
          collidesObstacle = true;
          break;
        }
      }
      if (!collidesObstacle) {
        hazards.push({
          id: `h${i}`,
          x,
          y,
          radius,
          dps: rng.int(12, 20),
        });
        placed = true;
      }
    }
  }

  const zones = 3;
  for (let i = 0; i < zones; i += 1) {
    const angle = (Math.PI * 2 * i) / zones;
    disputeZones.push({
      id: `z${i}`,
      x: cx + Math.cos(angle) * 520,
      y: cy + Math.sin(angle) * 390,
      radius: 150,
    });
  }

  return {
    seed,
    width,
    height,
    obstacles,
    hazards,
    disputeZones,
    spawnPoints: [
      { x: cx, y: cy },
      { x: cx - 220, y: cy + 160 },
      { x: cx + 220, y: cy - 160 },
      { x: cx + 180, y: cy + 180 },
      { x: cx - 180, y: cy - 180 },
      { x: 200, y: 200 },
      { x: width - 200, y: height - 200 },
      { x: width - 200, y: 200 },
      { x: 200, y: height - 200 },
    ],
  };
}

module.exports = {
  generateMap,
};
