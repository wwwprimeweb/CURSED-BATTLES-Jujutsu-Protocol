import { GojoVisualSystem } from "../animations/gojoVisualSystem.js";
import { YutaVisualSystem } from "../animations/yutaVisualSystem.js";
import { YujiVisualSystem } from "../animations/yujiVisualSystem.js";
import { GenericVisualSystem } from "../animations/genericVisualSystem.js";
import { DomainVisualSystem } from "../animations/domainVisualSystem.js";
import { drawGojoM1Slash } from "../animations/gojoEffects.js";
import { SmokeEffect } from "../animations/smokeEffect.js";
import { BloodEffect } from "../animations/bloodEffect.js";
import { HitImpactEffect } from "../animations/hitImpact.js";


function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

const CHAR_SPRITE = {
  "o-honrado":          { pw: 40, ph: 65, ox: 0,  cw: 80, ch: 80, rs: 1.7 },
  "portador-do-vinculo": { pw: 40, ph: 65, ox: 16, cw: 80, ch: 80, rs: 1.7 },
  "punho-indomavel":    { pw: 40, ph: 65, ox: 0,  cw: 80, ch: 80, rs: 1.9 },
  "rei-amaldicoado":    { pw: 40, ph: 65, ox: 0,  cw: 80, ch: 80, rs: 1.7 },
  "invocador-de-sombras": { pw: 40, ph: 65, ox: 0, cw: 80, ch: 80, rs: 1.7 },
  "lutador-de-sorte":   { pw: 40, ph: 65, ox: 0,  cw: 80, ch: 80, rs: 1.7 },
};

function worldToScreen(camera, canvas, x, y) {
  const zoom = camera.zoom;
  return {
    x: (x - camera.x) * zoom + canvas.width * 0.5 + (camera.shakeX || 0),
    y: (y - camera.y) * zoom + canvas.height * 0.5 + (camera.shakeY || 0),
  };
}

export class Renderer {
  constructor(canvas, particleSystem) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.particles = particleSystem;
    this.gojoVisual = new GojoVisualSystem();
    this.yutaVisual = new YutaVisualSystem();
    this.sukunaVisual = new GenericVisualSystem("rei-amaldicoado");
    this.yujiVisual = new YujiVisualSystem();
    this.megumiVisual = new GenericVisualSystem("invocador-de-sombras");
    this.hakariVisual = new GenericVisualSystem("lutador-de-sorte");
    this.domainVisual = new DomainVisualSystem();
    this.smokeFx = new SmokeEffect();
    this.smokeFx.load();
    this.bloodEffect = new BloodEffect();
    this.bloodEffect.load();
    this.hitImpact = new HitImpactEffect();
    this.hitImpact.load();
    this.map = null;
    this.camera = {
      x: 0,
      y: 0,
      zoom: 1,
      shakeX: 0,
      shakeY: 0,
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

    this.shakeIntensity = 0;
    this.shakeDuration = 0;
    this.shakeTime = 0;

    this.domainOverlayAlpha = 0;
    this.activeDomainOwnerIds = new Set();
    this.playerFacing = new Map();
    this.m1FacingTimers = new Map();
    this.localVisualPos = null;
    this.dashVisuals = new Map();
    this.dashTweens = new Map();
    this._movePuffTimers = new Map();
    this._wasMoving = new Map();
    this._enemyMovePuffTimers = new Map();
    this._enemyWasMoving = new Map();
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
    this._erImgs = {};
    this._erFrames = 19;
    this._erCols = 6;
    this._erFrameW = 136;
    this._erFrameH = 292;

    this.damageNumbers = [];

    this.crawlerExplosions = [];
    this.acidPuddles = [];

    this.monsterSprites = {};
    this.spriteScale = { crawler_nest: 4.5, crawler_baby: 3.6, fleshmaw: 4.0, staring_beast: 3.5 };
    this.dissolveEffects = [];
    this.enemyFacing = new Map();
    this.enemyHpVisuals = new Map();
    this._staringEyeOpacity = new Map();
    this._loadMonsterSprite("crawler_nest", "/assets/spritesmonsters/Crawler Nest.png");
    this._loadMonsterSprite("crawler_baby", "/assets/spritesmonsters/Crawler Nest Baby.png");
    this._loadMonsterSprite("staring_beast", "/assets/spritesmonsters/Staring Beast.png");
    this.monsterSprites["fleshmaw"] = new Image();
    this.monsterSprites["fleshmaw"].src = "/assets/spritesmonsters/Fleshmaw.png";
    this.fleshmawAttackFrames = [];
    for (let i = 0; i < 5; i++) {
      const img = new Image();
      img.onerror = () => { console.error(`[MONSTER] Failed to load attack frame: fleshmaw_atk_${i}.png`); };
      img.src = `/assets/spritesmonsters/fleshmaw_atk_${i}.png`;
      this.fleshmawAttackFrames.push(img);
    }
    this.staringBeastAttackFrames = [];
    for (let i = 0; i < 8; i++) {
      const img = new Image();
      img.onerror = () => { console.error(`[MONSTER] Failed to load attack frame: staring_beast_atk_${i}.png`); };
      img.src = `/assets/spritesmonsters/staring_beast_atk_${i}.png`;
      this.staringBeastAttackFrames.push(img);
    }
    this.crawlerAttackFrames = [];
    for (let i = 0; i < 18; i++) {
      const img = new Image();
      img.onerror = () => { console.error(`[MONSTER] Failed to load attack frame: crawler_atk_${i}.png`); };
      img.src = `/assets/spritesmonsters/crawler_atk_${i}.png`;
      this.crawlerAttackFrames.push(img);
    }
    this.staringBeastEyeSprite = new Image();
    this.staringBeastEyeSprite.src = "/assets/spritesmonsters/staring_beast_eye.png";

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

  _drawProceduralPurpleEye(ctx, x, y, size, now) {
    ctx.save();
    ctx.translate(x, y);

    const pulse = 1 + Math.sin(now * 0.004) * 0.08;
    const s = size * pulse;

    ctx.shadowColor = "#9933ff";
    ctx.shadowBlur = 20 * (s / 10);

    ctx.fillStyle = "rgba(30, 5, 50, 0.85)";
    ctx.beginPath();
    ctx.ellipse(0, 0, s * 1.15, s * 0.65, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.shadowBlur = 0;
    const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, s);
    grad.addColorStop(0, "#e0c0ff");
    grad.addColorStop(0.4, "#b07cf0");
    grad.addColorStop(0.8, "#7a3db8");
    grad.addColorStop(1, "#4a1a7a");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.ellipse(0, 0, s * 0.95, s * 0.5, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#0a0018";
    ctx.shadowColor = "#cc66ff";
    ctx.shadowBlur = 6 * (s / 10);
    ctx.beginPath();
    ctx.ellipse(0, 0, s * 0.18, s * 0.4, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.shadowBlur = 0;
    ctx.fillStyle = "#ff2060";
    ctx.beginPath();
    ctx.ellipse(0, 0, s * 0.05, s * 0.12, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = "#6020a0";
    ctx.lineWidth = s * 0.1;
    ctx.beginPath();
    ctx.ellipse(0, 0, s * 1.15, s * 0.65, 0, 0, Math.PI * 2);
    ctx.stroke();

    ctx.restore();
  }

  addDissolve(id, x, y, type, grade, facing) {
    const sprite = this.monsterSprites[type];
    if (!sprite || !sprite.complete || !sprite.naturalWidth) return;
    const duration = grade === "special" ? 1.5 : grade === 1 ? 0.8 : grade === 2 ? 0.5 : 0.3;
    const scaleEnd = grade === 3 ? 0.5 : grade === 2 ? 0.4 : 0.3;
    this.dissolveEffects.push({ 
      id, x, y, type, grade, sprite, 
      timer: duration, duration, scaleEnd, facing: facing || 1,
      seed: Math.random() * 1000 
    });

    const burstCount = grade === "special" ? 80 : grade === 1 ? 30 : grade === 2 ? 12 : 5;
    this.particles.spawnBurst({ x, y, color: "#9933ff", count: burstCount, speed: grade === "special" ? 400 : 200, life: grade === "special" ? 0.6 : 0.3, size: grade === "special" ? 4 : 2.5 });
    if (grade === "special" || grade === 1) {
      this.particles.spawnBurst({ x, y, color: "#1a0033", count: Math.floor(burstCount/2), speed: grade === "special" ? 600 : 300, life: grade === "special" ? 0.8 : 0.4, size: grade === "special" ? 5 : 3 });
    }
  }

  updateDissolveEffects(dt) {
    const particles = this.particles;
    for (let i = this.dissolveEffects.length - 1; i >= 0; i--) {
      const d = this.dissolveEffects[i];
      d.timer -= dt;
      const progress = 1 - d.timer / d.duration;
      if (progress >= 0 && progress < 1) {
        // Less particles for lower grades
        const emitRate = d.grade === "special" ? 12 : d.grade === 1 ? 4 : d.grade === 2 ? 1 : (Math.random() > 0.5 ? 1 : 0);
        const spread = 80 + progress * 100;
        for (let j = 0; j < emitRate; j++) {
          if (particles.pool.length === 0) break;
          const p = particles.pool.pop();
          p.x = d.x + (Math.random() - 0.5) * spread;
          p.y = d.y + (Math.random() - 0.5) * spread;
          
          p.vx = (Math.random() - 0.5) * (d.grade === "special" ? 200 : 100) + Math.sin(d.timer * 10 + j) * 50;
          p.vy = -(50 + Math.random() * (d.grade === "special" ? 150 : 80)) - progress * 50;
          p.life = 0.4 + Math.random() * (d.grade === "special" ? 0.6 : 0.3);
          p.maxLife = p.life;
          p.size = 1.5 + Math.random() * (d.grade === "special" ? 3 : 1.5);
          
          const colorRoll = Math.random();
          p.color = colorRoll > 0.7 ? "rgb(255, 60, 150)" : colorRoll > 0.3 ? "rgb(120, 10, 180)" : "rgb(20, 0, 30)";
          p.borderColor = colorRoll <= 0.3 ? "#8a2be2" : "#000000";
          p.borderWidth = d.grade === "special" ? 1.5 : 1;
          p.shape = Math.random() > 0.5 ? "circle" : "star";
          p.rotation = Math.random() * Math.PI * 2;
          p.spin = (Math.random() - 0.5) * 10;
          particles.active.push(p);
        }
      }
      if (d.timer <= 0) {
        const finalCount = d.grade === "special" ? 50 : d.grade === 1 ? 15 : d.grade === 2 ? 8 : 4;
        particles.spawnBurst({ x: d.x, y: d.y, color: "#8a2be2", count: finalCount, speed: d.grade === "special" ? 300 : 150, life: 0.4, size: d.grade === "special" ? 3 : 2 });
        this.dissolveEffects.splice(i, 1);
      }
    }
  }

  drawDissolveEffects() {
    const ctx = this.ctx;
    const zoom = this.camera.zoom;
    for (let i = 0; i < this.dissolveEffects.length; i++) {
      const d = this.dissolveEffects[i];
      const progress = 1 - d.timer / d.duration;
      const easeOut = 1 - Math.pow(progress, 3);
      const alpha = Math.max(0, easeOut);
      const scaleMul = 1 - Math.pow(progress, 2) * (1 - d.scaleEnd);
      const mult = this.spriteScale[d.type] || 1;
      const baseR = 18;
      const h = baseR * 2.5 * mult * zoom * scaleMul;
      const w = h * (d.sprite.naturalWidth / d.sprite.naturalHeight);
      
      const shakeBase = d.grade === "special" ? 20 : d.grade === 1 ? 8 : d.grade === 2 ? 3 : 0;
      const shakeAmt = (1 - progress) * shakeBase * zoom;
      const offsetX = (Math.random() - 0.5) * shakeAmt;
      const offsetY = (Math.random() - 0.5) * shakeAmt;

      const p = worldToScreen(this.camera, this.canvas, d.x + offsetX, d.y + offsetY);
      
      ctx.save();
      if (d.type === "staring_beast" ? d.facing > 0 : d.facing < 0) {
        ctx.translate(p.x, p.y);
        ctx.scale(-1, 1);
        ctx.translate(-p.x, -p.y);
      }
      
      ctx.globalAlpha = alpha;
      
      const brightness = 1 + progress * (d.grade === "special" ? 3 : 1);
      const invert = progress * (d.grade === "special" ? 100 : 50);
      
      ctx.filter = `invert(${invert}%) brightness(${brightness}) contrast(${2 + progress * 2}) drop-shadow(0 0 ${10 * progress * zoom}px #9900ff)`;
      ctx.globalCompositeOperation = progress > 0.5 ? "lighter" : "source-over";
      
      ctx.drawImage(d.sprite, p.x - w / 2, p.y - h / 2, w, h);
      ctx.filter = "none";
      ctx.globalCompositeOperation = "source-over";
      
      ctx.restore();
    }
  }

  setMap(map) {
    this.map = map;
    this.camera.x = map.width * 0.5;
    this.camera.y = map.height * 0.5;
    this.localVisualPos = null;
  }

  triggerScreenShake(intensity, duration) {
    this.shakeIntensity = intensity;
    this.shakeDuration = duration;
    this.shakeTime = 0;
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
    const bolts = this._generateBolts(x, y, 5, seed, dirX, dirY);
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
      const angle = baseAngle + (rng() - 0.5) * 2.5; // More initial spread
      const len = 250 + rng() * 450; // Longer bolts
      const points = [{ x: 0, y: 0 }];
      let cx = 0, cy = 0;
      const segments = 12 + Math.floor(rng() * 15); // Much more segments for spikiness
      const segLen = len / segments;
      let curAngle = angle;
      for (let s = 0; s < segments; s++) {
        // High angle variation for sharp, jagged spikes
        curAngle += (rng() - 0.5) * 2.2;
        cx += Math.cos(curAngle) * segLen * (0.5 + rng()); // Vary segment length slightly
        cy += Math.sin(curAngle) * segLen * (0.5 + rng());
        points.push({ x: cx, y: cy });
      }
      // Pre-compute segment lengths for main bolt
      let totalLen = 0;
      for (let pi = 1; pi < points.length; pi++) {
        const prev = points[pi - 1];
        const dx = points[pi].x - prev.x;
        const dy = points[pi].y - prev.y;
        const segLen = Math.sqrt(dx * dx + dy * dy);
        points[pi].segLen = segLen;
        totalLen += segLen;
      }
      points[0].segLen = 0;

      // Branches
      const branches = [];
      for (let b = 0; b < 3 + Math.floor(rng() * 4); b++) { // More branches
        const atSeg = Math.floor(rng() * (segments - 2)) + 1;
        const bp = points[atSeg];
        const bAngle = curAngle + (rng() - 0.5) * 2.5;
        const bLen = 100 + rng() * 200;
        const bPoints = [{ x: bp.x, y: bp.y }];
        let bcx = bp.x, bcy = bp.y;
        const bSegs = 5 + Math.floor(rng() * 6);
        const bSegLen = bLen / bSegs;
        let ba = bAngle;
        for (let s = 0; s < bSegs; s++) {
          ba += (rng() - 0.5) * 1.8;
          bcx += Math.cos(ba) * bSegLen * (0.5 + rng());
          bcy += Math.sin(ba) * bSegLen * (0.5 + rng());
          bPoints.push({ x: bcx, y: bcy });
        }
        let branchLen = 0;
        for (let pi = 1; pi < bPoints.length; pi++) {
          const prev = bPoints[pi - 1];
          const dx = bPoints[pi].x - prev.x;
          const dy = bPoints[pi].y - prev.y;
          const segLen = Math.sqrt(dx * dx + dy * dy);
          bPoints[pi].segLen = segLen;
          branchLen += segLen;
        }
        bPoints[0].segLen = 0;
        branches.push({ points: bPoints, thickness: 0.3 + rng() * 0.7, totalLen: branchLen });
      }
      bolts.push({ points, branches, phase: rng() * 0.25, thickness: 0.6 + rng() * 1.4, totalLen });
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
    const z = this.camera.zoom;
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
    const z = this.camera.zoom;
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
    const entry = this.domainVisual.expanding.get(ev.ownerId);
    if (entry) {
      entry.inkBaseZoom = this.camera.zoom;
    }
    this.startZoomSeq([
      { target: 1.4, duration: 300, pause: 1800 },
      { target: 1.2, duration: 400, pause: 0 },
    ]);
  }

  onDomainCollapse(ev) {
    this.domainVisual.onDomainCollapse(ev);
    this.zoomSeq = null;
  }

  getVisualForPlayer(character) {
    switch (character) {
      case "portador-do-vinculo": return this.yutaVisual;
      case "rei-amaldicoado": return this.sukunaVisual;
      case "punho-indomavel": return this.yujiVisual;
      case "invocador-de-sombras": return this.megumiVisual;
      case "lutador-de-sorte": return this.hakariVisual;
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
    const sheet = Math.floor(Math.random() * 3);
    const dirX = ev.dirX !== undefined ? ev.dirX : 1;
    const dirY = ev.dirY !== undefined ? ev.dirY : 0;
    const angle = Math.atan2(dirY, dirX);
    this.smokeFx.spawnBurst(
      startX - dirX * 15,
      startY - dirY * 15,
      sheet, 0.9 + Math.random() * 0.3, angle,
    );
    this.smokeFx.spawnBurst(
      ev.x + dirX * 10,
      ev.y + dirY * 10,
      (sheet + 1) % 3, 1.0 + Math.random() * 0.4, angle,
    );
  }

  _updateMovementSmoke(dt) {
    const interp = this.interpolationRef;
    if (!interp) return;
    const now = performance.now();

    interp.players.forEach((entry, id) => {
      const p = entry.raw;
      const ex = entry.x;
      const ey = entry.y;
      const speed = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
      const isMoving = speed > 20 && (p.animState === "walk" || p.animState === "run" || (p.animState && p.animState.startsWith("m1_")));

      const dx = entry.tx - ex;
      const dy = entry.ty - ey;
      const moveSpeed = Math.sqrt(dx * dx + dy * dy);

      const ndx = moveSpeed > 1 ? -dx / moveSpeed : 0;
      const ndy = moveSpeed > 1 ? -dy / moveSpeed : 0;
      const angle = moveSpeed > 1 ? Math.atan2(dy, dx) : 0;
      const dist = 10;

      const wasMoving = this._wasMoving.get(id) || false;
      if (isMoving && !wasMoving && moveSpeed > 1) {
        this.smokeFx.spawnBurst(
          ex + ndx * dist, ey + ndy * 2 + 10,
          0, 1.0, angle, 0.25,
        );
      }
      this._wasMoving.set(id, isMoving);

      if (!isMoving || moveSpeed <= 1) {
        this._movePuffTimers.delete(id);
        return;
      }

      const interval = speed > 80 ? 300 : 500;
      const last = this._movePuffTimers.get(id) || 0;
      if (now - last < interval) return;
      this._movePuffTimers.set(id, now);

      this.smokeFx.spawnBurst(
        ex + ndx * dist, ey + ndy * 2 + 10,
        Math.floor(Math.random() * 3),
        0.7 + Math.random() * 0.2,
        angle,
        0.25,
      );
    });
  }

  _getEnemySmokeParams(e) {
    const ss = this.spriteScale[e.type] || 2;
    const speed = Math.sqrt(e.vx * e.vx + e.vy * e.vy);
    const spriteH = 18 * 2.5 * ss;
    const sprite = this.monsterSprites[e.type];
    const aspect = sprite ? sprite.naturalWidth / sprite.naturalHeight : 1;
    const spriteW = spriteH * aspect;
    const sizeFactor = Math.sqrt(spriteH * spriteW) / 45;
    const puffScale = 0.30 * Math.pow(sizeFactor, 0.7);
    return {
      interval: Math.max(350, Math.min(600, speed * 2)),
      threshold: 10,
      puffScale,
      burstScale: 0.40 * Math.pow(sizeFactor, 0.7),
      dist: spriteW < 160 ? spriteW * 0.30 : spriteW / 2 - 32 * puffScale,
      height: spriteH * 0.18,
      dirYOffset: spriteH * 0.06,
    };
  }

  _updateEnemyMovementSmoke(dt) {
    const interp = this.interpolationRef;
    if (!interp) return;
    const now = performance.now();

    interp.enemies.forEach((entry) => {
      const e = entry.raw;
      if (!e.alive || e.frozen || e.stunned) return;

      const dx = entry.tx - entry.x;
      const dy = entry.ty - entry.y;
      const moveSpeed = Math.sqrt(dx * dx + dy * dy);
      const rawSpeed = Math.sqrt(e.vx * e.vx + e.vy * e.vy);

      const cfg = this._getEnemySmokeParams(e);
      const ndx = moveSpeed > 1 ? -dx / moveSpeed : 0;
      const ndy = moveSpeed > 1 ? -dy / moveSpeed : 0;
      const angle = moveSpeed > 1 ? Math.atan2(dy, dx) : 0;

      const isMoving = rawSpeed > cfg.threshold;
      const wasMoving = this._enemyWasMoving.get(e.id) || false;

      if (isMoving && !wasMoving && rawSpeed > 1) {
        this.smokeFx.spawnBurst(
          entry.x + ndx * cfg.dist,
          entry.y + ndy * cfg.dirYOffset + cfg.height,
          0, cfg.burstScale, angle, 0.3,
        );
      }
      this._enemyWasMoving.set(e.id, isMoving);

      if (!isMoving || moveSpeed <= 1) {
        this._enemyMovePuffTimers.delete(e.id);
        return;
      }

      const last = this._enemyMovePuffTimers.get(e.id) || 0;
      if (now - last < cfg.interval) return;
      this._enemyMovePuffTimers.set(e.id, now);

      this.smokeFx.spawnBurst(
        entry.x + ndx * cfg.dist,
        entry.y + ndy * cfg.dirYOffset + cfg.height,
        Math.floor(Math.random() * 3),
        cfg.puffScale + Math.random() * 0.15,
        angle,
        0.25,
      );
    });
  }

  updateEffects(dt) {
    this.gojoVisual.update(dt);
    this.yutaVisual.update(dt);
    if (this.yutaVisual.needsShake) {
      this.triggerScreenShake(10, 0.18);
      this.yutaVisual.needsShake = false;
    }
    this.sukunaVisual.update(dt);
    this.yujiVisual.update(dt);
    this.megumiVisual.update(dt);
    this.hakariVisual.update(dt);
    this.domainVisual.update(dt);
    this.smokeFx.update(dt);
    this.bloodEffect.update(dt, this.interpolationRef?.players);
    this.hitImpact.update(dt);
    if (this.domainVisual._needsZoomReset) {
      this.domainVisual._needsZoomReset = false;
      this.startZoom(1, 400);
    }
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
    for (let i = this.damageNumbers.length - 1; i >= 0; i -= 1) {
      const dn = this.damageNumbers[i];
      dn.floatOffset += dn.vy * dt;
      dn.life -= dt;
      if (dn.life <= 0) {
        this.damageNumbers.splice(i, 1);
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

    this.updateDissolveEffects(dt);

    if (this.shakeIntensity > 0) {
      this.shakeTime += dt;
      if (this.shakeTime >= this.shakeDuration) {
        this.shakeIntensity = 0;
        this.camera.shakeX = 0;
        this.camera.shakeY = 0;
      } else {
        const decay = 1 - this.shakeTime / this.shakeDuration;
        const intensity = this.shakeIntensity * decay;
        this.camera.shakeX = (Math.random() * 2 - 1) * intensity;
        this.camera.shakeY = (Math.random() * 2 - 1) * intensity;
      }
    } else {
      this.camera.shakeX = 0;
      this.camera.shakeY = 0;
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
      const z = this.camera.zoom;

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
      const z = this.camera.zoom;

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

  spawnDamageNumber(targetId, amount, category = "other", fallbackX, fallbackY) {
    for (let i = 0; i < this.damageNumbers.length; i += 1) {
      const dn = this.damageNumbers[i];
      if (dn.targetId === targetId && dn.category === category) {
        dn.value += amount;
        dn.life = dn.maxLife;
        dn.floatOffset = 0;
        dn.vy = -60 - Math.random() * 40;
        dn.scale = Math.min(2, 0.8 + dn.value * 0.004);
        return;
      }
    }
    this.damageNumbers.push({
      targetId,
      value: amount,
      life: 1.2,
      maxLife: 1.2,
      offsetX: (Math.random() - 0.5) * 30,
      floatOffset: 0,
      vy: -60 - Math.random() * 40,
      scale: Math.min(2, 0.8 + amount * 0.004),
      category,
      fallbackX,
      fallbackY,
    });
  }

  clearEffects() {
    this.markers = [];
    this.redExplosions = [];
    this.blueExplosions = [];
    this.purpleExplosions = [];
    this.blackFlashes = [];
    this.crawlerExplosions = [];
    this.acidPuddles = [];
    this.damageNumbers = [];
    this.dissolveEffects = [];
    this.gojoVisual.m1Slashes = [];
    this.gojoVisual.effects.projectiles = [];
    this.gojoVisual.effects.beams = [];
    this.gojoVisual.effects.explosions = [];
    this.gojoVisual.effects.teleports = [];
    this.gojoVisual.effects.afterimages = [];
    this.yujiVisual.m1Fx = [];
    this.yujiVisual.flyingKneeEffects = [];
    this.yujiVisual.soulImpactEffects = [];
    this.yujiVisual.taidoBeatdownEffects = [];
    this.yutaVisual.rikaAttacks = [];
    this.yutaVisual.rikaSummons = [];
    this.yutaVisual.rikaHeavyImpacts = [];
    this.yutaVisual.needsShake = false;
    this.yutaVisual.beamParticles = [];
    this.yutaVisual.dashSlashes = [];
    this.yutaVisual.slashCuts = [];
    this.yutaVisual.rikaImpulses = [];
    this.yutaVisual.rikaDashes = [];
    this.yutaVisual.effects.pureLoves = [];
    this.yutaVisual.effects.katanaSlashes = [];
    this.yutaVisual.effects.rikas = new Map();
    this.domainVisual.shattering = [];
    this.hitImpact.clear();
  }

  drawMarkers() {
    const ctx = this.ctx;
    const z = this.camera.zoom;
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
    for (let i = 0; i < this.redExplosions.length; i += 1) {
      const e = this.redExplosions[i];
      const p = worldToScreen(this.camera, this.canvas, e.x, e.y);
      const t = e.life / e.ttl;
      const s = e.seed;
      const z = this.camera.zoom;

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
        ctx.lineWidth = 1 * z;
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
    const z = this.camera.zoom;
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
    const z = this.camera.zoom;
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

      // Red shockwave rings (0-35% of animation)
      if (t < 0.35) {
        const swT = t / 0.35;
        const radius = 20 + swT * 140;
        const swAlpha = (1 - swT) * 0.9;

        // Offset shockwave in attack direction
        const dirLen = Math.sqrt(bf.dirX * bf.dirX + bf.dirY * bf.dirY) || 1;
        const nx = bf.dirX / dirLen;
        const ny = bf.dirY / dirLen;
        const offset = 20 * swT;
        const sx = p.x + nx * offset * z;
        const sy = p.y + ny * offset * z;

        // Outer ring with strong red glow
        ctx.shadowColor = "#ff0000";
        ctx.shadowBlur = 50 * z;
        ctx.strokeStyle = `rgba(255,0,0,${swAlpha * 0.8})`;
        ctx.lineWidth = 6 * z;
        ctx.beginPath();
        ctx.arc(sx, sy, radius * z, 0, Math.PI * 2);
        ctx.stroke();

        // Middle ring (orange-red)
        ctx.shadowBlur = 30 * z;
        ctx.strokeStyle = `rgba(255,60,20,${swAlpha * 0.6})`;
        ctx.lineWidth = 3 * z;
        ctx.beginPath();
        ctx.arc(sx, sy, (radius * 0.75) * z, 0, Math.PI * 2);
        ctx.stroke();

        // Inner ring (bright yellow-white)
        ctx.shadowBlur = 20 * z;
        ctx.strokeStyle = `rgba(255,200,50,${swAlpha * 0.4})`;
        ctx.lineWidth = 2 * z;
        ctx.beginPath();
        ctx.arc(sx, sy, (radius * 0.5) * z, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Light aura around impact point (0-55% of animation)
      if (t < 0.55) {
        const auraT = t / 0.55;
        const auraRadius = (40 + auraT * 120) * z;
        const auraAlpha = (1 - auraT) * 0.3;
        const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, auraRadius);
        grad.addColorStop(0, `rgba(255,200,100,${auraAlpha * 0.5})`);
        grad.addColorStop(0.3, `rgba(255,50,0,${auraAlpha * 0.25})`);
        grad.addColorStop(0.6, `rgba(200,0,0,${auraAlpha * 0.1})`);
        grad.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(p.x, p.y, auraRadius, 0, Math.PI * 2);
        ctx.fill();

        // Light rays emitting from center
        ctx.save();
        ctx.globalAlpha = auraAlpha * 0.2;
        const rayCount = 12;
        ctx.strokeStyle = `rgba(255,200,50,0.6)`;
        ctx.lineWidth = (3 - auraT * 1.5) * z;
        ctx.shadowColor = "#ff4400";
        ctx.shadowBlur = 30 * z;
        ctx.beginPath();
        for (let r = 0; r < rayCount; r++) {
          const rayAngle = (r / rayCount) * Math.PI * 2 + auraT * 2;
          const rayLen = (20 + auraT * 60) * z;
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p.x + Math.cos(rayAngle) * rayLen, p.y + Math.sin(rayAngle) * rayLen);
        }
        ctx.stroke();
        ctx.restore();
      }

      // Core bright flash (0-25% of animation)
      if (t < 0.25) {
        const coreT = t / 0.25;
        const coreRadius = (15 + coreT * 30) * z;
        ctx.shadowColor = "#ff4400";
        ctx.shadowBlur = 60 * z;
        const coreGrad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, coreRadius);
        coreGrad.addColorStop(0, `rgba(255,255,255,${(1 - coreT) * 0.95})`);
        coreGrad.addColorStop(0.3, `rgba(255,200,50,${(1 - coreT) * 0.7})`);
        coreGrad.addColorStop(0.6, `rgba(255,50,0,${(1 - coreT) * 0.4})`);
        coreGrad.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = coreGrad;
        ctx.beginPath();
        ctx.arc(p.x, p.y, coreRadius, 0, Math.PI * 2);
        ctx.fill();
      }

      // Spark particles drawn directly (0-60% of animation)
      if (t < 0.6) {
        const sparkT = t / 0.6;
        const sparkSeed = bf.seed;
        const sparkRng = () => {
          let s = (sparkSeed * 9301 + 49297) % 233280 + i * 1000;
          s = (s * 9301 + 49297) % 233280;
          return s / 233280;
        };
        ctx.shadowBlur = 0;
        for (let s = 0; s < 8; s++) {
          const angle = sparkRng() * Math.PI * 2;
          const dist = sparkRng() * 80 * sparkT * z;
          const size = (3 - sparkT * 1.5) * z;
          const sparkAlpha = (1 - sparkT) * 0.7;
          const colors = ["#ffffff", "#ff4400", "#ffcc00", "#ff0000"];
          ctx.fillStyle = colors[Math.floor(sparkRng() * colors.length)];
          ctx.globalAlpha = sparkAlpha * alpha;
          ctx.beginPath();
          ctx.arc(p.x + Math.cos(angle) * dist, p.y + Math.sin(angle) * dist, size, 0, Math.PI * 2);
          ctx.fill();
        }
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

        // Main bolt: massive red border and huge black core with variable thickness
        const baseGlow = (16 - localT * 8) * bolt.thickness;
        const baseBlack = (9 - localT * 5) * bolt.thickness;

        const drawTapered = (points, wGlow, wBlack, tLimit, totalLen) => {
          if (points.length < 2) return;
          const drawLen = totalLen * tLimit;

          // Helper to draw a tapered pass
          const drawPass = (color, blur, baseWidth) => {
            ctx.globalAlpha = 1.0; // Force 1.0 opacity so overlapping segments don't create dark dots!
            ctx.shadowColor = blur > 0 ? "#ff0000" : "transparent";
            ctx.shadowBlur = blur * z;
            ctx.strokeStyle = color;
            ctx.lineCap = "round"; // Round caps blend segments seamlessly
            
            let acc = 0;
            for (let pi = 1; pi < points.length; pi++) {
              if (acc >= drawLen) break;
              
              const prev = points[pi - 1];
              const seg = points[pi].segLen;
              
              let currentX = points[pi].x;
              let currentY = points[pi].y;
              let actualSeg = seg;
              
              if (acc + seg > drawLen) {
                const frac = (drawLen - acc) / seg;
                currentX = prev.x + (points[pi].x - prev.x) * frac;
                currentY = prev.y + (points[pi].y - prev.y) * frac;
                actualSeg = seg * frac;
              }
              
              // Taper thickness: thick at base (acc=0), thin at tip (acc=drawLen)
              const taper = Math.max(0.05, 1.0 - (acc / totalLen));
              // Multiply by alpha so it shrinks and vanishes instead of becoming transparent
              ctx.lineWidth = baseWidth * taper * alpha * z;
              
              ctx.beginPath();
              ctx.moveTo(p.x + prev.x * z, p.y + prev.y * z);
              ctx.lineTo(p.x + currentX * z, p.y + currentY * z);
              ctx.stroke();
              
              acc += actualSeg;
            }
          };

          // Pass 1: Red Glow (Fully opaque to avoid overlap dots)
          drawPass("rgba(220,10,0,1)", 50, wGlow);
          // Pass 2: Black Core (Fully opaque)
          drawPass("rgba(0,0,0,1)", 0, wBlack);
        };

        drawTapered(bolt.points, baseGlow, baseBlack, localT, bolt.totalLen);

        // Branches
        for (let br = 0; br < bolt.branches.length; br++) {
          const branchT = Math.max(0, Math.min(1, (t - delay * 0.3 - 0.05) * 3.5));
          if (branchT <= 0) continue;
          const branchData = bolt.branches[br];
          
          const bGlow = 10 * branchData.thickness;
          const bBlack = 5 * branchData.thickness;
          drawTapered(branchData.points, bGlow, bBlack, branchT, branchData.totalLen);
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
    const zoom = this.camera.zoom;
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
    const zoom = this.camera.zoom;

    this.drawGrid();

    this.map.disputeZones.forEach((zone) => {
      const p = worldToScreen(this.camera, this.canvas, zone.x, zone.y);
      ctx.strokeStyle = "rgba(95,148,255,0.2)";
      ctx.fillStyle = "rgba(50,80,140,0.08)";
      ctx.lineWidth = 2 * zoom;
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
      ctx.lineWidth = 2 * zoom;
      ctx.fillRect(p.x, p.y, obs.w * zoom, obs.h * zoom);
      ctx.strokeRect(p.x + 0.5, p.y + 0.5, obs.w * zoom - 1, obs.h * zoom - 1);
    });

    const topLeft = worldToScreen(this.camera, this.canvas, 0, 0);
    ctx.strokeStyle = "rgba(170,200,255,0.2)";
    ctx.lineWidth = 3 * zoom;
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
    const z = this.camera.zoom;

    const renderList = [];
    domains.forEach((entry) => {
      activeOwnerIds.add(entry.raw.ownerId);
      renderList.push({ ownerId: entry.raw.ownerId, x: entry.x, y: entry.y, d: entry.raw });
    });

    this.domainVisual.expanding.forEach((visEntry, ownerId) => {
      if (!activeOwnerIds.has(ownerId)) {
        renderList.push({ 
           ownerId, 
           x: visEntry.x, 
           y: visEntry.y, 
           d: { ownerId, radius: visEntry.targetRadius || 400, barrierMaxHp: 0, barrierHp: 0 } 
        });
      }
    });

    renderList.forEach((item) => {
      const ownerId = item.ownerId;
      const d = item.d;

      const p = worldToScreen(this.camera, this.canvas, item.x, item.y);
      const isMine = ownerId === youId;

      const targetR = d.radius;
      const currentR = this.domainVisual.getCurrentRadius(ownerId, targetR);
      const expandProgress = this.domainVisual.getExpandProgress(ownerId);
      const expEntry = this.domainVisual.expanding.get(ownerId);
      const expandAlpha = Math.min(1, expandProgress * 1.5);
      const vz = currentR * z;

      if (currentR < 2) return;

      let char;
      try {
        char = this.domainVisual.getCharacter(ownerId);
      } catch (e) {
        console.error("getCharacter failed:", e);
        char = "o-honrado";
      }
      try {
        if (!expEntry || expEntry.phase >= 5) {
          this.domainVisual.renderParallax(ctx, this.camera, ownerId, char, item.x, item.y, p, vz, z, expandProgress, isMine, now, d);
        }
      } catch (e) {
        console.error("renderParallax call failed:", e);
      }

      ctx.save();

      // Draw Ink Splash Overlay (Covers the screen and/or domain depending on phase)
      try {
        this.domainVisual.renderInkSplashOverlay(ctx, p, vz, expEntry || { phase: 8 }, z, char, this.canvas.width, this.canvas.height);
      } catch (e) {
        console.error("renderInkSplashOverlay call failed:", e);
      }

      ctx.restore();
      ctx.save();

      // Draw domain birth (Crack and border)
      if (expEntry && !expEntry.collapseStartTime) {
        this.domainVisual.renderDomainBirth(ctx, p, vz, expEntry, now, z, char, isMine);
      }

      // Draw final smooth border when completely expanded
      if (!expEntry || expEntry.phase >= 7) {
        ctx.globalAlpha = expandAlpha;
        ctx.shadowColor = "#ffffff";
        ctx.shadowBlur = 30 * expandAlpha * z;
        ctx.strokeStyle = "rgba(255,255,255,0.95)";
        ctx.lineWidth = 4 * z;
        ctx.beginPath();
        ctx.arc(p.x, p.y, vz, 0, Math.PI * 2);
        ctx.stroke();
        ctx.shadowBlur = 0;
        ctx.strokeStyle = "rgba(255,255,255,0.5)";
        ctx.lineWidth = 1.5 * z;
        ctx.beginPath();
        ctx.arc(p.x, p.y, vz - 3 * z, 0, Math.PI * 2);
        ctx.stroke();
      }

      const isAssembling = !!(expEntry && !expEntry.collapseStartTime);
      if (!isAssembling && char !== 'portador-do-vinculo') {
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
      const ddx = cx - item.x;
      const ddy = cy - item.y;
      if (ddx * ddx + ddy * ddy <= currentR * currentR) {
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

  drawProjectiles(projectiles) {
    const ctx = this.ctx;
    const now = Date.now();
    const zoom = this.camera.zoom;
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
        ctx.shadowBlur = 65 * zoom;
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

        ctx.shadowBlur = 50 * zoom;
        const spriteSize = sphereR * 2.3 * pulse;
        if (this.hollowPurpleImg.complete && this.hollowPurpleImg.naturalWidth > 0) {
          ctx.drawImage(this.hollowPurpleImg, px - spriteSize / 2, py - spriteSize / 2, spriteSize, spriteSize);
        } else {
          ctx.shadowBlur = 30 * zoom;
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
            const sz = (1 + Math.sin(vein * 1.7 + d * 2.3 + now * 0.003) * 0.8 + 0.8) * zoom;
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
          const sz = (0.5 + Math.sin(i * 1.9 + now * 0.004) * 0.4 + 0.5) * zoom;
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
            const ax = ex + Math.cos(arcAngle) * arcLen * st + Math.sin(now * 0.005 + i + s) * 3 * zoom;
            const ay = ey + Math.sin(arcAngle) * arcLen * st + Math.cos(now * 0.005 + i + s) * 3 * zoom;
            const alpha = (0.3 - st * 0.15) * (0.6 + Math.sin(now * 0.006 + i * 1.1) * 0.2);
            ctx.fillStyle = `rgba(200,160,255,${alpha})`;
            ctx.beginPath();
            ctx.arc(ax, ay, 1.2 * zoom, 0, Math.PI * 2);
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
          ctx.shadowBlur = 100 * zoom;
          ctx.drawImage(this.blueImg, screen.x - size / 2, screen.y - size / 2, size, size);
          ctx.shadowColor = "#88ddff";
          ctx.shadowBlur = 20 * zoom;
          ctx.drawImage(this.blueImg, screen.x - size / 2, screen.y - size / 2, size, size);
        } else {
          ctx.fillStyle = "#4cb4ff";
          ctx.shadowColor = "#66ccff";
          ctx.shadowBlur = 80 * zoom;
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
          const sz = (3 + Math.sin(now * 0.005 + i) * 1) * (1 - phase * 0.5) * zoom;
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
        ctx.shadowBlur = 70 * zoom;
        ctx.drawImage(this.redImg, screen.x - spriteSize / 2, screen.y - spriteSize / 2, spriteSize, spriteSize);
        ctx.shadowColor = "#ff6080";
        ctx.shadowBlur = 20 * zoom;
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
            const sz = (1.2 + Math.sin(vein * 1.7 + d * 2.3 + now * 0.004) * 1 + 1) * zoom;
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
          const sz = (0.6 + Math.sin(i * 1.9 + now * 0.005) * 0.5 + 0.6) * zoom;
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
          const sz = (1.5 + Math.abs(Math.sin(now * 0.008 + i * 0.7)) * 2.5) * zoom;
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
            const ax = ex + Math.cos(arcAngle) * arcLen * st + Math.sin(now * 0.006 + i + s) * 4 * zoom;
            const ay = ey + Math.sin(arcAngle) * arcLen * st + Math.cos(now * 0.006 + i + s) * 4 * zoom;
            const alpha = (0.3 - st * 0.15) * (0.6 + Math.sin(now * 0.007 + i * 1.1) * 0.3);
            ctx.fillStyle = `rgba(255,170,190,${alpha})`;
            ctx.beginPath();
            ctx.arc(ax, ay, 1.2 * zoom, 0, Math.PI * 2);
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

  applyEnemyDomainClip(ctx, enemyEntry, domains) {
    if (!domains || domains.size === 0) {
      return false;
    }

    let clipped = false;
    domains.forEach((entry) => {
      const d = entry.raw || entry;
      const currentR = this.domainVisual.getCurrentRadius(d.ownerId, d.radius);
      if (currentR < 2) return;

      // Skip hard clip during domain expansion (phases 1-7) to avoid cutting sprites
      const exp = this.domainVisual.expanding.get(d.ownerId);
      if (exp && exp.phase < 8) return;

      const dx = enemyEntry.x - entry.x;
      const dy = enemyEntry.y - entry.y;
      const enemyInside = dx * dx + dy * dy <= currentR * currentR;
      const p = worldToScreen(this.camera, this.canvas, entry.x, entry.y);
      const vz = currentR * this.camera.zoom;

      ctx.beginPath();
      if (enemyInside) {
        ctx.arc(p.x, p.y, vz, 0, Math.PI * 2);
      } else {
        ctx.rect(0, 0, this.canvas.clientWidth, this.canvas.clientHeight);
        ctx.arc(p.x, p.y, vz, 0, Math.PI * 2, true);
      }
      if (enemyInside) {
        ctx.clip();
      } else {
        ctx.clip("evenodd");
      }
      clipped = true;
    });

    return clipped;
  }

  drawEnemies(enemies, domains) {
    const ctx = this.ctx;
    const zoom = this.camera.zoom;
    const now = Date.now();

    // Prune visual HP tracking map
    if (this.enemyHpVisuals) {
      const activeIds = new Set(enemies.keys());
      for (const id of this.enemyHpVisuals.keys()) {
        if (!activeIds.has(id)) {
          this.enemyHpVisuals.delete(id);
        }
      }
    }

    const spriteScale = this.spriteScale;
    const bobConfig = {
      crawler_nest: { freq: 3, amp: 3, minSpeed: 2 },
      fleshmaw: { freq: 1.5, amp: 2, minSpeed: 3 },
      staring_beast: { freq: 2, amp: 2, minSpeed: 3 },
    };

    enemies.forEach((entry) => {
      const e = entry.raw;
      const p = worldToScreen(this.camera, this.canvas, entry.x, entry.y);
      const baseRadius = e.type === "boss" ? 34 : e.type === "elite" ? 24 : 18;
      const frozen = Boolean(e.frozen);
      const stunned = Boolean(e.stunVisual) && !frozen;
      const stunSeed = e.id ? e.id.length : 0;
      const stunShakeX = stunned ? Math.sin(now * 0.05 + stunSeed) * 3 * zoom : 0;
      const stunShakeY = stunned ? Math.cos(now * 0.065 + stunSeed) * 2 * zoom : 0;

      const walkSpeed = Math.sqrt(e.vx * e.vx + e.vy * e.vy);
      const bc = bobConfig[e.type] || { freq: 1, amp: 2, minSpeed: 5 };
      const bob = walkSpeed > bc.minSpeed
        ? Math.sin(now * 0.008 * bc.freq + (e.id ? e.id.length : 0) * 2.3) * bc.amp * zoom
        : 0;
      const drawY = p.y + bob;
      const drawX = p.x + stunShakeX;
      const renderY = drawY + stunShakeY;

      ctx.save();
      this.applyEnemyDomainClip(ctx, entry, domains);

      const sprite = this.monsterSprites[e.type];
      if (sprite) {
        const mult = spriteScale[e.type] || 1;
        const aspect = sprite.naturalWidth / sprite.naturalHeight;
        const h = baseRadius * 2.5 * mult * zoom;
        const w = h * aspect;
        ctx.save();
        if (stunned) ctx.translate(stunShakeX, stunShakeY);
        let facing = this.enemyFacing.get(e.id);
        if (Math.abs(e.vx || 0) > 1) facing = (e.vx || 0) > 0 ? -1 : 1;
        if (!facing) facing = 1;
        this.enemyFacing.set(e.id, facing);
        if (e.type === "staring_beast" ? facing > 0 : facing < 0) {
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

        this.drawEnemyHealthBar(ctx, p.x, drawY - h / 2 - 8 * zoom, e, zoom);

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
          const attackMlen = Math.sqrt((e.attackDirX || 0) * (e.attackDirX || 0) + (e.attackDirY || 0) * (e.attackDirY || 0));
          const dirX = attackMlen > 0.01 ? (e.attackDirX || 0) / attackMlen : (facing < 0 ? 1 : -1);
          const dirY = attackMlen > 0.01 ? (e.attackDirY || 0) / attackMlen : 0.01;
          if (atkSprite && atkSprite.naturalWidth > 0) {
            const atkAspect = atkSprite.naturalWidth / atkSprite.naturalHeight;
            const atkW = w * 0.5;
            const atkH = atkW / atkAspect;
            ctx.save();
            ctx.translate(p.x, drawY);
            if (dirX < 0) ctx.scale(-1, 1);
            ctx.rotate(Math.atan2(dirY, Math.abs(dirX || 0.01)));
            ctx.drawImage(atkSprite, -atkW / 2 + h * 0.2, -atkH / 2, atkW, atkH);
            ctx.restore();
          } else if (atkSprite) {
            ctx.fillStyle = "rgba(50,70,40,0.7)";
            ctx.beginPath();
            ctx.arc(p.x, drawY, h * 0.2, 0, Math.PI * 2);
            ctx.fill();
          }
        }

        if (e.type === "staring_beast") {
          if (e.windupTimer > 0) {
            const progress = 1 - Math.max(0, e.windupTimer) / (e.attackWindup || 0.5);
            const frameIdx = Math.min(7, Math.floor(progress * 8));
            const atkSprite = this.staringBeastAttackFrames[frameIdx];
            const atkMlen = Math.sqrt((e.attackDirX || 0) * (e.attackDirX || 0) + (e.attackDirY || 0) * (e.attackDirY || 0));
            const dirX = atkMlen > 0.01 ? (e.attackDirX || 0) / atkMlen : (facing < 0 ? 1 : -1);
            const dirY = atkMlen > 0.01 ? (e.attackDirY || 0) / atkMlen : 0.01;
            if (atkSprite && atkSprite.naturalWidth > 0) {
              const atkSize = h * 0.7;
              ctx.save();
              ctx.translate(p.x, drawY + h * 0.2);
              if (dirX < 0) ctx.scale(-1, 1);
              ctx.rotate(Math.atan2(dirY, Math.abs(dirX || 0.01)));
              ctx.translate(atkSize * 0.5, 0);
              ctx.drawImage(atkSprite, -atkSize / 2, -atkSize / 2, atkSize, atkSize);
              ctx.restore();
            } else if (atkSprite) {
              ctx.fillStyle = "rgba(160, 80, 255, 0.7)";
              ctx.beginPath();
              ctx.arc(p.x, drawY + h * 0.2, h * 0.3, 0, Math.PI * 2);
              ctx.fill();
            }
          }

          if (this._players) {
            const hasTarget = [...this._players.values()].some(entry => {
              const pl = entry.raw;
              return pl.alive && Math.hypot(e.x - pl.x, e.y - pl.y) < 200;
            });
            if (hasTarget) {
              const eyeY = drawY - h / 2 - 25 * zoom + Math.sin(now * 0.005) * 5 * zoom;
              if (this.staringBeastEyeSprite && this.staringBeastEyeSprite.complete && this.staringBeastEyeSprite.naturalWidth > 0) {
                const aspect = this.staringBeastEyeSprite.naturalWidth / this.staringBeastEyeSprite.naturalHeight;
                const eyeH = 42 * zoom;
                const eyeW = eyeH * aspect;
                ctx.save();
                ctx.shadowColor = "#9933ff";
                ctx.shadowBlur = 25 * zoom;
                ctx.drawImage(this.staringBeastEyeSprite, p.x - eyeW / 2, eyeY - eyeH / 2, eyeW, eyeH);
                ctx.restore();
              } else {
                this._drawProceduralPurpleEye(ctx, p.x, eyeY, 12 * zoom, now);
              }
            }
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
          ctx.shadowBlur = 16 * zoom;
        }
        ctx.lineWidth = 2 * zoom;
        ctx.beginPath();
        ctx.arc(drawX, renderY, baseRadius * zoom, 0, Math.PI * 2);
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

        this.drawEnemyHealthBar(ctx, p.x, drawY - baseRadius * zoom - 12 * zoom, e, zoom);
      }
      ctx.restore();
    });
  }

  drawEnemyHealthBar(ctx, x, y, e, zoom) {
    const hpPct = e.maxHp > 0 ? Math.max(0, Math.min(1, e.hp / e.maxHp)) : 0;

    // Visual catch-up bar for damage lag
    if (!this.enemyHpVisuals) {
      this.enemyHpVisuals = new Map();
    }
    let visualHp = this.enemyHpVisuals.get(e.id);
    if (visualHp === undefined) {
      visualHp = hpPct;
    } else {
      // Interpolate towards actual hp percentage
      const dt = this._renderDt || 0.016;
      if (visualHp > hpPct) {
        visualHp = Math.max(hpPct, visualHp - dt * 0.5);
      } else {
        visualHp = hpPct;
      }
    }
    this.enemyHpVisuals.set(e.id, visualHp);

    const grade = e.grade;

    ctx.save();

    if (grade === "special") {
      // BOSS / SPECIAL GRADE HEALTH BAR: highly detailed, gothic/fantasy style
      const barW = 125 * zoom;
      const barH = 10 * zoom;
      const bx = x - barW / 2;
      const by = y - 4 * zoom;

      // Draw shadow and glow
      ctx.shadowColor = "#ff0055";
      ctx.shadowBlur = 10 * zoom;

      // Background fill
      ctx.fillStyle = "rgba(10, 10, 15, 0.85)";
      ctx.strokeStyle = "rgba(220, 180, 100, 0.85)"; // Golden border
      ctx.lineWidth = 1.5 * zoom;

      // Draw ornamental border (hexagonal/winged shape)
      ctx.beginPath();
      ctx.moveTo(bx - 6 * zoom, by + barH / 2);
      ctx.lineTo(bx, by);
      ctx.lineTo(bx + barW, by);
      ctx.lineTo(bx + barW + 6 * zoom, by + barH / 2);
      ctx.lineTo(bx + barW, by + barH);
      ctx.lineTo(bx, by + barH);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.shadowBlur = 0; // Turn off shadow blur for inside bars

      // Damage lag bar (yellow/orange catch-up)
      if (visualHp > hpPct) {
        ctx.fillStyle = "#ffb703";
        ctx.fillRect(bx + 1 * zoom, by + 1 * zoom, (barW - 2 * zoom) * visualHp, barH - 2 * zoom);
      }

      // Actual HP bar (Cursed crimson gradient)
      const grad = ctx.createLinearGradient(bx, by, bx + barW, by);
      grad.addColorStop(0, "#800020"); // Deep burgundy
      grad.addColorStop(0.5, "#d90429"); // Crimson
      grad.addColorStop(1, "#ef233c"); // Bright red
      ctx.fillStyle = grad;
      ctx.fillRect(bx + 1 * zoom, by + 1 * zoom, (barW - 2 * zoom) * hpPct, barH - 2 * zoom);

      // Phase segments / notches
      ctx.strokeStyle = "rgba(0, 0, 0, 0.4)";
      ctx.lineWidth = 1.5 * zoom;
      const segments = 4;
      for (let i = 1; i < segments; i++) {
        const sx = bx + (barW / segments) * i;
        ctx.beginPath();
        ctx.moveTo(sx, by + 1 * zoom);
        ctx.lineTo(sx, by + barH - 1 * zoom);
        ctx.stroke();
      }

      // Fancy golden tips
      ctx.fillStyle = "#ffd166";
      ctx.beginPath();
      // Left diamond tip
      ctx.moveTo(bx - 9 * zoom, by + barH / 2);
      ctx.lineTo(bx - 6 * zoom, by + barH / 2 - 3 * zoom);
      ctx.lineTo(bx - 3 * zoom, by + barH / 2);
      ctx.lineTo(bx - 6 * zoom, by + barH / 2 + 3 * zoom);
      ctx.closePath();
      ctx.fill();

      // Right diamond tip
      ctx.beginPath();
      ctx.moveTo(bx + barW + 9 * zoom, by + barH / 2);
      ctx.lineTo(bx + barW + 6 * zoom, by + barH / 2 - 3 * zoom);
      ctx.lineTo(bx + barW + 3 * zoom, by + barH / 2);
      ctx.lineTo(bx + barW + 6 * zoom, by + barH / 2 + 3 * zoom);
      ctx.closePath();
      ctx.fill();

    } else if (grade === 1) {
      // GRADE 1: wider, distinct crimson gradient, white/silver border
      const barW = 75 * zoom;
      const barH = 7 * zoom;
      const bx = x - barW / 2;
      const by = y;

      // Background
      ctx.fillStyle = "rgba(15, 20, 30, 0.8)";
      ctx.strokeStyle = "rgba(220, 225, 235, 0.75)"; // Silver-ish border
      ctx.lineWidth = 1.2 * zoom;

      // Rounded/slanted rectangle for base
      ctx.beginPath();
      ctx.moveTo(bx - 3 * zoom, by);
      ctx.lineTo(bx + barW + 3 * zoom, by);
      ctx.lineTo(bx + barW, by + barH);
      ctx.lineTo(bx, by + barH);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Damage lag bar
      if (visualHp > hpPct) {
        ctx.fillStyle = "#ffb703";
        ctx.beginPath();
        ctx.moveTo(bx, by + 1 * zoom);
        ctx.lineTo(bx + barW * visualHp, by + 1 * zoom);
        ctx.lineTo(bx + barW * visualHp - 1 * zoom, by + barH - 1 * zoom);
        ctx.lineTo(bx, by + barH - 1 * zoom);
        ctx.closePath();
        ctx.fill();
      }

      // HP Fill (Fire gradient)
      const grad = ctx.createLinearGradient(bx, by, bx + barW, by);
      grad.addColorStop(0, "#d90429");
      grad.addColorStop(1, "#ff5d8f");
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(bx, by + 1 * zoom);
      ctx.lineTo(bx + (barW - 1 * zoom) * hpPct, by + 1 * zoom);
      ctx.lineTo(bx + (barW - 1 * zoom) * hpPct - 1 * zoom, by + barH - 1 * zoom);
      ctx.lineTo(bx, by + barH - 1 * zoom);
      ctx.closePath();
      ctx.fill();

    } else if (grade === 2) {
      // GRADE 2: similar to grade 3 but slightly wider and has clean styling
      const barW = 48 * zoom;
      const barH = 5 * zoom;
      const bx = x - barW / 2;
      const by = y + 2 * zoom;

      // Background
      ctx.fillStyle = "rgba(10, 12, 18, 0.75)";
      ctx.strokeStyle = "rgba(255, 255, 255, 0.25)";
      ctx.lineWidth = 1 * zoom;
      ctx.fillRect(bx, by, barW, barH);
      ctx.strokeRect(bx, by, barW, barH);

      // Damage lag bar
      if (visualHp > hpPct) {
        ctx.fillStyle = "rgba(255, 183, 3, 0.7)";
        ctx.fillRect(bx + 0.5 * zoom, by + 0.5 * zoom, (barW - 1 * zoom) * visualHp, barH - 1 * zoom);
      }

      // HP Fill (Coral red)
      ctx.fillStyle = "#ff4d6d";
      ctx.fillRect(bx + 0.5 * zoom, by + 0.5 * zoom, (barW - 1 * zoom) * hpPct, barH - 1 * zoom);

    } else {
      // GRADE 3 or default: smaller, simpler
      const barW = 34 * zoom;
      const barH = 4 * zoom;
      const bx = x - barW / 2;
      const by = y + 3 * zoom;

      // Background
      ctx.fillStyle = "rgba(10, 12, 18, 0.7)";
      ctx.fillRect(bx, by, barW, barH);

      // HP Fill (Simple red/pink)
      ctx.fillStyle = "#ff6e8f";
      ctx.fillRect(bx, by, barW * hpPct, barH);
    }

    ctx.restore();
  }

  drawPlayers(players, youId, localPred) {
    const ctx = this.ctx;
    const now = performance.now();
    this.yutaVisual.updateBeamsFromPlayerSnapshots(players);
    players.forEach((entry) => {
      const p = entry.raw;
      const isYou = p.id === youId;
      const chara = p.character || "o-honrado";
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
        const distSq = dx * dx + dy * dy;
        if (distSq > 19600) {
          this.localVisualPos.x = localPred.x;
          this.localVisualPos.y = localPred.y;
        } else {
          const follow = distSq > 784 ? 0.52 : 0.38;
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
      const isM1 = p.animState && p.animState.startsWith("m1_");

      let m1Expiry = this.m1FacingTimers.get(p.id) || 0;
      if (isM1) {
        m1Expiry = now + 500;
        this.m1FacingTimers.set(p.id, m1Expiry);
      }
      const recentlyM1 = now < m1Expiry;

      if (recentlyM1 && Number.isFinite(p.aimX) && Number.isFinite(p.aimY)) {
        const aimDx = p.aimX - rx;
        if (Math.abs(aimDx) > 1) {
          facing = aimDx < 0 ? -1 : 1;
          this.playerFacing.set(p.id, facing);
        }
      } else if (p.pureLoveActive && Number.isFinite(p.aimX)) {
        const aimDx = p.aimX - rx;
        if (Math.abs(aimDx) > 1) {
          facing = aimDx < 0 ? -1 : 1;
          this.playerFacing.set(p.id, facing);
        }
      } else if (Math.abs(pvx) > 1) {
        facing = pvx < 0 ? -1 : 1;
        this.playerFacing.set(p.id, facing);
      }

      const dashState = this.dashVisuals.has(p.id) ? "dash" : null;
      const stunned = Boolean(p.stunVisual) && !p.frozen;
      const stunSeed = p.id ? p.id.length : 0;
      const stunShakeX = stunned ? Math.sin(now * 0.05 + stunSeed) * 3 : 0;
      const stunShakeY = stunned ? Math.cos(now * 0.065 + stunSeed) * 2 : 0;

      ctx.save();
      if (!p.alive) {
        ctx.globalAlpha = 0.35;
      }

      if (p.recoveryActive && p.alive) {
        const sp = worldToScreen(this.camera, this.canvas, rx, ry);
        const erFrame = Math.floor(now * 0.009) % this._erFrames;
        this._drawERFrame(ctx, sp.x, sp.y, 140 * this.camera.zoom, erFrame, p.character, 1);
      }

      visual.renderPlayer(ctx, this.camera, entry, isYou, facing, dashState, rx + stunShakeX, ry + stunShakeY, this._renderDt);

      if (p.recoveryActive && p.alive) {
        const sp = worldToScreen(this.camera, this.canvas, rx, ry);
        const erFrame = Math.floor(now * 0.009) % this._erFrames;
        this._drawERFrame(ctx, sp.x, sp.y, 140 * this.camera.zoom, erFrame, p.character, 0.25);
      }

      ctx.restore();

      if (p.frozen) {
        const sp = worldToScreen(this.camera, this.canvas, rx, ry);
        ctx.save();
        ctx.strokeStyle = "rgba(255,255,255,0.85)";
        ctx.lineWidth = 3 * (this.camera.zoom);
        ctx.setLineDash([5 * (this.camera.zoom), 5 * (this.camera.zoom)]);
        ctx.beginPath();
        ctx.arc(sp.x, sp.y, 22 * (this.camera.zoom), 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
      }

      if (p.staringStacks > 0) {
        const sp = worldToScreen(this.camera, this.canvas, rx, ry);
        const zoom = this.camera.zoom;
        const nameOffsets = {
          "rei-amaldicoado": 70, "invocador-de-sombras": 70, "lutador-de-sorte": 70,
          "o-honrado": 120.5, "portador-do-vinculo": 120.5,
          "punho-indomavel": 133.5,
        };
        const base = nameOffsets[p.character] || 120.5;

        if (this._isPlayerInStaringAura(rx, ry)) {
          const eyeY = sp.y - (base + 20) * zoom + Math.sin(now * 0.005) * 5 * zoom;
          let eyeAlpha = this._staringEyeOpacity.get(p.id) || 0;
          eyeAlpha = Math.min(1, eyeAlpha + this._renderDt * 4);
          this._staringEyeOpacity.set(p.id, eyeAlpha);
          if (this.staringBeastEyeSprite && this.staringBeastEyeSprite.complete && this.staringBeastEyeSprite.naturalWidth > 0) {
            const aspect = this.staringBeastEyeSprite.naturalWidth / this.staringBeastEyeSprite.naturalHeight;
            const eyeH = 35 * zoom;
            const eyeW = eyeH * aspect;
            ctx.save();
            ctx.globalAlpha = eyeAlpha;
            ctx.shadowColor = "#9933ff";
            ctx.shadowBlur = 25 * zoom;
            ctx.drawImage(this.staringBeastEyeSprite, sp.x - eyeW / 2, eyeY - eyeH / 2, eyeW, eyeH);
            ctx.restore();
          } else {
            ctx.save();
            ctx.globalAlpha = eyeAlpha;
            this._drawProceduralPurpleEye(ctx, sp.x, eyeY, 10 * zoom, now);
            ctx.restore();
          }
        } else {
          let eyeAlpha = this._staringEyeOpacity.get(p.id) || 0;
          if (eyeAlpha > 0) {
            eyeAlpha = Math.max(0, eyeAlpha - this._renderDt * 4);
            this._staringEyeOpacity.set(p.id, eyeAlpha);
          }
        }

        this._drawStaringSlowVFX(ctx, sp, zoom, now, base, p.character);
      }
    });
  }

  _drawStaringSlowVFX(ctx, sp, zoom, now, base, character) {
    const cfg = CHAR_SPRITE[character] || CHAR_SPRITE["o-honrado"];
    const sprW = cfg.cw * cfg.rs * zoom;
    const sprH = cfg.ch * cfg.rs * zoom;
    const cx = sp.x;
    const cy = sp.y - cfg.ph * cfg.rs * zoom + sprH / 2;
    const h = sprH;
    const topY = cy - h * 0.50;
    const botY = cy + h * 0.48;
    const baseAmp = sprW * 0.35;
    const time = now * 0.002;

    ctx.save();

    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, h * 0.55);
    grad.addColorStop(0, "rgba(100, 40, 170, 0.06)");
    grad.addColorStop(0.5, "rgba(70, 25, 130, 0.04)");
    grad.addColorStop(1, "rgba(30, 5, 60, 0)");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(cx, cy, h * 0.55, 0, Math.PI * 2);
    ctx.fill();

    const ribbonColors = ["#b07cf0", "#8a4fd0", "#6a2ab0"];
    for (let i = 0; i < 3; i++) {
      const phaseOff = (i / 3) * Math.PI * 2;
      ctx.save();
      ctx.shadowColor = "#9933ff";
      ctx.shadowBlur = 10 * zoom;
      ctx.globalAlpha = 0.35;
      ctx.strokeStyle = ribbonColors[i];
      ctx.lineWidth = 3 * zoom;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.beginPath();
      const steps = 40;
      for (let j = 0; j <= steps; j++) {
        const t = j / steps;
        const y = topY + (botY - topY) * t;
        const ampMul = Math.sin(t * Math.PI) * 0.55;
        const amp = (baseAmp + sprW * 0.08 * Math.sin(time * 0.4 + i)) * ampMul;
        const x = cx + Math.sin(t * Math.PI * 3.5 + time + phaseOff) * amp;
        if (j === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.restore();
    }

    const innerColors = ["#d4a0ff", "#c080f0", "#b060e0"];
    for (let i = 0; i < 3; i++) {
      const phaseOff = (i / 3) * Math.PI * 2 + 0.5;
      ctx.save();
      ctx.shadowColor = "#b07cf0";
      ctx.shadowBlur = 6 * zoom;
      ctx.globalAlpha = 0.2;
      ctx.strokeStyle = innerColors[i];
      ctx.lineWidth = 1.5 * zoom;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.beginPath();
      const steps = 30;
      for (let j = 0; j <= steps; j++) {
        const t = j / steps;
        const y = topY + (botY - topY) * t;
        const ampMul = Math.sin(t * Math.PI) * 0.4;
        const amp = (sprW * 0.14 + sprW * 0.06 * Math.sin(time * 0.5 + i * 1.2)) * ampMul;
        const x = cx + Math.sin(t * Math.PI * 4 + time * 1.2 + phaseOff) * amp;
        if (j === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.restore();
    }

    const numParticles = 10;
    for (let i = 0; i < numParticles; i++) {
      const seed = i * 1.37;
      const t = ((i / numParticles) + (time * 0.04) % 1) % 1;
      const y = topY + (botY - topY) * t;
      const amp = sprW * 0.28 * Math.sin(t * Math.PI);
      const x = cx + Math.sin(t * Math.PI * 3.5 + time + seed) * amp + Math.sin(seed * 2.3 + time * 0.5) * 3 * zoom;
      const py = y + Math.sin(seed * 3.1 + time * 1.5) * 2 * zoom;
      const colors = ["#d4a0ff", "#b07cf0", "#e0c0ff", "#c080f0"];
      const col = colors[i % colors.length];
      const size = (1.5 + Math.sin(seed * 4.3 + time * 2) * 0.5) * zoom;
      const alpha = 0.35 + 0.3 * ((Math.sin(seed * 5 + time * 3) * 0.5 + 0.5));

      ctx.save();
      ctx.shadowColor = "#b07cf0";
      ctx.shadowBlur = 8 * zoom;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.arc(x, py, size, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    ctx.restore();
  }

  _isPlayerInStaringAura(wx, wy) {
    if (!this._enemies) return false;
    let inRange = false;
    this._enemies.forEach((entry) => {
      const e = entry.raw;
      if (e.type === "staring_beast" && Math.hypot(e.x - wx, e.y - wy) < 200) {
        inRange = true;
      }
    });
    return inRange;
  }

  _getERImg(character) {
    if (!this._erImgs[character]) {
      const img = new Image();
      img.src = `/assets/energyrecover/energyspritesheet_${character}.png`;
      this._erImgs[character] = img;
    }
    return this._erImgs[character];
  }

  _drawERFrame(ctx, spX, spY, drawW, frameIdx, character, globalAlphaMul) {
    const img = this._getERImg(character);
    if (!img.complete || img.naturalWidth === 0) return;
    const col = frameIdx % this._erCols;
    const row = Math.floor(frameIdx / this._erCols);
    const drawH = this._erFrameH * (drawW / this._erFrameW);
    const dx = spX - drawW / 2;
    const dy = spY - drawH / 2;
    if (globalAlphaMul < 1) ctx.globalAlpha = globalAlphaMul;
    ctx.drawImage(
      img,
      col * this._erFrameW, row * this._erFrameH, this._erFrameW, this._erFrameH,
      dx, dy, drawW, drawH
    );
    if (globalAlphaMul < 1) ctx.globalAlpha = 1;
  }

  drawM1PunchEffects() {
    const ctx = this.ctx;
    for (let i = 0; i < this.gojoVisual.m1Slashes.length; i++) {
      const slash = this.gojoVisual.m1Slashes[i];
      if (slash.life <= 0) continue;
      const pos = worldToScreen(this.camera, this.canvas, slash.worldX, slash.worldY);
      const progress = 1 - slash.life / slash.maxLife;

      drawGojoM1Slash(ctx, pos.x, pos.y, slash.dirX, slash.dirY, progress, slash.comboStep,
        this.gojoVisual.gojoM1Vertical, this.gojoVisual.gojoM1Horizontal, this.camera.zoom);
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

  drawDamageNumbers() {
    const ctx = this.ctx;
    const z = this.camera.zoom;

    for (let i = 0; i < this.damageNumbers.length; i += 1) {
      const dn = this.damageNumbers[i];
      let targetX, targetY;
      if (dn.targetId && this.interpolationRef) {
        const entity = this.interpolationRef.players.get(dn.targetId) || this.interpolationRef.enemies.get(dn.targetId);
        if (entity) {
          targetX = entity.x;
          targetY = entity.y;
          dn._lastX = targetX;
          dn._lastY = targetY;
        } else if (dn._lastX != null) {
          targetX = dn._lastX;
          targetY = dn._lastY;
        } else if (dn.fallbackX != null) {
          targetX = dn.fallbackX;
          targetY = dn.fallbackY;
        } else {
          continue;
        }
      } else {
        targetX = dn.x;
        targetY = dn.y;
      }
      const p = worldToScreen(this.camera, this.canvas, targetX + dn.offsetX, targetY + (dn.floatOffset || 0));
      const t = Math.max(0, dn.life / dn.maxLife);
      let alpha = Math.min(1, t * 3) * (t > 0.7 ? 1 : t / 0.7);
      if (alpha <= 0) continue;

      let fillColor, strokeColor, scaleMul;
      if (dn.category === "self") {
        fillColor = `rgba(255,51,51,${alpha})`;
        strokeColor = `rgba(102,0,0,${0.7 * alpha})`;
        scaleMul = 1.1;
      } else if (dn.category === "dealt") {
        fillColor = `rgba(255,255,255,${alpha})`;
        strokeColor = `rgba(0,0,0,${0.7 * alpha})`;
        scaleMul = 1.0;
      } else {
        fillColor = `rgba(170,170,170,${alpha * 0.35})`;
        strokeColor = `rgba(85,85,85,${0.7 * alpha * 0.35})`;
        scaleMul = 0.6;
      }

      const fontSize = Math.round(14 * dn.scale * scaleMul * z);
      ctx.save();

      ctx.font = `800 ${fontSize}px "Rajdhani", Arial, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      ctx.shadowColor = "rgba(0,0,0,0.9)";
      ctx.shadowBlur = 6 * z;

      ctx.fillStyle = fillColor;
      ctx.fillText(Math.round(dn.value), p.x, p.y);

      ctx.shadowBlur = 0;

      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = Math.max(2, 3 * z);
      ctx.lineJoin = "round";
      ctx.strokeText(Math.round(dn.value), p.x, p.y);

      ctx.fillStyle = fillColor;
      ctx.fillText(Math.round(dn.value), p.x, p.y);

      ctx.restore();
    }
  }

  render({ interpolation, youId, you, localPred }) {
    const now = performance.now();
    this._renderDt = this._lastRenderTime ? Math.min((now - this._lastRenderTime) / 1000, 0.05) : 1 / 60;
    this._lastRenderTime = now;
    this.interpolationRef = interpolation || this.interpolationRef;
    this._updateMovementSmoke(this._renderDt);
    this._updateEnemyMovementSmoke(this._renderDt);
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
      this._players = interpolation.players;
      this._enemies = interpolation.enemies;
      this.particles.render(this.ctx, this.camera, "back");
      this.smokeFx.render(this.ctx, this.camera);
      this.drawEnemies(interpolation.enemies, interpolation.domains);
      this.drawDissolveEffects();
      this.drawM1PunchEffects();
      this.bloodEffect.render(this.ctx, this.camera);
      this.hitImpact.render(this.ctx, this.camera);
      this.drawPlayers(interpolation.players, youId, localPred);
      this.gojoVisual.renderEffects(this.ctx, this.camera);
      this.yutaVisual.renderEffects(this.ctx, this.camera);
      this.sukunaVisual.renderEffects(this.ctx, this.camera);
      this.yujiVisual.renderEffects(this.ctx, this.camera);
      this.megumiVisual.renderEffects(this.ctx, this.camera);
      this.hakariVisual.renderEffects(this.ctx, this.camera);
      this.drawM1PunchEffects();
      this.particles.render(this.ctx, this.camera, "front");
      this.drawDamageNumbers();
      this.ctx.save();
      this.drawDomainPrivacy(interpolation.domains, you, localPred, this.canvas.clientWidth, this.canvas.clientHeight);
      this.ctx.restore();
      
      // Draw Domain Entry Effects (Flash, Typography) over everything
      this.domainVisual.drawEntryEffects(this.ctx, this.camera, this.canvas);
    }
  }

  drawDomainPrivacy(domains, you, localPred, w, h) {
    if (!domains || domains.size === 0) return;
    const ctx = this.ctx;
    const px = localPred ? localPred.x : (you ? you.x : 0);
    const py = localPred ? localPred.y : (you ? you.y : 0);

    let viewerInsideAny = false;
    let privacyAlpha = 0;

    domains.forEach((entry) => {
      const d = entry.raw || entry;
      const ex = entry.x;
      const ey = entry.y;
      const targetR = d.radius;
      const currentR = this.domainVisual.getCurrentRadius(d.ownerId, targetR);
      if (currentR < 2) return;
      const progress = this.domainVisual.getExpandProgress(d.ownerId);
      const entryAlpha = progress <= 0.64 ? 0 : Math.min(1, (progress - 0.64) / 0.08);
      if (entryAlpha > privacyAlpha) privacyAlpha = entryAlpha;
      const vz = currentR * this.camera.zoom;
      const sp = worldToScreen(this.camera, this.canvas, ex, ey);
      const ddx = px - ex;
      const ddy = py - ey;
      const viewerInside = ddx * ddx + ddy * ddy <= currentR * currentR;

      if (viewerInside) {
        viewerInsideAny = true;
      } else {
        ctx.save();
        ctx.beginPath();
        ctx.arc(sp.x, sp.y, vz, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(0,0,0,${privacyAlpha})`;
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
        const vz = currentR * this.camera.zoom;
        const sp = worldToScreen(this.camera, this.canvas, ex, ey);
        const ddx = px - ex;
        const ddy = py - ey;
        const viewerInside = ddx * ddx + ddy * ddy <= currentR * currentR;

        if (viewerInside) {
          ctx.arc(sp.x, sp.y, vz, 0, Math.PI * 2, true);
          ctx.closePath();
        }
      });

      ctx.fillStyle = `rgba(0,0,0,${privacyAlpha})`;
      ctx.fill("evenodd");
      ctx.restore();
    }
  }
}
