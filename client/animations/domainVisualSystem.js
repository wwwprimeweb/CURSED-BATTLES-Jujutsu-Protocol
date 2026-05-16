import { loadImage } from "./imageLoader.js";

const CHAR_COLORS = {
  gojo: [0, 229, 255],
  sukuna: [255, 0, 51],
  yuta: [255, 255, 255],
  yuji: [255, 107, 157],
  megumi: [10, 26, 74],
  hakari: [170, 68, 255],
};

const EXPAND_DURATION = 1.2;
const SHATTER_DURATION = 0.7;

export class DomainVisualSystem {
  constructor() {
    this.backgrounds = new Map();
    this.overlays = new Map();
    this.charByOwner = new Map();
    this.expanding = new Map();
    this.shattering = [];
    this.loaded = false;
    this.loadImages();
  }

  async loadImages() {
    const chars = Object.keys(CHAR_COLORS);
    for (const char of chars) {
      try {
        const bg = await loadImage(`/assets/domains/${char}-domain.png`);
        this.backgrounds.set(char, bg);
      } catch (e) {
      }
      try {
        const overlay = await loadImage(`/assets/domains/${char}-domain-overlay.png`);
        this.overlays.set(char, overlay);
      } catch (e) {
      }
    }
    this.loaded = true;
  }

  updatePlayers(players) {
    players.forEach((entry) => {
      const p = entry.raw || entry;
      if (p.character) {
        this.charByOwner.set(p.id, p.character);
      }
    });
  }

  getCharacter(ownerId) {
    return this.charByOwner.get(ownerId) || "gojo";
  }

  getBackground(ownerId) {
    const char = this.getCharacter(ownerId);
    return this.backgrounds.get(char) || null;
  }

  getOverlay(ownerId) {
    const char = this.getCharacter(ownerId);
    return this.overlays.get(char) || null;
  }

  onDomainStart(ev) {
    this.expanding.set(ev.ownerId, {
      startTime: performance.now(),
      targetRadius: ev.radius,
      x: ev.x,
      y: ev.y,
      ownerId: ev.ownerId,
    });
  }

  onDomainCollapse(ev) {
    const entry = this.expanding.get(ev.ownerId);
    const radius = ev.radius || (entry ? entry.targetRadius : 100);
    const x = ev.x;
    const y = ev.y;
    const character = this.getCharacter(ev.ownerId);

    this.expanding.delete(ev.ownerId);

    const shards = this.generateShards(radius);

    this.shattering.push({
      x,
      y,
      radius,
      shards,
      startTime: performance.now(),
      character,
      offscreenCanvas: null,
      ownerId: ev.ownerId,
    });
  }

  generateShards(radius) {
    const numShards = 12 + Math.floor(Math.random() * 9);
    const shards = [];
    const angles = [];

    let cumulative = 0;
    for (let i = 0; i < numShards; i++) {
      cumulative += (Math.PI * 2 / numShards) * (0.5 + Math.random() * 1.0);
      angles.push(cumulative);
    }
    const total = angles[angles.length - 1] || Math.PI * 2;
    for (let i = 0; i < angles.length; i++) {
      angles[i] = (angles[i] / total) * Math.PI * 2;
    }

    let prevAngle = 0;
    for (let i = 0; i < numShards; i++) {
      const startAngle = prevAngle;
      const endAngle = angles[i];
      prevAngle = endAngle;
      const midAngle = (startAngle + endAngle) / 2;
      const angleSpan = endAngle - startAngle;
      const numVerts = 4 + Math.floor(Math.random() * 3);
      const vertices = [];

      for (let j = 0; j < numVerts; j++) {
        const t = j / (numVerts - 1);
        const angle = startAngle + angleSpan * t + (Math.random() - 0.5) * angleSpan * 0.3;
        const radFrac = 0.15 + Math.random() * 0.85;
        const r = radius * radFrac;
        vertices.push({
          x: Math.cos(angle) * r,
          y: Math.sin(angle) * r,
        });
      }

      const dirAngle = midAngle + (Math.random() - 0.5) * 0.5;
      const speed = 100 + Math.random() * 250;

      shards.push({
        vertices,
        offsetX: 0,
        offsetY: 0,
        vx: Math.cos(dirAngle) * speed,
        vy: Math.sin(dirAngle) * speed,
        rot: 0,
        rotSpeed: (Math.random() - 0.5) * 4,
        alpha: 1,
      });
    }

    return shards;
  }

  isExpanding(ownerId) {
    return this.expanding.has(ownerId);
  }

  getExpandProgress(ownerId) {
    const entry = this.expanding.get(ownerId);
    if (!entry) return 1;
    const elapsed = (performance.now() - entry.startTime) / 1000;
    return Math.min(1, elapsed / EXPAND_DURATION);
  }

  getCurrentRadius(ownerId, targetRadius) {
    const progress = this.getExpandProgress(ownerId);
    return targetRadius * this.easeOutCubic(progress);
  }

  easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
  }

  update(dt) {
    for (let i = this.shattering.length - 1; i >= 0; i--) {
      const entry = this.shattering[i];
      let allDead = true;

      for (const shard of entry.shards) {
        shard.offsetX += shard.vx * dt;
        shard.offsetY += shard.vy * dt;
        shard.vx *= 0.97;
        shard.vy *= 0.97;
        shard.rot += shard.rotSpeed * dt;
        shard.alpha -= dt / SHATTER_DURATION;
        if (shard.alpha > 0) allDead = false;
      }

      if (allDead) {
        this.shattering.splice(i, 1);
      }
    }
  }

  captureDomainSnapshot(entry) {
    const canvas = document.createElement("canvas");
    const r = entry.radius;
    canvas.width = r * 2;
    canvas.height = r * 2;
    const ctx = canvas.getContext("2d");
    const cx = r;
    const cy = r;

    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.clip();

    const bg = this.backgrounds.get(entry.character);
    const overlay = this.overlays.get(entry.character);
    const rgb = CHAR_COLORS[entry.character] || CHAR_COLORS.gojo;

    if (bg) {
      const aspect = bg.width / bg.height;
      let dw = r * 2;
      let dh = dw / aspect;
      if (dh < r * 2) {
        dh = r * 2;
        dw = dh * aspect;
      }
      ctx.drawImage(bg, cx - dw / 2, cy - dh / 2, dw, dh);
    } else {
      const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
      grad.addColorStop(0, `rgba(${rgb[0]},${rgb[1]},${rgb[2]},0.3)`);
      grad.addColorStop(0.4, `rgba(${rgb[0]},${rgb[1]},${rgb[2]},0.12)`);
      grad.addColorStop(0.7, `rgba(${rgb[0]},${rgb[1]},${rgb[2]},0.04)`);
      grad.addColorStop(1, `rgba(0,0,0,0.85)`);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, r * 2, r * 2);
    }

    if (overlay) {
      ctx.drawImage(overlay, 0, 0, r * 2, r * 2);
    }

    ctx.restore();
    return canvas;
  }

  renderShards(ctx, camera, canvas) {
    const z = camera.zoom || 1;
    for (const entry of this.shattering) {
      const sx = (entry.x - camera.x) * z + canvas.width * 0.5;
      const sy = (entry.y - camera.y) * z + canvas.height * 0.5;

      if (!entry.offscreenCanvas) {
        entry.offscreenCanvas = this.captureDomainSnapshot(entry);
      }

      for (const shard of entry.shards) {
        if (shard.alpha <= 0) continue;

        const px = sx + shard.offsetX;
        const py = sy + shard.offsetY;

        ctx.save();
        ctx.globalAlpha = Math.max(0, shard.alpha);
        ctx.translate(px, py);
        ctx.rotate(shard.rot);

        ctx.beginPath();
        ctx.moveTo(shard.vertices[0].x, shard.vertices[0].y);
        for (let j = 1; j < shard.vertices.length; j++) {
          ctx.lineTo(shard.vertices[j].x, shard.vertices[j].y);
        }
        ctx.closePath();
        ctx.clip();

        ctx.drawImage(
          entry.offscreenCanvas,
          -entry.radius, -entry.radius,
          entry.radius * 2, entry.radius * 2
        );
        ctx.restore();

        ctx.save();
        ctx.globalAlpha = Math.max(0, shard.alpha * 0.5);
        ctx.translate(px, py);
        ctx.rotate(shard.rot);
        ctx.strokeStyle = "rgba(220,235,255,0.7)";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(shard.vertices[0].x, shard.vertices[0].y);
        for (let j = 1; j < shard.vertices.length; j++) {
          ctx.lineTo(shard.vertices[j].x, shard.vertices[j].y);
        }
        ctx.closePath();
        ctx.stroke();
        ctx.restore();
      }
    }
  }

  cleanupExpanding(activeOwnerIds) {
    this.expanding.forEach((_entry, ownerId) => {
      if (!activeOwnerIds.has(ownerId)) {
        this.expanding.delete(ownerId);
      }
    });
  }
}
