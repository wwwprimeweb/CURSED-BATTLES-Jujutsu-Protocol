"use strict";

const path = require("path");
const http = require("http");
const crypto = require("crypto");
const express = require("express");
const { WebSocketServer } = require("ws");

const config = require("./config");
const { GameServer } = require("./world/gameServer");
const { safeParse, sanitizeInput, sanitizeName } = require("./networking/protocol");

function sanitizeSessionToken(token) {
  if (typeof token !== "string") {
    return "";
  }
  const clean = token.trim().toLowerCase();
  if (!/^[a-f0-9]{16,64}$/.test(clean)) {
    return "";
  }
  return clean;
}

const app = express();
app.use(express.static(path.join(__dirname, "..", "client")));

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "cursed-battles", time: Date.now() });
});

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

const game = new GameServer(config);
game.start();

wss.on("connection", (socket) => {
  let joined = false;
  let playerId = null;

  socket.on("message", (raw) => {
    const msg = safeParse(raw.toString());
    if (!msg || typeof msg.type !== "string") {
      return;
    }

    if (msg.type === "join") {
      if (joined) {
        return;
      }

      const name = sanitizeName(msg.name, config.antiCheat.maxNameLength);
      const requestedToken = sanitizeSessionToken(msg.sessionToken);
      const sessionToken = requestedToken || crypto.randomBytes(12).toString("hex");
      const character = typeof msg.character === "string" ? msg.character : "gojo";

      const result = game.addPlayer({
        sessionToken,
        name,
        character,
        socket,
      });

      joined = true;
      playerId = result.player.id;

      socket.send(
        JSON.stringify({
          type: "joined",
          reconnected: result.reconnected,
          playerId: result.player.id,
          sessionToken: result.player.sessionToken,
          map: game.map,
          config: {
            tickRate: config.net.tickRate,
            snapshotRate: config.net.snapshotRate,
            controls: {
              move: "WASD",
              aim: "Mouse",
              m1: "Left Mouse",
              skill1: "Q",
              skill2: "E",
              skill3: "R",
              skill4: "Space",
              ultimate: "F",
              dodge: "Shift",
            },
          },
          now: Date.now(),
        })
      );
      return;
    }

    if (!joined || !playerId) {
      return;
    }

    const player = game.players.get(playerId);
    if (!player) {
      return;
    }

    if (msg.type === "input") {
      const input = sanitizeInput(msg);
      if (!input) {
        return;
      }
      game.handleClientInput(player, input);
      return;
    }

    if (msg.type === "chooseUpgrade") {
      if (typeof msg.upgradeId === "string") {
        game.progression.applyChoice(player, msg.upgradeId, false);
      }
      return;
    }

    if (msg.type === "ping") {
      socket.send(
        JSON.stringify({
          type: "pong",
          clientTime: msg.clientTime || 0,
          serverTime: Date.now(),
        })
      );
    }
  });

  socket.on("close", () => {
    game.removeSocket(socket);
  });

  socket.on("error", () => {
    game.removeSocket(socket);
  });
});

server.listen(config.port, () => {
  // eslint-disable-next-line no-console
  console.log(`CURSED BATTLES listening on http://localhost:${config.port}`);
});
