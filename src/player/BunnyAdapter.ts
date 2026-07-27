/**
 * Bunny Stream adapter.
 *
 * Bunny's embed is a Player.js-compatible iframe, driven over postMessage. There
 * is no SDK to load and no API key involved -- only the public embed URL, which
 * is what keeps the shipped bundle free of Bunny credentials.
 *
 * Bunny's readiness handshake is not guaranteed to arrive (an offline machine or
 * a deleted video produces silence, not an error frame), so a watchdog turns that
 * silence into a real error event instead of an eternal loading state.
 */
import { bunnyEmbedUrl, type VideoItem } from "../content/schema";
import type { AdapterOptions, MediaPlayerAdapter, PlayerEventHandler } from "./types";

const READY_TIMEOUT_MS = 15000;

interface PlayerJsMessage {
  context?: string;
  event?: string;
  value?: unknown;
  method?: string;
  listener?: string;
}

export class BunnyAdapter implements MediaPlayerAdapter {
  readonly source = "bunny" as const;

  private iframe: HTMLIFrameElement | null = null;
  private ready = false;
  private destroyed = false;
  private readyTimer: number | null = null;
  private duration = 0;

  private readonly mount: HTMLElement;
  private readonly item: Extract<VideoItem, { source: "bunny" }>;
  private readonly onEvent: PlayerEventHandler;
  private volume: number;

  private readonly handleMessage = (event: MessageEvent) => {
    if (this.destroyed || !this.iframe) return;
    if (event.source !== this.iframe.contentWindow) return;

    let data: PlayerJsMessage;
    try {
      data = typeof event.data === "string" ? JSON.parse(event.data) : (event.data as PlayerJsMessage);
    } catch {
      return;
    }
    if (!data || data.context !== "player.js") return;

    switch (data.event) {
      case "ready":
        this.onReady();
        break;
      case "play":
        this.onEvent({ type: "playing" });
        break;
      case "pause":
        this.onEvent({ type: "paused" });
        break;
      case "ended":
        this.onEvent({ type: "ended" });
        break;
      case "timeupdate": {
        const value = data.value as { seconds?: number; duration?: number } | undefined;
        if (value?.duration) this.duration = value.duration;
        if (typeof value?.seconds === "number" && this.duration > 0) {
          this.onEvent({ type: "progress", currentTime: value.seconds, duration: this.duration });
        }
        break;
      }
      case "error":
        this.onEvent({ type: "error", reason: "bunny-player" });
        break;
    }
  };

  constructor(options: AdapterOptions) {
    if (options.item.source !== "bunny") throw new Error("BunnyAdapter got a non-Bunny item");
    this.mount = options.mount;
    this.item = options.item;
    this.onEvent = options.onEvent;
    this.volume = options.volume;
  }

  async load(): Promise<void> {
    const iframe = document.createElement("iframe");
    iframe.src = `${bunnyEmbedUrl(this.item)}?autoplay=false&preload=true&responsive=true`;
    iframe.allow = "accelerometer; encrypted-media; gyroscope; picture-in-picture; fullscreen";
    iframe.setAttribute("loading", "eager");
    iframe.style.width = "100%";
    iframe.style.height = "100%";
    iframe.style.border = "0";
    iframe.title = this.item.titleJa;

    window.addEventListener("message", this.handleMessage);
    this.mount.appendChild(iframe);
    this.iframe = iframe;

    iframe.addEventListener("error", () => {
      if (!this.destroyed) this.onEvent({ type: "error", reason: "bunny-embed" });
    });

    this.readyTimer = window.setTimeout(() => {
      if (!this.ready && !this.destroyed) this.onEvent({ type: "error", reason: "bunny-timeout" });
    }, READY_TIMEOUT_MS);
  }

  private onReady() {
    if (this.ready) return;
    this.ready = true;
    if (this.readyTimer !== null) {
      window.clearTimeout(this.readyTimer);
      this.readyTimer = null;
    }
    for (const listener of ["play", "pause", "ended", "timeupdate", "error"]) {
      this.send("addEventListener", listener);
    }
    this.setVolume(this.volume);
    this.onEvent({ type: "ready" });
  }

  private send(method: string, value?: unknown) {
    const target = this.iframe?.contentWindow;
    if (!target) return;
    const payload: PlayerJsMessage = { context: "player.js", method };
    if (method === "addEventListener") payload.listener = String(value);
    else if (value !== undefined) payload.value = value;
    try {
      target.postMessage(JSON.stringify(payload), "*");
    } catch {
      // Cross-origin teardown races are expected; nothing useful to do.
    }
  }

  async play(): Promise<void> {
    this.send("play");
  }

  async pause(): Promise<void> {
    this.send("pause");
  }

  setVolume(value: number): void {
    this.volume = value;
    // Player.js expresses volume as 0-100.
    this.send("setVolume", Math.round(value * 100));
  }

  destroy(): void {
    this.destroyed = true;
    if (this.readyTimer !== null) {
      window.clearTimeout(this.readyTimer);
      this.readyTimer = null;
    }
    window.removeEventListener("message", this.handleMessage);
    try {
      this.send("pause");
    } catch {
      // Ignore.
    }
    // Blanking src before removal stops media that a bare remove() can leave
    // playing in the background.
    if (this.iframe) {
      this.iframe.src = "about:blank";
      this.iframe.remove();
      this.iframe = null;
    }
    this.mount.replaceChildren();
  }
}
