/**
 * The single application-level player controller.
 *
 * One adapter exists at a time. When the selected item changes, the old adapter
 * is destroyed *before* the new one is constructed, and the mount element is
 * emptied in between -- the switching sequence in 05-technical-architecture.md.
 *
 * The generation counter guards against a slow `load()` from a previous item
 * resolving after the user has already moved on and writing into a dead mount.
 */
import { useEffect, useRef, useState } from "react";

import type { VideoItem } from "../content/schema";
import { isUnfilled } from "../content/schema";
import { useStore } from "../state/store";
import { BunnyAdapter } from "./BunnyAdapter";
import { YouTubeAdapter } from "./YouTubeAdapter";
import type { MediaPlayerAdapter, PlayerEvent } from "./types";

export interface PlayerProgress {
  currentTime: number;
  duration: number;
}

export function usePlayerController(
  mountRef: React.RefObject<HTMLDivElement | null>,
  item: VideoItem | null,
) {
  const playIntent = useStore((s) => s.playIntent);
  const videoVolume = useStore((s) => s.videoVolume);
  const reloadNonce = useStore((s) => s.reloadNonce);
  const setPlaybackStatus = useStore((s) => s.setPlaybackStatus);
  const showNotice = useStore((s) => s.showNotice);

  const adapterRef = useRef<MediaPlayerAdapter | null>(null);
  const generationRef = useRef(0);
  const [progress, setProgress] = useState<PlayerProgress>({ currentTime: 0, duration: 0 });

  // Mount / swap the adapter whenever the item identity changes.
  useEffect(() => {
    const mount = mountRef.current;
    const generation = ++generationRef.current;

    // Teardown always runs first, even when there is no next item.
    adapterRef.current?.destroy();
    adapterRef.current = null;
    setProgress({ currentTime: 0, duration: 0 });

    if (!mount || !item) return;

    if (isUnfilled(item)) {
      // A manifest entry that still holds REPLACE_WITH_* placeholders. Treat it
      // exactly like an unavailable video rather than letting a bad embed load.
      setPlaybackStatus("error");
      showNotice("video-unavailable");
      return;
    }

    if (!navigator.onLine) {
      setPlaybackStatus("error");
      showNotice("offline");
      return;
    }

    const onEvent = (event: PlayerEvent) => {
      if (generationRef.current !== generation) return;
      switch (event.type) {
        case "ready":
          if (useStore.getState().playIntent) void adapterRef.current?.play();
          break;
        case "playing":
          setPlaybackStatus("playing");
          break;
        case "paused":
          setPlaybackStatus("paused");
          break;
        case "buffering":
          setPlaybackStatus("loading");
          break;
        case "ended":
          setPlaybackStatus("ended");
          break;
        case "progress":
          setProgress({ currentTime: event.currentTime, duration: event.duration });
          break;
        case "error":
          setPlaybackStatus("error");
          showNotice(navigator.onLine ? "video-unavailable" : "offline");
          break;
      }
    };

    const options = { mount, item, volume: videoVolume, onEvent };
    const adapter: MediaPlayerAdapter =
      item.source === "youtube" ? new YouTubeAdapter(options) : new BunnyAdapter(options);

    adapterRef.current = adapter;
    void adapter.load().catch(() => {
      if (generationRef.current === generation) {
        setPlaybackStatus("error");
        showNotice("video-unavailable");
      }
    });

    return () => {
      adapter.destroy();
      if (adapterRef.current === adapter) adapterRef.current = null;
    };
    // videoVolume is intentionally excluded: it is applied through the effect
    // below so that changing volume never rebuilds the player.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item?.id, reloadNonce, mountRef, setPlaybackStatus, showNotice]);

  // Play / pause follows the intent flag rather than being called imperatively,
  // so the store stays the only thing that decides what should be audible.
  useEffect(() => {
    const adapter = adapterRef.current;
    if (!adapter) return;
    if (playIntent) void adapter.play();
    else void adapter.pause();
  }, [playIntent, item?.id]);

  useEffect(() => {
    adapterRef.current?.setVolume(videoVolume);
  }, [videoVolume]);

  // Unmount safety net: nothing may outlive the television component.
  useEffect(
    () => () => {
      adapterRef.current?.destroy();
      adapterRef.current = null;
    },
    [],
  );

  return progress;
}
