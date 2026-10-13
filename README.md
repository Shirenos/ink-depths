# Ink Depths

A twin-stick dungeon roguelike drawn in black and white ink, inspired by *The Binding of Isaac*.
Pure HTML5 Canvas and vanilla JavaScript: no build step, no dependencies.

**Play:** https://shirenos.github.io/ink-depths/

![Ink Depths screenshot](screenshot.png)

## Controls

| Key | Action |
| --- | --- |
| WASD | Move |
| Arrow keys | Shoot (or hold the left mouse button to aim with the mouse) |
| Esc / P | Pause |
| R | Restart (from pause or the death screen) |
| M | Mute sound |

## Features

- Procedurally generated floors on a grid: doors lock until a room is cleared, minimap in the corner
- Six enemy types: flies, chasers, shooters that keep their distance, splitters, dashers that telegraph their charge, radial turrets
- Treasure room on every floor and a boss room with a multi-phase boss (aimed spreads, radial bursts, charges, summons, an enraged second half)
- Twelve items that change your stats and shots: damage, tears rate, speed, range, piercing, homing, multishot, spectral and backward tears, extra health
- Hearts drop from cleared rooms; each new floor is bigger and its enemies are tougher
- Death screen with run stats (floor, kills, rooms, items, time)
- Ink aesthetic: paper grain, wobbling ink outlines, splats, particles and screen shake
- Procedural sound effects made with the Web Audio API

## Run locally

Open `index.html` in a browser, or serve the folder: `python3 -m http.server`.

## License

MIT
