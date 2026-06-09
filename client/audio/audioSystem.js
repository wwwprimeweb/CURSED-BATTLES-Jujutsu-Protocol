export class AudioSystem {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this._musicGain = null;
    this._musicSource = null;
    this._musicBuffer = null;
    this._preloadedBuffer = null;
    this._fadeTimer = null;
    this.enabled = false;
    this.buffers = {};
    this._pendingBuffers = [];
    this._masterVol = parseFloat(localStorage.getItem("cursed_battles_masterVol")) || 1;
    this._sfxVol = parseFloat(localStorage.getItem("cursed_battles_sfxVol")) || 1;
    this._musicVol = parseFloat(localStorage.getItem("cursed_battles_musicVol")) || 1;
    this._musicPlayRequested = false;
    this._musicDecodedBuffer = null;
    this._gameActive = false;
  }

  async unlock() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 0.14 * this._masterVol;
      this.masterGain.connect(this.ctx.destination);
      this._musicGain = this.ctx.createGain();
      this._musicGain.gain.value = this._musicVol;
      this._musicGain.connect(this.masterGain);
    }
    for (const { key, arrayBuffer } of this._pendingBuffers) {
      try {
        this.buffers[key] = await this.ctx.decodeAudioData(arrayBuffer);
      } catch (e) {
        console.warn(`AudioSystem: failed to decode ${key}`, e);
      }
    }
    this._pendingBuffers = [];
    if (this._preloadedBuffer && !this._musicDecodedBuffer) {
      try {
        this._musicDecodedBuffer = await this.ctx.decodeAudioData(this._preloadedBuffer);
        if (this._musicPlayRequested && !this._gameActive) {
          this._musicPlayRequested = false;
          this.playMusic();
        }
      } catch (e) {
        console.warn(`AudioSystem: failed to decode preloaded music`, e);
      }
    }
  }

  async resume() {
    if (this.ctx && this.ctx.state === "suspended") {
      await this.ctx.resume();
    }
    this.enabled = true;
    if (this._musicPlayRequested && !this._gameActive) {
      this._musicPlayRequested = false;
      this.playMusic();
    }
  }

  async loadSound(url, key) {
    try {
      const response = await fetch(url);
      const arrayBuffer = await response.arrayBuffer();
      if (this.ctx) {
        this.buffers[key] = await this.ctx.decodeAudioData(arrayBuffer);
      } else {
        this._pendingBuffers.push({ key, arrayBuffer });
      }
    } catch (e) {
      console.warn(`AudioSystem: failed to load ${url}`, e);
    }
  }

  playBuffer(key, volume = 0.5) {
    if (!this.enabled || !this.ctx || !this.buffers[key]) return;
    const source = this.ctx.createBufferSource();
    const gain = this.ctx.createGain();
    source.buffer = this.buffers[key];
    gain.gain.value = volume * this._sfxVol;
    source.connect(gain);
    gain.connect(this.masterGain);
    source.start(0);
  }

  tone(freq, duration = 0.08, type = "sine", gain = 0.35) {
    if (!this.enabled || !this.ctx) {
      return;
    }
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.frequency.value = freq;
    osc.type = type;
    g.gain.value = 0.0001;
    osc.connect(g);
    g.connect(this.masterGain);

    const now = this.ctx.currentTime;
    g.gain.exponentialRampToValueAtTime(gain * this._sfxVol, now + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  noise(duration, gain = 0.15, decay = 1) {
    if (!this.enabled || !this.ctx) return;
    const sr = this.ctx.sampleRate;
    const len = Math.floor(sr * duration);
    const buffer = this.ctx.createBuffer(1, len, sr);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
    }
    const source = this.ctx.createBufferSource();
    const g = this.ctx.createGain();
    source.buffer = buffer;
    g.gain.value = gain * this._sfxVol;
    source.connect(g);
    g.connect(this.masterGain);
    source.start(0);
  }

  syntheticClick(gain = 0.1) {
    if (!this.enabled || !this.ctx) return;
    const now = this.ctx.currentTime;
    const sr = this.ctx.sampleRate;

    const noiseLen = Math.floor(sr * 0.04);
    const noiseBuf = this.ctx.createBuffer(1, noiseLen, sr);
    const noiseData = noiseBuf.getChannelData(0);
    for (let i = 0; i < noiseLen; i++) {
      noiseData[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / noiseLen, 6);
    }
    const noiseSrc = this.ctx.createBufferSource();
    const noiseGain = this.ctx.createGain();
    noiseSrc.buffer = noiseBuf;
    noiseGain.gain.setValueAtTime(gain * 0.3 * this._sfxVol, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.035);
    noiseSrc.connect(noiseGain);
    noiseGain.connect(this.masterGain);
    noiseSrc.start(now);
    noiseSrc.stop(now + 0.04);

    const osc = this.ctx.createOscillator();
    const oscGain = this.ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(250, now);
    osc.frequency.exponentialRampToValueAtTime(80, now + 0.05);
    oscGain.gain.setValueAtTime(gain * this._sfxVol, now);
    oscGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.05);
    osc.connect(oscGain);
    oscGain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.06);
  }

  syntheticPop(gain = 0.15, pitch = 440) {
    if (!this.enabled || !this.ctx) return;
    const now = this.ctx.currentTime;
    const sr = this.ctx.sampleRate;

    const noiseLen = Math.floor(sr * 0.015);
    const noiseBuf = this.ctx.createBuffer(1, noiseLen, sr);
    const noiseData = noiseBuf.getChannelData(0);
    for (let i = 0; i < noiseLen; i++) {
      noiseData[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / noiseLen, 8);
    }
    const noiseSrc = this.ctx.createBufferSource();
    const noiseGain = this.ctx.createGain();
    noiseSrc.buffer = noiseBuf;
    noiseGain.gain.setValueAtTime(gain * 0.2 * this._sfxVol, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.012);
    noiseSrc.connect(noiseGain);
    noiseGain.connect(this.masterGain);
    noiseSrc.start(now);
    noiseSrc.stop(now + 0.02);

    const osc = this.ctx.createOscillator();
    const oscGain = this.ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(pitch, now);
    osc.frequency.exponentialRampToValueAtTime(pitch * 1.6, now + 0.06);
    oscGain.gain.setValueAtTime(0.0001, now);
    oscGain.gain.exponentialRampToValueAtTime(gain * this._sfxVol, now + 0.006);
    oscGain.gain.setValueAtTime(gain * 0.7 * this._sfxVol, now + 0.03);
    oscGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);
    osc.connect(oscGain);
    oscGain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.15);
  }

  syntheticChime(gain = 0.12, pitch = 800, dur = 0.3) {
    if (!this.enabled || !this.ctx) return;
    const now = this.ctx.currentTime;
    const sr = this.ctx.sampleRate;

    const noiseLen = Math.floor(sr * dur);
    const noiseBuf = this.ctx.createBuffer(1, noiseLen, sr);
    const noiseData = noiseBuf.getChannelData(0);
    for (let i = 0; i < noiseLen; i++) {
      noiseData[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / noiseLen, 3);
    }
    const noiseSrc = this.ctx.createBufferSource();
    noiseSrc.buffer = noiseBuf;
    const noiseFilter = this.ctx.createBiquadFilter();
    noiseFilter.type = "bandpass";
    noiseFilter.Q.value = 0.8;
    noiseFilter.frequency.setValueAtTime(1000, now);
    noiseFilter.frequency.exponentialRampToValueAtTime(3000, now + dur * 0.6);
    const noiseGain = this.ctx.createGain();
    noiseGain.gain.setValueAtTime(0.0001, now);
    noiseGain.gain.linearRampToValueAtTime(gain * 0.4 * this._sfxVol, now + 0.02);
    noiseGain.gain.setValueAtTime(gain * 0.15 * this._sfxVol, now + 0.08);
    noiseGain.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    noiseSrc.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(this.masterGain);
    noiseSrc.start(now);
    noiseSrc.stop(now + dur + 0.05);

    function addPartial(freq, delay, attack, decay, gainScalar) {
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = "sine";
      o.frequency.value = freq;
      const startT = now + delay;
      g.gain.setValueAtTime(0.0001, now);
      g.gain.setValueAtTime(0.0001, startT);
      g.gain.linearRampToValueAtTime(gain * gainScalar * this._sfxVol, startT + attack);
      g.gain.exponentialRampToValueAtTime(0.0001, startT + attack + decay);
      o.connect(g);
      g.connect(this.masterGain);
      o.start(startT);
      o.stop(startT + attack + decay + 0.05);
    }

    addPartial.call(this, pitch, 0, 0.008, 0.3, 1);
    addPartial.call(this, pitch * 1.5, 0.02, 0.005, 0.25, 0.5);
    addPartial.call(this, pitch * 2, 0.03, 0.004, 0.2, 0.3);
    addPartial.call(this, pitch * 0.5, 0.01, 0.015, 0.35, 0.2);
  }

  syntheticWhoosh(gain = 0.1, ascending = true) {
    if (!this.enabled || !this.ctx) return;
    const now = this.ctx.currentTime;
    const sr = this.ctx.sampleRate;
    const dur = 0.18;
    const len = Math.floor(sr * dur);

    const buf = this.ctx.createBuffer(1, len, sr);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2);
    }
    const source = this.ctx.createBufferSource();
    source.buffer = buf;

    const filter = this.ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.Q.value = 1.5;
    const startFreq = ascending ? 300 : 1200;
    const endFreq = ascending ? 1800 : 400;
    filter.frequency.setValueAtTime(startFreq, now);
    filter.frequency.exponentialRampToValueAtTime(endFreq, now + dur);

    const gainNode = this.ctx.createGain();
    gainNode.gain.setValueAtTime(0.0001, now);
    gainNode.gain.linearRampToValueAtTime(gain * this._sfxVol, now + 0.03);
    gainNode.gain.setValueAtTime(gain * this._sfxVol, now + 0.07);
    gainNode.gain.linearRampToValueAtTime(0.0001, now + dur);

    source.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(this.masterGain);
    source.start(now);
    source.stop(now + dur);
  }

  setMasterVolume(v) {
    this._masterVol = Math.max(0, Math.min(1, v));
    localStorage.setItem("cursed_battles_masterVol", this._masterVol);
    if (this.masterGain) {
      this.masterGain.gain.value = 0.14 * this._masterVol;
    }
  }

  getMasterVolume() {
    return this._masterVol;
  }

  setSfxVolume(v) {
    this._sfxVol = Math.max(0, Math.min(1, v));
    localStorage.setItem("cursed_battles_sfxVol", this._sfxVol);
  }

  getSfxVolume() {
    return this._sfxVol;
  }

  setMusicVolume(v) {
    this._musicVol = Math.max(0, Math.min(1, v));
    localStorage.setItem("cursed_battles_musicVol", this._musicVol);
    if (this._musicGain) {
      this._musicGain.gain.value = this._musicVol;
    }
  }

  getMusicVolume() {
    return this._musicVol;
  }

  async preloadMusic(url) {
    this._preloadedBuffer = null;
    try {
      const response = await fetch(url);
      if (!response.ok) return;
      const arrayBuffer = await response.arrayBuffer();
      this._preloadedBuffer = arrayBuffer;
      if (this.ctx) {
        this._musicDecodedBuffer = await this.ctx.decodeAudioData(arrayBuffer);
      }
      if (this._musicPlayRequested && this.ctx && !this._gameActive) {
        this._musicPlayRequested = false;
        this.playMusic();
      }
    } catch (e) {
      console.warn(`AudioSystem: failed to preload music ${url}`, e);
    }
  }

  playMusic() {
    if (!this.ctx) return;
    if (!this._musicDecodedBuffer) {
      this._musicPlayRequested = true;
      return;
    }
    this.stopMusic(0);
    this._musicPending = true;
    try {
      this._musicSource = this.ctx.createBufferSource();
      this._musicSource.buffer = this._musicDecodedBuffer;
      this._musicSource.loop = true;
      this._musicGain.gain.value = this._musicVol;
      this._musicSource.connect(this._musicGain);
      this._musicSource.start(0);
    } catch (e) {
      console.warn(`AudioSystem: failed to play music`, e);
    }
  }

  stopMusic(fadeMs = 300) {
    this._musicPending = false;
    this._musicPlayRequested = false;
    if (this._fadeTimer) {
      clearTimeout(this._fadeTimer);
      this._fadeTimer = null;
    }
    if (!this._musicSource || !this._musicGain) return;
    if (fadeMs > 0) {
      const startVol = this._musicGain.gain.value;
      const startTime = this.ctx.currentTime;
      this._musicGain.gain.linearRampToValueAtTime(0, startTime + fadeMs / 1000);
      this._fadeTimer = setTimeout(() => {
        this._stopMusicNow();
      }, fadeMs + 50);
    } else {
      this._stopMusicNow();
    }
  }

  _stopMusicNow() {
    if (this._fadeTimer) {
      clearTimeout(this._fadeTimer);
      this._fadeTimer = null;
    }
    try {
      this._musicSource.stop();
    } catch {}
    this._musicSource.disconnect();
    this._musicSource = null;
    this._musicBuffer = null;
    if (this._musicGain) {
      this._musicGain.gain.value = this._musicVol;
    }
  }

  setGameActive(active) {
    this._gameActive = active;
    if (active) {
      this._musicPlayRequested = false;
    }
  }

  play(eventType) {
    switch (eventType) {
      case "hit":
        this.tone(220, 0.05, "triangle", 0.2);
        break;
      case "kill":
        this.tone(180, 0.11, "sawtooth", 0.2);
        this.tone(320, 0.12, "triangle", 0.15);
        break;
      case "skillBlue":
        this.tone(280, 0.09, "sine", 0.18);
        break;
      case "skillRed":
        this.tone(150, 0.08, "square", 0.2);
        break;
      case "skillPurple":
        this.tone(120, 0.2, "sawtooth", 0.18);
        break;
      case "domainStart":
        if (this.buffers.domainStart) {
          this.playBuffer("domainStart", 2.0);
        } else {
          this.tone(100, 0.3, "sine", 0.16);
        }
        break;
      case "crawlerTremor":
        this.tone(30, 0.35, "square", 0.08);
        this.tone(38, 0.25, "sawtooth", 0.06);
        break;
      case "crawlerExplosion":
        this.tone(22, 0.6, "sawtooth", 0.35);
        this.tone(45, 0.35, "square", 0.2);
        this.noise(0.4, 0.12, 1.8);
        break;
      case "acidPuddle":
        this.tone(800, 0.1, "sine", 0.06);
        this.tone(550, 0.08, "triangle", 0.04);
        this.tone(1000, 0.07, "sine", 0.03);
        break;
      case "fleshmawAttack":
        this.tone(120, 0.07, "sawtooth", 0.22);
        this.tone(200, 0.05, "square", 0.15);
        this.tone(80, 0.1, "sawtooth", 0.18);
        this.noise(0.05, 0.12, 4);
        break;
      case "crawlerNestAttack":
        this.tone(80, 0.12, "sawtooth", 0.2);
        this.tone(140, 0.09, "square", 0.15);
        this.tone(60, 0.1, "sine", 0.18);
        break;
      case "crawlerBabyAttack":
        this.tone(350, 0.07, "sawtooth", 0.18);
        this.tone(500, 0.05, "square", 0.12);
        this.tone(280, 0.06, "sine", 0.1);
        break;
      case "trainHit":
        this.tone(80, 0.2, "square", 0.35);
        this.tone(120, 0.1, "sawtooth", 0.25);
        this.noise(0.08, 0.15, 6);
        break;
      case "trainApproach":
        this.tone(1500, 0.15, "sine", 0.1);
        setTimeout(() => this.tone(1800, 0.15, "sine", 0.1), 800);
        const sr = this.ctx.sampleRate;
        const dur = 6.5;
        const len = sr * dur;
        const buf = this.ctx.createBuffer(1, len, sr);
        const ch = buf.getChannelData(0);
        for (let i = 0; i < len; i++) {
          const sec = i / sr;
          let vol;
          if (sec < 3) vol = sec / 3;
          else if (sec < 5) vol = 1;
          else vol = Math.max(0, 1 - (sec - 5) / 1.5);
          const motor = ((sec * 25) % 1) * 2 - 1;
          const pulse = ((sec * 2) % 1) < 0.08 ? 1 : 0;
          const noise = Math.random() * 2 - 1;
          ch[i] = (motor * 0.5 + pulse * 0.3 + noise * 0.2) * vol;
        }
        const src = this.ctx.createBufferSource();
        src.buffer = buf;
        const gn = this.ctx.createGain();
        gn.gain.value = 0.7;
        src.connect(gn);
        gn.connect(this.masterGain);
        src.start(0);
        break;
      default:
        break;
    }
  }
}
