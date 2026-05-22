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

const LAYER_SCALE = {
  far: 1.3,
  mid: 0.6,
  close: 1.2,
};

const LAYER_ALPHA = {
  far: 1,
  mid: 1,
  close: 1,
};

const LAYER_OFFSET = {
  far: { x: 0.12, y: 0 },
  mid: { x: 0.2, y: 0.3 },
  close: { x: 0, y: 0 },
};

const PARALLAX_DEPTHS = {
  far: 0.25,
  mid: 0.06,
  close: 0,
};
const IMG_SCALE = 1.0;

export class DomainVisualSystem {
  constructor() {
    this.backgrounds = new Map();
    this.overlays = new Map();
    this.layerImages = new Map();
    this.parallaxData = new Map();
    this.charByOwner = new Map();
    this.expanding = new Map();
    this.shattering = [];
    this.rotationTime = 0;
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
      for (const key of ['3', '2', '1']) {
        try {
          const img = await loadImage(`/assets/domains/${char}${key}.png`);
          this.layerImages.set(`${char}_${key}`, img);
        } catch (e) {
        }
      }
    }
    this.loaded = true;
  }

  update(dt) {
    this.rotationTime += dt;
    const now = performance.now();
    for (let i = this.shattering.length - 1; i >= 0; i--) {
      const age = (now - this.shattering[i].startTime) / 1000;
      if (age >= SHATTER_DURATION) {
        this.shattering.splice(i, 1);
      }
    }
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

  getBackgroundForChar(char) {
    return this.backgrounds.get(char) || null;
  }

  getOverlayForChar(char) {
    return this.overlays.get(char) || null;
  }

  getLayerImage(char, key) {
    return this.layerImages.get(`${char}_${key}`) || null;
  }

  hashString(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i);
      hash = hash & hash;
    }
    return Math.abs(hash);
  }

  mulberry32(seed) {
    let s = seed | 0;
    return function () {
      s = s + 0x6D2B79F5 | 0;
      let t = Math.imul(s ^ s >>> 15, 1 | s);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  getOrCreateParallaxData(ownerId, char) {
    if (this.parallaxData.has(ownerId)) {
      return this.parallaxData.get(ownerId);
    }

    const seed = this.hashString(ownerId);
    const rng = this.mulberry32(seed);
    const colors = CHAR_COLORS[char] || CHAR_COLORS.gojo;

    const mid = [];
    const midCount = 5 + Math.floor(rng() * 2);
    for (let i = 0; i < midCount; i++) {
      const angle = rng() * Math.PI * 2;
      const dist = 0.15 + rng() * 0.6;
      const r = 0.08 + rng() * 0.2;
      const alpha = 0.08 + rng() * 0.08;
      const colorVar = rng() * 60 - 30;
      mid.push({
        x: Math.cos(angle) * dist,
        y: Math.sin(angle) * dist,
        r,
        color: `rgba(${colors[0] + colorVar},${colors[1] + colorVar},${colors[2] + colorVar},${alpha})`,
      });
    }

    const close = [];
    const closeCount = 15 + Math.floor(rng() * 6);
    for (let i = 0; i < closeCount; i++) {
      const angle = rng() * Math.PI * 2;
      const dist = 0.2 + rng() * 0.7;
      const r = 1 + rng() * 3;
      const alpha = 0.2 + rng() * 0.3;
      const colorVar = rng() * 40 - 20;
      close.push({
        x: Math.cos(angle) * dist,
        y: Math.sin(angle) * dist,
        r: r * 0.01,
        color: `rgba(${colors[0] + colorVar},${colors[1] + colorVar},${colors[2] + colorVar},${alpha})`,
      });
    }

    const data = { mid, close, colors };
    this.parallaxData.set(ownerId, data);
    return data;
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
    this.parallaxData.delete(ev.ownerId);

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

  drawScaledImage(ctx, img, cx, cy, radius, offsetX, offsetY, layerScale) {
    if (!img || !img.width || !img.height) return;
    const s = layerScale ?? IMG_SCALE;
    const aspect = img.width / img.height;
    let dw = radius * 2 * s;
    let dh = dw / aspect;
    if (dh < radius * 2 * s) {
      dh = radius * 2 * s;
      dw = dh * aspect;
    }
    ctx.drawImage(img, cx - dw / 2 + offsetX, cy - dh / 2 + offsetY, dw, dh);
  }

  renderParallax(ctx, camera, ownerId, char, worldX, worldY, p, vz, zoom, expandProgress, isMine, now) {
    ctx.save();
    try {
      ctx.beginPath();
      ctx.arc(p.x, p.y, vz, 0, Math.PI * 2);
      ctx.clip();

      const layerData = this.getOrCreateParallaxData(ownerId, char);
      const layers = ['far', 'close', 'mid'];

      for (const key of layers) {
        const config = PARALLAX_DEPTHS[key];
        const entry = this.expanding.get(ownerId);
        const elapsed = entry ? (performance.now() - entry.startTime) / 1000 : 0;

        let alpha = 1;
        if (key === 'far') {
          alpha = Math.min(1, expandProgress * 3);
        } else if (key === 'mid') {
          alpha = Math.min(1, expandProgress * 1.8);
        } else {
          const delay = 1;
          if (elapsed < delay) {
            alpha = 0;
          } else {
            const fadeIn = Math.min(1, (elapsed - delay) / 0.5);
            alpha = Math.min(1, expandProgress * 1.4) * fadeIn;
          }
        }

        if (alpha < 0.01) continue;

        let effectiveOffset = LAYER_OFFSET[key] || { x: 0, y: 0 };
        let effectiveScale = LAYER_SCALE[key];
        let effectiveParallax = config ? (config.factor || config) : 0;

        if (char === 'yuta') {
          if (key === 'far') {
            effectiveOffset = { x: 0.15, y: 0 };
            effectiveParallax = 0.4;
          } else if (key === 'mid') {
            effectiveScale = 1.0;
            effectiveOffset = { x: 0, y: 0.5 };
            effectiveParallax = 0;
          }
        }

        if (char === 'gojo' && key === 'mid') {
          effectiveOffset = { x: 0.3, y: -0.3 };
        }

        const camX = camera.x || 0;
        const camY = camera.y || 0;
        const dx = (worldX - camX) * effectiveParallax * zoom;
        const dy = (worldY - camY) * effectiveParallax * zoom;

        const layerKeyMap = { far: '3', mid: '2', close: '1' };
        const img = this.getLayerImage(char, layerKeyMap[key] || key);
        if (img && img.width && img.height) {
          const lo = effectiveOffset;
          const cx2 = p.x + lo.x * vz + dx;
          const cy2 = p.y + lo.y * vz + dy;
          ctx.save();
          ctx.translate(cx2, cy2);
          if (char === 'gojo' && key === 'mid') {
            ctx.rotate(this.rotationTime * 0.01);
          }
          ctx.globalAlpha = alpha * (LAYER_ALPHA[key] ?? 1);
          this.drawScaledImage(ctx, img, 0, 0, vz, 0, 0, effectiveScale);
          ctx.globalAlpha = 1;
          ctx.restore();
          continue;
        }

        if (key === 'far') {
          const bg = this.backgrounds.get(char);
          if (bg) {
            ctx.globalAlpha = alpha * 0.5;
            this.drawScaledImage(ctx, bg, p.x + dx * 0.3, p.y + dy * 0.3, vz, 0, 0);
            ctx.globalAlpha = 1;
          }

          const skyGrad = ctx.createRadialGradient(p.x + dx, p.y + dy, 0, p.x + dx, p.y + dy, vz);
          skyGrad.addColorStop(0, isMine ? "rgba(10,20,50,0.95)" : "rgba(30,10,50,0.95)");
          skyGrad.addColorStop(0.5, isMine ? "rgba(5,15,40,0.92)" : "rgba(20,5,40,0.92)");
          skyGrad.addColorStop(1, "rgba(0,0,0,0.98)");
          ctx.globalAlpha = alpha;
          ctx.fillStyle = skyGrad;
          ctx.fill();
          ctx.globalAlpha = 1;

          const innerR = vz * 0.95;
          for (let i = 0; i < 80; i++) {
            const seed = i * 137.508;
            const angle = (seed % 360) * Math.PI / 180;
            const dist = ((seed * 7919) % innerR);
            const starX = p.x + Math.cos(angle) * dist + dx;
            const starY = p.y + Math.sin(angle) * dist + dy;
            const starSize = 0.5 + (seed % 3) * 0.5;
            const twinkle = 0.5 + Math.sin(now * 0.003 + seed) * 0.5;
            const starAlpha = twinkle * (0.6 + (seed % 40) * 0.01);
            ctx.fillStyle = `rgba(255,255,255,${starAlpha})`;
            ctx.beginPath();
            ctx.arc(starX, starY, starSize, 0, Math.PI * 2);
            ctx.fill();
          }
        } else if (key === 'mid' && layerData.mid) {
          ctx.globalAlpha = alpha;
          for (const h of layerData.mid) {
            ctx.fillStyle = h.color;
            ctx.beginPath();
            ctx.arc(p.x + h.x * vz + dx, p.y + h.y * vz + dy, h.r * vz, 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.globalAlpha = 1;
        } else if (key === 'close' && layerData.close && char !== 'yuta') {
          ctx.globalAlpha = alpha;
          for (const d of layerData.close) {
            ctx.fillStyle = d.color;
            ctx.beginPath();
            ctx.arc(p.x + d.x * vz + dx, p.y + d.y * vz + dy, d.r * vz, 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.globalAlpha = 1;
        }
      }
    } catch (e) {
      console.error("Parallax render error:", e);
    } finally {
      ctx.restore();
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
    const char = entry.character;

    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.clip();

    for (const key of ['3', '2', '1']) {
      const img = this.getLayerImage(char, key);
      if (img) {
        this.drawScaledImage(ctx, img, cx, cy, r, 0, 0);
      }
    }

    const bg = this.backgrounds.get(char);
    if (!this.getLayerImage(char, '3') && bg) {
      this.drawScaledImage(ctx, bg, cx, cy, r, 0, 0);
    } else if (!this.getLayerImage(char, '3') && !bg) {
      const rgb = CHAR_COLORS[char] || CHAR_COLORS.gojo;
      const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
      grad.addColorStop(0, `rgba(${rgb[0]},${rgb[1]},${rgb[2]},0.3)`);
      grad.addColorStop(0.4, `rgba(${rgb[0]},${rgb[1]},${rgb[2]},0.12)`);
      grad.addColorStop(0.7, `rgba(${rgb[0]},${rgb[1]},${rgb[2]},0.04)`);
      grad.addColorStop(1, `rgba(0,0,0,0.85)`);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, r * 2, r * 2);
    }

    const overlay = this.overlays.get(char);
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
