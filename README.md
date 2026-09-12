# Battlecoin

One React + Vite app with PixiJS for 2D rendering.

Run `npm install` then `npm run dev` from this directory.

`npm run build` creates the production build. `npm run preview` serves it locally.

The 16:9 landscape arena uses original generated art, with blue defending the left and red defending the right. The game fits the viewport with letterboxing when needed.

- Select a card, then click or tap the left half of the arena to deploy.
- Knights and guards cross the bridges; balloons fly directly to towers.
- Fireball can target either side. Elixir regenerates automatically.
- Keys 1–4 select cards; Escape cancels. The chat button opens instructions.
- Destroy towers to earn crowns. A king-tower defeat ends the battle; otherwise the timer decides by crowns.

`src/battle.js` handles PixiJS rendering and the local training opponent.
`src/App.jsx` handles the React HUD. This is a local playable prototype, without multiplayer.

Original artwork: `public/assets/arena.jpg` and `public/assets/characters.png`.
Both were generated with the built-in image generation tool; exact prompts are saved in
`public/assets/prompts.json`. The character atlas is framed at runtime, without external assets.

