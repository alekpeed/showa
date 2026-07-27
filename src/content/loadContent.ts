/**
 * Loads and validates all bundled content at startup.
 *
 * The manifests are imported statically so Vite inlines them into the bundle --
 * nothing is fetched, and the app is fully usable with no network until the user
 * chooses a video. Validation failures are collected rather than thrown so the UI
 * can show one plain Japanese notice instead of dying.
 */
import rawAppConfig from "./app-config.json";
import rawShowaSongs from "./showa-songs.json";
import rawNostalgicJapan from "./nostalgic-japan.json";
import rawPersonalVideos from "./personal-videos.json";
import rawPhotoAlbum from "./photo-album.json";
import rawRadio from "./radio.json";
import rawNews from "./news.json";

import {
  appConfigSchema,
  photoAlbumSchema,
  newsConfigSchema,
  radioConfigSchema,
  videoLibrarySchema,
  isPlaceholder,
  isUnfilled,
  LIBRARY_IDS,
  type AlbumPage,
  type AppConfig,
  type LibraryId,
  type NewsConfig,
  type RadioConfig,
  type VideoItem,
} from "./schema";

export interface LoadedContent {
  appConfig: AppConfig;
  libraries: Record<LibraryId, VideoItem[]>;
  albumPages: AlbumPage[];
  radio: RadioConfig;
  news: NewsConfig;
  /** Fatal problems. Non-empty means the app shows a configuration-error state. */
  errors: string[];
  /** Non-fatal: unfilled REPLACE_WITH_* placeholders, surfaced in dev only. */
  placeholders: string[];
}

const RAW_LIBRARIES: Record<LibraryId, unknown> = {
  "showa-songs": rawShowaSongs,
  "nostalgic-japan": rawNostalgicJapan,
  "personal-videos": rawPersonalVideos,
};

function formatIssues(label: string, error: { issues: { path: PropertyKey[]; message: string }[] }) {
  return error.issues.map((issue) => `${label}${issue.path.length ? ` [${issue.path.join(".")}]` : ""}: ${issue.message}`);
}

export function loadContent(): LoadedContent {
  const errors: string[] = [];
  const placeholders: string[] = [];

  const configResult = appConfigSchema.safeParse(rawAppConfig);
  if (!configResult.success) errors.push(...formatIssues("app-config.json", configResult.error));

  const radioResult = radioConfigSchema.safeParse(rawRadio);
  if (!radioResult.success) errors.push(...formatIssues("radio.json", radioResult.error));

  const albumResult = photoAlbumSchema.safeParse(rawPhotoAlbum);
  if (!albumResult.success) errors.push(...formatIssues("photo-album.json", albumResult.error));

  const newsResult = newsConfigSchema.safeParse(rawNews);
  if (!newsResult.success) errors.push(...formatIssues("news.json", newsResult.error));

  const libraries = {} as Record<LibraryId, VideoItem[]>;
  const seenIds = new Set<string>();

  for (const libraryId of LIBRARY_IDS) {
    const result = videoLibrarySchema.safeParse(RAW_LIBRARIES[libraryId]);
    if (!result.success) {
      errors.push(...formatIssues(`${libraryId}.json`, result.error));
      libraries[libraryId] = [];
      continue;
    }

    const items = result.data;
    for (const item of items) {
      if (seenIds.has(item.id)) errors.push(`duplicate video id: ${item.id}`);
      seenIds.add(item.id);
      if (item.library !== libraryId) {
        errors.push(`${item.id}: library is "${item.library}" but it lives in ${libraryId}.json`);
      }
      if (isUnfilled(item)) placeholders.push(item.id);
    }

    libraries[libraryId] = items
      .filter((item) => item.enabled)
      .sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id));
  }

  const radio = radioResult.success
    ? radioResult.data
    : { id: "j1-gold", name: "J1 GOLD", streamUrl: "", enabled: false, initialVolume: 0.55 };

  if (radio.enabled && isPlaceholder(radio.streamUrl)) {
    placeholders.push("radio.streamUrl");
  }

  const albumPages = albumResult.success
    ? [...albumResult.data].sort((a, b) => a.pageNumber - b.pageNumber)
    : [];

  return {
    appConfig: configResult.success
      ? configResult.data
      : {
          appNameJa: "昭和ビデオ・キャビネット",
          appNameEn: "Showa Video Cabinet",
          settingsPin: "1958",
          defaultLibrary: "showa-songs",
          autoplayNext: true,
          pauseRadioWhenVideoStarts: true,
          pauseVideoWhenRadioStarts: true,
          homeStopsPlayback: false,
          showEnglishSubtitles: true,
          enableFullScreenOnLaunch: false,
        },
    libraries,
    albumPages,
    radio,
    news: newsResult.success
      ? newsResult.data
      : {
          enabled: false,
          mode: "web-search",
          searchModel: "gpt-5.6",
          maxHeadlines: 5,
          speechModel: "tts-1",
          voice: "shimmer",
          feedUrl: "",
          feedNameJa: "NHKニュース",
          textModel: "gpt-4o-mini",
        },
    errors,
    placeholders,
  };
}

export const CONTENT = loadContent();
