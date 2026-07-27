/**
 * Build-time content validation.
 *
 * Runs before every production build. Schema violations, duplicate ids and
 * missing asset files are hard failures; unfilled REPLACE_WITH_* placeholders
 * are reported as warnings so the app stays buildable while content is gathered.
 *
 *   npm run validate:content
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  appConfigSchema,
  isPlaceholder,
  isUnfilled,
  newsConfigSchema,
  LIBRARY_IDS,
  photoAlbumSchema,
  radioConfigSchema,
  videoLibrarySchema,
  type LibraryId,
} from "../src/content/schema";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const contentDir = path.join(root, "src/content");
const publicDir = path.join(root, "public");

const errors: string[] = [];
const warnings: string[] = [];

const readJson = (name: string): unknown =>
  JSON.parse(fs.readFileSync(path.join(contentDir, name), "utf8"));

/** Content paths are web-absolute and resolve against public/. */
const assetExists = (webPath: string): boolean =>
  fs.existsSync(path.join(publicDir, webPath.replace(/^\//, "")));

const LIBRARY_FILES: Record<LibraryId, string> = {
  "showa-songs": "showa-songs.json",
  "nostalgic-japan": "nostalgic-japan.json",
  "personal-videos": "personal-videos.json",
};

// --- app-config.json ---------------------------------------------------------
const configResult = appConfigSchema.safeParse(readJson("app-config.json"));
if (!configResult.success) {
  for (const issue of configResult.error.issues) {
    errors.push(`app-config.json [${issue.path.join(".")}]: ${issue.message}`);
  }
}

// --- radio.json --------------------------------------------------------------
const radioResult = radioConfigSchema.safeParse(readJson("radio.json"));
if (!radioResult.success) {
  for (const issue of radioResult.error.issues) {
    errors.push(`radio.json [${issue.path.join(".")}]: ${issue.message}`);
  }
} else if (radioResult.data.enabled) {
  const { streamUrl } = radioResult.data;
  if (!streamUrl.trim()) {
    errors.push("radio.json: streamUrl is blank while the radio is enabled");
  } else if (isPlaceholder(streamUrl)) {
    warnings.push("radio.json: streamUrl is still a placeholder — the radio will show its error state");
  } else if (!streamUrl.startsWith("https://")) {
    errors.push("radio.json: streamUrl must be https (macOS blocks insecure media)");
  }
}

// --- news.json ---------------------------------------------------------------
const newsResult = newsConfigSchema.safeParse(readJson("news.json"));
if (!newsResult.success) {
  for (const issue of newsResult.error.issues) {
    errors.push(`news.json [${issue.path.join(".")}]: ${issue.message}`);
  }
} else if (newsResult.data.enabled) {
  const { feedUrl } = newsResult.data;
  if (!feedUrl.startsWith("https://")) {
    errors.push("news.json: feedUrl must be https");
  } else {
    // The Tauri capability pins which hosts the app may reach at all, so a feed
    // host that is not listed there fails silently at runtime. Catch it here.
    const capabilities = JSON.parse(
      fs.readFileSync(path.join(root, "src-tauri/capabilities/default.json"), "utf8"),
    ) as { permissions: (string | { identifier: string; allow?: { url: string }[] })[] };

    const allowed = capabilities.permissions
      .filter((p): p is { identifier: string; allow?: { url: string }[] } => typeof p !== "string")
      .flatMap((p) => p.allow ?? [])
      .map((entry) => entry.url);

    const host = new URL(feedUrl).host;
    const permitted = allowed.some((pattern) => {
      try {
        return new URL(pattern.replace(/\*$/, "")).host === host;
      } catch {
        return false;
      }
    });
    if (!permitted) {
      errors.push(
        `news.json: feed host "${host}" is not allowed in src-tauri/capabilities/default.json — ` +
          `the request will fail silently in the packaged app`,
      );
    }
  }
}

// --- video libraries ---------------------------------------------------------
const seenIds = new Set<string>();
let itemCount = 0;
let unfilledCount = 0;

for (const libraryId of LIBRARY_IDS) {
  const file = LIBRARY_FILES[libraryId];
  const result = videoLibrarySchema.safeParse(readJson(file));
  if (!result.success) {
    for (const issue of result.error.issues) {
      errors.push(`${file} [${issue.path.join(".")}]: ${issue.message}`);
    }
    continue;
  }

  for (const item of result.data) {
    itemCount++;
    if (seenIds.has(item.id)) errors.push(`${file}: duplicate id "${item.id}"`);
    seenIds.add(item.id);

    if (item.library !== libraryId) {
      errors.push(`${file}: "${item.id}" declares library "${item.library}"`);
    }
    if (!assetExists(item.thumbnail)) {
      errors.push(`${file}: "${item.id}" thumbnail not found at public${item.thumbnail}`);
    }
    if (isUnfilled(item)) {
      unfilledCount++;
      warnings.push(`${file}: "${item.id}" still has REPLACE_WITH_* identifiers`);
    }
  }
}

// --- photo-album.json --------------------------------------------------------
const albumResult = photoAlbumSchema.safeParse(readJson("photo-album.json"));
let photoCount = 0;
if (!albumResult.success) {
  for (const issue of albumResult.error.issues) {
    errors.push(`photo-album.json [${issue.path.join(".")}]: ${issue.message}`);
  }
} else {
  const pageNumbers = new Set<number>();
  const photoIds = new Set<string>();
  for (const page of albumResult.data) {
    if (pageNumbers.has(page.pageNumber)) {
      errors.push(`photo-album.json: duplicate pageNumber ${page.pageNumber}`);
    }
    pageNumbers.add(page.pageNumber);
    for (const photo of page.photos) {
      photoCount++;
      if (photoIds.has(photo.id)) errors.push(`photo-album.json: duplicate photo id "${photo.id}"`);
      photoIds.add(photo.id);
      if (!assetExists(photo.src)) {
        errors.push(`photo-album.json: "${photo.id}" not found at public${photo.src}`);
      }
    }
  }
}

// --- report ------------------------------------------------------------------
for (const warning of warnings) console.warn(`  warn  ${warning}`);
for (const error of errors) console.error(`  error ${error}`);

if (errors.length) {
  console.error(`\ncontent validation failed: ${errors.length} error(s)\n`);
  process.exit(1);
}

console.log(
  `content OK — ${itemCount} videos, ${photoCount} photos` +
    (unfilledCount ? `, ${unfilledCount} awaiting real ids` : ""),
);
