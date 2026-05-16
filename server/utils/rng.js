"use strict";

class Rng {
  constructor(seed) {
    this.seed = seed >>> 0;
  }

  next() {
    this.seed = (1664525 * this.seed + 1013904223) >>> 0;
    return this.seed / 4294967296;
  }

  range(min, max) {
    return min + (max - min) * this.next();
  }

  int(min, max) {
    return Math.floor(this.range(min, max + 1));
  }

  pick(array) {
    if (!array.length) {
      return null;
    }
    return array[this.int(0, array.length - 1)];
  }
}

module.exports = {
  Rng,
};
