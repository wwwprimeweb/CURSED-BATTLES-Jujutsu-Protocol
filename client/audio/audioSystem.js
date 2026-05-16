export class AudioSystem {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.enabled = false;
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
        this.tone(100, 0.3, "sine", 0.16);
        break;
      default:
        break;
    }
  }
}
