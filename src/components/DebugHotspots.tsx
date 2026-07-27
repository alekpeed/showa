/**
 * Development-only hotspot outlines, toggled with Shift+D.
 *
 * This is the tool for checking that overlays stay welded to the artwork at every
 * window size (Phase 2, step 4 of the build plan). It is compiled out of
 * production builds by the `import.meta.env.DEV` guard in App.tsx.
 */
import { useEffect, useState } from "react";

import { place } from "../scene/designSystem";
import {
  HOTSPOTS,
  QUEUE_CARD_LANE,
  QUEUE_PANEL,
  TELEVISION_SCREEN,
  TRANSPORT_BUTTONS,
  TUNER_DISPLAY,
} from "../scene/hotspots";
import styles from "./DebugHotspots.module.css";

const EXTRA = [
  { id: "television-screen", rect: TELEVISION_SCREEN },
  { id: "queue-panel", rect: QUEUE_PANEL },
  { id: "queue-card-lane", rect: QUEUE_CARD_LANE },
  { id: "tuner-display", rect: TUNER_DISPLAY },
];

export function DebugHotspots() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.shiftKey && (event.key === "D" || event.key === "d")) {
        setVisible((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (!visible) return null;

  return (
    <div className={styles.layer} aria-hidden="true">
      {HOTSPOTS.map((hotspot) => (
        <div key={hotspot.id} className={styles.box} style={place(hotspot)}>
          <span className={styles.tag}>{hotspot.id}</span>
        </div>
      ))}
      {TRANSPORT_BUTTONS.map((button) => (
        <div key={button.id} className={styles.box} style={place(button.rect)}>
          <span className={styles.tag}>{button.id}</span>
        </div>
      ))}
      {EXTRA.map((entry) => (
        <div key={entry.id} className={`${styles.box} ${styles.region}`} style={place(entry.rect)}>
          <span className={styles.tag}>{entry.id}</span>
        </div>
      ))}
    </div>
  );
}
