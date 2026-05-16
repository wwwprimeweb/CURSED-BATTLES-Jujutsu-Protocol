# CURSED BATTLES (MVP Foundation)

Authoritative multiplayer web arena survival built with Node.js + Express + WebSocket + HTML5 Canvas 2D.

## Run

```bash
npm install
npm start
```

Open `http://localhost:3000`.

## Controls (Gojo)

- `WASD` move
- `Mouse` aim
- `M1` Cursed Jab Combo
- `Q` Blue Singularity
- `E` Red Repulsion
- `R` Hollow Purple
- `Space` Spatial Step (teleport)
- `Shift` Dodge
- `F` Domain Expansion

## Gameplay Notes

- Server-authoritative state: movement, damage, cooldowns, RNG, collisions, kills, progression.
- PvP always on; PvE scales by match phase (Early, Mid, Late, Final).
- Gojo has no M2 (intentionally).
- Blue + Red collision triggers Spatial Collapse (purple explosion).
- Active Domain locks all skills for players (movement, dodge and M1 remain).
- Level-up choices are personal overlays and do not pause the match.
