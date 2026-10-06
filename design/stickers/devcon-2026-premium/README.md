# Namera / Mumbai illustrated sticker collection

Eight imagegen illustrations composed into spacious branded sticker layouts for
Devcon Mumbai 2026. This is the premium illustrated revision of the earlier flat
vector collection, saved separately so both versions remain available.

The art direction is warm, hand-painted anime: indigo wallet characters, detailed
Mumbai scenes, natural materials, and cinematic light. The accurate Namera mark
and lettering are added separately as vectors, with no generated branding text.

## Designs

1. Gateway to onchain: warm stonework, sea reflections, wallet explorer with chai.
2. Chai sidekick: a friendly wallet taking a cutting-chai break.
3. Auto-nomous: a Mumbai rickshaw with an agent-wallet passenger.
4. Next stop: onchain: a Mumbai local train and wallet traveler.
5. Build by the bay: a quiet Marine Drive builder moment.
6. Permission to explore: a wallet in a paper boat beneath the Sea Link.
7. Your agent. Your rules.: a wallet with a brass key and permission scroll.
8. After hours. Onchain.: a warmly lit Mumbai workspace at night.

## Deliverables

- `artwork/`: original transparent PNGs from the built-in imagegen tool, unchanged.
- `svg/`: self-contained SVG print layouts. Each embeds one original PNG; the
  Namera logo, lettering, white silhouette, and cut geometry are vector paths.
- `cut-contours/`: matching closed SVG trim contours, one per sticker.
- `png/`: transparent 300 DPI print exports at the supplied physical page size.
- `preview.svg` and `preview.png`: contact sheet for visual review, not a gang sheet.
- `manifest.json`: physical sizes, native artwork resolution, and effective DPI.
- `prompts.json`: the exact eight prompts used with the built-in imagegen tool.
- `source/`: layout and render scripts for reproduction.

The artwork is raster inside the SVG. It was intentionally not vector-traced,
because tracing would damage its painted textures and fine details. The SVG
container does not make the illustration infinitely scalable. Consult the native
effective DPI in the manifest before enlarging it.

## Print handoff

Each artwork page is **85 × 105.4 mm**, including white bleed and clear margins.
The closed cut contour defines the smaller finished sticker. The illustration
occupies a 72.25 mm square; native effective resolution is recorded per design.
PNG exports are 1004 × 1245 pixels at 300 DPI.

1. Import the artwork and its matching `-cut.svg` at 100%, aligned by page origin.
2. Place `CutContour` on a separate cutting layer and assign the printer's required
   spot-color name and overprint settings. The SVG's magenta stroke is a guide,
   not a production spot-color plate, and should not be printed.
3. White artwork extends 2.04 mm beyond the cut contour. A generous white keyline
   surrounds the illustration and branding inside the trim. If the printer needs
   3 mm bleed, extend the white bleed without moving the cut contour or artwork.
4. Use opaque white sticker stock. All files use sRGB color; the printer should
   convert through its press/stock ICC profile and supply a physical color proof.
5. Supply the individual SVG masters or 300 DPI PNGs, never the contact sheet.

Matte white vinyl preserves the painterly finish; a physical proof confirms the
small type and darker illustrations. No CMYK or PDF/X master is included.
The artwork identifies the occasion without using the Devcon logo or implying
official event merchandise.

## Authoring

Generation used the **built-in imagegen tool** with transparent-background output,
one distinct prompt per illustration. The complete prompt set is in `prompts.json`.
The original art is copied into this folder; no workspace file depends on the
tool's default output location.

`source/compose.py` reads the illustration alpha to derive a smooth, connected
sticker silhouette, adds an accurately outlined brand footer, and embeds the
unchanged PNG. It uses Pillow and NumPy for alpha geometry only. The type outlines
come from the earlier collection's CoreText exporter; regeneration requires
macOS with its installed Avenir Next fonts.

```sh
python3 design/stickers/devcon-2026-premium/source/compose.py
NAMERA_SHARP_PATH=/absolute/path/to/sharp node design/stickers/devcon-2026-premium/source/render.mjs
```

Use the desktop's bundled Pillow, NumPy and sharp, or existing local installations.
No application dependencies were added.

The collection is static printable artwork. Its animated-film style does not
mean that the print SVGs contain motion. Application builds, type checks, and
runtime tests do not apply to these design-only files; rendering, XML/geometry
checks, visual inspection, source linting, and formatting are relevant checks.
