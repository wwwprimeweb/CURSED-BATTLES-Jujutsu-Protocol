export class NetworkClient {
  constructor({ onJoined, onSnapshot, onPong, onConnectionState }) {
    this.onJoined = onJoined;
    this.onSnapshot = onSnapshot;
    this.onPong = onPong;
    this.onConnectionState = onConnectionState;

    this.socket = null;
    this.name = "Sorcerer";
    this.sessionToken = "";
    this.reconnectTimer = null;
    this.manualClose = false;
    this.connVersion = 0;
  }

  connect({ name, sessionToken, character }) {
    this.name = name || this.name;
    this.sessionToken = typeof sessionToken === "string" ? sessionToken : "";
    this.character = character || 'o-honrado';
    this.manualClose = false;
    this.connVersion += 1;
    const version = this.connVersion;

    const proto = window.location.protocol === "https:" ? "wss" : "ws";
    const url = `${proto}://${window.location.host}`;
    this.socket = new WebSocket(url);

    this.socket.addEventListener("open", () => {
      if (version !== this.connVersion) return;
      console.log("[DIAG] WebSocket OPEN, sending join");
      this.send({
        type: "join",
        name: this.name,
        sessionToken: this.sessionToken,
        character: this.character,
      });
      if (this.onConnectionState) {
        this.onConnectionState({ connected: true, reconnecting: false });
      }
    });

    this.socket.addEventListener("message", (event) => {
      if (version !== this.connVersion) return;
      let msg = null;
      try {
        msg = JSON.parse(event.data);
      } catch (err) {
        return;
      }
      if (!msg || typeof msg.type !== "string") {
        return;
      }

      if (msg.type === "joined") {
        console.log(`[DIAG] Received JOINED: playerId=${msg.playerId}, reconnected=${msg.reconnected}`);
        console.log(`[DIAG] Map: w=${msg.map?.width}, h=${msg.map?.height}, spawnPoints=${msg.map?.spawnPoints?.length}`);
        this.sessionToken = msg.sessionToken || this.sessionToken;
        if (this.onJoined) {
          this.onJoined(msg);
        }
        return;
      }

      if (msg.type === "snapshot") {
        if (typeof msg.tick !== 'undefined' && msg.tick < 3) {
          console.log(`[DIAG] First snapshot (#${msg.tick}): you=${JSON.stringify(msg.you)}, delta.players=${msg.delta.players.length}, removed.players=${msg.removed.players.length}`);
        }
        if (this.onSnapshot) {
          this.onSnapshot(msg);
        }
        return;
      }

      if (msg.type === "pong") {
        if (this.onPong) {
          this.onPong(msg);
        }
      }
    });

    this.socket.addEventListener("close", () => {
      if (version !== this.connVersion) return;
      if (this.onConnectionState) {
        this.onConnectionState({ connected: false, reconnecting: false });
      }
    });

    this.socket.addEventListener("error", () => {
      if (version !== this.connVersion) return;
      if (this.socket) {
        this.socket.close();
      }
    });
  }

  disconnect() {
    this.manualClose = true;
    clearTimeout(this.reconnectTimer);
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
  }

  send(msg) {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      console.warn(`[DIAG] send SKIPPED: socket=${!!this.socket}, readyState=${this.socket ? this.socket.readyState : 'N/A'}, type=${msg.type}`);
      return;
    }
    this.socket.send(JSON.stringify(msg));
  }

  sendInput(payload) {
    this.send(payload);
  }

  chooseUpgrade(upgradeId) {
    this.send({ type: "chooseUpgrade", upgradeId });
  }

  rejoin(name) {
    if (name) this.name = name;
    this.send({ type: "join", name: this.name, sessionToken: this.sessionToken || "" });
  }

  ping() {
    this.send({ type: "ping", clientTime: Date.now() });
  }
}
