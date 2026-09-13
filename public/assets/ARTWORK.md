# Frontline Artwork

Generated with the built-in image-generation tool for this project.

## Sand Arena Revision

- `sand-troops-pixel.png`: 1536 x 1024 chroma-key atlas with four distinct sand units in UP and DOWN variants.
- `arena-sand-left-trees.png`: portrait arena source prepared for Pixi's clockwise rotation, producing trees on the game-view left and a clear right edge.
- Both assets were generated with the built-in image-generation tool and are loaded directly by the runtime.

### Sand Troop Atlas Prompt

Use case: stylized-concept. Asset type: production 2D pixel-art game sprite atlas. Create one
1536x1024 PNG with exactly 4 equal columns and 2 equal rows. Pure opaque chroma-key magenta #FF00FF
background, perfectly flat and uniform outside silhouettes and between limbs; no gradient, glow, floor,
shadow, text, borders, or checkerboard. Each cell contains exactly one full-body character, centered
with generous magenta padding and no cropping. Top row UP team uses turquoise cloth and lapis details;
bottom row DOWN team is the exact matched character in coral-red cloth and ruby details. ALL characters
are made primarily from warm sandstone, sand, clay, rope and small gold details. Deliberately crisp
32-bit pixel art with visible block pixels, strong readable silhouettes, isometric/front three-quarter
casual strategy-game view, readable at 40px. Column 1: slim sand ranger with sandstone hood, compact bow
and quiver. Column 2: broad sand guardian with square stone shield and short spear. Column 3: sand bomber
balloon with compact hot-air balloon above, woven basket and one clearly visible round bomb. Column 4:
huge chunky sand golem with blocky fists and carved rune. Keep every cell visually distinct by silhouette.
No anti-aliased painterly 3D rendering; unmistakably pixelated game sprites.

### Final Sand Arena Prompt

Use case: precise-object-edit. This portrait arena is rotated 90 degrees clockwise by the game renderer.
Preserve the exact canvas, camera, playable grid, walls, two vertical paths, river, single wide bridge,
rocks, banners, lighting and geometry. To make the final rotated game view tree-heavy on the left and
tree-free on the right, remove every palm tree, trunk, frond, leafy canopy and log from the entire top
perimeter and upper corners of this portrait source image. The entire top perimeter outside the wall
must be clean sand and sandstone with only sparse low flowers and rocks. Move all removed tree mass to
the bottom perimeter and lower corners of this portrait source, behind the wall and never covering the
playable grid, gate, river or bridge. Also remove trees along the portrait source's left and right side
edges except where they naturally join the bottom corners. Required source orientation: top edge has
zero trees; bottom edge has a lush continuous palm cluster. No characters, text, logos or UI.

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
