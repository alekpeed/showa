/**
 * The overlay registry: every interactive region of the cabinet, in design pixels.
 *
 * Coordinates were measured off the approved artwork
 * (assets/reference/selected-interface-reference.png, 1586x992) by scanning
 * luminance edges, so each box lands on the painted object it drives. If the
 * background art is ever re-rendered, this file and clean-background.mjs are the
 * only two places that need to change.
 */

import type { DesignRect } from "./designSystem";

export type HotspotAction =
  | "select-showa"
  | "select-nostalgic"
  | "select-personal"
  | "open-album"
  | "radio-toggle"
  | "radio-volume"
  | "video-volume"
  | "video-previous"
  | "video-next"
  | "video-toggle"
  | "queue-page-previous"
  | "queue-page-next"
  | "play-news"
  | "toggle-call"
  | "home";

export interface Hotspot extends DesignRect {
  id: string;
  action: HotspotAction;
  ariaLabelJa: string;
  ariaLabelEn: string;
}

/** The television screen aperture. The player is clipped to exactly this box. */
export const TELEVISION_SCREEN: DesignRect = { x: 508, y: 188, width: 630, height: 405 };

/** Inner face of the queue recess beneath the television. */
export const QUEUE_PANEL: DesignRect = { x: 490, y: 656, width: 658, height: 108 };

/** Card lane between the two page arrows. Four cards at 116 wide, 12 apart. */
export const QUEUE_CARD_LANE: DesignRect = { x: 569, y: 658, width: 500, height: 104 };
export const QUEUE_VISIBLE_COUNT = 4;
export const QUEUE_CARD_WIDTH = 116;
export const QUEUE_CARD_GAP = 12;

/** Drawer front below the sleeves, used as the physical transport panel. */
export const TRANSPORT_DRAWER: DesignRect = { x: 108, y: 646, width: 344, height: 76 };

/** Amplifier tuner window; shows the station name and lights when the radio runs. */
export const TUNER_DISPLAY: DesignRect = { x: 1172, y: 583, width: 336, height: 62 };

/** The amplifier's power lamp, at the right edge of the knob row. */
export const RADIO_LAMP: DesignRect = { x: 1557, y: 529, width: 16, height: 16 };

/** Where transient Japanese error notices appear, tucked under the tuner. */
export const NOTICE_AREA: DesignRect = { x: 1166, y: 660, width: 350, height: 78 };

export const HOTSPOTS: Hotspot[] = [
  {
    id: "sleeve-showa",
    action: "select-showa",
    x: 142,
    y: 200,
    width: 306,
    height: 112,
    ariaLabelJa: "昭和のうた",
    ariaLabelEn: "Showa Songs",
  },
  {
    id: "sleeve-nostalgic",
    action: "select-nostalgic",
    x: 132,
    y: 313,
    width: 314,
    height: 108,
    ariaLabelJa: "なつかしい日本",
    ariaLabelEn: "Nostalgic Japan",
  },
  {
    id: "sleeve-personal",
    action: "select-personal",
    x: 124,
    y: 423,
    width: 327,
    height: 119,
    ariaLabelJa: "日本で撮った動画",
    ariaLabelEn: "Videos I Filmed in Japan",
  },
  {
    id: "photo-album",
    action: "open-album",
    x: 227,
    y: 767,
    width: 578,
    height: 205,
    ariaLabelJa: "写真を見る",
    ariaLabelEn: "Open the photo album",
  },
  {
    // The large brass knob sitting directly beside the lit station display. This
    // was the amplifier's input selector, on the reasoning that "switch to the
    // tuner" is the honest physical meaning of turning on a radio -- but nobody
    // finds a small knob two rows up when there is a big one next to the words
    // J1 GOLD. It is the switch because it is the thing that looks like the switch.
    id: "radio-power",
    action: "radio-toggle",
    x: 1497,
    y: 576,
    width: 82,
    height: 82,
    ariaLabelJa: "ラジオ",
    ariaLabelEn: "Radio power",
  },
  {
    // The input selector on the amplifier's knob row, at its right end.
    id: "radio-volume",
    action: "radio-volume",
    x: 1480,
    y: 478,
    width: 82,
    height: 82,
    ariaLabelJa: "ラジオの音量",
    ariaLabelEn: "Radio volume",
  },
  {
    // The knob painted 音量 on the amplifier face.
    id: "video-volume",
    action: "video-volume",
    x: 1191,
    y: 478,
    width: 82,
    height: 82,
    ariaLabelJa: "音量",
    ariaLabelEn: "Video volume",
  },
  {
    // The stack of magazines on the table. It already reads as "something to
    // read", so it carries the daily news without adding an object to the scene.
    id: "newspaper",
    action: "play-news",
    x: 1210,
    y: 812,
    width: 370,
    height: 178,
    ariaLabelJa: "今日のニュース",
    ariaLabelEn: "Today's news",
  },
  {
    // PLACEHOLDER POSITION. There is no telephone in the approved artwork, so
    // this sits on the bare table between the album and the magazines. When a
    // scene render with an actual handset arrives, these four numbers are the
    // only thing that needs to change.
    id: "telephone",
    action: "toggle-call",
    x: 862,
    y: 872,
    width: 214,
    height: 118,
    ariaLabelJa: "おしゃべり",
    ariaLabelEn: "Talk",
  },
  {
    id: "queue-page-previous",
    action: "queue-page-previous",
    x: 490,
    y: 658,
    width: 72,
    height: 104,
    ariaLabelJa: "前のビデオ一覧",
    ariaLabelEn: "Previous page of videos",
  },
  {
    id: "queue-page-next",
    action: "queue-page-next",
    x: 1076,
    y: 658,
    width: 72,
    height: 104,
    ariaLabelJa: "次のビデオ一覧",
    ariaLabelEn: "Next page of videos",
  },
];

/*
 * Four brass plaques -- 前へ / 再生 / 次へ / ホーム -- used to be laid across the
 * drawer front here. They were removed: every one duplicated something already
 * within reach (the television toggles playback, the queue is one click from any
 * video, the next one follows on its own), and they were invented objects on a
 * drawer the artwork paints with no buttons on it.
 *
 * TRANSPORT_DRAWER is kept above -- it is the drawer's own geometry, and
 * scripts/clean-background.mjs still refers to that region.
 */
