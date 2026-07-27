/**
 * Pulls a thumbnail for every YouTube item that does not have a real one yet.
 *
 * Otherwise this is the tedious part of adding content: find the video, find a
 * still, crop it to 16:9, convert it, name it correctly, put it in the right
 * folder. That is the step most likely to make you stop adding songs.
 *
 * maxresdefault does not exist for every upload -- older and low-resolution
 * videos only have the smaller sizes, and asking for the wrong one returns a
 * 404 even though the video is perfectly alive. So it falls back down the chain.
 *
 *   npm run fetch:thumbnails          # only items still using a placeholder image
 *   npm run fetch:thumbnails -- --all # re-fetch everything, overwriting
 */
import sharp from "sharp";
import fs from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const contentDir = path.join(root, "src/content");
const publicDir = path.join(root, "public");

const force = process.argv.includes("--all");

/** Largest first. A 404 here means "this size does not exist", not "no video". */
const SIZES = ["maxresdefault", "hqdefault", "mqdefault"];

const readJson = async (name) =>
  JSON.parse(await fs.readFile(path.join(contentDir, name), "utf8"));

const isPlaceholder = (value) => typeof value === "string" && value.startsWith("REPLACE_WITH");

/**
 * Generated placeholders are small; a real still is not. Used to tell "never
 * fetched" from "already has a proper thumbnail" without tracking state.
 */
const PLACEHOLDER_MAX_BYTES = 20_000;

async function looksLikePlaceholder(file) {
  try {
    const { size } = await fs.stat(file);
    return size < PLACEHOLDER_MAX_BYTES;
  } catch {
    return true;
  }
}

async function fetchStill(videoId) {
  for (const size of SIZES) {
    const url = `https://img.youtube.com/vi/${videoId}/${size}.jpg`;
    const response = await fetch(url);
    if (!response.ok) continue;
    const buffer = Buffer.from(await response.arrayBuffer());
    // YouTube serves a small grey "no thumbnail" placeholder rather than 404ing
    // in some cases; it is always tiny.
    if (buffer.byteLength < 2000) continue;
    return { buffer, size };
  }
  return null;
}

const results = { written: 0, skipped: 0, failed: [] };

for (const file of ["showa-songs.json", "nostalgic-japan.json"]) {
  for (const item of await readJson(file)) {
    if (item.source !== "youtube" || !item.enabled) continue;

    if (isPlaceholder(item.youtubeVideoId)) {
      results.skipped++;
      continue;
    }

    const target = path.join(publicDir, item.thumbnail.replace(/^\//, ""));
    if (!force && existsSync(target) && !(await looksLikePlaceholder(target))) {
      results.skipped++;
      continue;
    }

    try {
      const still = await fetchStill(item.youtubeVideoId);
      if (!still) {
        results.failed.push(`${item.id}: no thumbnail available for ${item.youtubeVideoId}`);
        continue;
      }

      await fs.mkdir(path.dirname(target), { recursive: true });
      // Cropped to a consistent 16:9 so the queue reads as one row rather than a
      // set of differently-shaped cards; hqdefault in particular is 4:3.
      await sharp(still.buffer)
        .resize(640, 360, { fit: "cover", position: "attention" })
        .webp({ quality: 88 })
        .toFile(target);

      console.log(`  ${item.id}  <- ${still.size}`);
      results.written++;
    } catch (error) {
      results.failed.push(`${item.id}: ${error.message}`);
    }
  }
}

console.log(
  `\n${results.written} fetched, ${results.skipped} skipped` +
    (results.failed.length ? `, ${results.failed.length} failed` : ""),
);

if (results.failed.length) {
  for (const failure of results.failed) console.error(`  FAILED  ${failure}`);
  console.error(
    `\nA failure usually means the video id is wrong or the upload is gone. ` +
      `Run "npm run check:links" to confirm.\n`,
  );
  process.exit(1);
}

if (results.written) {
  console.log(`\nRun "npm run validate:content" next.\n`);
}
