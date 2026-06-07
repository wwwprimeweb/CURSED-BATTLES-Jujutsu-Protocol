export class AudioSystem {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.enabled = false;
    this.buffers = {};
    this._pendingBuffers = [];
  }

  unlock() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 0.14;
      this.masterGain.connect(this.ctx.destination);
    }
    if (this.ctx.state === "suspended") {
      this.ctx.resume();
    }
    this.enabled = true;
    this._pendingBuffers.forEach(async ({ key, arrayBuffer }) => {
      try {
        this.buffers[key] = await this.ctx.decodeAudioData(arrayBuffer);
      } catch (e) {
        console.warn(`AudioSystem: failed to decode ${key}`, e);
      }
    });
    this._pendingBuffers = [];
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
    gain.gain.value = volume;
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
    g.gain.exponentialRampToValueAtTime(gain, now + 0.01);
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
    g.gain.value = gain;
    source.connect(g);
    g.connect(this.masterGain);
    source.start(0);
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
      default:
        break;
    }
  }
}
