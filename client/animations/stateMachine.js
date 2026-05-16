export class AnimationStateMachine {
  constructor() {
    this.states = new Map();
  }

  set(entityId, state) {
    const existing = this.states.get(entityId);
    if (!existing) {
      this.states.set(entityId, {
        state,
        since: performance.now(),
      });
      return;
    }
    if (existing.state !== state) {
      existing.state = state;
      existing.since = performance.now();
    }
  }

  get(entityId) {
    return this.states.get(entityId) || null;
  }

  clearRemoved(validIds) {
    this.states.forEach((_value, key) => {
      if (!validIds.has(key)) {
        this.states.delete(key);
      }
    });
  }
}
