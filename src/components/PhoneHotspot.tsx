/**
 * The handset. Pick it up to talk, put it down to stop.
 *
 * The position is a placeholder -- there is no telephone in the approved
 * artwork -- so this renders its own plate rather than relying on a painted
 * object underneath. When a scene render with a real handset arrives, the plate
 * can go and the hotspot rectangle moves onto it.
 *
 * There is deliberately no "connecting" spinner or error text here. If the call
 * fails she sees the plate return to its resting label, which is what a phone
 * that did not connect does. The reason lands in the settings panel instead.
 */
import type { CompanionState } from "../phone/useCompanion";
import { CONTENT } from "../content/loadContent";
import { fontSize, place } from "../scene/designSystem";
import { HOTSPOTS } from "../scene/hotspots";
import { useStore } from "../state/store";
import styles from "./PhoneHotspot.module.css";

const hotspot = HOTSPOTS.find((h) => h.id === "telephone")!;

export function PhoneHotspot({ companion }: { companion: CompanionState }) {
  const phoneStatus = useStore((s) => s.phoneStatus);
  const startCall = useStore((s) => s.startCall);
  const endCall = useStore((s) => s.endCall);

  const live = phoneStatus === "connecting" || phoneStatus === "connected";
  const label =
    phoneStatus === "connected"
      ? "おわる"
      : phoneStatus === "connecting"
        ? "つないでいます…"
        : CONTENT.companion.labelJa;

  return (
    <button
      type="button"
      className={styles.phone}
      style={place(hotspot)}
      data-live={live || undefined}
      data-connected={phoneStatus === "connected" || undefined}
      onClick={() => (live ? endCall() : startCall())}
      aria-label={live ? "おしゃべりをおわる" : companion.available ? "おしゃべりをはじめる" : "おしゃべり"}
    >
      <span className={styles.plate}>
        <span className={styles.glyph} aria-hidden="true">
          {phoneStatus === "connected" ? "☏" : "✆"}
        </span>
        <span className={styles.label} style={{ fontSize: fontSize(23) }}>
          {label}
        </span>
      </span>
    </button>
  );
}
