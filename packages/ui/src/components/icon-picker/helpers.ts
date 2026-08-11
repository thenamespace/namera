// oxlint-disable typescript/no-non-null-assertion
type RGB = {
  r: number;
  g: number;
  b: number;
};

type EmojiDominantColorOptions = {
  size?: number;
  k?: number;
  maxIterations?: number;
  alphaThreshold?: number;
  sampleStep?: number;
};

function rgbToCss({ r, g, b }: RGB, alpha = 1) {
  return `rgba(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)}, ${alpha})`;
}

function distanceSq(a: RGB, b: RGB) {
  const dr = a.r - b.r;
  const dg = a.g - b.g;
  const db = a.b - b.b;
  return dr * dr + dg * dg + db * db;
}

function getBrightness(c: RGB) {
  return (c.r * 299 + c.g * 587 + c.b * 114) / 1000;
}

function getSaturation(c: RGB) {
  const max = Math.max(c.r, c.g, c.b);
  const min = Math.min(c.r, c.g, c.b);

  if (max === 0) return 0;

  return (max - min) / max;
}

function kMeansDominantColor(pixels: RGB[], k = 4, maxIterations = 12): RGB {
  if (pixels.length === 0) {
    return { r: 128, g: 128, b: 128 };
  }

  // Pick initial centroids spread across the sample.
  const centroids: RGB[] = Array.from({ length: k }, (_, i) => {
    const index = Math.floor((i / k) * pixels.length);
    return { ...pixels[index]! };
  });

  let clusters: RGB[][] = [];

  for (let iteration = 0; iteration < maxIterations; iteration++) {
    clusters = Array.from({ length: k }, () => []);

    for (const pixel of pixels) {
      let bestIndex = 0;
      let bestDistance = Infinity;

      for (let i = 0; i < centroids.length; i++) {
        const distance = distanceSq(pixel, centroids[i]!);

        if (distance < bestDistance) {
          bestDistance = distance;
          bestIndex = i;
        }
      }

      clusters[bestIndex]!.push(pixel);
    }

    for (let i = 0; i < k; i++) {
      const cluster = clusters[i]!;

      if (cluster.length === 0) continue;

      let r = 0;
      let g = 0;
      let b = 0;

      for (const pixel of cluster) {
        r += pixel.r;
        g += pixel.g;
        b += pixel.b;
      }

      centroids[i] = {
        r: r / cluster.length,
        g: g / cluster.length,
        b: b / cluster.length,
      };
    }
  }

  // Prefer large, colorful clusters.
  // This avoids white/gray/black anti-aliased pixels winning too often.
  let bestColor = centroids[0];
  let bestScore = -Infinity;

  for (let i = 0; i < clusters.length; i++) {
    const color = centroids[i]!;
    const clusterSize = clusters[i]?.length ?? 0;

    const saturation = getSaturation(color);
    const brightness = getBrightness(color);

    const tooDark = brightness < 35;
    const tooLight = brightness > 245;
    const tooGray = saturation < 0.12;

    let score = clusterSize;

    if (tooDark || tooLight || tooGray) {
      score *= 0.35;
    }

    score *= 1 + saturation;

    if (score > bestScore) {
      bestScore = score;
      bestColor = color;
    }
  }

  return bestColor!;
}

export function getEmojiDominantColor(emoji: string, options: EmojiDominantColorOptions = {}): RGB {
  const { size = 128, k = 4, maxIterations = 12, alphaThreshold = 40, sampleStep = 4 } = options;

  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;

  const ctx = canvas.getContext("2d", {
    willReadFrequently: true,
  });

  if (!ctx) {
    throw new Error("Could not create canvas context");
  }

  ctx.clearRect(0, 0, size, size);

  ctx.font = `${size * 0.78}px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  ctx.fillText(emoji, size / 2, size / 2);

  const { data } = ctx.getImageData(0, 0, size, size);

  const pixels: RGB[] = [];

  for (let i = 0; i < data.length; i += 4 * sampleStep) {
    const r = data[i]!;
    const g = data[i + 1]!;
    const b = data[i + 2]!;
    const a = data[i + 3]!;

    if (a < alphaThreshold) continue;

    pixels.push({ r, g, b });
  }

  return kMeansDominantColor(pixels, k, maxIterations);
}

export function getEmojiBackgroundColor(emoji: string, alpha = 0.1): string {
  const color = getEmojiDominantColor(emoji);

  return rgbToCss(color, alpha);
}
