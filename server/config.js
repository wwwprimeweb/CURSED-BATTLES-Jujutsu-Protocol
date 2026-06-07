"use strict";

module.exports = {
  port: process.env.PORT ? Number(process.env.PORT) : 3000,
  net: {
    tickRate: 30,
    snapshotRate: 15,
    maxInputPerSecond: 90,
    reconnectGraceMs: 25000,
  },
  map: {
    width: 3600,
    height: 2600,
  },
  match: {
    phaseTimings: {
      early: 60,
      mid: 120,
      late: 180,
    },
    friendlyFire: true,
  },
  antiCheat: {
    maxNameLength: 20,
    maxAimDistanceFromPlayer: 6000,
  },
  debug: {
    overridePhase: null,
  },
};
