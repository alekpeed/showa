/**
 * Canary for the things that rot on their own.
 *
 * She will never report a broken video. A 90-year-old who finds a song no longer
 * plays assumes she did something wrong and quietly stops using that sleeve. So
 * the rot has to be found from this side instead.
 *
 * What actually rots, in rough order of likelihood:
 *   - YouTube uploads get deleted, region-locked, or have embedding disabled
 *     *after* shipping. Checked via oEmbed, which is exactly what a player does.
 *   - Internet radio stream hosts move.
 *   - The news feed URL changes.
 *
 * Not covered, and worth being honest about: this says nothing about *her*
 * machine. It checks whether the current build's dependencies still exist.
 *
 *   npm run check:links
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const contentDir = path.join(root, "src/content");

const readJson = (name) => JSON.parse(fs.readFileSync(path.join(contentDir, name), "utf8"));
const isPlaceholder = (value) => typeof value === "string" && value.startsWith("REPLACE_WITH");

const problems = [];
const skipped = [];
let checked = 0;

const TIMEOUT_MS = 20_000;

async function request(url, init = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * oEmbed returns 401/403 for videos whose owner disabled embedding and 404 for
 * deleted ones. Both look identical to her: a television that will not play.
 */
async function checkYouTube(item) {
  const url = `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(
    `https://www.youtube.com/watch?v=${item.youtubeVideoId}`,
  )}`;
  try {
    const response = await request(url);
    if (response.ok) return;
    // Verified against the live endpoint: a deleted or nonexistent id comes back
    // 400, not 404, which is why both are treated as gone.
    const reason =
      response.status === 400 || response.status === 404
        ? "video is gone or the id is wrong"
        : response.status === 401 || response.status === 403
          ? "embedding disabled or region-locked"
          : `oEmbed returned ${response.status}`;
    problems.push(`${item.id} (${item.titleJa}): ${reason}`);
  } catch (error) {
    problems.push(`${item.id} (${item.titleJa}): ${error.message}`);
  }
}

async function checkUrl(label, url, { method = "HEAD" } = {}) {
  try {
    let response = await request(url, { method });
    // Plenty of stream and CDN hosts reject HEAD but serve GET perfectly well.
    if (response.status === 405 || response.status === 501) {
      response = await request(url, { method: "GET" });
    }
    if (!response.ok) problems.push(`${label}: returned ${response.status}`);
  } catch (error) {
    problems.push(`${label}: ${error.message}`);
  }
}

const libraries = ["showa-songs.json", "nostalgic-japan.json", "personal-videos.json"];

for (const file of libraries) {
  for (const item of readJson(file)) {
    if (!item.enabled) continue;

    if (item.source === "youtube") {
      if (isPlaceholder(item.youtubeVideoId)) {
        skipped.push(`${item.id} (still a placeholder)`);
        continue;
      }
      checked++;
      await checkYouTube(item);
    } else {
      // Bunny embeds are private to the library; a HEAD on the embed URL is the
      // most that can be checked without credentials.
      if (isPlaceholder(item.bunnyLibraryId) || isPlaceholder(item.bunnyVideoId)) {
        skipped.push(`${item.id} (still a placeholder)`);
        continue;
      }
      checked++;
      const embed =
        item.bunnyEmbedUrl ??
        `https://iframe.mediadelivery.net/embed/${item.bunnyLibraryId}/${item.bunnyVideoId}`;
      await checkUrl(`${item.id} (${item.titleJa})`, embed, { method: "GET" });
    }
  }
}

const radio = readJson("radio.json");
if (radio.enabled && !isPlaceholder(radio.streamUrl)) {
  checked++;
  await checkUrl(`radio "${radio.name}"`, radio.streamUrl);
} else if (radio.enabled) {
  skipped.push("radio.streamUrl (still a placeholder)");
}

const news = readJson("news.json");
if (news.enabled && news.mode === "feed") {
  checked++;
  await checkUrl("news feed", news.feedUrl, { method: "GET" });
}

console.log(`\nchecked ${checked} links`);
for (const entry of skipped) console.log(`  skip  ${entry}`);

if (problems.length) {
  console.error(`\n${problems.length} problem(s):\n`);
  for (const problem of problems) console.error(`  BROKEN  ${problem}`);
  console.error(
    `\nFix the manifest, then release. Until then she sees the Japanese ` +
      `"could not play" message on those items.\n`,
  );
  process.exit(1);
}

console.log("\neverything still resolves\n");
