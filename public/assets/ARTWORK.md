# Frontline Artwork

Generated with the built-in image-generation tool for this project.

## Wind Flags and Bomb Revision

The existing `grounded-flags.png` is animated with a small cloth mesh; pole, attachment,
and stone-base vertices remain fixed. No replacement flag artwork was needed.

`bomb-pixel.png` was generated with the built-in image tool and copied into this directory
from `exec-e8733427-845b-4910-b3b3-8fec7c08e993.png`. `src/bomb-art.js` removes the magenta
backdrop once and crops the sprite for both battle and tutorial. Bomb fuse flicker, its
shadow, smoke, embers, and full/partial impacts are code-rendered local effects. Final prompt:

> Use case: stylized-concept. Asset type: one production pixel-art bomb sprite for a sand-themed
> 16-bit fantasy strategy game. A compact dark charcoal iron bomb with a squat round body,
> chunky stepped silhouette, warm bronze equatorial band, two tiny rivets, one crisp ivory
> highlight, a short braided fuse curling up to the right with a small golden/orange spark.
> Three-quarter view, readable at 28 pixels high. Restrained 12-color palette, authentic large
> square pixel clusters, hard edges, no antialiasing, no smooth shading. One centered sprite
> only, fits inside the central 80% of a square image, no text, no floor, no drop shadow, no
> border or other objects. Perfectly flat opaque saturated magenta #FF00FF backdrop for
> chroma-key removal. No magenta in the bomb or fuse. Professional game sprite, not photoreal.

## Pixel Scenery and Cent Icon

`arena-pixel-grounded.png` is the current map. It was created with the built-in image tool
from `arena-grounded.png`, preserving the walls, bridge, paving, and arrow locations.
The source result was `exec-024dc433-a08f-41ff-a89f-004e328856ef.png` under the local Codex
generated-images directory, then copied here. Final prompt:

> Use case: style-transfer. Edit target: the supplied portrait battle arena map. Create a
> strict low-resolution pixel-art version matching 16-bit sand-themed RPG troop sprites.
> Keep EXACT map layout, portrait 1:2 proportions, ALL wall boundaries, chessboard tile
> positions, central single wooden bridge and river, pavement and gold chevron positions,
> palms predominantly at bottom end (becomes left when rotated). Change ONLY rendering
> style: sharply stepped pixel edges, 2-4 tone shaded pixel clusters on palms, foliage,
> rocks, sand, water and masonry, no smooth gradients, no painted/blurred surfaces, no
> antialiasing. Read like a 320x640 pixel game map enlarged with nearest-neighbor. No towers,
> characters, flags, text or new objects. Walls and pavement must not move. Same framing,
> no crop.

`cent-pixel.svg` is a code-native 5x9 pixel glyph, proportioned for VT323 rather than an
AI-generated icon. React masks it with the surrounding text color; Pixi uses the same image
as a tinted texture. Ambient wind, foam, tumbleweed, and tutorial animation are code-rendered
game effects using the existing map and troop artwork, not video overlays.

## Grounded Flag Revision

The current renderer uses `arena-grounded.png` with the four baked-in banner assemblies removed.
`grounded-flags.png` is a separate pair of green/right-arrow and red/left-arrow upright flags.
`src/arena-flags.js` removes the magenta backdrop and anchors each stone socket to its arena
coordinate. Their poles remain vertical when the background is rotated. Both files were generated
with the built-in image tool, then copied into this directory.

Map edit prompt: remove only the four flag/banner assemblies and their long wooden poles; restore
the sand, stone and vegetation behind them. Preserve the arena, walls, bridge, river, grid,
pavement, gold pavement arrows, rocks, trees, and exact vertical 1:2 geometry.

Flag atlas prompt: two standing wooden flagpoles, each planted in a chunky sandstone socket.
Left sprite has its pole on the left, green cloth extending right, and a gold right arrow.
Right sprite is the mirrored red variant with a gold left arrow. Both bases sit on one baseline;
full poles are visibly seated in stone. Crisp pixel-art desert strategy-game style, generous
magenta chroma-key padding, no scenery or lettering.

## Balloon and Faction Revision (September 13)

- `sand-balloon-roster.png`: six sprites, small scout, medium caravan, and large twin-canopy siege
  bombers. Green UP is the top row and red DOWN is the bottom row. Explicit atlas bounds in
  `src/character-art.js` separate the wide silhouettes, then remove the magenta chroma background.
- `arena-faction-banners.png`: geometry-preserving edit of the sand arena. The lower spawn becomes
  game-left after clockwise rotation, with green banners and inward-facing arrows. The upper spawn
  becomes game-right, with red banners. The poles extend away from the battlefield.
- Both assets were generated with the built-in image tool and copied into this directory.

### Balloon Prompt

Create one production sprite atlas PNG for a sand-themed pixel-art trading battle game. Exactly
3 columns x 2 rows of isolated hot air balloon bombers, green and sand gold on the top row, red
and sand gold on the bottom. Small: one round canopy, wicker basket and sand pilot holding a bomb.
Medium: elongated segmented canopy, reinforced basket and two bomb racks. Large: broad twin-lobed
canopy, armored gold ribs, substantial gondola and three bomb racks. Distinct silhouettes at tiny
size, crisp 16-bit pixel art, no turquoise/blue, no text, uncropped sprites. Follow-up edit replaced
the generated checkerboard with perfectly flat #FF00FF magenta while preserving all six sprites.

### Faction Map Prompt

Preserve exact canvas aspect ratio and all coordinates of walls, tiles, river, bridge, pavement,
trees and rocks. At the bottom spawn, point pavement chevrons and banner emblems UP toward the
arena; recolor banners GREEN and extend wooden supports down, away from battle. At the top spawn,
keep chevrons and banner emblems pointing DOWN toward the arena; recolor banners RED and extend
supports toward the top edge. No new structures, towers, typography, or UI. Source rotates clockwise.

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
