/**
 * A single versioned preferences blob in localStorage.
 *
 * localStorage is used rather than the Tauri store plugin because it needs no
 * IPC, no async boot step, and no extra capability -- and the data is four
 * numbers and a list of ids. Anything unreadable falls back to defaults silently;
 * a corrupted preference file must never stop a 90-year-old from watching a video.
 */
import type { LibraryId } from "../content/schema";

export const STORAGE_KEY = "showa-video-cabinet.state.v1";

export interface PersistedStateV1 {
  schemaVersion: 1;
  favoriteVideoIds: string[];
  lastLibraryId?: LibraryId;
  lastVideoId?: string;
  videoVolume: number;
  radioVolume: number;
  autoplayNext: boolean;
}

const clamp01 = (n: unknown, fallback: number): number =>
  typeof n === "number" && Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : fallback;

export function defaultState(radioVolume: number, autoplayNext: boolean): PersistedStateV1 {
  return {
    schemaVersion: 1,
    favoriteVideoIds: [],
    videoVolume: 0.8,
    radioVolume,
    autoplayNext,
  };
}

export function readPersistedState(fallback: PersistedStateV1): PersistedStateV1 {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<PersistedStateV1>;
    if (parsed.schemaVersion !== 1) return fallback;
    return {
      schemaVersion: 1,
      favoriteVideoIds: Array.isArray(parsed.favoriteVideoIds)
        ? parsed.favoriteVideoIds.filter((id): id is string => typeof id === "string")
        : fallback.favoriteVideoIds,
      lastLibraryId: parsed.lastLibraryId,
      lastVideoId: typeof parsed.lastVideoId === "string" ? parsed.lastVideoId : undefined,
      videoVolume: clamp01(parsed.videoVolume, fallback.videoVolume),
      radioVolume: clamp01(parsed.radioVolume, fallback.radioVolume),
      autoplayNext:
        typeof parsed.autoplayNext === "boolean" ? parsed.autoplayNext : fallback.autoplayNext,
    };
  } catch {
    return fallback;
  }
}

export function writePersistedState(state: PersistedStateV1): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Quota or private-mode failures are not worth interrupting playback for.
  }
}
