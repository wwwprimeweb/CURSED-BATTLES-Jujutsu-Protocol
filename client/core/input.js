export class InputManager {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = {
      up: false,
      down: false,
      left: false,
      right: false,
      m1: false,
      q: false,
      e: false,
      r: false,
      space: false,
      f: false,
      dodge: false,
    };
    this.mouseX = canvas.clientWidth * 0.5;
    this.mouseY = canvas.clientHeight * 0.5;
    this.enabled = false;
    this.onUpgradeKey = null;
  }

  setEnabled(value) {
    this.enabled = Boolean(value);
  }

  install() {
    window.addEventListener("keydown", (event) => {
      if (!this.enabled) {
        return;
      }

      const key = event.code;
      if (key === "Digit1" || key === "Digit2" || key === "Digit3") {
        if (this.onUpgradeKey) {
          this.onUpgradeKey(Number(key.slice(-1)) - 1);
        }
      }

      if (key === "KeyW") this.keys.up = true;
      if (key === "KeyS") this.keys.down = true;
      if (key === "KeyA") this.keys.left = true;
      if (key === "KeyD") this.keys.right = true;
      if (key === "KeyQ") this.keys.q = true;
      if (key === "KeyE") this.keys.e = true;
      if (key === "KeyR") this.keys.r = true;
      if (key === "KeyF") this.keys.f = true;
      if (key === "Space") {
        this.keys.space = true;
        event.preventDefault();
      }
      if (key === "ShiftLeft" || key === "ShiftRight") {
        this.keys.dodge = true;
      }
    });

    window.addEventListener("keyup", (event) => {
      const key = event.code;
      if (key === "KeyW") this.keys.up = false;
      if (key === "KeyS") this.keys.down = false;
      if (key === "KeyA") this.keys.left = false;
      if (key === "KeyD") this.keys.right = false;
      if (key === "KeyQ") this.keys.q = false;
      if (key === "KeyE") this.keys.e = false;
      if (key === "KeyR") this.keys.r = false;
      if (key === "KeyF") this.keys.f = false;
      if (key === "Space") this.keys.space = false;
      if (key === "ShiftLeft" || key === "ShiftRight") this.keys.dodge = false;
    });

    this.canvas.addEventListener("mousedown", (event) => {
      if (event.button === 0) {
        this.keys.m1 = true;
      }
    });

    this.canvas.addEventListener("mouseup", (event) => {
      if (event.button === 0) {
        this.keys.m1 = false;
      }
    });

    this.canvas.addEventListener("mousemove", (event) => {
      const rect = this.canvas.getBoundingClientRect();
      this.mouseX = event.clientX - rect.left;
      this.mouseY = event.clientY - rect.top;
    });
  }

  resetActionKeys() {
    this.keys.q = false;
    this.keys.e = false;
    this.keys.r = false;
    this.keys.space = false;
    this.keys.f = false;
    this.keys.dodge = false;
  }

  toPayload(camera, seq) {
    const zoom = camera.zoom || 1;
    const aimX = camera.x + (this.mouseX - this.canvas.clientWidth * 0.5) / zoom;
    const aimY = camera.y + (this.mouseY - this.canvas.clientHeight * 0.5) / zoom;
    return {
      type: "input",
      seq,
      aimX,
      aimY,
      keys: {
        up: this.keys.up,
        down: this.keys.down,
        left: this.keys.left,
        right: this.keys.right,
        m1: this.keys.m1,
        q: this.keys.q,
        e: this.keys.e,
        r: this.keys.r,
        space: this.keys.space,
        f: this.keys.f,
        dodge: this.keys.dodge,
      },
    };
  }
}
