"""Build spacious SVG sticker layouts around unmodified imagegen artwork."""

import base64
import html
import json
import math
from pathlib import Path
import subprocess
import xml.etree.ElementTree as ET

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
FONTS = json.loads(subprocess.check_output(["swift", str(ROOT / "source/outline-fonts.swift")]))
INK, INDIGO = "#272838", "#5E6AD2"
HEAVY, DEMI = "AvenirNext-Heavy", "AvenirNext-DemiBold"
NS = "{http://www.w3.org/2000/svg}"
favicon = ET.parse(ROOT / "source/namera-mark.svg").getroot()
LOGO = "".join(p.attrib["d"] for p in favicon.iter(f"{NS}path"))
WIDTH, MM = 1000, 85
DESIGNS = [
    ("01-mumbai-wallet-mascot", "Mumbai wallet mascot", "YOUR AGENT. YOUR RULES."),
    ("02-permission-chai-stall", "Permission chai stall", "CHAI. CODE. ONCHAIN."),
    ("03-auto-nomous", "Auto-nomous", "AUTO-NOMOUS"),
    ("04-mumbai-local", "Mumbai local", "NEXT STOP: ONCHAIN"),
    ("05-gateway-pass", "Gateway pass", "GATEWAY TO ONCHAIN"),
    ("06-permission-peacock", "Permission peacock", "PERMISSION TO EXPLORE"),
    ("07-retro-builder-desk", "Retro builder desk", "BUILD WITH PERMISSION"),
]


def text(label, x, baseline, size, fill=INK, font=HEAVY, tracking=0):
    glyphs = FONTS[font]
    width = sum(glyphs[c]["advance"] * size / 1000 for c in label) + max(0, len(label) - 1) * tracking
    cursor = x - width / 2
    paths = []
    for c in label:
        if glyphs[c]["path"]:
            paths.append(f'<path d="{glyphs[c]["path"]}" transform="translate({cursor:.3f} {baseline}) scale({size/1000:.6f} {-size/1000:.6f})"/>')
        cursor += glyphs[c]["advance"] * size / 1000 + tracking
    return f'<g fill="{fill}" aria-label="{html.escape(label, quote=True)}">{"".join(paths)}</g>'


def brand(baseline):
    size = 60
    word_width = sum(FONTS[DEMI][c]["advance"] * size / 1000 for c in "namera") - 5
    mark_width, gap = 45, 13
    left = 500 - (mark_width + gap + word_width)/2
    mark = f'<path d="{LOGO}" fill="{INDIGO}" transform="translate({left} {baseline-mark_width*148.238/180}) scale({mark_width/180})"/>'
    return mark + text("namera", left+mark_width+gap+word_width/2, baseline, size, font=DEMI, tracking=-1)


def scene_brand(name):
    # Exact vector type sits on the intentionally blank signs in the artwork.
    if name == "02-permission-chai-stall":
        label = f'<path d="{LOGO}" fill="{INK}" transform="translate(350 173) scale(.2)"/>'
        label += text("namera", 479, 204, 46, font=DEMI)
        return f'<g transform="rotate(-2 460 190)">{label}</g>'
    if name == "03-auto-nomous":
        label = f'<path d="{LOGO}" fill="{INK}" transform="translate(530 166) scale(.17)"/>'
        label += text("namera", 646, 194, 43, font=DEMI)
        return f'<g transform="rotate(5 620 185)">{label}</g>'
    if name == "04-mumbai-local":
        label = f'<path d="{LOGO}" fill="{INK}" transform="translate(575 254) scale(.17)"/>'
        label += text("namera", 680, 281, 36, font=DEMI)
        return f'<g transform="rotate(2 680 280)">{label}</g>'
    if name == "06-permission-peacock":
        return f'<path d="{LOGO}" fill="{INDIGO}" transform="translate(450 397) scale(.6111)"/>' + text("namera", 505, 526, 32, font=DEMI)
    if name == "07-retro-builder-desk":
        label = f'<path d="{LOGO}" fill="{INK}" transform="translate(500 535) scale(.15)"/>'
        label += text("namera", 604, 558, 36, font=DEMI)
        return f'<g transform="rotate(-2 590 550)">{label}</g>'
    return ""


def simplify(points, tolerance=1.4):
    if len(points) < 3:
        return points
    first, last = points[0], points[-1]
    vx, vy = last[0] - first[0], last[1] - first[1]
    length = math.hypot(vx, vy)
    distances = [abs(vx * (first[1] - p[1]) - (first[0] - p[0]) * vy) / length if length else math.dist(first, p) for p in points]
    farthest = max(range(len(points)), key=distances.__getitem__)
    if distances[farthest] <= tolerance:
        return [first, last]
    return simplify(points[:farthest + 1], tolerance)[:-1] + simplify(points[farthest:], tolerance)


def smooth_path(points, scale=4):
    points = [(x * scale, y * scale) for x, y in points]
    mid = lambda p, q: ((p[0] + q[0]) / 2, (p[1] + q[1]) / 2)
    start = mid(points[-1], points[0])
    commands = [f"M{start[0]:.2f} {start[1]:.2f}"]
    for i, p in enumerate(points):
        end = mid(p, points[(i + 1) % len(points)])
        commands.append(f"Q{p[0]:.2f} {p[1]:.2f} {end[0]:.2f} {end[1]:.2f}")
    return "".join(commands) + "Z"


def silhouette(image, art_box, canvas_height, footer_top, footer_bottom, footer_width):
    # Derive geometry from alpha only. The original illustration pixels stay untouched.
    scale = 4
    mask = Image.new("L", (WIDTH // scale, canvas_height // scale))
    x, y, w, h = art_box
    alpha = image.getchannel("A").resize((round(w / scale), round(h / scale)), Image.Resampling.LANCZOS)
    alpha = alpha.point(lambda v: 255 if v > 12 else 0)
    mask.paste(alpha, (round(x / scale), round(y / scale)))
    draw = ImageDraw.Draw(mask)
    draw.rounded_rectangle((round((500-footer_width/2)/scale), round(footer_top/scale), round((500+footer_width/2)/scale), round(footer_bottom/scale)), radius=24 // scale, fill=255)

    # Enclose detached small scenic details within one connected, cuttable silhouette.
    rows = np.asarray(mask)
    bounds = [(y, int(xs[0]), int(xs[-1])) for y, row in enumerate(rows) if len(xs := np.flatnonzero(row))]
    envelope = Image.new("L", mask.size)
    draw = ImageDraw.Draw(envelope)
    left = [(x1, y) for y, x1, x2 in bounds]
    right = [(x2, y) for y, x1, x2 in reversed(bounds)]
    draw.polygon(left + right, fill=255)
    # About 2 mm of white keyline inside trim at the supplied scale.
    envelope = envelope.filter(ImageFilter.MaxFilter(13))
    envelope = envelope.filter(ImageFilter.GaussianBlur(1.2)).point(lambda v: 255 if v >= 100 else 0)
    rows = np.asarray(envelope)
    bounds = [(y, int(xs[0]), int(xs[-1])) for y, row in enumerate(rows) if len(xs := np.flatnonzero(row))]
    left = simplify([(x1, y) for y, x1, x2 in bounds])
    right = simplify([(x2, y) for y, x1, x2 in reversed(bounds)])
    return smooth_path(left + right)


manifest, stickers = [], []
for name, title, slogan in DESIGNS:
    file = ROOT / "artwork" / f"{name}.png"
    with Image.open(file) as source:
        assert source.mode == "RGBA", f"Transparent RGBA artwork required: {file}"
        assert source.getchannel("A").getextrema()[0] == 0
        image = source.copy()
        native = source.size
    art_width = min(850, 850 * native[0] / native[1])
    art_height = min(850, 850 * native[1] / native[0])
    art_box = ((WIDTH-art_width)/2, 55, art_width, art_height)
    alpha_bounds = image.getchannel("A").point(lambda value: 255 if value > 12 else 0).getbbox()
    assert alpha_bounds, f"Empty illustration: {name}"
    content_bottom = 55 + alpha_bounds[3]/native[1]*art_height
    needs_wordmark = name in ("01-mumbai-wallet-mascot", "05-gateway-pass")
    footer_baseline = content_bottom + (60 if needs_wordmark else 48)
    footer_bottom = footer_baseline + (93 if needs_wordmark else 62)
    canvas_height = math.ceil((footer_bottom+60)/4)*4
    contour = silhouette(image, art_box, canvas_height, content_bottom-16, footer_bottom, 440 if needs_wordmark else 480)
    encoded = base64.b64encode(file.read_bytes()).decode()
    x, y, w, h = art_box
    geometry = f'xmlns="http://www.w3.org/2000/svg" width="{MM}mm" height="{MM*canvas_height/WIDTH:g}mm" viewBox="0 0 {WIDTH} {canvas_height}"'
    body = f'<path d="{contour}" fill="#FFFFFF" stroke="#FFFFFF" stroke-width="48" stroke-linecap="round" stroke-linejoin="round"/>'
    body += f'<image x="{x}" y="{y}" width="{w}" height="{h}" href="data:image/png;base64,{encoded}"/>'
    body += scene_brand(name)
    if needs_wordmark:
        body += brand(footer_baseline)
    body += text(slogan, 500, footer_baseline+(37 if needs_wordmark else 0), 25, font=DEMI, tracking=.8)
    body += text("MUMBAI / DEVCON 2026", 500, footer_baseline+(70 if needs_wordmark else 36), 22, font=DEMI, tracking=1.1)
    artwork = f'<svg {geometry} role="img"><title>Namera / {html.escape(title)}</title><desc>Imagegen graphic Mumbai illustration embedded at its native resolution; accurate vector Namera mark and outlined lettering. Separate cut contour supplied.</desc><g id="artwork">{body}</g></svg>'
    (ROOT / "svg" / f"{name}.svg").write_text(artwork + "\n")
    cut = f'<svg {geometry}><title>{html.escape(title)} trim path</title><path id="CutContour" d="{contour}" fill="none" stroke="#FF00FF" stroke-width="1"/></svg>'
    (ROOT / "cut-contours" / f"{name}-cut.svg").write_text(cut + "\n")
    manifest.append(dict(name=name, title=title, slogan=slogan, page_width_mm=MM, page_height_mm=MM*canvas_height/WIDTH, viewbox_height=canvas_height, native_artwork_pixels=list(native), artwork_width_mm=w/WIDTH*MM, artwork_height_mm=h/WIDTH*MM, native_effective_dpi=round(native[0]/(w/WIDTH*MM/25.4)), raster_export_dpi=300))
    # The review sheet shows the finished trim, rather than the extra white bleed.
    trim_clip = f'<defs><clipPath id="trim-{name}"><path d="{contour}"/></clipPath></defs>'
    stickers.append(trim_clip + f'<g clip-path="url(#trim-{name})">{body}</g>')

# An eighth design uses the actual brand mark as black ink on holographic stock.
holo_name = "08-holographic-namera-mark"
holo_contour = "M180 58H720Q743 58 760 75L853 168Q870 185 870 210V570Q870 595 853 612L760 705Q743 722 720 722H180Q157 722 140 705L47 612Q30 595 30 570V210Q30 185 47 168L140 75Q157 58 180 58Z"
holo_mark = f'<path d="{LOGO}" fill="{INK}" transform="translate(236 146) scale(2.38)"/>'
holo_mark += text("namera", 450, 591, 85, font=DEMI, tracking=-1)
holo_mark += text("WALLETS FOR AGENTS", 450, 646, 23, font=DEMI, tracking=1.2)
holo_geometry = 'xmlns="http://www.w3.org/2000/svg" width="85mm" height="73.6667mm" viewBox="0 0 900 780"'
holo_ink = holo_mark.replace(INK, "#000000")
(ROOT / "svg" / f"{holo_name}.svg").write_text(f'<svg {holo_geometry}><title>Namera mark / black ink on holographic stock</title><desc>Production black ink only. Transparent regions expose the holographic substrate; the separate trim contour defines the sticker.</desc><g id="black-ink">{holo_ink}</g></svg>\n')
(ROOT / "cut-contours" / f"{holo_name}-cut.svg").write_text(f'<svg {holo_geometry}><title>Namera mark cut contour</title><path id="CutContour" d="{holo_contour}" fill="none" stroke="#FF00FF" stroke-width="1"/></svg>\n')
holo_def = '<defs><linearGradient id="foil" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#B4CFF1"/><stop offset=".19" stop-color="#C4EEDD"/><stop offset=".35" stop-color="#D9D4FD"/><stop offset=".53" stop-color="#F2CFE0"/><stop offset=".68" stop-color="#F3E6AC"/><stop offset=".83" stop-color="#A8E0D7"/><stop offset="1" stop-color="#9DB6E8"/></linearGradient></defs>'
holo_preview = f'<path d="{holo_contour}" fill="url(#foil)" stroke="#FFFFFF" stroke-width="12"/>' + holo_mark
(ROOT / "holographic-preview.svg").write_text(f'<svg {holo_geometry}><title>Holographic finish simulation / not print artwork</title>{holo_def}{holo_preview}</svg>\n')
manifest.append(dict(name=holo_name, title="Holographic Namera mark", slogan="WALLETS FOR AGENTS", page_width_mm=85, page_height_mm=85*780/900, viewbox_height=1240, raster_export_dpi=300, artwork_type="vector ink on holographic stock", native_effective_dpi=None))
stickers.append(f'<g transform="translate(25 145) scale(1.05)">{holo_preview}</g>')

# Large contact sheet for assessing spacing and consistency across the collection.
sheet = '<rect width="2800" height="2200" fill="#EDECE7"/>'
sheet += holo_def + text("namera / Mumbai collectibles", 1400, 102, 63)
sheet += text("EIGHT COLLECTIBLES / DEVCON 2026", 1400, 154, 24, font=DEMI, tracking=2)
for i, (entry, body) in enumerate(zip(manifest, stickers)):
    x, y = 80 + (i % 4)*680, 240 + (i // 4)*955
    centered_y = y + (1240-entry["viewbox_height"])*.3
    sheet += f'<g transform="translate({x} {centered_y}) scale(.6)">{body}</g>'
    sheet += text(f"0{i+1} / {entry['title']}", x+300, y+774, 24, font=DEMI)
    sheet += text(entry["slogan"], x+300, y+815, 16, font=DEMI, tracking=1)
    if entry["name"] == holo_name:
        sheet += text("SIMULATED HOLOGRAPHIC STOCK", x+300, y+853, 15, font=DEMI)
(ROOT / "preview.svg").write_text(f'<svg xmlns="http://www.w3.org/2000/svg" width="2800" height="2200" viewBox="0 0 2800 2200"><title>Namera premium Mumbai illustrated stickers</title>{sheet}</svg>\n')
(ROOT / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")
print("Composed 7 illustrated stickers and 1 vector holographic design with cut contours.")
