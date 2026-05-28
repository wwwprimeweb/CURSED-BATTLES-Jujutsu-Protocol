export class InterpolationBuffer {
  constructor() {
    this.players = new Map();
    this.enemies = new Map();
    this.projectiles = new Map();
    this.domains = new Map();
  }

  applyDelta(store, changes, removed) {
    if (removed && removed.length) {
      for (let i = 0; i < removed.length; i += 1) {
        store.delete(removed[i]);
      }
    }

    if (!changes || !changes.length) {
      return;
    }

    for (let i = 0; i < changes.length; i += 1) {
      const update = changes[i];
      const existing = store.get(update.id);
      if (!existing) {
        store.set(update.id, {
          id: update.id,
          x: update.x,
          y: update.y,
          tx: update.x,
          ty: update.y,
          raw: update,
        });
      } else {
        existing.tx = update.x;
        existing.ty = update.y;
        existing.raw = update;
      }
    }
  }

  ingest(snapshot) {
    this.applyDelta(this.players, snapshot.delta.players, snapshot.removed.players);
    this.applyDelta(this.enemies, snapshot.delta.enemies, snapshot.removed.enemies);
    this.applyDelta(this.projectiles, snapshot.delta.projectiles, snapshot.removed.projectiles);
    this.applyDelta(this.domains, snapshot.delta.domains, snapshot.removed.domains);
  }

  updateSmoothing(dt = 1 / 60) {
    const alpha = 0.22;
    const fastAlpha = 0.35;
    this.players.forEach((entry) => {
      const dx = entry.tx - entry.x;
      const dy = entry.ty - entry.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const a = dist > 30 ? fastAlpha : alpha;
      const frameAlpha = 1 - Math.pow(1 - a, dt * 60);
      entry.x += dx * frameAlpha;
      entry.y += dy * frameAlpha;
    });
    this.enemies.forEach((entry) => {
      const dx = entry.tx - entry.x;
      const dy = entry.ty - entry.y;
      const a = Math.sqrt(dx * dx + dy * dy) > 30 ? fastAlpha : alpha;
      const frameAlpha = 1 - Math.pow(1 - a, dt * 60);
      entry.x += dx * frameAlpha;
      entry.y += dy * frameAlpha;
    });
    this.projectiles.forEach((entry) => {
      entry.x += (entry.tx - entry.x) * Math.min(1, 12 * dt);
      entry.y += (entry.ty - entry.y) * Math.min(1, 12 * dt);
    });
    this.domains.forEach((entry) => {
      entry.x += (entry.tx - entry.x) * Math.min(1, 6 * dt);
      entry.y += (entry.ty - entry.y) * Math.min(1, 6 * dt);
    });
  }
}
