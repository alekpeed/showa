/**
 * Turns a plain list of YouTube URLs into a validated library manifest.
 *
 * This is the low-friction path for adding songs: paste links into a text file,
 * run this once. For each URL it extracts the id, checks the video is actually
 * embeddable, and pulls the real title -- so the three things most likely to be
 * got wrong by hand all happen automatically.
 *
 * A video whose owner has disabled embedding is reported and skipped rather than
 * written, because it would look configured and then refuse to play.
 *
 *   npm run import:urls -- --library showa-songs links.txt
 *
 * One entry per line. Everything after the URL is optional:
 *
 *   https://www.youtube.com/watch?v=XXXXXXXXXXX
 *   https://youtu.be/YYYYYYYYYYY | 川の流れのように | 美空ひばり | 1989
 *
 * Existing entries are matched by video id and left alone, so re-running after
 * adding a few more lines will not undo any hand-written Japanese.
 */
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const contentDir = path.join(root, "src/content");

const LIBRARIES = {
  "showa-songs": { file: "showa-songs.json", folder: "showa" },
  "nostalgic-japan": { file: "nostalgic-japan.json", folder: "nostalgic" },
};

const args = process.argv.slice(2);
const libIndex = args.indexOf("--library");
const library = libIndex === -1 ? "showa-songs" : args[libIndex + 1];
const inputPath = args.filter((a, i) => !a.startsWith("--") && i !== libIndex + 1)[0];

if (!inputPath || !LIBRARIES[library]) {
  console.error(
    `\n  npm run import:urls -- --library <${Object.keys(LIBRARIES).join("|")}> links.txt\n\n` +
      `  One URL per line. Optionally:  URL | 日本語タイトル | 歌手 | 年\n`,
  );
  process.exit(1);
}

const { file, folder } = LIBRARIES[library];
const target = path.join(contentDir, file);

/** Accepts a bare id, watch URL, youtu.be link or embed URL. */
function videoId(value) {
  const trimmed = value.trim();
  if (/^[\w-]{11}$/.test(trimmed)) return trimmed;
  for (const pattern of [/[?&]v=([\w-]{11})/, /youtu\.be\/([\w-]{11})/, /\/embed\/([\w-]{11})/]) {
    const match = trimmed.match(pattern);
    if (match?.[1]) return match[1];
  }
  return null;
}

/** oEmbed doubles as the embeddability check and the title source. */
async function lookup(id) {
  const url = `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(
    `https://www.youtube.com/watch?v=${id}`,
  )}`;
  const response = await fetch(url);
  if (response.status === 401 || response.status === 403) {
    return { ok: false, reason: "embedding is disabled for this video" };
  }
  if (response.status === 400 || response.status === 404) {
    return { ok: false, reason: "video not found" };
  }
  if (!response.ok) return { ok: false, reason: `oEmbed returned ${response.status}` };

  const data = await response.json();
  return { ok: true, title: data.title ?? "", author: data.author_name ?? "" };
}

/** Stable, readable id from the Japanese or fetched title. */
function slugFor(id, index) {
  return `${folder}-${String(index + 1).padStart(2, "0")}-${id.toLowerCase().slice(0, 6)}`;
}

const raw = await fs.readFile(inputPath, "utf8");
const lines = raw
  .split("\n")
  .map((line) => line.trim())
  .filter((line) => line && !line.startsWith("#"));

let existing = [];
try {
  existing = JSON.parse(await fs.readFile(target, "utf8"));
} catch {
  existing = [];
}
// Anything already carrying a real id is preserved untouched.
const kept = existing.filter((item) => item.youtubeVideoId && !item.youtubeVideoId.startsWith("REPLACE_WITH"));
const knownIds = new Set(kept.map((item) => item.youtubeVideoId));

const added = [];
const rejected = [];

for (const [index, line] of lines.entries()) {
  const [urlPart, titleJa, artistJa, year] = line.split("|").map((part) => part?.trim());
  const id = videoId(urlPart ?? "");
  if (!id) {
    rejected.push(`${urlPart} — could not find a video id in that`);
    continue;
  }
  if (knownIds.has(id)) continue;

  const info = await lookup(id);
  if (!info.ok) {
    rejected.push(`${id} — ${info.reason}`);
    continue;
  }

  const slug = slugFor(id, kept.length + added.length);
  added.push({
    id: slug,
    library,
    source: "youtube",
    // The fetched title is a starting point. Replace it with something she
    // would recognise -- YouTube titles are often noisy.
    titleJa: titleJa || info.title,
    ...(info.title && titleJa ? { titleEn: info.title } : {}),
    ...(artistJa ? { artistJa } : {}),
    ...(year && /^\d{4}$/.test(year) ? { year: Number(year) } : {}),
    youtubeVideoId: id,
    thumbnail: `/assets/thumbnails/${folder}/${slug}.webp`,
    sortOrder: (kept.length + added.length + 1) * 10,
    enabled: true,
  });
  knownIds.add(id);
  console.log(`  + ${id}  ${titleJa || info.title}`);
}

if (added.length) {
  await fs.writeFile(target, `${JSON.stringify([...kept, ...added], null, 2)}\n`, "utf8");
}

console.log(`\n${added.length} added, ${kept.length} already present`);

if (rejected.length) {
  console.error(`\n${rejected.length} skipped:`);
  for (const entry of rejected) console.error(`  - ${entry}`);
  console.error(
    `\nEmbedding-disabled videos cannot be made to work. Find another upload of\n` +
      `the same performance and add that instead.\n`,
  );
}

if (added.length) {
  console.log(`\nNext:\n  npm run fetch:thumbnails\n  npm run validate:content\n`);
}
