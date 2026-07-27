/**
 * Repoints existing manifest entries from YouTube to Bunny Stream, in place.
 *
 * This is the second half of moving a library off YouTube embeds. The first half
 * happens outside this repo: download each video, name the file after the entry
 * id it belongs to, and upload it to a Bunny library. This script then matches
 * what is in Bunny against what is in the manifests and rewrites only the source.
 *
 * Everything hand-written survives -- Japanese titles, artists, years, sort
 * order, thumbnails, favourites. The only fields that change are `source`,
 * `youtubeVideoId` (removed) and the two Bunny ids (added). An entry that has no
 * match in the library is left exactly as it was, still playing from YouTube, so
 * a partial upload leaves a working cabinet rather than a half-broken one.
 *
 *   BUNNY_LIBRARY_ID=123456 BUNNY_API_KEY=xxxx npm run migrate:bunny
 *   BUNNY_LIBRARY_ID=123456 BUNNY_API_KEY=xxxx npm run migrate:bunny -- --apply
 *
 * Without --apply it only reports what it would do. The API key is read from the
 * environment, used here at authoring time, and never written to a file or
 * shipped -- playback uses public embed URLs and the bundle carries no Bunny
 * credential of any kind.
 */
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const contentDir = path.join(root, "src/content");

const MANIFESTS = ["showa-songs.json", "nostalgic-japan.json", "personal-videos.json"];

const libraryId = process.env.BUNNY_LIBRARY_ID;
const apiKey = process.env.BUNNY_API_KEY;
const apply = process.argv.includes("--apply");

if (!libraryId || !apiKey) {
  console.error(
    "\n  Set both, then re-run:\n" +
      "    BUNNY_LIBRARY_ID=123456 BUNNY_API_KEY=xxxxxxxx npm run migrate:bunny\n\n" +
      "  Both are in the Bunny dashboard under Stream > your library > API.\n",
  );
  process.exit(1);
}

/**
 * Bunny's title is whatever the file was called at upload. Reduced to the same
 * shape as an entry id so `showa-hosokawa-bokyo-jongara.mp4`, `Showa Hosokawa
 * Bokyo Jongara.MP4` and `showa_hosokawa_bokyo_jongara` all land on one key.
 *
 * The character class is Unicode-aware on purpose. Stripping to [a-z0-9] would
 * reduce every Japanese title in these manifests to an empty string, and the
 * fallback match on titleJa -- the whole point of which is to catch a file named
 * 望郷じょんがら.mp4 -- would silently never fire.
 */
function normalise(text) {
  return String(text ?? "")
    .toLowerCase()
    .replace(/\.[a-z0-9]{2,4}$/, "")
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "");
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
            ? "That usually means the API key is wrong, or belongs to a different library."
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

let videos;
try {
  videos = await listVideos();
} catch (error) {
  console.error(`\n  ${error.message}\n`);
  process.exit(1);
}

if (!videos.length) {
  console.error("\n  Library " + libraryId + " has no videos in it yet.\n");
  process.exit(1);
}

// A video still encoding will not play. Better to say so than to write an id
// that produces a black screen for a few minutes and looks like a bug.
const READY_STATUS = 4;
const byKey = new Map();
for (const video of videos) {
  const key = normalise(video.title);
  if (key) byKey.set(key, video);
}

console.log(`\n${videos.length} videos in Bunny library ${libraryId}`);

const matched = [];
const unmatched = [];
const alreadyBunny = [];
const encoding = [];

for (const file of MANIFESTS) {
  const full = path.join(contentDir, file);
  let items;
  try {
    items = JSON.parse(await fs.readFile(full, "utf8"));
  } catch {
    continue;
  }

  let changed = false;

  const next = items.map((item) => {
    // Unfilled placeholders are disabled and carry REPLACE_WITH_* ids. They are
    // not videos anyone is waiting on, so they stay out of the report entirely --
    // a list of sixteen "missing" entries that are meant to be missing trains you
    // to skim past the ones that matter.
    if (item.enabled === false) return item;

    if (item.source === "bunny") {
      alreadyBunny.push(item.id);
      return item;
    }

    // Match on the entry id first, then on the entry's own Japanese title, so a
    // file named after the song rather than the id still finds its home.
    const video = byKey.get(normalise(item.id)) ?? byKey.get(normalise(item.titleJa));
    if (!video) {
      unmatched.push({ file, id: item.id, titleJa: item.titleJa });
      return item;
    }

    if (video.status !== undefined && video.status !== READY_STATUS) {
      encoding.push({ id: item.id, status: video.status });
      return item;
    }

    changed = true;
    matched.push({ file, id: item.id, guid: video.guid, bunnyTitle: video.title });

    const { youtubeVideoId: _dropped, ...rest } = item;
    return {
      ...rest,
      source: "bunny",
      bunnyLibraryId: String(libraryId),
      bunnyVideoId: video.guid,
      ...(video.length ? { durationSeconds: Math.round(video.length) } : {}),
    };
  });

  if (changed && apply) {
    await fs.writeFile(full, `${JSON.stringify(next, null, 2)}\n`, "utf8");
  }
}

const pad = (s, n) => String(s).padEnd(n);

if (matched.length) {
  console.log(`\n${apply ? "Repointed" : "Would repoint"} ${matched.length}:`);
  for (const m of matched) console.log(`  ${pad(m.id, 38)} <- ${m.bunnyTitle}`);
}

if (encoding.length) {
  console.log(`\nStill encoding in Bunny -- re-run when they finish (${encoding.length}):`);
  for (const e of encoding) console.log(`  ${pad(e.id, 38)} status ${e.status}`);
}

if (alreadyBunny.length) {
  console.log(`\nAlready on Bunny, untouched: ${alreadyBunny.length}`);
}

if (unmatched.length) {
  console.log(`\nNo Bunny video found -- left on YouTube (${unmatched.length}):`);
  for (const u of unmatched) console.log(`  ${pad(u.id, 38)} ${u.titleJa ?? ""}`);
  console.log(
    "\n  These match by filename. Upload each one named after its id above\n" +
      "  (showa-hosokawa-bokyo-jongara.mp4) and re-run.",
  );
}

if (!apply && matched.length) {
  console.log("\nNothing was written. Re-run with --apply to make the change:");
  console.log("  BUNNY_LIBRARY_ID=... BUNNY_API_KEY=... npm run migrate:bunny -- --apply\n");
} else if (apply && matched.length) {
  console.log("\nNext:  npm run validate:content && npm run check:links\n");
} else {
  console.log("");
}
