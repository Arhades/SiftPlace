// Regenerate every PWA / favicon PNG from the brand SVG (the blue pixel-house
// mascot). Run after any logo change:  node scripts/generate-icons.mjs
import sharp from "sharp";
import { fileURLToPath } from "node:url";
import path from "node:path";

const pub = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "public");
const svg = path.join(pub, "siftplace-logo.svg");

// warm off-white backdrop (matches --surface) so the transparent SVG reads
// cleanly as an app icon on any launcher / tab strip
const BG = { r: 255, g: 248, b: 246, alpha: 1 };

async function icon(file, size, { pad = 0.1, bg = BG } = {}) {
  const inner = Math.round(size * (1 - pad * 2));
  const img = await sharp(svg, { density: 300 })
    .resize(inner, inner, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .toBuffer();
  await sharp({ create: { width: size, height: size, channels: 4, background: bg } })
    .composite([{ input: img, gravity: "centre" }])
    .png()
    .toFile(path.join(pub, file));
  console.log(`✓ ${file} (${size}×${size})`);
}

await icon("pwa-192.png", 192);
await icon("pwa-512.png", 512);
await icon("apple-touch-icon.png", 180);
// maskable: launchers crop up to ~20% per edge — keep the house in the safe zone
await icon("pwa-maskable-512.png", 512, { pad: 0.18 });
console.log("done — icons regenerated from siftplace-logo.svg");
