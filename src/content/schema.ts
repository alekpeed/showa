/**
 * Zod schemas for every piece of bundled content.
 *
 * These run twice: once at build time via `npm run validate:content`, which fails
 * the build on bad data, and once at startup so a hand-edited JSON file surfaces
 * as a plain Japanese "content configuration error" rather than a white screen.
 */
import { z } from "zod";

export const LIBRARY_IDS = ["showa-songs", "nostalgic-japan", "personal-videos"] as const;
export type LibraryId = (typeof LIBRARY_IDS)[number];

export const LIBRARY_LABELS: Record<LibraryId, { ja: string; en: string }> = {
  "showa-songs": { ja: "昭和のうた", en: "Showa Songs" },
  "nostalgic-japan": { ja: "なつかしい日本", en: "Nostalgic Japan" },
  "personal-videos": { ja: "日本で撮った動画", en: "Videos I Filmed in Japan" },
};

/** Marker used by unfilled manifest entries. Valid to ship, but reported loudly. */
export const PLACEHOLDER_PREFIX = "REPLACE_WITH";

export const isPlaceholder = (value: string | undefined): boolean =>
  typeof value === "string" && value.startsWith(PLACEHOLDER_PREFIX);

const videoBase = z.object({
  id: z
    .string()
    .min(1)
    .regex(/^[a-z0-9-]+$/, "ids must be lowercase letters, digits and hyphens"),
  library: z.enum(LIBRARY_IDS),
  titleJa: z.string().min(1, "titleJa is required"),
  titleEn: z.string().optional(),
  subtitleJa: z.string().optional(),
  subtitleEn: z.string().optional(),
  artistJa: z.string().optional(),
  artistEn: z.string().optional(),
  year: z.number().int().min(1868).max(2100).optional(),
  locationJa: z.string().optional(),
  locationEn: z.string().optional(),
  thumbnail: z.string().min(1),
  durationSeconds: z.number().int().positive().optional(),
  favoriteByDefault: z.boolean().optional(),
  sortOrder: z.number().int(),
  enabled: z.boolean(),
});

const youtubeVideo = videoBase.extend({
  source: z.literal("youtube"),
  youtubeVideoId: z.string().min(1, "youtubeVideoId is required for source: youtube"),
});

const bunnyVideo = videoBase.extend({
  source: z.literal("bunny"),
  bunnyLibraryId: z.string().min(1, "bunnyLibraryId is required for source: bunny"),
  bunnyVideoId: z.string().min(1, "bunnyVideoId is required for source: bunny"),
  bunnyEmbedUrl: z.string().min(1).optional(),
});

export const videoItemSchema = z.discriminatedUnion("source", [youtubeVideo, bunnyVideo]);
export type VideoItem = z.infer<typeof videoItemSchema>;
export type VideoSource = VideoItem["source"];

export const videoLibrarySchema = z.array(videoItemSchema);

export const albumPhotoSchema = z.object({
  id: z.string().min(1),
  src: z.string().min(1),
  captionJa: z.string().optional(),
  captionEn: z.string().optional(),
  locationJa: z.string().optional(),
  locationEn: z.string().optional(),
  year: z.number().int().min(1868).max(2100).optional(),
  rotationDegrees: z.number().min(-8).max(8).optional(),
});
export type AlbumPhoto = z.infer<typeof albumPhotoSchema>;

export const albumPageSchema = z.object({
  id: z.string().min(1),
  pageNumber: z.number().int().positive(),
  layout: z.enum(["single", "double", "collage"]),
  titleJa: z.string().optional(),
  titleEn: z.string().optional(),
  noteJa: z.string().optional(),
  noteEn: z.string().optional(),
  photos: z.array(albumPhotoSchema).min(1, "a page needs at least one photo"),
});
export type AlbumPage = z.infer<typeof albumPageSchema>;

export const photoAlbumSchema = z.array(albumPageSchema);

export const radioConfigSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  streamUrl: z.string().min(1),
  enabled: z.boolean(),
  initialVolume: z.number().min(0).max(1),
});
export type RadioConfig = z.infer<typeof radioConfigSchema>;

export const newsConfigSchema = z.object({
  enabled: z.boolean(),
  /**
   * "web-search" asks a search-enabled model to find gentle news itself, which
   * is the only way to filter for tone rather than category.
   * "feed" reads a fixed RSS feed: cheaper, fully deterministic, and the
   * fallback if search proves unreliable.
   */
  mode: z.enum(["web-search", "feed"]),
  /** Search-enabled model. A model without the web_search tool WILL invent news. */
  searchModel: z.string().min(1),
  maxHeadlines: z.number().int().min(1).max(15),
  speechModel: z.string().min(1),
  voice: z.string().min(1),
  /** Region the reading is asked to favour, when the day's news offers any. */
  regionHintJa: z.string().optional(),
  /** Used by "feed" mode only. */
  feedUrl: z.string().min(1),
  feedNameJa: z.string().min(1),
  textModel: z.string().min(1),
});
export type NewsConfig = z.infer<typeof newsConfigSchema>;

export const companionConfigSchema = z.object({
  enabled: z.boolean(),
  /** Must be a Realtime speech-to-speech model. */
  model: z.string().min(1),
  voice: z.string().min(1),
  /**
   * Semantic VAD eagerness. "low" gives her the most room to pause mid-sentence
   * before the model decides she has finished, which matters at 90.
   */
  eagerness: z.enum(["low", "medium", "high", "auto"]),
  /** Rolling notes between calls, so a conversation can be picked back up. */
  memoryEnabled: z.boolean(),
  memoryModel: z.string().min(1),
  maxMemoryNotes: z.number().int().min(1).max(200),
  /**
   * Quiet seconds before the far end gently says something to invite her back.
   * Semantic VAD waits a long time by design, and silence on a phone reads as a
   * broken phone -- especially to someone who cannot see that it is still live.
   */
  silenceNudgeSeconds: z.number().int().min(5).max(300),
  /**
   * Quiet seconds before the call ends itself. Guards against her walking away
   * without hanging up, which would otherwise leave the microphone open and the
   * meter running until the app is closed.
   */
  silenceHangupSeconds: z.number().int().min(30).max(3600),
  labelJa: z.string().min(1),
});
export type CompanionConfig = z.infer<typeof companionConfigSchema>;

export const appConfigSchema = z.object({
  appNameJa: z.string().min(1),
  appNameEn: z.string().min(1),
  /** Unlocks the hidden settings panel. A speed bump, not a security boundary. */
  settingsPin: z.string().min(1),
  defaultLibrary: z.enum(LIBRARY_IDS),
  autoplayNext: z.boolean(),
  pauseRadioWhenVideoStarts: z.boolean(),
  pauseVideoWhenRadioStarts: z.boolean(),
  homeStopsPlayback: z.boolean(),
  showEnglishSubtitles: z.boolean(),
  enableFullScreenOnLaunch: z.boolean(),
});
export type AppConfig = z.infer<typeof appConfigSchema>;

/** Resolved embed URL for a Bunny item, falling back to the canonical form. */
export function bunnyEmbedUrl(item: Extract<VideoItem, { source: "bunny" }>): string {
  return (
    item.bunnyEmbedUrl ??
    `https://iframe.mediadelivery.net/embed/${item.bunnyLibraryId}/${item.bunnyVideoId}`
  );
}

/** True when an item still carries unfilled placeholder identifiers. */
export function isUnfilled(item: VideoItem): boolean {
  if (item.source === "youtube") return isPlaceholder(item.youtubeVideoId);
  return (
    isPlaceholder(item.bunnyLibraryId) ||
    isPlaceholder(item.bunnyVideoId) ||
    isPlaceholder(item.bunnyEmbedUrl)
  );
}
