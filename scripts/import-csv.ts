/**
 * Converts a video source spreadsheet into the three validated JSON manifests.
 *
 * Columns are the ones listed in 06-asset-manifest.md, section E. Export the
 * sheet as CSV and run:
 *
 *   npm run import:csv -- path/to/videos.csv
 *
 * Existing manifests are overwritten, so keep the CSV as the source of truth
 * once you start using it. A YouTube URL in any common form is accepted; the
 * video id is extracted rather than requiring you to pick it out by hand.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { videoLibrarySchema, LIBRARY_IDS, type LibraryId } from "../src/content/schema";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const contentDir = path.join(root, "src/content");

const OUTPUT: Record<LibraryId, string> = {
  "showa-songs": "showa-songs.json",
  "nostalgic-japan": "nostalgic-japan.json",
  "personal-videos": "personal-videos.json",
};

/** RFC 4180-ish parser: handles quoted fields, embedded commas and newlines. */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }
    if (char === '"') inQuotes = true;
    else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (char !== "\r") {
      field += char;
    }
  }
  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((cell) => cell.trim() !== ""));
}

/** Accepts a bare id, a watch URL, a youtu.be link, or an embed URL. */
function youtubeId(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (!trimmed.includes("/") && !trimmed.includes("?")) return trimmed;
  const patterns = [/[?&]v=([\w-]{11})/, /youtu\.be\/([\w-]{11})/, /\/embed\/([\w-]{11})/];
  for (const pattern of patterns) {
    const match = trimmed.match(pattern);
    if (match?.[1]) return match[1];
  }
  return trimmed;
}

const csvPath = process.argv[2];
if (!csvPath) {
  console.error("usage: npm run import:csv -- path/to/videos.csv");
  process.exit(1);
}

const rows = parseCsv(fs.readFileSync(csvPath, "utf8"));
const header = rows.shift();
if (!header) {
  console.error("the CSV is empty");
  process.exit(1);
}

const columns = header.map((h) => h.trim().toLowerCase());
const at = (row: string[], name: string): string => {
  const index = columns.indexOf(name);
  return index === -1 ? "" : (row[index] ?? "").trim();
};

const num = (value: string): number | undefined => {
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const buckets: Record<LibraryId, Record<string, unknown>[]> = {
  "showa-songs": [],
  "nostalgic-japan": [],
  "personal-videos": [],
};

let skipped = 0;

rows.forEach((row, index) => {
  const library = at(row, "library") as LibraryId;
  if (!LIBRARY_IDS.includes(library)) {
    console.warn(`row ${index + 2}: unknown library "${library}" — skipped`);
    skipped++;
    return;
  }

  const source = at(row, "source") === "bunny" ? "bunny" : "youtube";
  const id = at(row, "id");
  const thumbnailFile = at(row, "thumbnail_filename");
  const folder =
    library === "showa-songs" ? "showa" : library === "nostalgic-japan" ? "nostalgic" : "personal";

  const item: Record<string, unknown> = {
    id,
    library,
    source,
    titleJa: at(row, "title_ja"),
    sortOrder: num(at(row, "sort_order")) ?? (index + 1) * 10,
    // Anything other than an explicit "false" counts as enabled, so a blank
    // column in a hand-made sheet does not silently hide a video.
    enabled: at(row, "enabled").toLowerCase() !== "false",
    thumbnail: `/assets/thumbnails/${folder}/${thumbnailFile || `${id}.webp`}`,
  };

  const optional: Record<string, string | number | undefined> = {
    titleEn: at(row, "title_en") || undefined,
    artistJa: at(row, "artist_ja") || undefined,
    artistEn: at(row, "artist_en") || undefined,
    locationJa: at(row, "location_ja") || undefined,
    locationEn: at(row, "location_en") || undefined,
    year: num(at(row, "year")),
    durationSeconds: num(at(row, "duration_seconds")),
  };
  for (const [key, value] of Object.entries(optional)) {
    if (value !== undefined) item[key] = value;
  }

  if (source === "youtube") {
    item.youtubeVideoId = youtubeId(at(row, "youtube_url"));
  } else {
    item.bunnyLibraryId = at(row, "bunny_library_id");
    item.bunnyVideoId = at(row, "bunny_video_id");
    const embed = at(row, "bunny_embed_url");
    if (embed) item.bunnyEmbedUrl = embed;
  }

  buckets[library].push(item);
});

let written = 0;
for (const library of LIBRARY_IDS) {
  const items = buckets[library].sort(
    (a, b) => (a.sortOrder as number) - (b.sortOrder as number),
  );
  const result = videoLibrarySchema.safeParse(items);
  if (!result.success) {
    console.error(`\n${OUTPUT[library]} would be invalid — nothing was written:`);
    for (const issue of result.error.issues) {
      const row = String(issue.path[0]);
      console.error(`  item ${row}: [${issue.path.slice(1).join(".")}] ${issue.message}`);
    }
    process.exit(1);
  }
  fs.writeFileSync(
    path.join(contentDir, OUTPUT[library]),
    `${JSON.stringify(items, null, 2)}\n`,
    "utf8",
  );
  written += items.length;
  console.log(`${OUTPUT[library]}: ${items.length} items`);
}

console.log(
  `\nwrote ${written} items${skipped ? `, skipped ${skipped}` : ""}. ` +
    `Run "npm run validate:content" to check thumbnails exist.`,
);
