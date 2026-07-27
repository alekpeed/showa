/**
 * Drives the daily news reading.
 *
 * On launch, if today's clip is missing and a key is configured, generation is
 * fired off in the background. It is deliberately fire-and-forget: the scene must
 * be interactive within three seconds, and a failed feed or a rate-limited API
 * must never produce anything she has to react to.
 *
 * The newspaper always plays the newest clip that already exists, and the object
 * shows which day that clip is from. A stale clip is never presented as today's.
 */
import { useCallback, useEffect, useRef, useState } from "react";

import { CONTENT } from "../content/loadContent";
import { bump } from "../health/healthBeacon";
import { useSettings } from "../state/settings";
import { useStore } from "../state/store";
import { generateTodaysClip } from "./newsService";
import { getClip, getLatestClip, japanDate, type NewsClip } from "./newsCache";

export interface NewsState {
  clip: NewsClip | null;
  generating: boolean;
  /** Present only for the settings panel; never shown in the scene. */
  lastError: string | null;
  available: boolean;
  generateNow: () => Promise<void>;
  refresh: () => Promise<void>;
}

export function useNews(): NewsState {
  const newsStatus = useStore((s) => s.newsStatus);
  const stopNews = useStore((s) => s.stopNews);
  const radioVolume = useStore((s) => s.radioVolume);

  const apiKey = useSettings((s) => s.openAiApiKey);
  const newsEnabled = useSettings((s) => s.newsEnabled);

  const [clip, setClip] = useState<NewsClip | null>(null);
  const [generating, setGenerating] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  const startedRef = useRef(false);

  const config = CONTENT.news;
  const available = config.enabled && newsEnabled && Boolean(apiKey.trim());

  const refresh = useCallback(async () => {
    setClip(await getLatestClip());
  }, []);

  const generateNow = useCallback(async () => {
    const key = useSettings.getState().openAiApiKey.trim();
    if (!key) {
      setLastError("APIキーが設定されていません");
      return;
    }
    setGenerating(true);
    setLastError(null);
    try {
      const fresh = await generateTodaysClip(key, config);
      setClip(fresh);
    } catch (error) {
      bump("newsFailures");
      setLastError(error instanceof Error ? error.message : String(error));
    } finally {
      setGenerating(false);
    }
  }, [config]);

  // Startup: show whatever is cached, then quietly try to add today's.
  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    void (async () => {
      await refresh();
      if (!config.enabled) return;

      const settings = useSettings.getState();
      if (!settings.newsEnabled || !settings.openAiApiKey.trim()) return;
      if (await getClip(japanDate())) return;

      // Nothing here is surfaced to her. If it fails, the newspaper simply keeps
      // offering the most recent clip it already has.
      try {
        setGenerating(true);
        const fresh = await generateTodaysClip(settings.openAiApiKey.trim(), config);
        setClip(fresh);
      } catch (error) {
        bump("newsFailures");
        setLastError(error instanceof Error ? error.message : String(error));
      } finally {
        setGenerating(false);
      }
    })();
  }, [config, refresh]);

  // One audio element, mirroring how the radio is handled.
  useEffect(() => {
    const audio = new Audio();
    audio.preload = "auto";
    audioRef.current = audio;
    return () => {
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
      audioRef.current = null;
    };
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (newsStatus !== "playing" || !clip) {
      audio.pause();
      return;
    }

    const onEnded = () => stopNews();
    audio.addEventListener("ended", onEnded);

    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    const url = URL.createObjectURL(clip.audio);
    objectUrlRef.current = url;
    audio.src = url;
    audio.volume = radioVolume;
    void audio.play().catch(() => stopNews());

    return () => {
      audio.removeEventListener("ended", onEnded);
    };
  }, [newsStatus, clip, radioVolume, stopNews]);

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = radioVolume;
  }, [radioVolume]);

  return { clip, generating, lastError, available, generateNow, refresh };
}
