/**
 * Reads a Bunny Stream library and writes personal-videos.json from it.
 *
 * Copying GUIDs out of a dashboard by hand is error-prone in the worst way: a
 * mistyped GUID produces a video that looks configured and simply never plays.
 *
 * The API key is used *here*, at authoring time, from an environment variable.
 * It is never written to a file and never reaches the app -- playback uses
 * public embed URLs only, and the shipped bundle must contain no Bunny
 * credential of any kind.
 *
 *   BUNNY_LIBRARY_ID=123456 BUNNY_API_KEY=xxxx npm run import:bunny
 *
 * Re-running is safe: anything you have hand-written -- Japanese titles,
 * locations, years, sort order -- is matched by GUID and preserved. Only videos
 * newly present in the library are added.
 */
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const target = path.join(root, "src/content/personal-videos.json");

const libraryId = process.env.BUNNY_LIBRARY_ID;
const apiKey = process.env.BUNNY_API_KEY;

if (!libraryId || !apiKey) {
  console.error(
    "\n  Set both, then re-run:\n" +
      "    BUNNY_LIBRARY_ID=123456 BUNNY_API_KEY=xxxxxxxx npm run import:bunny\n\n" +
      "  Both are in the Bunny dashboard under Stream > your library > API.\n",
  );
  process.exit(1);
}

/** Lowercase, hyphenated, stable id derived from the title. */
function slugify(title, fallback) {
  const slug = title
    .toLowerCase()
    .replace(/\.[a-z0-9]+$/, "") // drop a file extension
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug ? `personal-${slug}`.slice(0, 60) : `personal-${fallback.slice(0, 8)}`;
}

async function listVideos() {
  const items = [];
  for (let page = 1; page <= 20; page++) {
    const url =
      `https://video.bunnycdn.com/library/${libraryId}/videos` +
      `?page=${page}&itemsPerPage=100&orderBy=date`;
    const response = await fetch(url, {
      headers: { AccessKey: apiKey, accept: "application/json" },
    });
    if (!response.ok) {
      throw new Error(
        `Bunny returned ${response.status}. ` +
          (response.status === 401
            ? "That usually means the API key is wrong, or it belongs to a different library."
            : ""),
      );
    }
    const data = await response.json();
    const batch = Array.isArray(data.items) ? data.items : [];
    items.push(...batch);
    if (items.length >= (data.totalItems ?? items.length) || batch.length === 0) break;
  }
  return items;
}

async function readExisting() {
  try {
    return JSON.parse(await fs.readFile(target, "utf8"));
  } catch {
    return [];
  }
}

const existing = await readExisting();
const byGuid = new Map(
  existing.filter((item) => item.bunnyVideoId).map((item) => [item.bunnyVideoId, item]),
);

let videos;
try {
  videos = await listVideos();
} catch (error) {
  console.error(`\n  ${error.message}\n`);
  process.exit(1);
}

if (!videos.length) {
  console.error("\n  The library has no videos in it yet.\n");
  process.exit(1);
}

let added = 0;
let kept = 0;

const items = videos.map((video, index) => {
  const previous = byGuid.get(video.guid);
  if (previous) {
    kept++;
    // Refresh only what Bunny owns; everything hand-written stays as it is.
    return {
      ...previous,
      bunnyLibraryId: String(libraryId),
      ...(video.length ? { durationSeconds: Math.round(video.length) } : {}),
    };
  }

  added++;
  const id = slugify(video.title ?? "", video.guid);
  return {
    id,
    library: "personal-videos",
    source: "bunny",
    // Bunny's title is whatever the file was called. Replace with a Japanese
    // title she would recognise -- this is the one field worth doing by hand.
    titleJa: video.title ?? "無題",
    bunnyLibraryId: String(libraryId),
    bunnyVideoId: video.guid,
    thumbnail: `/assets/thumbnails/personal/${id}.webp`,
    ...(video.length ? { durationSeconds: Math.round(video.length) } : {}),
    sortOrder: (index + 1) * 10,
    enabled: true,
  };
});

await fs.writeFile(target, `${JSON.stringify(items, null, 2)}\n`, "utf8");

console.log(`\n${items.length} videos in library ${libraryId}`);
console.log(`  ${added} added, ${kept} already present and left alone\n`);

if (added) {
  console.log("Next:");
  console.log("  1. Open src/content/personal-videos.json and set a Japanese titleJa");
  console.log("     for each new entry -- Bunny's titles are filenames.");
  console.log("  2. Save a thumbnail per video to public/assets/thumbnails/personal/,");
  console.log("     or run: npm run generate:placeholders");
  console.log("  3. npm run validate:content && npm run check:links\n");
}
