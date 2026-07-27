/**
 * YouTube IFrame Player API adapter.
 *
 * The API script is loaded once and cached on a module-level promise, so
 * switching videos never re-injects it. `destroy()` calls the API's own
 * destroy() *and* clears the mount, because a detached iframe that is only
 * removed from the DOM can keep audio running -- the specific failure the
 * acceptance checklist calls "audio does not continue invisibly".
 */
import type { VideoItem } from "../content/schema";
import type { AdapterOptions, MediaPlayerAdapter, PlayerEventHandler } from "./types";

const IFRAME_API_SRC = "https://www.youtube.com/iframe_api";

/** Minimal shape of the parts of the YT namespace this app touches. */
interface YTPlayer {
  playVideo(): void;
  pauseVideo(): void;
  stopVideo(): void;
  setVolume(percent: number): void;
  getCurrentTime(): number;
  getDuration(): number;
  destroy(): void;
}

interface YTNamespace {
  Player: new (element: HTMLElement, config: unknown) => YTPlayer;
  PlayerState: { ENDED: number; PLAYING: number; PAUSED: number; BUFFERING: number };
}

declare global {
  interface Window {
    YT?: YTNamespace;
    onYouTubeIframeAPIReady?: () => void;
  }
}

let apiPromise: Promise<YTNamespace> | null = null;

function loadIframeApi(): Promise<YTNamespace> {
  if (apiPromise) return apiPromise;
  apiPromise = new Promise<YTNamespace>((resolve, reject) => {
    if (window.YT?.Player) {
      resolve(window.YT);
      return;
    }
    const timeout = window.setTimeout(() => {
      apiPromise = null;
      reject(new Error("youtube-api-timeout"));
    }, 15000);

    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previous?.();
      window.clearTimeout(timeout);
      if (window.YT?.Player) resolve(window.YT);
      else reject(new Error("youtube-api-unavailable"));
    };

    const script = document.createElement("script");
    script.src = IFRAME_API_SRC;
    script.async = true;
    script.onerror = () => {
      window.clearTimeout(timeout);
      apiPromise = null;
      reject(new Error("youtube-api-blocked"));
    };
    document.head.appendChild(script);
  });
  return apiPromise;
}

export class YouTubeAdapter implements MediaPlayerAdapter {
  readonly source = "youtube" as const;

  private player: YTPlayer | null = null;
  private container: HTMLElement | null = null;
  private progressTimer: number | null = null;
  private destroyed = false;

  private readonly mount: HTMLElement;
  private readonly item: Extract<VideoItem, { source: "youtube" }>;
  private readonly onEvent: PlayerEventHandler;
  private volume: number;

  constructor(options: AdapterOptions) {
    if (options.item.source !== "youtube") throw new Error("YouTubeAdapter got a non-YouTube item");
    this.mount = options.mount;
    this.item = options.item;
    this.onEvent = options.onEvent;
    this.volume = options.volume;
  }

  async load(): Promise<void> {
    let api: YTNamespace;
    try {
      api = await loadIframeApi();
    } catch {
      this.onEvent({ type: "error", reason: "youtube-api" });
      return;
    }
    if (this.destroyed) return;

    const host = document.createElement("div");
    host.style.width = "100%";
    host.style.height = "100%";
    this.mount.appendChild(host);
    this.container = host;

    this.player = new api.Player(host, {
      videoId: this.item.youtubeVideoId,
      playerVars: {
        autoplay: 0,
        // YouTube's controls are on, and are the only controls over the video.
        // With them off its pause screen still appeared -- controls=0 removes the
        // control bar, not the overlay -- so the choice was never "our chrome or
        // theirs", it was "theirs, or theirs with ours on top of it". Theirs at
        // least lets her drag through a song, which nothing we drew could do.
        controls: 1,
        // Left enabled so that once the player has focus, space and the arrow
        // keys keep doing something sensible instead of going dead.
        disablekb: 0,
        rel: 0,
        iv_load_policy: 3,
        playsinline: 1,
        // Full screen stays off: there is no way back out of it that she would
        // find, and the cabinet is the point.
        fs: 0,
        origin: window.location.origin,
      },
      events: {
        onReady: () => {
          if (this.destroyed) return;
          this.player?.setVolume(Math.round(this.volume * 100));
          this.onEvent({ type: "ready" });
          this.startProgress();
        },
        onStateChange: (event: { data: number }) => {
          if (this.destroyed) return;
          switch (event.data) {
            case api.PlayerState.PLAYING:
              this.onEvent({ type: "playing" });
              break;
            case api.PlayerState.PAUSED:
              this.onEvent({ type: "paused" });
              break;
            case api.PlayerState.ENDED:
              this.onEvent({ type: "ended" });
              break;
            case api.PlayerState.BUFFERING:
              this.onEvent({ type: "buffering" });
              break;
          }
        },
        onError: (event: { data: number }) => {
          if (this.destroyed) return;
          // 101 and 150 both mean "the uploader disabled embedding". They are the
          // single most likely failure for archival Showa footage, so they get
          // named rather than folded into a generic error.
          const reason =
            event.data === 101 || event.data === 150 ? "embedding-disabled" : `youtube-${event.data}`;
          this.onEvent({ type: "error", reason });
        },
      },
    });
  }

  private startProgress() {
    this.stopProgress();
    this.progressTimer = window.setInterval(() => {
      if (!this.player || this.destroyed) return;
      try {
        const currentTime = this.player.getCurrentTime();
        const duration = this.player.getDuration();
        if (Number.isFinite(currentTime) && duration > 0) {
          this.onEvent({ type: "progress", currentTime, duration });
        }
      } catch {
        // The player can be mid-teardown; a dropped tick is harmless.
      }
    }, 500);
  }

  private stopProgress() {
    if (this.progressTimer !== null) {
      window.clearInterval(this.progressTimer);
      this.progressTimer = null;
    }
  }

  async play(): Promise<void> {
    this.player?.playVideo();
  }

  async pause(): Promise<void> {
    this.player?.pauseVideo();
  }

  setVolume(value: number): void {
    this.volume = value;
    this.player?.setVolume(Math.round(value * 100));
  }

  destroy(): void {
    this.destroyed = true;
    this.stopProgress();
    try {
      this.player?.stopVideo();
      this.player?.destroy();
    } catch {
      // Already gone.
    }
    this.player = null;
    this.container?.remove();
    this.container = null;
    // Belt and braces: the API sometimes leaves its own iframe behind.
    this.mount.replaceChildren();
  }
}
