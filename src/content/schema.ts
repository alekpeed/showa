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

export const appConfigSchema = z.object({
  appNameJa: z.string().min(1),
  appNameEn: z.string().min(1),
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
