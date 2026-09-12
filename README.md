# Battlecoin

One React + Vite app with PixiJS for 2D rendering.

Run `npm install` then `npm run dev` from this directory.

`npm run build` creates the production build. `npm run preview` serves it locally.

The 16:9 landscape arena uses original generated art, with blue defending the left and red defending the right. The game fits the viewport with letterboxing when needed.

- Drag a card onto a green or red grid cell, or select it and click/tap a cell, to deploy for that team. The preview eases between tile centers and shows a blank tooltip for valid placement.
- Grid seams follow the arena artwork. Brown path lanes and both river columns cannot be selected. Cards stay selected until deployment, cancellation, or another selection; there is no timeout.
- The two regions partition the entire area inside the walls. Their shared boundary is fixed at the midpoint for now; `setTerritoryBoundary` updates both shading and team assignment for future game-state integration.
- Knights and guards must spawn on land or bridges and cross using bridges; balloons can fly over water. Troops fight opposing troops.
- Fireball belongs to the region where it is placed and damages that team's enemies. Elixir regenerates automatically.
- Keys 1–4 select cards; Escape cancels. The chat button opens instructions.
- Towers are decorative and cannot deal or receive damage. The round ends when the timer expires.

`src/battle.js` handles PixiJS rendering and the local training opponent.
`src/App.jsx` handles the React HUD. This is a local playable prototype, without multiplayer.

Original artwork: `public/assets/arena.jpg` and `public/assets/characters.png`.
Both were generated with the built-in image generation tool; exact prompts are saved in
`public/assets/prompts.json`. The character atlas is framed at runtime, without external assets.

To replace tower art, place individual transparent PNGs in `public/assets/`:

- `tower_primary_green.png`: blue team's central tower.
- `tower_secondary_green.png`: blue team's two side towers.
- `tower_primary_red.png`: red team's central tower.
- `tower_secondary_red.png`: red team's two side towers.

Use tightly cropped images with the tower base at the bottom. Each image scales
automatically while preserving its aspect ratio. Refresh the page after replacing
files (rebuild and redeploy for production). Files can be added individually;
missing images fall back to the original atlas artwork. Towers remain decorative.
