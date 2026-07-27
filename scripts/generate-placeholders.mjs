/**
 * Generates stand-in thumbnails and album photos so the cabinet looks finished
 * before the real media arrives.
 *
 * Each placeholder is a warm, muted card carrying its own Japanese title, so the
 * queue and album read correctly at a glance and it is obvious which slots are
 * still empty. Dropping a real file at the same path replaces it -- no code or
 * JSON change needed.
 *
 *   npm run generate:placeholders
 */
import sharp from "sharp";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const contentDir = path.join(root, "src/content");
const publicDir = path.join(root, "public");

/** Warm Showa-era palette, cycled so adjacent cards stay distinguishable. */
const PALETTE = [
  ["#3d2a18", "#6b4a26"],
  ["#2a3227", "#4d5c41"],
  ["#332330", "#5b3c52"],
  ["#1f2c33", "#3b5560"],
  ["#3a2620", "#69423a"],
  ["#2d2a1c", "#575030"],
];

const escapeXml = (s) =>
  s.replace(/[<>&'"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" })[c]);

function card(width, height, title, subtitle, index) {
  const [from, to] = PALETTE[index % PALETTE.length];
  const titleSize = Math.round(height * 0.115);
  const subSize = Math.round(height * 0.075);
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${from}"/>
      <stop offset="100%" stop-color="${to}"/>
    </linearGradient>
    <radialGradient id="vig" cx="50%" cy="42%" r="78%">
      <stop offset="55%" stop-color="rgba(0,0,0,0)"/>
      <stop offset="100%" stop-color="rgba(0,0,0,0.45)"/>
    </radialGradient>
  </defs>
  <rect width="100%" height="100%" fill="url(#bg)"/>
  <rect width="100%" height="100%" fill="url(#vig)"/>
  <text x="50%" y="${subtitle ? "46%" : "52%"}" text-anchor="middle" dominant-baseline="middle"
        font-family="Hiragino Mincho ProN, Noto Serif JP, serif" font-size="${titleSize}"
        fill="#f2e6cd" opacity="0.92">${escapeXml(title)}</text>
  ${
    subtitle
      ? `<text x="50%" y="63%" text-anchor="middle" dominant-baseline="middle"
        font-family="Hiragino Mincho ProN, Noto Serif JP, serif" font-size="${subSize}"
        fill="#d8c49a" opacity="0.72">${escapeXml(subtitle)}</text>`
      : ""
  }
</svg>`);
}

async function writeIfMissing(target, buffer) {
  try {
    await fs.access(target);
    return false;
  } catch {
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, buffer);
    return true;
  }
}

async function readJson(name) {
  return JSON.parse(await fs.readFile(path.join(contentDir, name), "utf8"));
}

async function main() {
  let created = 0;
  let index = 0;

  for (const file of ["showa-songs.json", "nostalgic-japan.json", "personal-videos.json"]) {
    for (const item of await readJson(file)) {
      const svg = card(640, 360, item.titleJa, item.artistJa ?? item.locationJa ?? "", index++);
      const buffer = await sharp(svg).webp({ quality: 88 }).toBuffer();
      const target = path.join(publicDir, item.thumbnail.replace(/^\//, ""));
      if (await writeIfMissing(target, buffer)) created++;
    }
  }

  for (const page of await readJson("photo-album.json")) {
    for (const photo of page.photos) {
      const svg = card(1600, 1200, photo.captionJa ?? "写真", photo.locationJa ?? "", index++);
      const buffer = await sharp(svg).webp({ quality: 86 }).toBuffer();
      const target = path.join(publicDir, photo.src.replace(/^\//, ""));
      if (await writeIfMissing(target, buffer)) created++;
    }
  }

  console.log(`${created} placeholder assets written (existing files left untouched)`);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
