/**
 * Global keyboard handling, per the accessibility spec.
 *
 *   Escape  close the album, or leave full screen
 *   Space   play / pause
 *   ← →     previous / next video, or page the album when it is open
 *   H       Home
 *
 * Keys are ignored while focus sits on a slider or inside an embedded player, so
 * the knobs keep their own arrow-key behaviour and YouTube never fights us for
 * the space bar.
 */
import { useEffect } from "react";

import { useStore } from "../state/store";

function focusIsInsideControl(): boolean {
  const active = document.activeElement;
  if (!active) return false;
  if (active.tagName === "IFRAME") return true;
  return active.getAttribute("role") === "slider";
}

export function useKeyboardShortcuts() {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;

      const state = useStore.getState();

      if (event.key === "Escape") {
        if (state.albumOpen) {
          event.preventDefault();
          state.closeAlbum();
        } else if (document.fullscreenElement) {
          event.preventDefault();
          void document.exitFullscreen();
        }
        return;
      }

      if (focusIsInsideControl()) return;

      switch (event.key) {
        case " ":
          event.preventDefault();
          if (!state.albumOpen) state.togglePlayback();
          break;
        case "ArrowRight":
          event.preventDefault();
          if (state.albumOpen) state.nextAlbumPage();
          else state.nextVideo(false);
          break;
        case "ArrowLeft":
          event.preventDefault();
          if (state.albumOpen) state.previousAlbumPage();
          else state.previousVideo();
          break;
        case "h":
        case "H":
          event.preventDefault();
          state.goHome();
          break;
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
}
