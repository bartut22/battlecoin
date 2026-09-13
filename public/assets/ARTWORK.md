# Frontline Artwork

Generated with the built-in image-generation tool for this project.

## Final Assets

- `arena-wide-bridge.png`: edited arena with one uninterrupted bridge deck joining the original two crossings.
- `troop-roster-keyed.png`: 1536 x 1024 atlas, three columns (ranger, guardian, crystal golem),
  two rows (green UP, red DOWN). Balloon artwork remains the existing asset.
- `src/character-art.js` removes the generated magenta chroma backdrop once at runtime and creates six
  transparent sprite canvases, shared between Pixi and the React card portraits.

The first background-free generation produced a visible background, so it was not used for the sprites.
The production atlas intentionally uses an opaque magenta backdrop for reliable chroma rendering.

## Final Prompts

### Troop Atlas

Production sprite-sheet edit for chroma-key rendering. Preserve EXACT six characters, exact same
1536x1024 canvas and three-column two-row placement. Replace the entire backdrop outside the six
silhouettes with perfectly solid saturated magenta #FF00FF RGB(255,0,255). All background must be one
flat exact magenta, no gradients, no haze, no shadows, no light spill. Keep no magenta pixels in the
characters. Full bodies, no cropping, no words. This will be chroma keyed by a game renderer, so the
background must be uniformly magenta including between limbs, bow strings and cloak openings.
Do not output transparency or checkerboard; use pure opaque magenta.

The reference design is a hooded ranger with bow, silver armored guardian with shield, and rocky crystal
golem. Green variants occupy the top row; matching red variants occupy the bottom row.

### Bridge

Precise game map edit. Preserve this exact portrait top-down tropical arena, all walls and sand tiles
and plants and camera orientation. Change only the TWO narrow wooden bridges across the middle
horizontal turquoise river: connect them by replacing the entire water area BETWEEN those two bridges
with continuous wooden decking. The result is ONE very broad clean rectangular timber bridge platform
extending horizontally from the left former bridge to the right former bridge, all planks aligned and
joined. Its upper and lower edges are flush with existing river banks. Leave visible turquoise water
only at the far left and far right ends outside the broad single bridge. No posts, obstacles, rails or
gaps in the middle of the deck. Continuous flat walkable surface all the way between the two old
bridges. No characters, towers, text or UI. Keep the same portrait map composition, high-quality
colorful bubbly hand-painted casual strategy game style.
