import { GojoVisualSystem } from "../animations/gojoVisualSystem.js";
import { YutaVisualSystem } from "../animations/yutaVisualSystem.js";
import { YujiVisualSystem } from "../animations/yujiVisualSystem.js";
import { GenericVisualSystem } from "../animations/genericVisualSystem.js";
import { DomainVisualSystem } from "../animations/domainVisualSystem.js";
import { drawGojoM1Sprite } from "../animations/gojoEffects.js";

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function worldToScreen(camera, canvas, x, y) {
  const zoom = camera.zoom || 1;
  return {
    x: (x - camera.x) * zoom + canvas.width * 0.5,
    y: (y - camera.y) * zoom + canvas.height * 0.5,
  };
}

export class Renderer {
  constructor(canvas, particleSystem) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.particles = particleSystem;
    this.gojoVisual = new GojoVisualSystem();
    this.yutaVisual = new YutaVisualSystem();
    this.sukunaVisual = new GenericVisualSystem("sukuna");
    this.yujiVisual = new YujiVisualSystem();
    this.megumiVisual = new GenericVisualSystem("megumi");
    this.hakariVisual = new GenericVisualSystem("hakari");
    this.domainVisual = new DomainVisualSystem();
    this.map = null;
    this.camera = {
      x: 0,
      y: 0,
      zoom: 1,
    };
    this.zoomTween = {
      startZoom: 1,
      endZoom: 1,
      startTime: 0,
      duration: 0,
    };
    this.zoomSeq = null;
    this.zoomSeqIndex = 0;
    this.zoomSeqTime = 0;

    this.domainOverlayAlpha = 0;
    this.activeDomainOwnerIds = new Set();
    this.playerFacing = new Map();
    this.localVisualPos = null;
    this.dashVisuals = new Map();
    this.dashTweens = new Map();
    this.markers = [];
    this.redExplosions = [];
    this.blueExplosions = [];
    this.purpleCharges = new Map();
    this.purpleExplosions = [];
    this.interpolationRef = null;
    this.hollowPurpleImg = new Image();
    this.hollowPurpleImg.src = "/assets/habilit%20hollow%20purple";
    this.blueImg = new Image();
    this.blueImg.src = "/assets/habilit/blue.png";
    this.redImg = new Image();
    this.redImg.src = "/assets/habilit/red.png";
    this.blackFlashes = [];
    this.blackFlashDuration = 800;
    this.energyRecoverImg = new Image();
    this.energyRecoverImg.src = "/assets/energyrecover/energyspritesheet.png";
    this._erFrames = 19;
    this._erCols = 6;
    this._erFrameW = 136;
    this._erFrameH = 292;
    this._erCanvas = {};
    this._erLastFrame = {};

    this.crawlerExplosions = [];
    this.acidPuddles = [];

    this.monsterSprites = {};
    this.enemyFacing = new Map();
    this._loadMonsterSprite("crawler_nest", "/assets/spritesmonsters/Crawler Nest.png");
    this._loadMonsterSprite("crawler_baby", "/assets/spritesmonsters/Crawler Nest Baby.png");
    this.monsterSprites["fleshmaw"] = new Image();
    this.monsterSprites["fleshmaw"].src = "/assets/spritesmonsters/Fleshmaw.png";
    this.fleshmawAttackFrames = [];
    for (let i = 0; i < 5; i++) {
      const img = new Image();
      img.onerror = () => { console.error(`[MONSTER] Failed to load attack frame: fleshmaw_atk_${i}.png`); };
      img.src = `/assets/spritesmonsters/fleshmaw_atk_${i}.png`;
      this.fleshmawAttackFrames.push(img);
    }
    this.crawlerAttackFrames = [];
    for (let i = 0; i < 18; i++) {
      const img = new Image();
      img.onerror = () => { console.error(`[MONSTER] Failed to load attack frame: crawler_atk_${i}.png`); };
      img.src = `/assets/spritesmonsters/crawler_atk_${i}.png`;
      this.crawlerAttackFrames.push(img);
    }

    this._renderDt = 1 / 60;
    this._lastRenderTime = 0;

    this.resize();
    window.addEventListener("resize", () => this.resize());
  }

  resize() {
    const dpr = window.devicePixelRatio || 1;
    const w = Math.floor(window.innerWidth);
    const h = Math.floor(window.innerHeight);
    this.canvas.width = Math.max(800, Math.floor(w * dpr));
    this.canvas.height = Math.max(450, Math.floor(h * dpr));
    this.canvas.style.width = `${w}px`;
    this.canvas.style.height = `${h}px`;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  _loadMonsterSprite(type, path) {
    const img = new Image();
    img.onload = () => { this.monsterSprites[type] = img; };
    img.onerror = () => { console.error(`[MONSTER] Failed to load: ${path}`); };
    img.src = path;
    if (img.complete) this.monsterSprites[type] = img;
  }

  setMap(map) {
    this.map = map;
    this.camera.x = map.width * 0.5;
    this.camera.y = map.height * 0.5;
    this.localVisualPos = null;
  }

  updateCamera(targetX, targetY, dt = 1 / 60) {
    if (!this.map) {
      return;
    }

    const now = performance.now();
    const elapsed = now - this.zoomTween.startTime;
    if (elapsed < this.zoomTween.duration) {
      const t = elapsed / this.zoomTween.duration;
      this.camera.zoom = this.zoomTween.startZoom + (this.zoomTween.endZoom - this.zoomTween.startZoom) * t;
    } else {
      this.camera.zoom = this.zoomTween.endZoom;
      this.advanceZoomSeq();
    }

    const camAlpha = 1 - Math.pow(1 - 0.12, dt * 60);
    this.camera.x += (targetX - this.camera.x) * camAlpha;
    this.camera.y += (targetY - this.camera.y) * camAlpha;

    const halfW = (this.canvas.clientWidth * 0.5) / this.camera.zoom;
    const halfH = (this.canvas.clientHeight * 0.5) / this.camera.zoom;
    this.camera.x = clamp(this.camera.x, halfW, this.map.width - halfW);
    this.camera.y = clamp(this.camera.y, halfH, this.map.height - halfH);
  }

  startZoom(targetZoom, duration) {
    this.zoomTween.startZoom = this.camera.zoom;
    this.zoomTween.endZoom = targetZoom;
    this.zoomTween.startTime = performance.now();
    this.zoomTween.duration = duration;
  }

  startZoomSeq(steps) {
    this.zoomSeq = steps;
    this.zoomSeqIndex = 0;
    this.zoomSeqTime = performance.now();
    this.startZoom(steps[0].target, steps[0].duration);
  }

  advanceZoomSeq() {
    if (!this.zoomSeq || this.zoomSeqIndex >= this.zoomSeq.length) return;
    const step = this.zoomSeq[this.zoomSeqIndex];
    if (performance.now() - this.zoomSeqTime >= step.duration + step.pause) {
      this.zoomSeqIndex++;
      if (this.zoomSeqIndex < this.zoomSeq.length) {
        const next = this.zoomSeq[this.zoomSeqIndex];
        this.zoomSeqTime = performance.now();
        this.startZoom(next.target, next.duration);
      }
    }
  }

  clear() {
    const ctx = this.ctx;
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;

    const bg = ctx.createLinearGradient(0, 0, w, h);
    bg.addColorStop(0, "#080b13");
    bg.addColorStop(0.55, "#101827");
    bg.addColorStop(1, "#1a2535");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);
  }

  addMarker({ x, y, radius = 60, color = "rgba(255,136,170,0.4)", ttl = 0.8 }) {
    this.markers.push({ x, y, radius, color, ttl, life: ttl });
  }

  addCrawlerExplosion({ x, y, radius = 160, ttl = 0.6 }) {
    this.crawlerExplosions.push({ x, y, radius, ttl, life: ttl, seed: Math.random() * 100 });
  }

  addAcidPuddle({ x, y, radius = 60, duration = 4, dps = 8 }) {
    this.acidPuddles.push({ x, y, radius, ttl: duration, life: duration, dps });
  }

  addRedExplosion({ x, y, radius = 110, ttl = 0.5 }) {
    this.redExplosions.push({ x, y, radius, ttl, life: ttl, seed: Math.random() * 100 });
  }

  addBlueExplosion({ x, y, radius = 200, ttl = 0.6 }) {
    this.blueExplosions.push({ x, y, radius, ttl, life: ttl, seed: Math.random() * 100 });
  }

  triggerBlackFlash(x, y, dirX = 0, dirY = -1) {
    const seed = Math.random() * 10000;
    const bolts = this._generateBolts(x, y, 8, seed, dirX, dirY);
    this.blackFlashes.push({ x, y, dirX, dirY, startTime: performance.now(), bolts, seed });
  }

  _generateBolts(x, y, count, seed, dirX, dirY) {
    const rng = () => {
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280;
    };
    const baseAngle = Math.atan2(dirY, dirX);
    const bolts = [];
    for (let i = 0; i < count; i++) {
      const angle = baseAngle + (rng() - 0.5) * 2.4;
      const len = 120 + rng() * 300;
      const points = [{ x: 0, y: 0 }];
      let cx = 0, cy = 0;
      const segments = 5 + Math.floor(rng() * 5);
      const segLen = len / segments;
      let curAngle = angle;
      for (let s = 0; s < segments; s++) {
        curAngle += (rng() - 0.5) * 0.8;
        cx += Math.cos(curAngle) * segLen;
        cy += Math.sin(curAngle) * segLen;
        points.push({ x: cx, y: cy });
      }
      // Branches
      const branches = [];
      for (let b = 0; b < 2 + Math.floor(rng() * 3); b++) {
        const atSeg = Math.floor(rng() * (segments - 1));
        const bp = points[atSeg];
        const bAngle = curAngle + (rng() - 0.5) * 1.5;
        const bLen = 50 + rng() * 120;
        const bPoints = [{ x: bp.x, y: bp.y }];
        let bcx = bp.x, bcy = bp.y;
        const bSegs = 3 + Math.floor(rng() * 3);
        const bSegLen = bLen / bSegs;
        let ba = bAngle;
        for (let s = 0; s < bSegs; s++) {
          ba += (rng() - 0.5) * 0.6;
          bcx += Math.cos(ba) * bSegLen;
          bcy += Math.sin(ba) * bSegLen;
          bPoints.push({ x: bcx, y: bcy });
        }
        branches.push(bPoints);
      }
      bolts.push({ points, branches, phase: rng() * 0.3 });
    }
    return bolts;
  }

  startPurpleCharge(ev) {
    this.purpleCharges.set(ev.ownerId, {
      x: ev.x,
      y: ev.y,
      startTime: performance.now(),
      duration: 3.5,
    });
  }

  triggerPurpleExplosion(ev) {
    this.purpleCharges.delete(ev.ownerId);
    this.purpleExplosions.push({
      x: ev.x,
      y: ev.y,
      startTime: performance.now(),
      duration: 0.7,
      seed: Math.random() * 100,
    });
  }

  renderPurpleCharges(ctx, camera) {
    const now = performance.now();
    const time = now * 0.001;
    const z = this.camera.zoom || 1;
    this.purpleCharges.forEach((charge) => {
      const progress = Math.min(1, (now - charge.startTime) / (charge.duration * 1000));
      const easeScale = 1 - Math.pow(1 - progress, 2);
      const imgScale = 0.15 + easeScale * 0.95;
      const baseSize = 240 * z;
      const imgSize = baseSize * imgScale;
      const pulse = 1 + Math.sin(time * 3 + charge.x) * 0.04;
      const p = worldToScreen(camera, this.canvas, charge.x, charge.y);

      ctx.save();

      ctx.globalAlpha = 0.4 + easeScale * 0.6;

      if (this.hollowPurpleImg.complete && this.hollowPurpleImg.naturalWidth > 0) {
        ctx.drawImage(this.hollowPurpleImg, p.x - imgSize / 2, p.y - imgSize / 2, imgSize * pulse, imgSize * pulse);
      } else {
        const fallbackGrad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, imgSize * 0.5);
        fallbackGrad.addColorStop(0, `rgba(255,255,255,${0.6 * easeScale})`);
        fallbackGrad.addColorStop(0.3, `rgba(200,130,255,${0.5 * easeScale})`);
        fallbackGrad.addColorStop(0.7, `rgba(120,40,200,${0.3 * easeScale})`);
        fallbackGrad.addColorStop(1, `rgba(60,10,150,0)`);
        ctx.fillStyle = fallbackGrad;
        ctx.beginPath();
        ctx.arc(p.x, p.y, imgSize * 0.5 * pulse, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();
    });
  }

  renderPurpleExplosions(ctx, camera) {
    const now = performance.now();
    const z = this.camera.zoom || 1;
    for (let i = this.purpleExplosions.length - 1; i >= 0; i--) {
      const exp = this.purpleExplosions[i];
      const t = Math.min(1, (now - exp.startTime) / (exp.duration * 1000));
      const alpha = 1 - t;

      if (alpha <= 0) {
        this.purpleExplosions.splice(i, 1);
        continue;
      }

      if (t < 0.05) {
        this.particles.spawnBurst({ x: exp.x, y: exp.y, color: "#ffffff", count: 30, speed: 600, life: 0.5, size: 5 });
        this.particles.spawnBurst({ x: exp.x, y: exp.y, color: "#c080ff", count: 40, speed: 450, life: 0.7, size: 4 });
        this.particles.spawnBurst({ x: exp.x, y: exp.y, color: "#8030cc", count: 25, speed: 300, life: 0.9, size: 3 });
      }

      const p = worldToScreen(camera, this.canvas, exp.x, exp.y);
      const waveRadius = (40 + t * 900) * z;

      ctx.save();
      ctx.globalAlpha = Math.min(1, alpha * 1.3);

      ctx.shadowColor = "#00d4b0";
      ctx.shadowBlur = 100 * alpha * z;

      const flashGrad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, 800 * t * z);
      flashGrad.addColorStop(0, `rgba(0, 230, 190,${alpha * 0.8})`);
      flashGrad.addColorStop(0.1, `rgba(0, 200, 170,${alpha * 0.5})`);
      flashGrad.addColorStop(0.3, `rgba(0, 170, 150,${alpha * 0.2})`);
      flashGrad.addColorStop(0.6, `rgba(120,50,220,${alpha * 0.1})`);
      flashGrad.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = flashGrad;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 800 * t * z, 0, Math.PI * 2);
      ctx.fill();

      ctx.shadowBlur = 80 * alpha * z;
      ctx.strokeStyle = `rgba(255,200,255,${alpha})`;
      ctx.lineWidth = (16 - t * 12) * z;
      ctx.beginPath();
      ctx.arc(p.x, p.y, waveRadius, 0, Math.PI * 2);
      ctx.stroke();

      ctx.shadowBlur = 60 * alpha * z;
      ctx.strokeStyle = `rgba(200,130,255,${alpha * 0.6})`;
      ctx.lineWidth = (8 - t * 6) * z;
      ctx.beginPath();
      ctx.arc(p.x, p.y, waveRadius * 0.85, 0, Math.PI * 2);
      ctx.stroke();

      ctx.shadowBlur = 100 * alpha * z;
      ctx.fillStyle = "#b060ff";
      ctx.beginPath();
      ctx.arc(p.x, p.y, 160 * (1 - t * 0.5) * z, 0, Math.PI * 2);
      ctx.fill();

      ctx.shadowBlur = 0;
      ctx.restore();
    }
  }

  onDomainStart(ev) {
    this.domainVisual.onDomainStart(ev);
    this.startZoomSeq([
      { target: 1.4, duration: 300, pause: 500 },
      { target: 1.2, duration: 300, pause: 0 },
    ]);
  }

  onDomainCollapse(ev) {
    this.domainVisual.onDomainCollapse(ev);
    this.zoomSeq = null;
    this.startZoom(1, 400);
  }

  getVisualForPlayer(character) {
    switch (character) {
      case "yuta": return this.yutaVisual;
      case "sukuna": return this.sukunaVisual;
      case "yuji": return this.yujiVisual;
      case "megumi": return this.megumiVisual;
      case "hakari": return this.hakariVisual;
      default: return this.gojoVisual;
    }
  }

  triggerDash(playerId, ev, startX, startY) {
    this.dashVisuals.set(playerId, performance.now() + 220);
    this.dashTweens.set(playerId, {
      startX: startX,
      startY: startY,
      endX: ev.x,
      endY: ev.y,
      startTime: performance.now(),
      duration: 200,
    });
  }

  updateEffects(dt) {
    this.gojoVisual.update(dt);
    this.yutaVisual.update(dt);
    this.sukunaVisual.update(dt);
    this.yujiVisual.update(dt);
    this.megumiVisual.update(dt);
    this.hakariVisual.update(dt);
    this.domainVisual.update(dt);
    const now = performance.now();
    this.dashVisuals.forEach((expiry, id) => {
      if (now > expiry) this.dashVisuals.delete(id);
    });
    this.dashTweens.forEach((tw, id) => {
      if (now > tw.startTime + tw.duration) {
        this.dashTweens.delete(id);
        const entry = this.interpolationRef?.players.get(id);
        if (entry) {
          entry.x = tw.endX;
          entry.y = tw.endY;
          entry.tx = tw.endX;
          entry.ty = tw.endY;
        }
      }
    });
    this.purpleCharges.forEach((charge, id) => {
      if (now > charge.startTime + charge.duration * 1000) this.purpleCharges.delete(id);
    });
    for (let i = this.markers.length - 1; i >= 0; i -= 1) {
      const m = this.markers[i];
      m.life -= dt;
      if (m.life <= 0) {
        this.markers.splice(i, 1);
      }
    }
    for (let i = this.redExplosions.length - 1; i >= 0; i -= 1) {
      const e = this.redExplosions[i];
      e.life -= dt;
      if (e.life <= 0) {
        this.redExplosions.splice(i, 1);
      }
    }
    for (let i = this.blueExplosions.length - 1; i >= 0; i -= 1) {
      const e = this.blueExplosions[i];
      e.life -= dt;
      if (e.life <= 0) {
      this.blueExplosions.splice(i, 1);
    }
    }
    for (let i = this.blackFlashes.length - 1; i >= 0; i -= 1) {
      const bf = this.blackFlashes[i];
      const elapsed = performance.now() - bf.startTime;
      if (elapsed >= this.blackFlashDuration) {
        this.blackFlashes.splice(i, 1);
      }
    }
    for (let i = this.crawlerExplosions.length - 1; i >= 0; i -= 1) {
      const e = this.crawlerExplosions[i];
      e.life -= dt;
      if (e.life <= 0) this.crawlerExplosions.splice(i, 1);
    }
    for (let i = this.acidPuddles.length - 1; i >= 0; i -= 1) {
      const p = this.acidPuddles[i];
      p.life -= dt;
      if (p.life <= 0) this.acidPuddles.splice(i, 1);
    }
  }

  drawCrawlerExplosions() {
    const ctx = this.ctx;
    const now = Date.now();
    for (let i = 0; i < this.crawlerExplosions.length; i += 1) {
      const e = this.crawlerExplosions[i];
      const p = worldToScreen(this.camera, this.canvas, e.x, e.y);
      const t = e.life / e.ttl;
      const s = e.seed;
      const z = this.camera.zoom || 1;

      ctx.save();

      const coreSize = e.radius * 0.2 * (1 - t * 0.5) * z;
      const coreGrad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, coreSize);
      coreGrad.addColorStop(0, `rgba(200,255,200,${t * 0.9})`);
      coreGrad.addColorStop(0.3, `rgba(80,255,100,${t * 0.6})`);
      coreGrad.addColorStop(0.7, `rgba(30,180,50,${t * 0.3})`);
      coreGrad.addColorStop(1, "rgba(0,80,0,0)");
      ctx.shadowColor = "#40ff60";
      ctx.shadowBlur = 30 * t * z;
      ctx.fillStyle = coreGrad;
      ctx.beginPath();
      ctx.arc(p.x, p.y, coreSize, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;

      const ringR = e.radius * (0.3 + (1 - t) * 0.7) * z;
      ctx.strokeStyle = `rgba(80,255,120,${t * 0.4})`;
      ctx.lineWidth = 3 * t * z;
      ctx.beginPath();
      ctx.arc(p.x, p.y, ringR, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = `rgba(200,255,200,${t * 0.2})`;
      ctx.lineWidth = 1.5 * t * z;
      ctx.beginPath();
      ctx.arc(p.x, p.y, ringR * 1.15, 0, Math.PI * 2);
      ctx.stroke();

      const dropCount = 6 + Math.floor(t * 4);
      for (let d = 0; d < dropCount; d++) {
        const angle = (d / dropCount) * Math.PI * 2 + Math.sin(s + d * 1.7) * 0.3 + (1 - t) * 0.5;
        const dist = e.radius * (0.2 + (1 - t) * 0.8) * (0.6 + Math.sin(s + d * 2.3) * 0.4) * z;
        const dx = p.x + Math.cos(angle) * dist;
        const dy = p.y + Math.sin(angle) * dist;
        const dropSize = 3 * (0.3 + t * 0.7) * z;
        ctx.fillStyle = `rgba(100,255,120,${t * 0.7})`;
        ctx.beginPath();
        ctx.arc(dx, dy, dropSize, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();
    }
  }

  drawAcidPuddles() {
    const ctx = this.ctx;
    const now = Date.now();
    for (let i = 0; i < this.acidPuddles.length; i += 1) {
      const puddle = this.acidPuddles[i];
      const p = worldToScreen(this.camera, this.canvas, puddle.x, puddle.y);
      const t = puddle.life / puddle.ttl;
      const z = this.camera.zoom || 1;

      ctx.save();

      const gradR = puddle.radius * z;
      const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, gradR);
      grad.addColorStop(0, `rgba(80,255,100,${0.3 * t})`);
      grad.addColorStop(0.5, `rgba(40,200,60,${0.2 * t})`);
      grad.addColorStop(1, `rgba(0,80,0,0)`);
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(p.x, p.y, gradR, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = `rgba(100,255,120,${0.3 * t})`;
      ctx.lineWidth = 2 * z;
      ctx.beginPath();
      ctx.arc(p.x, p.y, puddle.radius * (0.95 + Math.sin(now * 0.003 + i) * 0.05) * z, 0, Math.PI * 2);
      ctx.stroke();

      const bubbleCount = 3 + Math.floor(Math.sin(now * 0.002 + i * 2.3) * 2 + 3);
      for (let b = 0; b < bubbleCount; b++) {
        const bAngle = (b / bubbleCount) * Math.PI * 2 + now * 0.001;
        const bDist = puddle.radius * (0.3 + Math.sin(now * 0.004 + b * 1.7 + i) * 0.3) * z;
        const bx = p.x + Math.cos(bAngle) * bDist;
        const by = p.y + Math.sin(bAngle) * bDist;
        const bSize = (2 + Math.sin(now * 0.005 + b * 2.1) * 1) * z;
        ctx.fillStyle = `rgba(150,255,170,${0.4 * t})`;
        ctx.beginPath();
        ctx.arc(bx, by, bSize, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();
    }
  }

  clearEffects() {
    this.markers = [];
    this.redExplosions = [];
    this.blueExplosions = [];
    this.purpleExplosions = [];
    this.blackFlashes = [];
    this.crawlerExplosions = [];
    this.acidPuddles = [];
    this.gojoVisual.m1Slashes = [];
    this.gojoVisual.effects.projectiles = [];
    this.gojoVisual.effects.beams = [];
    this.gojoVisual.effects.explosions = [];
    this.gojoVisual.effects.teleports = [];
    this.gojoVisual.effects.afterimages = [];
    this.yujiVisual.flyingKneeEffects = [];
    this.yujiVisual.soulImpactEffects = [];
    this.yujiVisual.taidoBeatdownEffects = [];
    this.yutaVisual.rikaAttacks = [];
    this.yutaVisual.rikaHeavyImpacts = [];
    this.yutaVisual.beamParticles = [];
    this.yutaVisual.dashSlashes = [];
    this.yutaVisual.slashCuts = [];
    this.yutaVisual.rikaImpulses = [];
    this.yutaVisual.rikaDashes = [];
    this.yutaVisual.effects.pureLoves = [];
    this.yutaVisual.effects.katanaSlashes = [];
    this.yutaVisual.effects.rikas = new Map();
    this.domainVisual.shattering = [];
  }

  drawMarkers() {
    const ctx = this.ctx;
    const z = this.camera.zoom || 1;
    for (let i = 0; i < this.markers.length; i += 1) {
      const marker = this.markers[i];
      const p = worldToScreen(this.camera, this.canvas, marker.x, marker.y);
      const t = marker.life / marker.ttl;
      ctx.save();
      ctx.strokeStyle = marker.color;
      ctx.lineWidth = (2 + (1 - t) * 2) * z;
      ctx.globalAlpha = Math.max(0.08, t);
      ctx.beginPath();
      ctx.arc(p.x, p.y, marker.radius * (0.92 + (1 - t) * 0.15) * z, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }

  drawRedExplosions() {
    const ctx = this.ctx;
    const now = Date.now();
    for (let i = 0; i < this.redExplosions.length; i += 1) {
      const e = this.redExplosions[i];
      const p = worldToScreen(this.camera, this.canvas, e.x, e.y);
      const t = e.life / e.ttl;
      const s = e.seed;
      const z = this.camera.zoom || 1;

      ctx.save();

      const coreSize = e.radius * 0.25 * (1 - t * 0.5) * z;
      const coreGrad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, coreSize);
      coreGrad.addColorStop(0, `rgba(255,255,255,${t * 0.95})`);
      coreGrad.addColorStop(0.3, `rgba(255,200,200,${t * 0.6})`);
      coreGrad.addColorStop(0.7, `rgba(255,50,80,${t * 0.3})`);
      coreGrad.addColorStop(1, "rgba(255,0,50,0)");
      ctx.shadowColor = "#ff2040";
      ctx.shadowBlur = 40 * t * z;
      ctx.fillStyle = coreGrad;
      ctx.beginPath();
      ctx.arc(p.x, p.y, coreSize, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;

      const shockwaveRadius = e.radius * (0.3 + (1 - t) * 0.7) * z;
      ctx.strokeStyle = `rgba(255,80,110,${t * 0.4})`;
      ctx.lineWidth = 3 * t * z;
      ctx.beginPath();
      ctx.arc(p.x, p.y, shockwaveRadius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = `rgba(255,200,220,${t * 0.2})`;
      ctx.lineWidth = 1.5 * t * z;
      ctx.beginPath();
      ctx.arc(p.x, p.y, shockwaveRadius * 1.15, 0, Math.PI * 2);
      ctx.stroke();

      const fragCount = 8 + Math.floor(t * 4);
      for (let f = 0; f < fragCount; f++) {
        const angle = (f / fragCount) * Math.PI * 2 + Math.sin(s + f * 1.7) * 0.3 + (1 - t) * 0.5;
        const fragDist = e.radius * (0.2 + (1 - t) * 0.8) * (0.6 + Math.sin(s + f * 2.3) * 0.4) * z;
        const fx = p.x + Math.cos(angle) * fragDist;
        const fy = p.y + Math.sin(angle) * fragDist;
        const fragSize = 4 * (0.3 + t * 0.7) * (0.5 + Math.sin(s + f * 1.1) * 0.5) * z;
        const fragAngle = angle + t * 2 + f;
        const darkVal = Math.floor(20 + (1 - t) * 40);
        ctx.fillStyle = `rgba(${200 - (1 - t) * 150},${darkVal},${darkVal * 0.5},${t * 0.8})`;
        ctx.save();
        ctx.translate(fx, fy);
        ctx.rotate(fragAngle);
        ctx.fillRect(-fragSize * 0.5, -fragSize * 0.5, fragSize, fragSize);
        ctx.restore();
        const rimX = fx + Math.cos(angle) * fragSize * 0.3;
        const rimY = fy + Math.sin(angle) * fragSize * 0.3;
        ctx.strokeStyle = `rgba(255,100,130,${t * 0.5})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(rimX - fragSize * 0.2, rimY - fragSize * 0.2);
        ctx.lineTo(rimX + fragSize * 0.2, rimY + fragSize * 0.2);
        ctx.stroke();
      }

      const lineCount = 5 + Math.floor(t * 3);
      for (let l = 0; l < lineCount; l++) {
        const angle = (l / lineCount) * Math.PI * 2 + (1 - t) * 0.8 + Math.sin(s + l * 1.3) * 0.2;
        const len = e.radius * (0.4 + (1 - t) * 0.8) * (0.7 + Math.sin(s + l * 2.1) * 0.3) * z;
        const lx = Math.cos(angle) * len;
        const ly = Math.sin(angle) * len;
        ctx.strokeStyle = `rgba(255,255,255,${t * 0.3 * (1 - l / lineCount)})`;
      ctx.lineWidth = 1.5 * t * z;
        ctx.beginPath();
        ctx.moveTo(p.x + lx * 0.1, p.y + ly * 0.1);
        ctx.lineTo(p.x + lx, p.y + ly);
        ctx.stroke();
      }

      for (let l = 0; l < 3; l++) {
        const angle = (l / 3) * Math.PI * 2 + (1 - t) * 1.2 + Math.sin(s + l * 1.7) * 0.3;
        const len = e.radius * (0.3 + (1 - t) * 0.6) * (0.5 + Math.sin(s + l * 2.5) * 0.5) * z;
        const lx = Math.cos(angle) * len;
        const ly = Math.sin(angle) * len;
        ctx.strokeStyle = `rgba(0,0,0,${t * 0.4})`;
        ctx.lineWidth = 2 * t * z;
        ctx.beginPath();
        ctx.moveTo(p.x + lx * 0.2, p.y + ly * 0.2);
        ctx.lineTo(p.x + lx, p.y + ly);
        ctx.stroke();
      }

      ctx.restore();
    }
  }

  drawBlueExplosions() {
    const ctx = this.ctx;
    const z = this.camera.zoom || 1;
    for (let i = 0; i < this.blueExplosions.length; i += 1) {
      const e = this.blueExplosions[i];
      const p = worldToScreen(this.camera, this.canvas, e.x, e.y);
      const t = e.life / e.ttl;
      const s = e.seed;

      ctx.save();

      const a = Math.min(t * 2.5, 1) * (1 - Math.max(0, t - 0.85) * 6);

      const ringR = e.radius * 0.8 * (0.05 + t * 0.95) * z;

      ctx.shadowColor = "#66ccff";
      ctx.shadowBlur = 40 * a * z;
      ctx.strokeStyle = `rgba(150,220,255,${0.7 * a})`;
      ctx.lineWidth = (5 - t * 3) * z;
      ctx.beginPath();
      ctx.arc(p.x, p.y, ringR + 4 * z, 0, Math.PI * 2);
      ctx.stroke();

      ctx.shadowBlur = 15 * a * z;
      ctx.strokeStyle = `rgba(200,235,255,${0.5 * a})`;
      ctx.lineWidth = (2 + t * 2) * z;
      ctx.beginPath();
      ctx.arc(p.x, p.y, ringR, 0, Math.PI * 2);
      ctx.stroke();

      ctx.shadowBlur = 0;
      const gradR = Math.max(ringR * 1.4, 10 * z);
      const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, gradR);
      grad.addColorStop(0, `rgba(150,220,255,${0.6 * a})`);
      grad.addColorStop(0.3, `rgba(80,170,240,${0.5 * a})`);
      grad.addColorStop(0.7, `rgba(20,60,140,${0.2 * a})`);
      grad.addColorStop(1, `rgba(5,15,50,0)`);
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(p.x, p.y, gradR, 0, Math.PI * 2);
      ctx.fill();

      const streakCount = 8;
      for (let j = 0; j < streakCount; j++) {
        const angle = (j / streakCount) * Math.PI * 2 + s * 0.1 + t * 0.4;
        const outer = ringR * 1.5;
        const inner = ringR * 0.1;
        ctx.strokeStyle = `rgba(170,225,255,${0.25 * a})`;
        ctx.lineWidth = (2.5 - t * 1.5) * z;
        ctx.beginPath();
        ctx.moveTo(p.x + Math.cos(angle) * outer, p.y + Math.sin(angle) * outer);
        ctx.lineTo(p.x + Math.cos(angle) * inner, p.y + Math.sin(angle) * inner);
        ctx.stroke();
      }

      const pullCount = 6;
      for (let j = 0; j < pullCount; j++) {
        const angle = (j / pullCount) * Math.PI * 2 + Math.sin(s + j * 1.7) * 0.5 + t * 0.6;
        const dist = ringR * (0.4 + t * 0.8) * (0.4 + Math.sin(s + j * 2.3) * 0.3);
        const px = p.x + Math.cos(angle) * dist;
        const py = p.y + Math.sin(angle) * dist;
        const sz = (2 + (1 - t) * 2.5) * z;
        ctx.fillStyle = `rgba(190,235,255,${0.5 * a})`;
        ctx.beginPath();
        ctx.arc(px, py, sz, 0, Math.PI * 2);
        ctx.fill();
      }

      if (t < 0.35) {
        const flashT = t / 0.35;
        const flashA = (1 - flashT) * 0.6;
        ctx.shadowColor = "#88ddff";
        ctx.shadowBlur = 60 * flashA * z;
        ctx.fillStyle = `rgba(200,240,255,${flashA})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, (8 - flashT * 6) * z, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();
    }
  }

  drawBlackFlashes() {
    const ctx = this.ctx;
    const z = this.camera.zoom || 1;
    const now = performance.now();

    for (let i = 0; i < this.blackFlashes.length; i += 1) {
      const bf = this.blackFlashes[i];
      const p = worldToScreen(this.camera, this.canvas, bf.x, bf.y);
      const elapsed = now - bf.startTime;
      const t = Math.min(1, elapsed / this.blackFlashDuration);
      if (t >= 1) return;

      const alpha = Math.min(1, (1 - t) * 2);

      ctx.save();
      ctx.globalAlpha = alpha;

      // Red shockwave ring (0-30% of animation)
      if (t < 0.3) {
        const swT = t / 0.3;
        const radius = 20 + swT * 100;
        const swAlpha = (1 - swT) * 0.8;

        // Offset shockwave in attack direction
        const dirLen = Math.sqrt(bf.dirX * bf.dirX + bf.dirY * bf.dirY) || 1;
        const nx = bf.dirX / dirLen;
        const ny = bf.dirY / dirLen;
        const offset = 15 * swT;
        const sx = p.x + nx * offset * z;
        const sy = p.y + ny * offset * z;

        // Outer ring with red glow
        ctx.shadowColor = "#ff0000";
        ctx.shadowBlur = 35 * z;
        ctx.strokeStyle = `rgba(255,0,0,${swAlpha * 0.7})`;
        ctx.lineWidth = 4 * z;
        ctx.beginPath();
        ctx.arc(sx, sy, radius * z, 0, Math.PI * 2);
        ctx.stroke();

        // Inner ring (brighter)
        ctx.shadowBlur = 20 * z;
        ctx.strokeStyle = `rgba(255,80,20,${swAlpha * 0.5})`;
        ctx.lineWidth = 2 * z;
        ctx.beginPath();
        ctx.arc(sx, sy, (radius * 0.7) * z, 0, Math.PI * 2);
        ctx.stroke();

        // Core flash
        ctx.shadowColor = "#ff2200";
        ctx.shadowBlur = 50 * z;
        const coreGrad = ctx.createRadialGradient(sx, sy, 0, sx, sy, (25 + swT * 15) * z);
        coreGrad.addColorStop(0, `rgba(255,255,255,${(1 - swT) * 0.9})`);
        coreGrad.addColorStop(0.4, `rgba(255,50,0,${(1 - swT) * 0.5})`);
        coreGrad.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = coreGrad;
        ctx.beginPath();
        ctx.arc(sx, sy, (25 + swT * 15) * z, 0, Math.PI * 2);
        ctx.fill();
      }

      // Lightning bolts (0-80% of animation)
      if (t < 0.8) {
      const boltT = Math.min(1, t * 2.5);
      const bolts = bf.bolts;
      for (let b = 0; b < bolts.length; b++) {
        const bolt = bolts[b];
        const delay = bolt.phase;
        const localT = Math.max(0, Math.min(1, (t - delay * 0.3) * 3));
        if (localT <= 0) continue;

        const drawBolt = (points, wGlow, wBlack) => {
          if (points.length < 2) return;
          const totalLen = points.reduce((a, pt, idx) => {
            if (idx === 0) return 0;
            const prev = points[idx - 1];
            return a + Math.sqrt((pt.x - prev.x) ** 2 + (pt.y - prev.y) ** 2);
          }, 0);
          const drawLen = totalLen * localT;

          // Pass 1: red glow / border
          ctx.shadowColor = "#ff0000";
          ctx.shadowBlur = 22 * z;
          ctx.strokeStyle = "rgba(255,0,0,0.7)";
          ctx.lineWidth = wGlow * z;
          ctx.beginPath();
          ctx.moveTo(p.x + points[0].x, p.y + points[0].y);
          let acc = 0;
          for (let pi = 1; pi < points.length; pi++) {
            const prev = points[pi - 1];
            const seg = Math.sqrt((points[pi].x - prev.x) ** 2 + (points[pi].y - prev.y) ** 2);
            if (acc + seg >= drawLen) {
              const frac = (drawLen - acc) / seg;
              ctx.lineTo(p.x + prev.x + (points[pi].x - prev.x) * frac, p.y + prev.y + (points[pi].y - prev.y) * frac);
              break;
            }
            ctx.lineTo(p.x + points[pi].x, p.y + points[pi].y);
            acc += seg;
          }
          ctx.stroke();

          // Pass 2: black core
          ctx.shadowBlur = 0;
          ctx.strokeStyle = "rgba(0,0,0,0.6)";
          ctx.lineWidth = wBlack * z;
          ctx.beginPath();
          ctx.moveTo(p.x + points[0].x, p.y + points[0].y);
          acc = 0;
          for (let pi = 1; pi < points.length; pi++) {
            const prev = points[pi - 1];
            const seg = Math.sqrt((points[pi].x - prev.x) ** 2 + (points[pi].y - prev.y) ** 2);
            if (acc + seg >= drawLen) {
              const frac = (drawLen - acc) / seg;
              ctx.lineTo(p.x + prev.x + (points[pi].x - prev.x) * frac, p.y + prev.y + (points[pi].y - prev.y) * frac);
              break;
            }
            ctx.lineTo(p.x + points[pi].x, p.y + points[pi].y);
            acc += seg;
          }
          ctx.stroke();
        };

        // Main bolt: glow thickness 4 → 2, black core 1.5 → 1
        drawBolt(bolt.points, 4 - localT * 2, 1.5 - localT * 0.5);

        // Branches: thinner
        for (let br = 0; br < bolt.branches.length; br++) {
          const branchT = Math.max(0, Math.min(1, (t - delay * 0.3 - 0.05) * 3.5));
          if (branchT <= 0) continue;
          const drawBoltBr = (points) => {
            if (points.length < 2) return;
            const totalLen = points.reduce((a, pt, idx) => {
              if (idx === 0) return 0;
              const prev = points[idx - 1];
              return a + Math.sqrt((pt.x - prev.x) ** 2 + (pt.y - prev.y) ** 2);
            }, 0);
            const drawLen = totalLen * branchT;

            ctx.shadowColor = "#ff0000";
            ctx.shadowBlur = 14 * z;
            ctx.strokeStyle = "rgba(255,0,0,0.5)";
            ctx.lineWidth = 2.5 * z;
            ctx.beginPath();
            ctx.moveTo(p.x + points[0].x, p.y + points[0].y);
            let acc = 0;
            for (let pi = 1; pi < points.length; pi++) {
              const prev = points[pi - 1];
              const seg = Math.sqrt((points[pi].x - prev.x) ** 2 + (points[pi].y - prev.y) ** 2);
              if (acc + seg >= drawLen) {
                const frac = (drawLen - acc) / seg;
                ctx.lineTo(p.x + prev.x + (points[pi].x - prev.x) * frac, p.y + prev.y + (points[pi].y - prev.y) * frac);
                break;
              }
              ctx.lineTo(p.x + points[pi].x, p.y + points[pi].y);
              acc += seg;
            }
            ctx.stroke();

            ctx.shadowBlur = 0;
            ctx.strokeStyle = "rgba(0,0,0,0.6)";
            ctx.lineWidth = 1 * z;
            ctx.beginPath();
            ctx.moveTo(p.x + points[0].x, p.y + points[0].y);
            acc = 0;
            for (let pi = 1; pi < points.length; pi++) {
              const prev = points[pi - 1];
              const seg = Math.sqrt((points[pi].x - prev.x) ** 2 + (points[pi].y - prev.y) ** 2);
              if (acc + seg >= drawLen) {
                const frac = (drawLen - acc) / seg;
                ctx.lineTo(p.x + prev.x + (points[pi].x - prev.x) * frac, p.y + prev.y + (points[pi].y - prev.y) * frac);
                break;
              }
              ctx.lineTo(p.x + points[pi].x, p.y + points[pi].y);
              acc += seg;
            }
            ctx.stroke();
          };
          drawBoltBr(bolt.branches[br]);
        }
      }
      }

      ctx.shadowBlur = 0;
      ctx.restore();
    }
  }

  drawGrid() {
    const ctx = this.ctx;
    const cell = 70;
    const zoom = this.camera.zoom || 1;
    const cellScreen = cell * zoom;
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    const offsetX = -((this.camera.x - w * 0.5 / zoom) % cell) * zoom;
    const offsetY = -((this.camera.y - h * 0.5 / zoom) % cell) * zoom;

    ctx.strokeStyle = "rgba(120,150,210,0.06)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = offsetX; x < w; x += cellScreen) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
    }
    for (let y = offsetY; y < h; y += cellScreen) {
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
    }
    ctx.stroke();
  }

  drawWorld() {
    if (!this.map) {
      return;
    }

    const ctx = this.ctx;
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    const zoom = this.camera.zoom || 1;

    this.drawGrid();

    this.map.disputeZones.forEach((zone) => {
      const p = worldToScreen(this.camera, this.canvas, zone.x, zone.y);
      ctx.strokeStyle = "rgba(95,148,255,0.2)";
      ctx.fillStyle = "rgba(50,80,140,0.08)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(p.x, p.y, zone.radius * zoom, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    });

    this.map.hazards.forEach((hazard) => {
      const p = worldToScreen(this.camera, this.canvas, hazard.x, hazard.y);
      const pulse = 0.7 + Math.sin(Date.now() * 0.005 + hazard.x) * 0.15;
      ctx.fillStyle = `rgba(220,58,72,${0.12 * pulse})`;
      ctx.strokeStyle = "rgba(255,98,116,0.34)";
      ctx.beginPath();
      ctx.arc(p.x, p.y, hazard.radius * zoom, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    });

    this.map.obstacles.forEach((obs) => {
      const p = worldToScreen(this.camera, this.canvas, obs.x, obs.y);
      ctx.fillStyle = "rgba(20,26,38,0.95)";
      ctx.strokeStyle = "rgba(115,140,185,0.25)";
      ctx.lineWidth = 2;
      ctx.fillRect(p.x, p.y, obs.w * zoom, obs.h * zoom);
      ctx.strokeRect(p.x + 0.5, p.y + 0.5, obs.w * zoom - 1, obs.h * zoom - 1);
    });

    const topLeft = worldToScreen(this.camera, this.canvas, 0, 0);
    ctx.strokeStyle = "rgba(170,200,255,0.2)";
    ctx.lineWidth = 3;
    ctx.strokeRect(topLeft.x, topLeft.y, this.map.width * zoom, this.map.height * zoom);

    if (w && h) {
      ctx.fillStyle = "rgba(0,0,0,0.07)";
      ctx.fillRect(0, 0, w, h);
    }
  }

  drawDomains(domains, youId, you, localPred) {
    const ctx = this.ctx;
    const now = Date.now();
    let insideDomain = false;
    const activeOwnerIds = new Set();
    const z = this.camera.zoom || 1;

    domains.forEach((entry) => {
      const d = entry.raw;
      const ownerId = d.ownerId;
      activeOwnerIds.add(ownerId);

      const p = worldToScreen(this.camera, this.canvas, entry.x, entry.y);
      const isMine = ownerId === youId;

      const targetR = d.radius;
      const currentR = this.domainVisual.getCurrentRadius(ownerId, targetR);
      const expandProgress = this.domainVisual.getExpandProgress(ownerId);
      const expandAlpha = Math.min(1, expandProgress * 1.5);
      const vz = currentR * z;

      if (currentR < 2) return;

      let char;
      try {
        char = this.domainVisual.getCharacter(ownerId);
      } catch (e) {
        console.error("getCharacter failed:", e);
        char = "gojo";
      }
      try {
        this.domainVisual.renderParallax(ctx, this.camera, ownerId, char, entry.x, entry.y, p, vz, z, expandProgress, isMine, now);
      } catch (e) {
        console.error("renderParallax call failed:", e);
      }

      ctx.save();
      ctx.globalAlpha = expandAlpha;
      ctx.shadowColor = isMine ? "#88ccff" : "#cc80ff";
      ctx.shadowBlur = 30 * expandAlpha * z;
      ctx.strokeStyle = isMine ? "rgba(180,220,255,0.95)" : "rgba(220,180,255,0.95)";
      ctx.lineWidth = 4 * z;
      ctx.beginPath();
      ctx.arc(p.x, p.y, vz, 0, Math.PI * 2);
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = isMine ? "rgba(255,255,255,0.5)" : "rgba(255,220,255,0.5)";
      ctx.lineWidth = 1.5 * z;
      ctx.beginPath();
      ctx.arc(p.x, p.y, vz - 3 * z, 0, Math.PI * 2);
      ctx.stroke();

      if (d.barrierMaxHp > 0) {
        const barrierPct = d.barrierHp / d.barrierMaxHp;
        if (barrierPct < 1) {
          this.drawDomainCracks(ctx, p.x, p.y, vz, barrierPct, isMine);
        }
      }

      if (char !== 'yuta') {
        for (let i = 0; i < 12; i++) {
          const a = (i / 12) * Math.PI * 2 + now * 0.001;
          const rx = p.x + Math.cos(a) * vz;
          const ry = p.y + Math.sin(a) * vz;
          ctx.fillStyle = isMine ? "rgba(220,240,255,0.8)" : "rgba(240,200,255,0.8)";
          ctx.beginPath();
          ctx.arc(rx, ry, 3 * z, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.restore();

      const cx = localPred ? localPred.x : (you ? you.x : 0);
      const cy = localPred ? localPred.y : (you ? you.y : 0);
      const ddx = cx - entry.x;
      const ddy = cy - entry.y;
      if (ddx * ddx + ddy * ddy <= d.radius * d.radius) {
        insideDomain = true;
      }
    });

    this.domainVisual.renderShards(ctx, this.camera, this.canvas);

    this.domainVisual.cleanupExpanding(activeOwnerIds);

    const alphaLerp = 1 - Math.pow(1 - 0.08, this._renderDt * 60);
    this.domainOverlayAlpha += ((insideDomain ? 1 : 0) - this.domainOverlayAlpha) * alphaLerp;
    if (this.domainOverlayAlpha > 0.01) {
      ctx.fillStyle = `rgba(5,10,30,${0.12 * this.domainOverlayAlpha})`;
      ctx.fillRect(0, 0, this.canvas.clientWidth, this.canvas.clientHeight);
    }
  }

  drawDomainCracks(ctx, cx, cy, radius, hpPct, isMine) {
    const z = this.camera.zoom || 1;
    const crackCount = Math.floor((1 - hpPct) * 12) + 2;
    const color = isMine ? "rgba(255,255,255,0.4)" : "rgba(255,200,220,0.4)";
    const inner = radius * 0.92;
    const outer = radius * 1.02;

    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = (1.5 + (1 - hpPct) * 2) * z;

    for (let i = 0; i < crackCount; i++) {
      const seed = i * 47.11;
      const angle = ((seed * 137.5) % 360) * Math.PI / 180;
      const segments = 3 + Math.floor((1 - hpPct) * 4);
      let lastX = cx + Math.cos(angle) * (inner + Math.random() * (outer - inner));
      let lastY = cy + Math.sin(angle) * (inner + Math.random() * (outer - inner));
      ctx.beginPath();
      ctx.moveTo(lastX, lastY);
      for (let j = 0; j < segments; j++) {
        const spread = 0.3 + (1 - hpPct) * 0.5;
        const aOff = (Math.random() - 0.5) * spread;
        const rOff = (j / segments) * (radius * 0.15 * (1 - hpPct));
        const nx = cx + Math.cos(angle + aOff) * (inner + (outer - inner) * ((j + 1) / segments) + rOff);
        const ny = cy + Math.sin(angle + aOff) * (inner + (outer - inner) * ((j + 1) / segments) + rOff);
        ctx.lineTo(nx, ny);
      }
      ctx.stroke();
    }
    ctx.restore();
  }

  drawProjectiles(projectiles) {
    const ctx = this.ctx;
    const now = Date.now();
    const zoom = this.camera.zoom || 1;
    projectiles.forEach((entry) => {
      const p = entry.raw;
      const screen = worldToScreen(this.camera, this.canvas, entry.x, entry.y);

      if (p.type === "purple") {
        const sphereR = Math.max(10 * zoom, p.width * 0.55 * zoom);
        const px = screen.x;
        const py = screen.y;
        const pulse = 1 + Math.sin(now * 0.003) * 0.03;

        ctx.save();

        ctx.shadowColor = "#00d4b0";
        ctx.shadowBlur = 65;
        const bgGrad = ctx.createRadialGradient(px, py, 0, px, py, sphereR * pulse * 2);
        bgGrad.addColorStop(0, "rgba(0,230,190,0.15)");
        bgGrad.addColorStop(0.15, "rgba(0,200,170,0.12)");
        bgGrad.addColorStop(0.4, "rgba(0,170,150,0.08)");
        bgGrad.addColorStop(0.7, "rgba(0,140,130,0.04)");
        bgGrad.addColorStop(1, "rgba(60,10,150,0)");
        ctx.fillStyle = bgGrad;
        ctx.beginPath();
        ctx.arc(px, py, sphereR * pulse * 2, 0, Math.PI * 2);
        ctx.fill();

        ctx.shadowBlur = 0;

        const smokeGrad = ctx.createRadialGradient(px, py, 0, px, py, sphereR * pulse * 1.6);
        smokeGrad.addColorStop(0, "rgba(255,235,255,0.5)");
        smokeGrad.addColorStop(0.12, "rgba(230,200,255,0.35)");
        smokeGrad.addColorStop(0.3, "rgba(180,130,255,0.25)");
        smokeGrad.addColorStop(0.55, "rgba(130,70,230,0.15)");
        smokeGrad.addColorStop(0.8, "rgba(90,40,190,0.06)");
        smokeGrad.addColorStop(1, "rgba(60,15,150,0)");
        ctx.fillStyle = smokeGrad;
        ctx.beginPath();
        ctx.arc(px, py, sphereR * pulse * 1.6, 0, Math.PI * 2);
        ctx.fill();

        const innerGrad = ctx.createRadialGradient(px, py, 0, px, py, sphereR * pulse);
        innerGrad.addColorStop(0, "rgba(255,255,255,0.7)");
        innerGrad.addColorStop(0.2, "rgba(240,220,255,0.35)");
        innerGrad.addColorStop(0.5, "rgba(200,160,255,0.12)");
        innerGrad.addColorStop(1, "rgba(160,100,240,0)");
        ctx.fillStyle = innerGrad;
        ctx.beginPath();
        ctx.arc(px, py, sphereR * pulse, 0, Math.PI * 2);
        ctx.fill();

        ctx.shadowBlur = 50;
        const spriteSize = sphereR * 2.3 * pulse;
        if (this.hollowPurpleImg.complete && this.hollowPurpleImg.naturalWidth > 0) {
          ctx.drawImage(this.hollowPurpleImg, px - spriteSize / 2, py - spriteSize / 2, spriteSize, spriteSize);
        } else {
          ctx.shadowBlur = 30;
          const fallbackGrad = ctx.createRadialGradient(px, py, 0, px, py, spriteSize * 0.5);
          fallbackGrad.addColorStop(0, "rgba(255,255,255,0.7)");
          fallbackGrad.addColorStop(0.3, "rgba(200,130,255,0.5)");
          fallbackGrad.addColorStop(0.7, "rgba(120,40,200,0.2)");
          fallbackGrad.addColorStop(1, "rgba(60,10,150,0)");
          ctx.fillStyle = fallbackGrad;
          ctx.beginPath();
          ctx.arc(px, py, spriteSize * 0.5, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.shadowBlur = 0;

        for (let vein = 0; vein < 3; vein++) {
          const vAngle = (vein / 3) * Math.PI * 2 + now * 0.001;
          const dots = 5 + (vein * 3) % 4;
          for (let d = 0; d < dots; d++) {
            const t = (d + 1) / (dots + 1);
            const spread = 0.3 + Math.sin(vein * 2.7 + d * 1.3) * 0.2;
            const a = vAngle + Math.sin(t * 6 + vein * 4 + now * 0.002) * spread;
            const dist = sphereR * (0.15 + t * 0.75);
            const dx = px + Math.cos(a) * dist;
            const dy = py + Math.sin(a) * dist;
            const sz = 1 + Math.sin(vein * 1.7 + d * 2.3 + now * 0.003) * 0.8 + 0.8;
            const alpha = 0.3 + Math.sin(vein * 2.1 + d * 1.1 + now * 0.002) * 0.15 + 0.2;
            ctx.fillStyle = `rgba(230,210,255,${alpha})`;
            ctx.beginPath();
            ctx.arc(dx, dy, sz, 0, Math.PI * 2);
            ctx.fill();
          }
        }

        for (let i = 0; i < 20; i++) {
          const angle = i * 2.399 + Math.sin(now * 0.002 + i * 0.5) * 0.2;
          const dist = sphereR * (0.1 + (Math.sin(i * 3.7 + now * 0.001) * 0.5 + 0.5) * 0.8);
          const sx = px + Math.cos(angle) * dist;
          const sy = py + Math.sin(angle) * dist;
          const sz = 0.5 + Math.sin(i * 1.9 + now * 0.004) * 0.4 + 0.5;
          const alpha = 0.2 + Math.sin(i * 2.3 + now * 0.003) * 0.1 + 0.15;
          ctx.fillStyle = `rgba(255,245,255,${alpha})`;
          ctx.beginPath();
          ctx.arc(sx, sy, sz, 0, Math.PI * 2);
          ctx.fill();
        }

        for (let i = 0; i < 8; i++) {
          const angle = (i / 8) * Math.PI * 2 + now * 0.002;
          const dist = sphereR * (0.85 + Math.sin(now * 0.003 + i * 1.3) * 0.1);
          const ex = px + Math.cos(angle) * dist;
          const ey = py + Math.sin(angle) * dist;
          const arcAngle = angle + Math.PI * 0.5;
          const arcLen = sphereR * (0.15 + Math.sin(now * 0.004 + i * 0.7) * 0.08 + 0.1);
          for (let s = 0; s < 2; s++) {
            const st = (s + 1) / 4;
            const ax = ex + Math.cos(arcAngle) * arcLen * st + Math.sin(now * 0.005 + i + s) * 3;
            const ay = ey + Math.sin(arcAngle) * arcLen * st + Math.cos(now * 0.005 + i + s) * 3;
            const alpha = (0.3 - st * 0.15) * (0.6 + Math.sin(now * 0.006 + i * 1.1) * 0.2);
            ctx.fillStyle = `rgba(200,160,255,${alpha})`;
            ctx.beginPath();
            ctx.arc(ax, ay, 1.2, 0, Math.PI * 2);
            ctx.fill();
          }
        }

        ctx.restore();
        return;
      }

      const prev = worldToScreen(this.camera, this.canvas, p.prevX, p.prevY);
      ctx.save();

      if (p.type === "blue") {
        const baseR = Math.max(10 * zoom, p.radius * zoom);
        const size = baseR * 2 * 1.3;
        if (this.blueImg.complete && this.blueImg.naturalWidth > 0) {
          ctx.shadowColor = "#66ccff";
          ctx.shadowBlur = 100;
          ctx.drawImage(this.blueImg, screen.x - size / 2, screen.y - size / 2, size, size);
          ctx.shadowColor = "#88ddff";
          ctx.shadowBlur = 20;
          ctx.drawImage(this.blueImg, screen.x - size / 2, screen.y - size / 2, size, size);
        } else {
          ctx.fillStyle = "#4cb4ff";
          ctx.shadowColor = "#66ccff";
          ctx.shadowBlur = 80;
          ctx.beginPath();
          ctx.arc(screen.x, screen.y, baseR * 1.3, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.shadowBlur = 0;
        const pullCount = 12;
        for (let i = 0; i < pullCount; i++) {
          const speed = 0.0001 + ((i * 7.31 + 3.17) % 1) * 0.002;
          const phase = (now * speed + i / pullCount) % 1;
          if (phase < 0.2) continue;
          const angle = i * 2.094 + phase * Math.PI * 4;
          const dist = baseR * 3.5 * Math.pow(1 - phase, 2);
          const px = screen.x + Math.cos(angle) * dist;
          const py = screen.y + Math.sin(angle) * dist;
          const alpha = (1 - phase) * 0.5;
          const sz = (3 + Math.sin(now * 0.005 + i) * 1) * (1 - phase * 0.5);
          ctx.fillStyle = `rgba(180,230,255,${alpha})`;
          ctx.beginPath();
          ctx.arc(px, py, sz, 0, Math.PI * 2);
          ctx.fill();
        }
      } else if (p.type === "red") {
        const r = Math.max(8 * zoom, p.radius * zoom);
        const px = screen.x;
        const py = screen.y;
        const pulse = 1 + Math.sin(now * 0.004 + 1) * 0.04;

        const dx = screen.x - prev.x;
        const dy = screen.y - prev.y;
        const trailLen = Math.sqrt(dx * dx + dy * dy);
        if (trailLen > 5) {
          const trailDirX = dx / trailLen;
          const trailDirY = dy / trailLen;
          const extend = Math.min(40, trailLen * 2);
          for (let i = 0; i < 4; i++) {
            const t = (i + 1) / 5;
            const tx = px - trailDirX * extend * t;
            const ty = py - trailDirY * extend * t;
            const flicker = 0.6 + Math.sin(now * 0.015 + i * 2.5 + t * 5) * 0.3;
            const sz = r * 0.6 * (1 - t * 0.6) * flicker;
            const alpha = (0.35 - t * 0.22) * flicker;
            ctx.fillStyle = `rgba(255,100,130,${alpha})`;
            ctx.beginPath();
            ctx.arc(tx, ty, sz, 0, Math.PI * 2);
            ctx.fill();
          }
        }

        ctx.save();
        const spriteSize = r * 2 * 2.2 * 0.7;
        ctx.shadowColor = "#ff2040";
        ctx.shadowBlur = 70;
        ctx.drawImage(this.redImg, screen.x - spriteSize / 2, screen.y - spriteSize / 2, spriteSize, spriteSize);
        ctx.shadowColor = "#ff6080";
        ctx.shadowBlur = 20;
        ctx.drawImage(this.redImg, screen.x - spriteSize / 2, screen.y - spriteSize / 2, spriteSize, spriteSize);
        ctx.shadowBlur = 0;

        for (let vein = 0; vein < 4; vein++) {
          const vAngle = (vein / 4) * Math.PI * 2 + now * 0.0015 + vein * 0.3;
          const dots = 4 + (vein * 3) % 4;
          for (let d = 0; d < dots; d++) {
            const t = (d + 1) / (dots + 1);
            const spread = 0.35 + Math.sin(vein * 2.7 + d * 1.3) * 0.25;
            const a = vAngle + Math.sin(t * 7 + vein * 4 + now * 0.003) * spread;
            const dist = r * (0.1 + t * 0.8);
            const dx2 = px + Math.cos(a) * dist;
            const dy2 = py + Math.sin(a) * dist;
            const sz = 1.2 + Math.sin(vein * 1.7 + d * 2.3 + now * 0.004) * 1 + 1;
            const alpha = 0.35 + Math.sin(vein * 2.1 + d * 1.1 + now * 0.003) * 0.2 + 0.25;
            ctx.fillStyle = `rgba(255,210,220,${alpha})`;
            ctx.beginPath();
            ctx.arc(dx2, dy2, sz, 0, Math.PI * 2);
            ctx.fill();
          }
        }

        for (let i = 0; i < 25; i++) {
          const angle = i * 2.399 + Math.sin(now * 0.003 + i * 0.5) * 0.3;
          const dist = r * (0.05 + (Math.sin(i * 3.7 + now * 0.002) * 0.5 + 0.5) * 0.85);
          const sx = px + Math.cos(angle) * dist;
          const sy = py + Math.sin(angle) * dist;
          const sz = 0.6 + Math.sin(i * 1.9 + now * 0.005) * 0.5 + 0.6;
          const alpha = 0.25 + Math.sin(i * 2.3 + now * 0.004) * 0.15 + 0.2;
          ctx.fillStyle = `rgba(255,245,245,${alpha})`;
          ctx.beginPath();
          ctx.arc(sx, sy, sz, 0, Math.PI * 2);
          ctx.fill();
        }

        for (let i = 0; i < 10; i++) {
          const angle = now * 0.005 + i * (Math.PI * 2 / 15) + Math.sin(now * 0.003 + i * 0.6) * 0.5;
          const dist = r * (0.6 + Math.sin(now * 0.006 + i * 1.1) * 0.5 + 0.5);
          const sx2 = px + Math.cos(angle) * dist;
          const sy2 = py + Math.sin(angle) * dist;
          const sz = 1.5 + Math.abs(Math.sin(now * 0.008 + i * 0.7)) * 2.5;
          const alpha = 0.4 + Math.sin(now * 0.005 + i * 1.2) * 0.3;
          ctx.fillStyle = `rgba(255,180,200,${alpha})`;
          ctx.beginPath();
          ctx.arc(sx2, sy2, sz, 0, Math.PI * 2);
          ctx.fill();
        }

        for (let i = 0; i < 8; i++) {
          const angle = (i / 8) * Math.PI * 2 + now * 0.003;
          const dist = r * (0.88 + Math.sin(now * 0.004 + i * 1.3) * 0.12);
          const ex = px + Math.cos(angle) * dist;
          const ey = py + Math.sin(angle) * dist;
          const arcAngle = angle + Math.PI * 0.5;
          const arcLen = r * (0.15 + Math.sin(now * 0.005 + i * 0.7) * 0.1 + 0.12);
          for (let s = 0; s < 2; s++) {
            const st = (s + 1) / 4;
            const ax = ex + Math.cos(arcAngle) * arcLen * st + Math.sin(now * 0.006 + i + s) * 4;
            const ay = ey + Math.sin(arcAngle) * arcLen * st + Math.cos(now * 0.006 + i + s) * 4;
            const alpha = (0.3 - st * 0.15) * (0.6 + Math.sin(now * 0.007 + i * 1.1) * 0.3);
            ctx.fillStyle = `rgba(255,170,190,${alpha})`;
            ctx.beginPath();
            ctx.arc(ax, ay, 1.2, 0, Math.PI * 2);
            ctx.fill();
          }
        }

        ctx.restore();
      } else {
        ctx.strokeStyle = "rgba(255,165,92,0.45)";
        ctx.lineWidth = Math.max(2 * zoom, p.radius * 0.45 * zoom);
        ctx.beginPath();
        ctx.moveTo(prev.x, prev.y);
        ctx.lineTo(screen.x, screen.y);
        ctx.stroke();
        ctx.fillStyle = "#ffbe73";
        ctx.beginPath();
        ctx.arc(screen.x, screen.y, Math.max(3 * zoom, p.radius * zoom), 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();
    });
  }

  drawEnemies(enemies) {
    const ctx = this.ctx;
    const zoom = this.camera.zoom || 1;
    const now = Date.now();

    const spriteScale = { crawler_nest: 4.5, crawler_baby: 3.6, fleshmaw: 3.25 };
    const bobConfig = {
      crawler_nest: { freq: 3, amp: 3, minSpeed: 2 },
      fleshmaw: { freq: 1.5, amp: 2, minSpeed: 3 },
    };

    enemies.forEach((entry) => {
      const e = entry.raw;
      const p = worldToScreen(this.camera, this.canvas, entry.x, entry.y);
      const baseRadius = e.type === "boss" ? 34 : e.type === "elite" ? 24 : 18;
      const frozen = Boolean(e.frozen);

      const walkSpeed = Math.sqrt(e.vx * e.vx + e.vy * e.vy);
      const bc = bobConfig[e.type] || { freq: 1, amp: 2, minSpeed: 5 };
      const bob = walkSpeed > bc.minSpeed
        ? Math.sin(now * 0.008 * bc.freq + (e.id ? e.id.length : 0) * 2.3) * bc.amp * zoom
        : 0;
      const drawY = p.y + bob;

      const sprite = this.monsterSprites[e.type];
      if (sprite) {
        const mult = spriteScale[e.type] || 1;
        const aspect = sprite.naturalWidth / sprite.naturalHeight;
        const h = baseRadius * 2.5 * mult * zoom;
        const w = h * aspect;
        ctx.save();
        let facing = this.enemyFacing.get(e.id);
        if (Math.abs(e.vx || 0) > 1) facing = (e.vx || 0) > 0 ? -1 : 1;
        if (!facing) facing = 1;
        this.enemyFacing.set(e.id, facing);
        if (facing < 0) {
          ctx.translate(p.x, drawY);
          ctx.scale(-1, 1);
          ctx.translate(-p.x, -drawY);
        }
        if (frozen) {
          ctx.shadowColor = "white";
          ctx.shadowBlur = 4 * zoom;
        }
        ctx.drawImage(sprite, p.x - w / 2, drawY - h / 2, w, h);
        if (frozen) {
          ctx.shadowBlur = 0;
        }
        ctx.restore();

        const hpBarRadius = baseRadius * mult * 0.5;
        const hpPct = e.maxHp > 0 ? e.hp / e.maxHp : 0;
        const hpBarW = hpBarRadius * 2 * zoom;
        const hpBarH = 4 * zoom;
        const hpBarX = p.x - hpBarW / 2;
        const hpBarY = drawY - h / 2 - 6 * zoom;
        ctx.fillStyle = "rgba(14,18,27,0.8)";
        ctx.fillRect(hpBarX, hpBarY, hpBarW, hpBarH);
        ctx.fillStyle = "#ff6e8f";
        ctx.fillRect(hpBarX, hpBarY, hpBarW * hpPct, hpBarH);

        if (e.type === "fleshmaw" && e.windupTimer > 0) {
          const progress = 1 - Math.max(0, e.windupTimer) / (e.attackWindup || 0.5);
          const frameIdx = Math.min(4, Math.floor(progress * 5));
          const atkSprite = this.fleshmawAttackFrames[frameIdx];
          const mlen = Math.sqrt((e.vx || 0) * (e.vx || 0) + (e.vy || 0) * (e.vy || 0));
          const dirX = mlen > 0.01 ? (e.vx || 0) / mlen : (facing < 0 ? 1 : -1);
          const dirY = mlen > 0.01 ? (e.vy || 0) / mlen : 0.01;
          const atkH = h * 0.6;
          if (atkSprite && atkSprite.naturalWidth > 0) {
            const atkAspect = atkSprite.naturalWidth / atkSprite.naturalHeight;
            const atkW = atkH * atkAspect;
            ctx.save();
            ctx.translate(p.x, drawY + h * 0.2);
            if (dirX < 0) ctx.scale(-1, 1);
            ctx.rotate(Math.atan2(dirY, Math.abs(dirX || 0.01)));
            ctx.drawImage(atkSprite, -atkW / 2 + h * 0.2, -atkH / 2, atkW, atkH);
            ctx.restore();
          } else if (atkSprite) {
            ctx.fillStyle = "rgba(30,20,40,0.7)";
            ctx.beginPath();
            ctx.arc(p.x, drawY + h * 0.2, atkH * 0.3, 0, Math.PI * 2);
            ctx.fill();
          }
        }

        if ((e.type === "crawler_nest" || e.type === "crawler_baby") && e.windupTimer > 0) {
          const progress = 1 - Math.max(0, e.windupTimer) / (e.attackWindup || 0.7);
          const frameIdx = Math.min(17, Math.floor(progress * 18));
          const atkSprite = this.crawlerAttackFrames[frameIdx];
          const mlen = Math.sqrt((e.vx || 0) * (e.vx || 0) + (e.vy || 0) * (e.vy || 0));
          const dirX = mlen > 0.01 ? (e.vx || 0) / mlen : (facing < 0 ? 1 : -1);
          const dirY = mlen > 0.01 ? (e.vy || 0) / mlen : 0.01;
          if (atkSprite && atkSprite.naturalWidth > 0) {
            const atkAspect = atkSprite.naturalWidth / atkSprite.naturalHeight;
            const atkW = w * 0.5;
            const atkH = atkW / atkAspect;
            ctx.save();
            ctx.translate(p.x, drawY + h * (e.type === "crawler_baby" ? 0.3 : 0));
            if (dirX < 0) ctx.scale(-1, 1);
            ctx.rotate(Math.atan2(dirY, Math.abs(dirX || 0.01)));
            ctx.drawImage(atkSprite, -atkW / 2 + h * 0.2, -atkH / 2, atkW, atkH);
            ctx.restore();
          } else if (atkSprite) {
            ctx.fillStyle = "rgba(50,70,40,0.7)";
            ctx.beginPath();
            ctx.arc(p.x, drawY + h * (e.type === "crawler_baby" ? 0.3 : 0), h * 0.2, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      } else {
        ctx.save();
        ctx.fillStyle = frozen
          ? "#d3e6ff"
          : e.type === "boss"
            ? "#9b2e4f"
            : e.type === "elite"
              ? "#5b335f"
              : e.type === "caster"
                ? "#573d66"
                : "#3a4159";
        ctx.strokeStyle = frozen ? "rgba(246,253,255,0.92)" : "rgba(242,156,177,0.58)";
        if (frozen) {
          ctx.shadowColor = "rgba(227,244,255,0.85)";
          ctx.shadowBlur = 16;
        }
        ctx.lineWidth = 2 * zoom;
        ctx.beginPath();
        ctx.arc(p.x, drawY, baseRadius * zoom, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        if (frozen) {
          const pulse = 0.75 + Math.sin(now * 0.01 + baseRadius) * 0.15;
          ctx.strokeStyle = "rgba(243,252,255,0.75)";
          ctx.lineWidth = 2 * zoom;
          ctx.beginPath();
          ctx.arc(p.x, drawY, baseRadius * zoom + 4 * zoom + pulse * 2 * zoom, 0, Math.PI * 2);
          ctx.stroke();
          ctx.strokeStyle = "rgba(255,255,255,0.9)";
          ctx.lineWidth = 3 * zoom;
          ctx.beginPath();
          ctx.arc(p.x, drawY, baseRadius * zoom + 4 * zoom, 0, Math.PI * 2);
          ctx.stroke();
        }
        ctx.restore();

        const hpPct = e.maxHp > 0 ? e.hp / e.maxHp : 0;
        ctx.fillStyle = "rgba(14,18,27,0.8)";
        ctx.fillRect(p.x - baseRadius * zoom, drawY - baseRadius * zoom - 10 * zoom, baseRadius * 2 * zoom, 4 * zoom);
        ctx.fillStyle = "#ff6e8f";
        ctx.fillRect(p.x - baseRadius * zoom, drawY - baseRadius * zoom - 10 * zoom, baseRadius * 2 * zoom * hpPct, 4 * zoom);
      }
    });
  }

  drawPlayers(players, youId, localPred) {
    const ctx = this.ctx;
    const now = performance.now();
    this.yutaVisual.updateBeamsFromPlayerSnapshots(players);
    players.forEach((entry) => {
      const p = entry.raw;
      const isYou = p.id === youId;
      const chara = p.character || "gojo";
      const visual = this.getVisualForPlayer(chara);

      const tween = this.dashTweens.get(p.id);
      let rx = entry.x;
      let ry = entry.y;
      if (isYou && localPred && !tween) {
        if (!this.localVisualPos) {
          this.localVisualPos = { x: localPred.x, y: localPred.y };
        }
        const dx = localPred.x - this.localVisualPos.x;
        const dy = localPred.y - this.localVisualPos.y;
        const dist = Math.hypot(dx, dy);
        if (dist > 140) {
          this.localVisualPos.x = localPred.x;
          this.localVisualPos.y = localPred.y;
        } else {
          const follow = dist > 28 ? 0.52 : 0.38;
          const frameFollow = 1 - Math.pow(1 - follow, this._renderDt * 60);
          this.localVisualPos.x += dx * frameFollow;
          this.localVisualPos.y += dy * frameFollow;
        }
        rx = this.localVisualPos.x;
        ry = this.localVisualPos.y;
      }
      if (tween) {
        const t = Math.min(1, (now - tween.startTime) / tween.duration);
        const ease = 1 - Math.pow(1 - t, 3);
        rx = tween.startX + (tween.endX - tween.startX) * ease;
        ry = tween.startY + (tween.endY - tween.startY) * ease;
        if (isYou) {
          this.localVisualPos = { x: rx, y: ry };
        }
      }

      let facing = this.playerFacing.get(p.id) || 1;
      const pvx = p.vx || 0;
      if (Math.abs(pvx) > 1) {
        facing = pvx < 0 ? -1 : 1;
        this.playerFacing.set(p.id, facing);
      }

      const dashState = this.dashVisuals.has(p.id) ? "dash" : null;

      ctx.save();
      if (!p.alive) {
        ctx.globalAlpha = 0.35;
      }

      if (p.recoveryActive && p.alive) {
        const sp = worldToScreen(this.camera, this.canvas, rx, ry);
        if (this.energyRecoverImg.complete && this.energyRecoverImg.naturalWidth > 0) {
          const frameIdx = Math.floor(now * 0.009) % this._erFrames;
          const col = frameIdx % this._erCols;
          const row = Math.floor(frameIdx / this._erCols);
          const drawW = 140;
          const drawH = this._erFrameH * (drawW / this._erFrameW);

          this._processERFrame(frameIdx, p.character);

          const frame = this._erCanvas[p.character];
          if (frame) {
            ctx.drawImage(
              frame,
              0, 0, this._erFrameW, this._erFrameH,
              sp.x - drawW / 2, sp.y - drawH / 2, drawW, drawH
            );
          }
        }
      }

      visual.renderPlayer(ctx, this.camera, entry, isYou, facing, dashState, rx, ry, this._renderDt);

      if (p.recoveryActive && p.alive) {
        const sp = worldToScreen(this.camera, this.canvas, rx, ry);
        if (this.energyRecoverImg.complete && this.energyRecoverImg.naturalWidth > 0) {
          const frameIdx = Math.floor(now * 0.009) % this._erFrames;
          const col = frameIdx % this._erCols;
          const row = Math.floor(frameIdx / this._erCols);
          const drawW = 140;
          const drawH = this._erFrameH * (drawW / this._erFrameW);

          this._processERFrame(frameIdx, p.character);

          const frame = this._erCanvas[p.character];
          if (frame) {
            ctx.globalAlpha = 0.25;
            ctx.drawImage(
              frame,
              0, 0, this._erFrameW, this._erFrameH,
              sp.x - drawW / 2, sp.y - drawH / 2, drawW, drawH
            );
            ctx.globalAlpha = 1;
          }
        }
      }

      ctx.restore();

      if (p.frozen) {
        const sp = worldToScreen(this.camera, this.canvas, rx, ry);
        ctx.save();
        ctx.strokeStyle = "rgba(255,255,255,0.85)";
        ctx.lineWidth = 3 * (this.camera.zoom || 1);
        ctx.setLineDash([5 * (this.camera.zoom || 1), 5 * (this.camera.zoom || 1)]);
        ctx.beginPath();
        ctx.arc(sp.x, sp.y, 22 * (this.camera.zoom || 1), 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
      }
    });
  }

  _processERFrame(frameIdx, character) {
    if (!this.energyRecoverImg.complete) return;
    if (!this._erCanvas[character]) {
      this._erCanvas[character] = document.createElement("canvas");
      this._erCanvas[character].width = this._erFrameW;
      this._erCanvas[character].height = this._erFrameH;
    }
    if (this._erLastFrame[character] === frameIdx) return;
    this._erLastFrame[character] = frameIdx;

    const canvas = this._erCanvas[character];
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    const col = frameIdx % this._erCols;
    const row = Math.floor(frameIdx / this._erCols);

    ctx.clearRect(0, 0, this._erFrameW, this._erFrameH);
    ctx.drawImage(
      this.energyRecoverImg,
      col * this._erFrameW, row * this._erFrameH, this._erFrameW, this._erFrameH,
      0, 0, this._erFrameW, this._erFrameH
    );

    const imageData = ctx.getImageData(0, 0, this._erFrameW, this._erFrameH);
    const pixels = imageData.data;

    const colors = {
      yuta:   { r: 255, g: 20,  b: 140 },
      sukuna: { r: 230, g: 50,  b: 50  },
      hakari: { r: 50,  g: 220, b: 80  },
    };
    const c = colors[character] || { r: 80, g: 235, b: 255 };
    const alphaMuls = { yuta: 0.7 };
    const am = alphaMuls[character] || 0.5;

    for (let i = 0; i < pixels.length; i += 4) {
      const r = pixels[i];
      const g = pixels[i + 1];
      const b = pixels[i + 2];
      const a = pixels[i + 3];

      if (a < 10) continue;

      const brightness = Math.max(r, g, b);
      if (brightness < 25) {
        pixels[i]     = 0;
        pixels[i + 1] = 0;
        pixels[i + 2] = 0;
        pixels[i + 3] = Math.round(a * am);
      } else {
        pixels[i]     = c.r;
        pixels[i + 1] = c.g;
        pixels[i + 2] = c.b;
        pixels[i + 3] = Math.round(a * am);
      }
    }

    ctx.putImageData(imageData, 0, 0);
  }

  drawM1PunchEffects() {
    const ctx = this.ctx;
    for (let i = 0; i < this.gojoVisual.m1Slashes.length; i++) {
      const slash = this.gojoVisual.m1Slashes[i];
      if (slash.life <= 0) continue;
      const pos = worldToScreen(this.camera, this.canvas, slash.worldX, slash.worldY);
      const progress = 1 - slash.life / slash.maxLife;
      const sprite = this.gojoVisual.gojoAttackSprite;

      // Trail sprites
      if (slash.trail && sprite && sprite.complete && sprite.naturalWidth > 0) {
        const aspect = sprite.naturalWidth / sprite.naturalHeight;
        const tHeight = 12 + slash.comboStep * 3;
        const tWidth = tHeight * aspect;
        const angle = Math.atan2(slash.dirY, slash.dirX);
        for (const t of slash.trail) {
          const tp = worldToScreen(this.camera, this.canvas, t.x, t.y);
          const baseY = tp.y - 25;
          const tAlpha = (t.life / 0.4) * 0.25;
          ctx.save();
          ctx.translate(tp.x, baseY);
          ctx.globalCompositeOperation = "lighter";
          ctx.rotate(angle);
          ctx.globalAlpha = tAlpha;
          ctx.drawImage(sprite, -tWidth / 2, -tHeight / 2, tWidth, tHeight);
          ctx.restore();
        }
      }

      drawGojoM1Sprite(ctx, pos.x, pos.y, slash.dirX, slash.dirY, progress, slash.comboStep, sprite);
    }
  }

  drawMinimap(players, enemies, youId) {
    if (!this.map) {
      return;
    }

    const ctx = this.ctx;
    const w = 170;
    const h = 118;
    const x = this.canvas.clientWidth - w - 16;
    const y = this.canvas.clientHeight - h - 16;

    ctx.save();
    ctx.fillStyle = "rgba(8,12,20,0.72)";
    ctx.strokeStyle = "rgba(141,168,219,0.26)";
    ctx.lineWidth = 1;
    ctx.fillRect(x, y, w, h);
    ctx.strokeRect(x, y, w, h);

    const sx = w / this.map.width;
    const sy = h / this.map.height;

    this.map.obstacles.forEach((obs) => {
      ctx.fillStyle = "rgba(98,113,146,0.28)";
      ctx.fillRect(x + obs.x * sx, y + obs.y * sy, obs.w * sx, obs.h * sy);
    });

    enemies.forEach((entry) => {
      const e = entry.raw;
      ctx.fillStyle = e.type === "boss" ? "#ff5e85" : "#d07ca0";
      ctx.fillRect(x + e.x * sx - 1, y + e.y * sy - 1, 3, 3);
    });

    players.forEach((entry) => {
      const p = entry.raw;
      ctx.fillStyle = p.id === youId ? "#8fd4ff" : "#ffd0dc";
      ctx.beginPath();
      ctx.arc(x + entry.x * sx, y + entry.y * sy, p.id === youId ? 2.8 : 2.2, 0, Math.PI * 2);
      ctx.fill();
    });

    ctx.restore();
  }

  render({ interpolation, youId, you, localPred }) {
    const now = performance.now();
    this._renderDt = this._lastRenderTime ? Math.min((now - this._lastRenderTime) / 1000, 0.05) : 1 / 60;
    this._lastRenderTime = now;
    this.interpolationRef = interpolation || this.interpolationRef;
    if (typeof window._diagRender === 'undefined') {
      window._diagRender = 0;
    }
    this.clear();
    this.drawWorld();

    if (interpolation) {
      if (window._diagRender < 30) {
        const youEntry = interpolation.players.get(youId);
        console.log(`[DIAG] render #${window._diagRender}: camera=(${this.camera.x.toFixed(0)},${this.camera.y.toFixed(0)}), players=${interpolation.players.size}, you=${youEntry ? 'present' : 'ABSENT'}, youId=${youId}`);
        window._diagRender++;
      }
      this.domainVisual.updatePlayers(interpolation.players);
      this.ctx.save();
      this.drawDomains(interpolation.domains, youId, you, localPred);
      this.ctx.restore();
      this.drawMarkers();
      this.drawRedExplosions();
      this.drawBlueExplosions();
      this.drawCrawlerExplosions();
      this.drawAcidPuddles();
      this.drawBlackFlashes();
      this.drawProjectiles(interpolation.projectiles);
      this.renderPurpleCharges(this.ctx, this.camera);
      this.renderPurpleExplosions(this.ctx, this.camera);
      this.drawEnemies(interpolation.enemies);
      this.drawM1PunchEffects();
      this.drawPlayers(interpolation.players, youId, localPred);
      this.gojoVisual.renderEffects(this.ctx, this.camera);
      this.yutaVisual.renderEffects(this.ctx, this.camera);
      this.sukunaVisual.renderEffects(this.ctx, this.camera);
      this.yujiVisual.renderEffects(this.ctx, this.camera);
      this.megumiVisual.renderEffects(this.ctx, this.camera);
      this.hakariVisual.renderEffects(this.ctx, this.camera);
      this.drawM1PunchEffects();
      this.particles.render(this.ctx, this.camera);
      this.ctx.save();
      this.drawDomainPrivacy(interpolation.domains, you, localPred, this.camera.zoom, this.camera.x, this.camera.y, this.canvas.clientWidth, this.canvas.clientHeight);
      this.ctx.restore();
    }
  }

  drawDomainPrivacy(domains, you, localPred, z, cx, cy, w, h) {
    if (!domains || domains.size === 0) return;
    const ctx = this.ctx;
    const px = localPred ? localPred.x : (you ? you.x : 0);
    const py = localPred ? localPred.y : (you ? you.y : 0);

    let viewerInsideAny = false;

    domains.forEach((entry) => {
      const d = entry.raw || entry;
      const ex = entry.x;
      const ey = entry.y;
      const targetR = d.radius;
      const currentR = this.domainVisual.getCurrentRadius(d.ownerId, targetR);
      if (currentR < 2) return;
      const vz = currentR * z;
      const spx = (ex - cx) * z + w * 0.5;
      const spy = (ey - cy) * z + h * 0.5;
      const viewerInside = Math.hypot(px - ex, py - ey) <= targetR;

      if (viewerInside) {
        viewerInsideAny = true;
      } else {
        ctx.save();
        ctx.beginPath();
        ctx.arc(spx, spy, vz, 0, Math.PI * 2);
        ctx.fillStyle = "#000000";
        ctx.fill();
        ctx.restore();
      }
    });

    if (viewerInsideAny) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, w, h);

      domains.forEach((entry) => {
        const d = entry.raw || entry;
        const ex = entry.x;
        const ey = entry.y;
        const targetR = d.radius;
        const currentR = this.domainVisual.getCurrentRadius(d.ownerId, targetR);
        if (currentR < 2) return;
        const vz = currentR * z;
        const spx = (ex - cx) * z + w * 0.5;
        const spy = (ey - cy) * z + h * 0.5;
        const viewerInside = Math.hypot(px - ex, py - ey) <= targetR;

        if (viewerInside) {
          ctx.arc(spx, spy, vz, 0, Math.PI * 2, true);
          ctx.closePath();
        }
      });

      ctx.fillStyle = "rgba(0,0,0,0.85)";
      ctx.fill("evenodd");
      ctx.restore();
    }
  }
}
