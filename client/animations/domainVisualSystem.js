import { loadImage } from "./imageLoader.js";

const CHAR_COLORS = {
  "o-honrado": [0, 229, 255],
  "rei-amaldicoado": [255, 0, 51],
  "portador-do-vinculo": [255, 255, 255],
  "punho-indomavel": [255, 107, 157],
  "invocador-de-sombras": [10, 26, 74],
  "lutador-de-sorte": [170, 68, 255],
};

const EXPAND_DURATION = 1.6;
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
    // Sync anchor for smooth train animation between server snapshots
    this.trainSyncData = new Map(); // ownerId -> { refTime, refTimer, initialDelay }
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
    
    // Transição de pre-shatter para shattering
    this.expanding.forEach((entry, ownerId) => {
      if (entry.collapseStartTime) {
         const age = (now - entry.collapseStartTime) / 1000;
         if (age >= 1.3) {
            const radius = entry.targetRadius || 400;
            const shards = this.generateShards(radius);
            this.shattering.push({
               x: entry.x,
               y: entry.y,
               radius,
               shards,
               startTime: performance.now(),
               character: entry.character,
               offscreenCanvas: this.captureDomainSnapshot(entry),
               ownerId: ownerId,
            });
            this.expanding.delete(ownerId);
            this.parallaxData.delete(ownerId);
         }
      }
    });

    for (let i = this.shattering.length - 1; i >= 0; i--) {
      const entry = this.shattering[i];
      const age = (now - entry.startTime) / 1000;
      
      // SHATTER_DURATION * 3.0 para cacos flutuantes
      if (age >= SHATTER_DURATION * 3.0) {
        this.shattering.splice(i, 1);
        continue;
      }
      
      for (const shard of entry.shards) {
        const shardDuration = SHATTER_DURATION * (shard.lifeScale || 1.0);
        const life = 1 - (age / shardDuration);
        
        shard.vy += (shard.gravity || 0) * dt; 
        
        shard.offsetX += shard.vx * dt;
        shard.offsetY += shard.vy * dt;
        shard.rot += shard.rotSpeed * dt;
        shard.alpha = Math.max(0, Math.min(1, life));
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
    return this.charByOwner.get(ownerId) || "o-honrado";
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
    const colors = CHAR_COLORS[char] || CHAR_COLORS["o-honrado"];

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
    if (!entry) return;

    entry.collapseStartTime = performance.now();
    
    // Generate edge-to-edge and center-out sequential cracks for the 1.3s pre-shatter phase
    entry.cracks = [];
    const numCracks = 16;
    const radius = ev.radius || entry.targetRadius || 400;
    
    for(let i=0; i<numCracks; i++) {
       const points = [];
       const isEdge = Math.random() > 0.4;
       const startDist = isEdge ? radius : Math.random() * radius * 0.4;
       const startAngle = Math.random() * Math.PI * 2;
       
       let cx = Math.cos(startAngle) * startDist;
       let cy = Math.sin(startAngle) * startDist;
       const targetAngle = startAngle + Math.PI + (Math.random() - 0.5) * 1.5;
       
       let len = 0;
       const maxLen = radius * 2.5;
       while(len < maxLen) {
           points.push({x: cx, y: cy});
           const step = 10 + Math.random() * 30; // Mais pontos, rachaduras mais detalhadas
           const a = targetAngle + (Math.random() - 0.5) * 1.8; // Desvios mais bruscos
           cx += Math.cos(a) * step;
           cy += Math.sin(a) * step;
           len += step;
       }
       
       // Distribuição exponencial: começam poucas e depois aceleram muito no final
       const timeP = Math.pow(i / numCracks, 1.5); 
       const appearTime = timeP * 1.0; 
       const duration = 0.1 + Math.random() * 0.15; // Velocidades de 'rasgo' variadas
       
       entry.cracks.push({ points, appearTime, duration });
    }
  }

  generateShards(radius) {
    const shards = [];
    const numShards = 150 + Math.random() * 50; // Quantidade massiva
    
    for (let i = 0; i < numShards; i++) {
      // Posição base do caco
      const distFromCenter = Math.sqrt(Math.random()) * radius * 0.9;
      const angleFromCenter = Math.random() * Math.PI * 2;
      const cx = Math.cos(angleFromCenter) * distFromCenter;
      const cy = Math.sin(angleFromCenter) * distFromCenter;
      
      // Apenas tamanhos pequenos a minúsculos (sem pedaços grandes)
      const sizeBase = (radius / 15) + Math.random() * (radius / 20);
      const size = sizeBase * (0.2 + Math.random() * 0.8);
      
      const vertices = [];
      // Formatos completamente irregulares e diferentes (de 3 a 8 pontas)
      const numVerts = 3 + Math.floor(Math.random() * 6);
      let currentAngle = 0;
      for (let v = 0; v < numVerts; v++) {
        currentAngle += (Math.PI * 2 / numVerts) * (0.3 + Math.random() * 1.4);
        const dist = size * (0.2 + Math.random() * 1.2); // Pontas muito irregulares
        vertices.push({
          x: cx + Math.cos(currentAngle) * dist,
          y: cy + Math.sin(currentAngle) * dist
        });
      }

      // Físicas variadas
      const isFloater = Math.random() > 0.45;
      const gravity = isFloater ? -10 - Math.random() * 140 : 100 + Math.random() * 800;
      const lifeScale = isFloater ? 1.0 + Math.random() * 2.0 : 0.1 + Math.random() * 0.8;
      
      const dirAngle = angleFromCenter + (Math.random() - 0.5) * 4.0;
      const speed = isFloater ? 5 + Math.random() * 60 : 50 + Math.random() * 200;

      shards.push({
        vertices,
        offsetX: 0,
        offsetY: 0,
        vx: Math.cos(dirAngle) * speed,
        vy: Math.sin(dirAngle) * speed,
        gravity: gravity,
        rot: Math.random() * Math.PI * 2, // Inclinados aleatoriamente desde o início
        rotSpeed: 0, // Sem girar no ar
        alpha: 1,
        lifeScale: lifeScale
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

  renderParallax(ctx, camera, ownerId, char, worldX, worldY, p, vz, zoom, expandProgress, isMine, now, domainRaw) {
    ctx.save();
    try {
      ctx.beginPath();
      ctx.arc(p.x, p.y, vz, 0, Math.PI * 2);
      ctx.clip();

      const layerData = this.getOrCreateParallaxData(ownerId, char);
      const layers = char === 'portador-do-vinculo' ? ['far', 'mid', 'close'] : ['far', 'close', 'mid'];
      const camX = camera.x || 0;
      const camY = camera.y || 0;

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

        if (char === 'portador-do-vinculo') {
          if (key === 'far') {
            effectiveScale = 2.0;
            effectiveOffset = { x: -0.6, y: 0.4 };
            effectiveParallax = 0.221;
          } else if (key === 'mid') {
            effectiveScale = 1.0;
            effectiveOffset = { x: 0, y: 0.5 };
            effectiveParallax = 0;
          } else if (key === 'close') {
            effectiveParallax = 0.1;
          }
        }

        if (char === 'o-honrado' && key === 'mid') {
          effectiveOffset = { x: 0.3, y: -0.3 };
        }

        if (char === 'punho-indomavel' && key === 'far') {
          effectiveParallax = 0;
          effectiveScale = 1.0;
          effectiveOffset = { x: 0, y: 0.5 };
        }
        if (char === 'punho-indomavel' && key === 'close') {
          effectiveParallax = 0.25;
        }
        if (char === 'punho-indomavel' && key === 'mid') continue;

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
          if (char === 'o-honrado' && key === 'mid') {
            ctx.rotate(this.rotationTime * 0.01);
          }
          ctx.globalAlpha = alpha * (LAYER_ALPHA[key] ?? 1);
          if (char === 'punho-indomavel' && key === 'far') ctx.filter = 'blur(1.5px)';
          this.drawScaledImage(ctx, img, 0, 0, vz, 0, 0, effectiveScale);
          ctx.globalAlpha = 1;
          ctx.restore();
          continue;
        }

        if (key === 'far') {
          const overlay = this.overlays.get(char);
          if (overlay) {
            ctx.save();
            ctx.globalAlpha = alpha;
            this.drawScaledImage(ctx, overlay, p.x, p.y, vz, 0, 0);
            ctx.restore();
          }

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

          if (char === "o-honrado") {
            const innerR = vz * 0.95;
            for (let i = 0; i < 80; i++) {
              const seed = i * 137.508;
              const angle = (seed % 360) * Math.PI / 180;
              const dist = ((seed * 7919) % innerR);
              const starX = p.x + Math.cos(angle) * dist + dx;
              const starY = p.y + Math.sin(angle) * dist + dy;
              const starSize = (0.5 + (seed % 3) * 0.5) * zoom;
              const twinkle = 0.5 + Math.sin(now * 0.003 + seed) * 0.5;
              const starAlpha = twinkle * (0.6 + (seed % 40) * 0.01);
              ctx.fillStyle = `rgba(255,255,255,${starAlpha})`;
              ctx.beginPath();
              ctx.arc(starX, starY, starSize, 0, Math.PI * 2);
              ctx.fill();
            }
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
        } else if (key === 'close' && layerData.close && char !== 'portador-do-vinculo') {
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

      // Train (yuji2.png animado nos trilhos)
        // Sync to server timer for hitbox accuracy, extrapolate locally for smooth 60fps animation
        const trainEntry = this.expanding.get(ownerId);
        if (trainEntry && char === 'punho-indomavel') {
          let progress = null;
          if (domainRaw && typeof domainRaw.trainTimer === 'number' && typeof domainRaw.trainInitialDelay === 'number') {
            if (domainRaw.trainInitialDelay <= 0) {
              // Update sync anchor whenever server provides a new timer value
              const syncKey = ownerId + '_train';
              let sync = this.trainSyncData.get(syncKey);
              if (!sync || Math.abs(sync.lastServerTimer - domainRaw.trainTimer) > 0.001) {
                sync = { refTime: performance.now(), refTimer: domainRaw.trainTimer, lastServerTimer: domainRaw.trainTimer };
                this.trainSyncData.set(syncKey, sync);
              }
              // Extrapolate forward from anchor for smooth 60fps rendering
              const elapsed = (performance.now() - sync.refTime) / 1000;
              progress = (sync.refTimer + elapsed) % 10;
              if (progress > 2) progress = null; // only show during active pass
            }
          } else {
            // Fallback: pure local time (before first snapshot with trainTimer)
            const elapsed = (performance.now() - trainEntry.startTime) / 1000;
            if (elapsed >= 6) {
              const p2 = (elapsed - 6) % 10;
              if (p2 <= 2) progress = p2;
            }
          }
          if (progress !== null) {
            const t = progress / 2;
            const tNormX = 150 / (380 * 1.2);
            const tNormY = (-1400 + t * 2800) / (380 * 1.2);
            const trainX = p.x + tNormX * vz;
            const trainY = p.y + tNormY * vz + vz * 0.3;

            const trainImg = this.getLayerImage('punho-indomavel', '2');
            if (trainImg && trainImg.width) {
              ctx.save();
              ctx.translate(trainX, trainY);
          ctx.shadowColor = 'rgba(255, 107, 157, 0.4)';
          ctx.shadowBlur = 12 * zoom;
              this.drawScaledImage(ctx, trainImg, 0, 0, vz, 0, 0, 1.2);
              ctx.restore();
            }
          }
        }

      // --- DRAW PRE-SHATTER CRACKS ON ACTIVE DOMAIN ---
      const entry = this.expanding.get(ownerId);
      if (entry && entry.collapseStartTime && entry.cracks) {
        const collapseAge = (now - entry.collapseStartTime) / 1000;
        ctx.save();
        for (const crack of entry.cracks) {
          if (collapseAge >= crack.appearTime) {
            const timeSinceAppear = collapseAge - crack.appearTime;
            const isFlashing = timeSinceAppear < 0.15;
            
            ctx.strokeStyle = isFlashing ? "white" : "rgba(230, 245, 255, 0.9)";
            ctx.lineWidth = isFlashing ? 6 * zoom : 3 * zoom;
            ctx.shadowColor = "white";
            ctx.shadowBlur = isFlashing ? 15 * zoom : 8 * zoom;
            
            const progress = Math.min(1, timeSinceAppear / crack.duration);
            ctx.beginPath();
            ctx.moveTo(p.x + crack.points[0].x * zoom, p.y + crack.points[0].y * zoom);
            
            const totalSegments = crack.points.length - 1;
            const currentFloat = progress * totalSegments;
            const currentIdx = Math.floor(currentFloat);
            const fraction = currentFloat - currentIdx;
            
            for(let k=1; k<=currentIdx; k++) {
               ctx.lineTo(p.x + crack.points[k].x * zoom, p.y + crack.points[k].y * zoom);
            }
            if (currentIdx < totalSegments && fraction > 0) {
               const pA = crack.points[currentIdx];
               const pB = crack.points[currentIdx + 1];
               const intX = pA.x + (pB.x - pA.x) * fraction;
               const intY = pA.y + (pB.y - pA.y) * fraction;
               ctx.lineTo(p.x + intX * zoom, p.y + intY * zoom);
            }
            ctx.stroke();
          }
        }
        ctx.restore();
      }
    } catch (e) {
      console.error("Parallax render error:", e);
    } finally {
      ctx.restore();
    }
  }

  captureDomainSnapshot(entry) {
    const canvas = document.createElement("canvas");
    const r = entry.radius || entry.targetRadius || 400;
    canvas.width = r * 2;
    canvas.height = r * 2;
    const ctx = canvas.getContext("2d");
    const cx = r;
    const cy = r;
    const char = this.getCharacter(entry.ownerId);

    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.clip();

    for (const key of ['3', '2', '1']) {
      const img = this.getLayerImage(char, key);
      if (img) {
        const reverseMap = { '3': 'far', '2': 'mid', '1': 'close' };
        const layerKey = reverseMap[key];
        let effectiveScale = LAYER_SCALE[layerKey];
        let effectiveOffset = LAYER_OFFSET[layerKey] || { x: 0, y: 0 };
        
        if (char === 'portador-do-vinculo') {
          if (key === '3') { effectiveScale = 2.0; effectiveOffset = { x: -0.6, y: 0.4 }; }
          else if (key === '2') { effectiveScale = 1.0; effectiveOffset = { x: 0, y: 0.5 }; }
        }
        if (char === 'o-honrado' && key === '2') { effectiveOffset = { x: 0.3, y: -0.3 }; }
        if (char === 'punho-indomavel' && key === '3') { effectiveScale = 1.0; effectiveOffset = { x: 0, y: 0.5 }; }

        ctx.save();
        ctx.translate(cx + effectiveOffset.x * r, cy + effectiveOffset.y * r);
        this.drawScaledImage(ctx, img, 0, 0, r, 0, 0, effectiveScale);
        ctx.restore();
      }
    }

    const bg = this.backgrounds.get(char);
    if (!this.getLayerImage(char, '3') && bg) {
      this.drawScaledImage(ctx, bg, cx, cy, r, 0, 0);
    } else if (!this.getLayerImage(char, '3') && !bg) {
      const rgb = CHAR_COLORS[char] || CHAR_COLORS["o-honrado"];
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
    const z = camera.zoom;
    const now = performance.now();
    for (const entry of this.shattering) {
      const age = (now - entry.startTime) / 1000;
      const sx = (entry.x - camera.x) * z + canvas.width * 0.5;
      const sy = (entry.y - camera.y) * z + canvas.height * 0.5;

      if (!entry.offscreenCanvas) {
        entry.offscreenCanvas = this.captureDomainSnapshot(entry);
      }

      // SHATTER PHASE: Draw flying shards
      for (const shard of entry.shards) {
        if (shard.alpha <= 0) continue;

        const px = sx + shard.offsetX;
        const py = sy + shard.offsetY;

        ctx.save();
        ctx.globalAlpha = Math.max(0, shard.alpha);
        ctx.translate(px, py);
        ctx.rotate(shard.rot);
        ctx.scale(z, z);

        ctx.beginPath();
        ctx.moveTo(shard.vertices[0].x, shard.vertices[0].y);
        for (let j = 1; j < shard.vertices.length; j++) {
          ctx.lineTo(shard.vertices[j].x, shard.vertices[j].y);
        }
        ctx.closePath();
        ctx.clip();

        ctx.drawImage(
          entry.offscreenCanvas,
          -entry.radius * z, -entry.radius * z,
          entry.radius * 2 * z, entry.radius * 2 * z
        );
        ctx.restore();
        
        // Draw thin bright border on flying shards
        ctx.save();
        ctx.globalAlpha = Math.max(0, shard.alpha * 0.4);
        ctx.translate(px, py);
        ctx.rotate(shard.rot);
        ctx.scale(z, z);
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
    this.expanding.forEach((entry, ownerId) => {
      // Deleta se não está mais nos ativos do server, E não está no meio da animação de colapso
      if (!activeOwnerIds.has(ownerId) && !entry.collapseStartTime) {
        this.expanding.delete(ownerId);
      }
    });
  }

  getDomainName(char) {
    switch(char) {
      case "o-honrado": return "Domínio: Vazio Absoluto";
      case "rei-amaldicoado": return "Domínio: Santuário Devastador";
      case "portador-do-vinculo": return "Laço Eterno";
      case "punho-indomavel": return "Domínio: Manifestação Interior";
      case "invocador-de-sombras": return "Domínio: Jardim das Sombras";
      case "lutador-de-sorte": return "Domínio: Roleta da Morte";
      default: return "Expansão de Domínio";
    }
  }

  drawEntryEffects(ctx, camera, canvas) {
    const now = performance.now();
    const w = canvas.width;
    const h = canvas.height;

    this.expanding.forEach((entry, ownerId) => {
      const elapsed = (now - entry.startTime) / 1000;

      // Phase 4: Typography (0.2s to 1.6s)
      if (elapsed > 0.2 && elapsed < EXPAND_DURATION + 0.5) {
        const textProgress = (elapsed - 0.2) / (EXPAND_DURATION + 0.3);
        const alpha = Math.min(1, Math.sin(textProgress * Math.PI) * 2);
        
        const char = this.getCharacter(ownerId);
        const name = this.getDomainName(char);
        
        ctx.save();
        ctx.globalAlpha = Math.max(0, alpha);
        ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
        ctx.strokeStyle = "rgba(0, 0, 0, 0.8)";
        ctx.lineWidth = 4;
        ctx.textAlign = "center";
        
        ctx.font = "italic 900 48px 'Impact', 'Arial Black', sans-serif";
        const yOffset = h * 0.2 + (1 - Math.pow(1 - textProgress, 3)) * 50;
        
        ctx.strokeText("EXPANSÃO DE DOMÍNIO", w / 2, yOffset);
        ctx.fillText("EXPANSÃO DE DOMÍNIO", w / 2, yOffset);
        
        ctx.font = "italic 700 32px 'Georgia', serif";
        ctx.fillStyle = "rgba(200, 200, 255, 0.9)";
        ctx.strokeText(name, w / 2, yOffset + 50);
        ctx.fillText(name, w / 2, yOffset + 50);
        
        ctx.restore();
      }
    });
  }
}
