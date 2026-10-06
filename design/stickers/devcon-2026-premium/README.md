# Namera / Mumbai collectibles

Eight premium sticker designs for Devcon Mumbai 2026, guided by the supplied
ETHGlobal, ETHIndia, ENS and Reown merchandise photos. The collection uses
original Namera illustrations and its exact existing mark; reference brands'
logos and artwork are not reproduced.

The direction is bold graphic collectibles: indigo, warm cream, saffron and orange,
organized internal detail, confident outlines, and distinct die-cut silhouettes.
The logo and lettering are added as vectors, separate from generated illustrations.

## Designs

1. Mumbai wallet mascot: chai, a permission card, and streetwear personality.
2. Permission chai stall: a wallet shopkeeper, kettles and a striped awning.
3. Auto-nomous: a Mumbai rickshaw with an agent-wallet passenger.
4. Next stop: onchain: a Mumbai local train and wallet traveler.
5. Gateway pass: the Gateway of India, a seafront and a wallet explorer.
6. Permission peacock: patterned feathers and permission motifs.
7. Retro builder desk: a CRT computer, wallet character and cutting chai.
8. Holographic Namera mark: the actual mark and wordmark, printed in black on foil.

## Deliverables

- `artwork/`: seven original transparent PNGs from the built-in imagegen tool,
  copied unchanged from the tool's output location.
- `svg/`: eight self-contained SVG print masters. The seven illustrated designs
  embed their original PNG; branding, lettering, white silhouettes and trim
  geometry are vector paths. The eighth design is entirely vector.
- `cut-contours/`: matching closed SVG trim contours.
- `png/`: transparent 300 DPI print exports at the supplied physical page sizes.
- `preview.svg` and `preview.png`: labeled contact sheet for visual review.
- `holographic-preview.svg` and `.png`: simulated foil finish for design review.
  The rainbow gradient is not part of the production ink file.
- `manifest.json`: sizes, native artwork resolution, and effective DPI.
- `prompts.json` and `refinement-prompts.json`: exact generation and cleanup prompts
  used with the built-in imagegen tool.
- `source/`: self-contained layout and render scripts, and the exact Namera mark.

The seven generated illustrations are raster inside SVG. They were not traced,
so their detailed edges and shading remain intact. The SVG container does not
make those images infinitely scalable. Check the manifest's native effective
DPI before enlarging; the eighth design can scale as a pure vector.

## Print handoff

Illustrated artwork pages are **85 mm wide**, including bleed and clear margins.
Each page height follows its illustration and compact brand tab; exact dimensions
are in `manifest.json`. Illustrations fit within 72.25 × 72.25 mm while preserving
their original aspect ratios. The eighth page is
**85 × 73.6667 mm**. Each closed cut contour defines the smaller finished sticker;
do not cut at the rectangular page edge.

1. Import artwork and its matching `-cut.svg` at 100%, aligned by page origin.
2. Put `CutContour` on a separate cutting layer and assign the printer's required
   spot-color name and overprint settings. Magenta is only a guide in these SVGs,
   not a production spot-color plate, and must not be printed.
3. For designs 01–07, use opaque white vinyl. White artwork extends 2.04 mm beyond
   the cut contour; extend it to 3 mm if required by the printer. Keep the trim
   path and illustration unchanged. A generous white keyline remains inside trim.
4. For design 08, use holographic vinyl and print the production SVG's black ink
   only. Transparent areas expose the foil. Do not print the rainbow simulation.
   Map the black artwork to the printer's one-color black plate, such as 100% K,
   rather than a composite rich black.
   The cut contour defines the foil's full sticker shape, including clear areas.
   Extend the unprinted stock beyond trim for the printer's required bleed.
5. All colored artwork uses sRGB. Let the printer convert using its stock/press
   ICC profile and supply a physical color proof. Use the SVG masters or 300 DPI
   PNGs, never the review contact sheet.

Matte white vinyl suits the illustrated set; holographic vinyl distinguishes the
brand-mark collectible. The foil preview approximates a reflective material and
is not a press proof. No CMYK or PDF/X masters are included. Event text identifies
the occasion without implying official Devcon merchandise.

## Authoring and design choices

Generation used the **built-in imagegen tool**, with one distinct prompt and
transparent-background output per illustration. See `prompts.json` for the full
prompt set. All final originals are stored locally in `artwork/`.

- Indigo and the exact Namera mark tie the set to the existing brand.
- Saffron, chai, the rickshaw, train, architecture and peacock give it local identity.
- Fine internal details make the artwork collectible; strong outer silhouettes
  keep it legible at sticker scale.
- Compact brand tabs and branding on the artwork's signs avoid large empty labels.
- Avenir Next Demi Bold keeps the wordmark substantial without making it compete
  with the graphics; all print lettering is converted to paths.
- Foil is a separate material option, represented separately from production ink.

Direction: graphic collectibles for Ethereum builders. Energy 3 / rhythm 3 /
motion 1: static print artwork, with different subjects and silhouettes.

`source/compose.py` reads alpha to derive a smooth connected sticker silhouette,
adds vector branding, and embeds the unchanged original PNG. Pillow and NumPy
are used for alpha geometry; sharp renders the SVG print layouts. The CoreText
exporter requires macOS with Avenir Next and DIN Condensed installed.

```sh
python3 design/stickers/devcon-2026-premium/source/compose.py
NAMERA_SHARP_PATH=/absolute/path/to/sharp node design/stickers/devcon-2026-premium/source/render.mjs
```

Use the desktop's bundled Python libraries and sharp, or existing local installs.
No application dependencies were added. Delivered artwork needs none of these
authoring tools or fonts.

Application builds, type checks and runtime tests do not apply to these design
files. Relevant checks are XML, asset resolution, matching trim geometry, PNG
transparency/DPI, source linting, formatting, and visual inspection. A printer's
physical proof and cutting setup remain production steps.

## Verification

PASS: all eight print SVGs and both review SVGs parse; print lettering is outlined.
PASS: all eight cut contours are closed and match their artwork page dimensions.
PASS: the embedded image bytes match the saved original PNGs. Native effective
illustration resolution is 441–540 DPI at supplied size; all PNG exports carry
300 DPI metadata and alpha transparency.
PASS: rendered color and lettering stay inside the trim on all eight designs;
rendered bleed stays within the page. The review sheet shows finished trim.
PASS: the full collection was visually inspected, and source linting/formatting
passed. The holographic production SVG contains black vector ink and no gradient.
