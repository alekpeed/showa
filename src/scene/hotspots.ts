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
    // The amplifier's input selector. Its painted labels read PHONO / TUNER / AUX,
    // so "switch to the tuner" is the honest physical meaning of turning on radio.
    id: "radio-power",
    action: "radio-toggle",
    x: 1480,
    y: 478,
    width: 82,
    height: 82,
    ariaLabelJa: "ラジオ",
    ariaLabelEn: "Radio power",
  },
  {
    // Large brass knob on the tuner. Hit box is deliberately wider than the knob.
    id: "radio-volume",
    action: "radio-volume",
    x: 1497,
    y: 576,
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

/**
 * The four brass buttons rendered across the drawer front. Sizes are chosen so
 * that each stays above the 52x52 CSS pixel minimum at a 1200x750 window.
 */
export interface TransportButtonSpec {
  id: string;
  action: HotspotAction;
  labelJa: string;
  labelEn: string;
  rect: DesignRect;
}

const TRANSPORT_BUTTON_WIDTH = 80;
const TRANSPORT_BUTTON_GAP = 8;

const transportRect = (index: number): DesignRect => ({
  x: TRANSPORT_DRAWER.x + index * (TRANSPORT_BUTTON_WIDTH + TRANSPORT_BUTTON_GAP),
  y: TRANSPORT_DRAWER.y,
  width: TRANSPORT_BUTTON_WIDTH,
  height: TRANSPORT_DRAWER.height,
});

export const TRANSPORT_BUTTONS: TransportButtonSpec[] = [
  {
    id: "transport-previous",
    action: "video-previous",
    labelJa: "前へ",
    labelEn: "Previous",
    rect: transportRect(0),
  },
  {
    id: "transport-toggle",
    action: "video-toggle",
    labelJa: "再生",
    labelEn: "Play",
    rect: transportRect(1),
  },
  {
    id: "transport-next",
    action: "video-next",
    labelJa: "次へ",
    labelEn: "Next",
    rect: transportRect(2),
  },
  {
    id: "transport-home",
    action: "home",
    labelJa: "ホーム",
    labelEn: "Home",
    rect: transportRect(3),
  },
];
