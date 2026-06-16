const BINDINGS_KEY = "cursed_battles_bindings";
const DEFAULT_BINDINGS = {
  up: "KeyW",
  down: "KeyS",
  left: "KeyA",
  right: "KeyD",
  q: "KeyQ",
  e: "KeyE",
  r: "KeyR",
  f: "KeyF",
  space: "Space",
  dodge: "ShiftLeft",
  help: "KeyC",
};

const REBINDABLE_ACTIONS = ["q", "e", "r", "f", "space", "dodge", "help"];

function loadBindings() {
  try {
    const raw = localStorage.getItem(BINDINGS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return { ...DEFAULT_BINDINGS, ...parsed };
    }
  } catch {}
  return { ...DEFAULT_BINDINGS };
}

function saveBindings(bindings) {
  const toSave = {};
  for (const action of REBINDABLE_ACTIONS) {
    toSave[action] = bindings[action];
  }
  localStorage.setItem(BINDINGS_KEY, JSON.stringify(toSave));
}

export class InputManager {
  constructor(canvas) {
    this.canvas = canvas;
    this.bindings = loadBindings();
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
      help: false,
    };
    this.mouseX = canvas.width * 0.5;
    this.mouseY = canvas.height * 0.5;
    this.enabled = false;
    this.onUpgradeKey = null;
  }

  setEnabled(value) {
    this.enabled = Boolean(value);
  }

  getBindings() {
    return { ...this.bindings };
  }

  setBinding(action, code) {
    if (!REBINDABLE_ACTIONS.includes(action)) return false;
    const allValues = Object.values(this.bindings);
    if (allValues.includes(code) && code !== this.bindings[action]) return false;
    this.bindings[action] = code;
    saveBindings(this.bindings);
    return true;
  }

  resetBindings() {
    this.bindings = { ...DEFAULT_BINDINGS };
    saveBindings(this.bindings);
  }

  install() {
    window.addEventListener("keydown", (event) => {
      if (!this.enabled) return;

      const key = event.code;
      if (key === "Digit1" || key === "Digit2" || key === "Digit3") {
        if (this.onUpgradeKey) {
          this.onUpgradeKey(Number(key.slice(-1)) - 1);
        }
      }

      if (key === this.bindings.up) this.keys.up = true;
      if (key === this.bindings.down) this.keys.down = true;
      if (key === this.bindings.left) this.keys.left = true;
      if (key === this.bindings.right) this.keys.right = true;
      if (key === this.bindings.q) this.keys.q = true;
      if (key === this.bindings.e) this.keys.e = true;
      if (key === this.bindings.r) this.keys.r = true;
      if (key === this.bindings.f) this.keys.f = true;
      if (key === this.bindings.space) {
        this.keys.space = true;
        event.preventDefault();
      }
      if (key === this.bindings.dodge || key === "ShiftRight") {
        this.keys.dodge = true;
      }
      if (key === this.bindings.help) {
        this.keys.help = true;
        event.preventDefault();
      }
    });

    window.addEventListener("keyup", (event) => {
      const key = event.code;
      if (key === this.bindings.up) this.keys.up = false;
      if (key === this.bindings.down) this.keys.down = false;
      if (key === this.bindings.left) this.keys.left = false;
      if (key === this.bindings.right) this.keys.right = false;
      if (key === this.bindings.q) this.keys.q = false;
      if (key === this.bindings.e) this.keys.e = false;
      if (key === this.bindings.r) this.keys.r = false;
      if (key === this.bindings.f) this.keys.f = false;
      if (key === this.bindings.space) this.keys.space = false;
      if (key === this.bindings.dodge || key === "ShiftRight") this.keys.dodge = false;
      if (key === this.bindings.help) this.keys.help = false;
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
    this.keys.dodge = false;
  }

  toPayload(camera, seq) {
    const zoom = camera.zoom;
    const aimX = camera.x + (this.mouseX - this.canvas.width * 0.5) / zoom;
    const aimY = camera.y + (this.mouseY - this.canvas.height * 0.5) / zoom;
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
