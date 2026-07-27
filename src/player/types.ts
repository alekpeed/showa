import type { VideoItem } from "../content/schema";

export type PlayerEvent =
  | { type: "ready" }
  | { type: "playing" }
  | { type: "paused" }
  | { type: "ended" }
  | { type: "buffering" }
  | { type: "error"; reason: string }
  | { type: "progress"; currentTime: number; duration: number };

export type PlayerEventHandler = (event: PlayerEvent) => void;

export interface AdapterOptions {
  mount: HTMLElement;
  item: VideoItem;
  volume: number;
  onEvent: PlayerEventHandler;
}

export interface MediaPlayerAdapter {
  readonly source: VideoItem["source"];
  load(): Promise<void>;
  play(): Promise<void>;
  pause(): Promise<void>;
  setVolume(value: number): void;
  destroy(): void;
}
