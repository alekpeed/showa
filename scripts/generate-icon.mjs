/**
 * Draws the app icon source, then hands it to `tauri icon` for the platform set.
 *
 * Direction from 06-asset-manifest.md: a simple cabinet/television silhouette in
 * warm wood and muted brass, no dense text, legible at Dock size. The glyph is a
 * lit television set into a cabinet -- recognisable at 32px, where any wording
 * would turn to mud.
 *
 *   npm run generate:icon
 */
import sharp from "sharp";
import path from "node:path";
import fs from "node:fs/promises";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const outDir = path.join(root, "src/assets/app-icon");
const out = path.join(outDir, "app-icon-1024.png");

const S = 1024;

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}" viewBox="0 0 1024 1024">
  <defs>
    <linearGradient id="wood" x1="0" y1="0" x2="0.6" y2="1">
      <stop offset="0%" stop-color="#6b4526"/>
      <stop offset="55%" stop-color="#4a2d16"/>
      <stop offset="100%" stop-color="#301c0d"/>
    </linearGradient>
    <linearGradient id="brass" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#f0d190"/>
      <stop offset="50%" stop-color="#c9a04e"/>
      <stop offset="100%" stop-color="#8a6f36"/>
    </linearGradient>
    <radialGradient id="glow" cx="50%" cy="46%" r="62%">
      <stop offset="0%" stop-color="#ffe6b0"/>
      <stop offset="58%" stop-color="#e2b96c"/>
      <stop offset="100%" stop-color="#7d5a25"/>
    </radialGradient>
    <linearGradient id="sheen" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="rgba(255,255,255,0.34)"/>
      <stop offset="42%" stop-color="rgba(255,255,255,0)"/>
    </linearGradient>
  </defs>

  <!-- Cabinet body. The rounded square reads as an app tile at Dock size. -->
  <rect x="72" y="72" width="880" height="880" rx="196" fill="url(#wood)"/>
  <rect x="72" y="72" width="880" height="880" rx="196" fill="none"
        stroke="#20120a" stroke-width="10" opacity="0.7"/>

  <!-- Brass bezel and the lit screen. -->
  <rect x="196" y="248" width="632" height="404" rx="46" fill="url(#brass)"/>
  <rect x="228" y="280" width="568" height="340" rx="26" fill="url(#glow)"/>
  <rect x="228" y="280" width="568" height="340" rx="26" fill="url(#sheen)"/>

  <!-- Two cabinet knobs below, the only other object the silhouette needs. -->
  <circle cx="396" cy="782" r="62" fill="url(#brass)"/>
  <circle cx="396" cy="782" r="26" fill="#3a2611" opacity="0.55"/>
  <circle cx="628" cy="782" r="62" fill="url(#brass)"/>
  <circle cx="628" cy="782" r="26" fill="#3a2611" opacity="0.55"/>
</svg>`;

await fs.mkdir(outDir, { recursive: true });
await sharp(Buffer.from(svg)).png().toFile(out);
console.log(`wrote ${path.relative(root, out)}`);
console.log("now run:  npx tauri icon src/assets/app-icon/app-icon-1024.png");
