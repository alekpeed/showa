/**
 * J1 GOLD radio, driven by a single HTMLAudioElement.
 *
 * The stream URL comes from radio.json and is never referenced anywhere else, so
 * swapping stations is a one-line content edit. Playback only ever begins from a
 * user gesture (the input-selector knob), which is both the spec's rule and what
 * keeps macOS autoplay policy happy.
 *
 * A live stream has no end, so a stall is the normal failure mode rather than an
 * error event. One silent retry is attempted before the Japanese notice appears.
 */
import { useEffect, useRef } from "react";

import { CONTENT } from "../content/loadContent";
import { isPlaceholder } from "../content/schema";
import { resolveStreamUrl, useSettings } from "../state/settings";
import { useStore } from "../state/store";

const STALL_TIMEOUT_MS = 12000;

export function useRadio() {
  const radioStatus = useStore((s) => s.radioStatus);
  const radioVolume = useStore((s) => s.radioVolume);
  const setRadioStatus = useStore((s) => s.setRadioStatus);
  // Subscribed to so that saving a new URL re-runs the effect below.
  const radioOverride = useSettings((s) => s.radioStreamUrlOverride);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const retriedRef = useRef(false);
  const stallTimerRef = useRef<number | null>(null);

  useEffect(() => {
    const audio = new Audio();
    audio.preload = "none";
    audio.crossOrigin = "anonymous";
    audioRef.current = audio;
    return () => {
      audio.pause();
      audio.src = "";
      audio.load();
      audioRef.current = null;
    };
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const clearStall = () => {
      if (stallTimerRef.current !== null) {
        window.clearTimeout(stallTimerRef.current);
        stallTimerRef.current = null;
      }
    };

    if (radioStatus === "off" || radioStatus === "error") {
      clearStall();
      audio.pause();
      // Dropping the source matters: a paused live stream otherwise keeps its
      // connection open and buffers in the background indefinitely.
      if (audio.src) {
        audio.removeAttribute("src");
        audio.load();
      }
      if (radioStatus === "off") retriedRef.current = false;
      return;
    }

    if (radioStatus !== "connecting") return;

    // The device override wins, so a dead stream URL is fixable in the hidden
    // settings panel instead of costing a rebuild and a notarization round trip.
    const enabled = CONTENT.radio.enabled;
    const streamUrl = resolveStreamUrl(CONTENT.radio.streamUrl);
    if (!enabled || !streamUrl || isPlaceholder(streamUrl)) {
      setRadioStatus("error");
      return;
    }

    const onPlaying = () => {
      clearStall();
      retriedRef.current = false;
      setRadioStatus("playing");
    };

    const onFailure = () => {
      clearStall();
      if (!retriedRef.current) {
        retriedRef.current = true;
        // One quiet retry. Live streams routinely drop the first connection
        // after the machine wakes from sleep.
        window.setTimeout(() => {
          if (useStore.getState().radioStatus === "connecting") {
            audio.src = `${streamUrl}${streamUrl.includes("?") ? "&" : "?"}_=${Date.now()}`;
            audio.load();
            void audio.play().catch(onFailure);
          }
        }, 1200);
        return;
      }
      setRadioStatus("error");
    };

    audio.addEventListener("playing", onPlaying);
    audio.addEventListener("error", onFailure);
    audio.addEventListener("stalled", onFailure);

    audio.volume = radioVolume;
    audio.src = streamUrl;
    audio.load();
    void audio.play().catch(onFailure);

    stallTimerRef.current = window.setTimeout(onFailure, STALL_TIMEOUT_MS);

    return () => {
      clearStall();
      audio.removeEventListener("playing", onPlaying);
      audio.removeEventListener("error", onFailure);
      audio.removeEventListener("stalled", onFailure);
    };
  }, [radioStatus, radioVolume, setRadioStatus, radioOverride]);

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = radioVolume;
  }, [radioVolume]);
}
