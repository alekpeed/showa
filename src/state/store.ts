/**
 * Application state.
 *
 * The audio-focus rules from 05-technical-architecture.md ("exactly one audible
 * source at a time") are enforced here, in the actions, rather than in the
 * components. That way there is one place to read to know why something paused.
 */
import { create } from "zustand";

import { CONTENT } from "../content/loadContent";
import type { LibraryId, VideoItem } from "../content/schema";
import { QUEUE_VISIBLE_COUNT } from "../scene/hotspots";
import {
  defaultState,
  readPersistedState,
  writePersistedState,
  type PersistedStateV1,
} from "./persistence";

export type PlaybackStatus = "idle" | "loading" | "playing" | "paused" | "ended" | "error";
export type RadioStatus = "off" | "connecting" | "playing" | "error";
export type NewsStatus = "off" | "playing";

/** Every user-facing failure resolves to one of these, per the architecture doc. */
export type NoticeKind = "video-unavailable" | "offline" | "radio-unavailable" | "content-error";

export interface Notice {
  kind: NoticeKind;
  messageJa: string;
  /** Label for the single recovery action. Every notice has exactly one. */
  retryLabelJa: string;
}

const NOTICES: Record<NoticeKind, Omit<Notice, "kind">> = {
  "video-unavailable": {
    messageJa: "このビデオは再生できませんでした。",
    retryLabelJa: "もう一度",
  },
  offline: {
    messageJa: "インターネットにつながっていません。",
    retryLabelJa: "もう一度",
  },
  "radio-unavailable": {
    messageJa: "ラジオを再生できませんでした。もう一度お試しください。",
    retryLabelJa: "もう一度",
  },
  "content-error": {
    messageJa: "ビデオの一覧を読み込めませんでした。",
    retryLabelJa: "もう一度",
  },
};

const initialPersisted: PersistedStateV1 = readPersistedState(
  defaultState(CONTENT.radio.initialVolume, CONTENT.appConfig.autoplayNext),
);

const initialLibrary: LibraryId =
  initialPersisted.lastLibraryId && CONTENT.libraries[initialPersisted.lastLibraryId]?.length
    ? initialPersisted.lastLibraryId
    : CONTENT.appConfig.defaultLibrary;

export interface AppState {
  selectedLibrary: LibraryId;
  currentVideoId: string | null;
  playbackStatus: PlaybackStatus;
  /** Set when the user has asked for playback; adapters read this on load. */
  playIntent: boolean;
  videoVolume: number;

  radioStatus: RadioStatus;
  radioVolume: number;

  newsStatus: NewsStatus;

  albumOpen: boolean;
  albumPageIndex: number;

  queuePage: number;
  favoriteVideoIds: string[];
  autoplayNext: boolean;

  notice: Notice | null;
  /** Bumped to force the active adapter to tear down and reload the same item. */
  reloadNonce: number;

  selectLibrary: (library: LibraryId) => void;
  playVideo: (videoId: string) => void;
  togglePlayback: () => void;
  setPlaybackStatus: (status: PlaybackStatus) => void;
  nextVideo: (auto?: boolean) => void;
  previousVideo: () => void;
  setVideoVolume: (volume: number) => void;

  toggleRadio: () => void;
  setRadioStatus: (status: RadioStatus) => void;
  setRadioVolume: (volume: number) => void;

  startNews: () => void;
  stopNews: () => void;

  openAlbum: () => void;
  closeAlbum: () => void;
  nextAlbumPage: () => void;
  previousAlbumPage: () => void;

  nextQueuePage: () => void;
  previousQueuePage: () => void;
  toggleFavorite: (videoId: string) => void;

  goHome: () => void;
  showNotice: (kind: NoticeKind) => void;
  dismissNotice: () => void;
  retryNotice: () => void;
}

const persist = (state: AppState) => {
  writePersistedState({
    schemaVersion: 1,
    favoriteVideoIds: state.favoriteVideoIds,
    lastLibraryId: state.selectedLibrary,
    lastVideoId: state.currentVideoId ?? undefined,
    videoVolume: state.videoVolume,
    radioVolume: state.radioVolume,
    autoplayNext: state.autoplayNext,
  });
};

export const useStore = create<AppState>((set, get) => {
  /** Items in the currently selected library, already filtered and sorted. */
  const currentItems = (): VideoItem[] => CONTENT.libraries[get().selectedLibrary] ?? [];

  const indexOfCurrent = (): number => {
    const id = get().currentVideoId;
    if (!id) return -1;
    return currentItems().findIndex((item) => item.id === id);
  };

  /** Scroll the queue so the given index is on the visible page. */
  const pageContaining = (index: number): number =>
    index < 0 ? 0 : Math.floor(index / QUEUE_VISIBLE_COUNT);

  const startVideo = (videoId: string) => {
    set({
      currentVideoId: videoId,
      playbackStatus: "loading",
      playIntent: true,
      notice: null,
      // Starting a video always takes audio focus from the radio and the news.
      radioStatus: "off",
      newsStatus: "off",
      queuePage: pageContaining(currentItems().findIndex((item) => item.id === videoId)),
    });
    persist(get());
  };

  return {
    selectedLibrary: initialLibrary,
    currentVideoId: null,
    playbackStatus: "idle",
    playIntent: false,
    videoVolume: initialPersisted.videoVolume,

    radioStatus: "off",
    radioVolume: initialPersisted.radioVolume,

    newsStatus: "off",

    albumOpen: false,
    albumPageIndex: 0,

    queuePage: 0,
    favoriteVideoIds: initialPersisted.favoriteVideoIds,
    autoplayNext: initialPersisted.autoplayNext,

    notice: CONTENT.errors.length ? { kind: "content-error", ...NOTICES["content-error"] } : null,
    reloadNonce: 0,

    selectLibrary: (library) => {
      if (get().selectedLibrary === library) return;
      // Selecting a sleeve fills the queue but deliberately does not start
      // playback -- the television stays idle until she picks something.
      set({ selectedLibrary: library, queuePage: 0, notice: null });
      persist(get());
    },

    playVideo: (videoId) => startVideo(videoId),

    togglePlayback: () => {
      const { currentVideoId, playbackStatus } = get();
      if (!currentVideoId) {
        const first = currentItems()[0];
        if (first) startVideo(first.id);
        return;
      }
      if (playbackStatus === "playing") {
        set({ playIntent: false, playbackStatus: "paused" });
      } else {
        set({ playIntent: true, radioStatus: "off" });
      }
    },

    setPlaybackStatus: (status) => {
      set({ playbackStatus: status });
      if (status === "ended") {
        const { autoplayNext } = get();
        if (autoplayNext) get().nextVideo(true);
        else set({ playIntent: false });
      }
    },

    nextVideo: (auto = false) => {
      const items = currentItems();
      if (!items.length) return;
      const index = indexOfCurrent();
      const nextIndex = index + 1;
      if (nextIndex >= items.length) {
        // End of the library. Autoplay stops rather than looping back, so the
        // television goes quiet instead of restarting on its own.
        if (auto) {
          set({ playIntent: false, playbackStatus: "ended" });
          return;
        }
        const first = items[0];
        if (first) startVideo(first.id);
        return;
      }
      const next = items[nextIndex];
      if (next) startVideo(next.id);
    },

    previousVideo: () => {
      const items = currentItems();
      if (!items.length) return;
      const index = indexOfCurrent();
      const target = index <= 0 ? items[items.length - 1] : items[index - 1];
      if (target) startVideo(target.id);
    },

    setVideoVolume: (volume) => {
      set({ videoVolume: Math.min(1, Math.max(0, volume)) });
      persist(get());
    },

    toggleRadio: () => {
      const { radioStatus } = get();
      if (radioStatus === "off" || radioStatus === "error") {
        // Radio takes audio focus from the television and the news.
        set({
          radioStatus: "connecting",
          playIntent: false,
          playbackStatus: get().currentVideoId ? "paused" : "idle",
          newsStatus: "off",
          notice: null,
        });
      } else {
        set({ radioStatus: "off" });
      }
    },

    setRadioStatus: (status) => {
      set({ radioStatus: status });
      if (status === "error") get().showNotice("radio-unavailable");
    },

    setRadioVolume: (volume) => {
      set({ radioVolume: Math.min(1, Math.max(0, volume)) });
      persist(get());
    },

    startNews: () => {
      // The news takes audio focus from both the television and the radio.
      set({
        newsStatus: "playing",
        playIntent: false,
        playbackStatus: get().currentVideoId ? "paused" : "idle",
        radioStatus: "off",
        notice: null,
      });
    },

    stopNews: () => set({ newsStatus: "off" }),

    openAlbum: () => {
      // Every audio source pauses while the album is open.
      set({
        albumOpen: true,
        playIntent: false,
        playbackStatus: get().currentVideoId ? "paused" : "idle",
        radioStatus: "off",
        newsStatus: "off",
      });
    },

    closeAlbum: () => set({ albumOpen: false }),

    nextAlbumPage: () =>
      set((state) => ({
        albumPageIndex: Math.min(CONTENT.albumPages.length - 1, state.albumPageIndex + 1),
      })),

    previousAlbumPage: () =>
      set((state) => ({ albumPageIndex: Math.max(0, state.albumPageIndex - 1) })),

    nextQueuePage: () => {
      const pages = Math.max(1, Math.ceil(currentItems().length / QUEUE_VISIBLE_COUNT));
      set((state) => ({ queuePage: Math.min(pages - 1, state.queuePage + 1) }));
    },

    previousQueuePage: () => set((state) => ({ queuePage: Math.max(0, state.queuePage - 1) })),

    toggleFavorite: (videoId) => {
      set((state) => ({
        favoriteVideoIds: state.favoriteVideoIds.includes(videoId)
          ? state.favoriteVideoIds.filter((id) => id !== videoId)
          : [...state.favoriteVideoIds, videoId],
      }));
      persist(get());
    },

    goHome: () => {
      set({ albumOpen: false, notice: null });
      // Whether Home also stops playback is a config choice, not a hard rule.
      if (CONTENT.appConfig.homeStopsPlayback) {
        set({
          playIntent: false,
          playbackStatus: "idle",
          currentVideoId: null,
          radioStatus: "off",
          newsStatus: "off",
        });
      }
    },

    showNotice: (kind) => set({ notice: { kind, ...NOTICES[kind] } }),

    dismissNotice: () => set({ notice: null }),

    retryNotice: () => {
      const { notice } = get();
      if (!notice) return;
      set({ notice: null });
      switch (notice.kind) {
        case "radio-unavailable":
          set({ radioStatus: "connecting" });
          break;
        case "video-unavailable":
        case "offline":
          set((state) => ({ reloadNonce: state.reloadNonce + 1, playIntent: true }));
          break;
        case "content-error":
          window.location.reload();
          break;
      }
    },
  };
});

/** Items of the selected library. Kept out of the store so it stays derived. */
export const selectCurrentItems = (state: AppState): VideoItem[] =>
  CONTENT.libraries[state.selectedLibrary] ?? [];

export const selectCurrentItem = (state: AppState): VideoItem | null => {
  if (!state.currentVideoId) return null;
  for (const items of Object.values(CONTENT.libraries)) {
    const found = items.find((item) => item.id === state.currentVideoId);
    if (found) return found;
  }
  return null;
};
