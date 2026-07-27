/**
 * The television: the app's only video surface.
 *
 * The player mount is clipped to the screen aperture measured off the artwork,
 * and that is very nearly all this component does.
 *
 * It used to draw a title, a progress bar and a play mark over the video, and
 * cover the paused state to hide YouTube's own screen. That was the wrong fight.
 * YouTube's player cannot be removed from a YouTube embed, so drawing a second
 * set of chrome on top of it only ever produced two of everything -- two titles,
 * two progress bars, two play buttons -- and a full-bleed transparent click
 * target that swallowed every click meant for YouTube's scrubber, so the video
 * could not be skipped through at all.
 *
 * So the cabinet draws nothing over a playing video. YouTube's controls are
 * enabled and are the controls. What remains here is the resting card shown when
 * no video is loaded, which overlaps nothing because there is nothing to overlap.
 *
 * If the libraries move to Bunny Stream (see docs/CONTENT.md), that player is
 * ours to style and this decision is worth revisiting.
 */
import { useRef } from "react";

import { CONTENT } from "../content/loadContent";
import { usePlayerController } from "../player/usePlayerController";
import { fontSize, place } from "../scene/designSystem";
import { TELEVISION_SCREEN } from "../scene/hotspots";
import { selectCurrentItem, useStore } from "../state/store";
import styles from "./Television.module.css";

export function Television() {
  const mountRef = useRef<HTMLDivElement>(null);
  const item = useStore(selectCurrentItem);
  const radioStatus = useStore((s) => s.radioStatus);

  usePlayerController(mountRef, item);

  const idle = !item;

  return (
    <div className={styles.screen} style={place(TELEVISION_SCREEN)}>
      <div ref={mountRef} className={styles.mount} aria-hidden={idle} />

      {idle && radioStatus !== "off" && (
        <div className={styles.card}>
          <p className={styles.cardKicker} style={{ fontSize: fontSize(22) }}>
            ラジオ
          </p>
          <p className={styles.cardTitle} style={{ fontSize: fontSize(46) }}>
            {CONTENT.radio.name}
          </p>
          <p className={styles.cardNote} style={{ fontSize: fontSize(22) }}>
            {radioStatus === "playing" ? "放送中です" : "つないでいます…"}
          </p>
        </div>
      )}

      {idle && radioStatus === "off" && (
        <div className={styles.card}>
          <p className={styles.cardTitle} style={{ fontSize: fontSize(38) }}>
            {CONTENT.appConfig.appNameJa}
          </p>
          <p className={styles.cardNote} style={{ fontSize: fontSize(24) }}>
            左のケースを選んでください
          </p>
        </div>
      )}

      {/* The CRT sheen. Decorative, non-interactive, and drawn only when the
          screen is at rest -- over a running video it dimmed the corners of
          YouTube's own controls, which is the same mistake in a quieter form. */}
      {idle && <div className={styles.glass} aria-hidden="true" />}
    </div>
  );
}
