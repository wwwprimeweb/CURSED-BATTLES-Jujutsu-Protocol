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

  updateSmoothing(alpha = 0.22) {
    this.players.forEach((entry) => {
      entry.x += (entry.tx - entry.x) * alpha;
      entry.y += (entry.ty - entry.y) * alpha;
    });
    this.enemies.forEach((entry) => {
      entry.x += (entry.tx - entry.x) * alpha;
      entry.y += (entry.ty - entry.y) * alpha;
    });
    this.projectiles.forEach((entry) => {
      entry.x += (entry.tx - entry.x) * 0.38;
      entry.y += (entry.ty - entry.y) * 0.38;
    });
    this.domains.forEach((entry) => {
      entry.x += (entry.tx - entry.x) * alpha;
      entry.y += (entry.ty - entry.y) * alpha;
    });
  }
}
