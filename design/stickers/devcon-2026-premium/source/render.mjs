import fs from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

// Use the desktop's bundled renderer, or an existing sharp install. No app dependency.
const sharpModule = process.env.NAMERA_SHARP_PATH
  ? pathToFileURL(createRequire(import.meta.url).resolve(process.env.NAMERA_SHARP_PATH)).href
  : "sharp";
const { default: sharp } = await import(sharpModule);
const root = fileURLToPath(new URL("../", import.meta.url));

async function render() {
  const manifest = JSON.parse(await fs.readFile(path.join(root, "manifest.json"), "utf8"));

  await Promise.all(
    manifest.map(async (sticker) => {
      const pixels = Math.round((sticker.page_width_mm / 25.4) * sticker.raster_export_dpi);
      await sharp(path.join(root, "svg", `${sticker.name}.svg`), {
        density: sticker.raster_export_dpi,
      })
        .resize({ width: pixels })
        .withMetadata({ density: sticker.raster_export_dpi })
        .png()
        .toFile(path.join(root, "png", `${sticker.name}.png`));
      process.stdout.write(
        `${sticker.name}: ${pixels}px wide / ${sticker.raster_export_dpi} DPI\n`,
      );
    }),
  );

  await sharp(path.join(root, "preview.svg")).png().toFile(path.join(root, "preview.png"));
  await sharp(path.join(root, "holographic-preview.svg"), { density: 300 })
    .png()
    .toFile(path.join(root, "holographic-preview.png"));
}

await render();
