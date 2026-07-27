/**
 * A cabinet knob: click its left half to go down a step, its right half to go up
 * a step. Also takes the scroll wheel and the arrow keys.
 *
 * It has been through two wrong designs. Drag-to-turn meant "click, hold and
 * move", which on a first attempt just looks like the knob is broken. Replacing
 * that with the angle under the pointer fixed the click but made every click a
 * jump to an absolute position -- so clicking the left edge did not nudge the
 * volume down, it dropped it to silence, and clicking the right edge slammed it
 * to full. Neither is what a hand expects from a knob.
 *
 * So a click is a step, and which half you hit decides the direction. Ten clicks
 * cross the whole range, nothing lands anywhere surprising, and there is no drag
 * gesture left to discover or fail to discover.
 *
 * The visible brass cap is small because the artwork's knobs are small, but the
 * hit box is the full hotspot rectangle -- the spec's "large hit targets, even if
 * the visible knob is smaller". It is a real `role="slider"`, so keyboard and
 * VoiceOver work without a parallel control.
 */
import { useCallback } from "react";

import { fontSize } from "../scene/designSystem";
import styles from "./Knob.module.css";

export interface KnobProps {
  value: number;
  onChange: (value: number) => void;
  labelJa: string;
  /** Rotation sweep of the pointer, in degrees, from value 0 to value 1. */
  sweep?: number;
  style: React.CSSProperties;
  showValue?: boolean;
}

/** Ten clicks from silent to full. Coarse on purpose: fine control is not the job. */
const STEP = 0.1;

export function Knob({ value, onChange, labelJa, sweep = 270, style, showValue }: KnobProps) {
  const clamp = (n: number) => Math.min(1, Math.max(0, n));

  /**
   * One step, in the direction of whichever half was clicked. Left is down and
   * right is up, matching both the way the index line travels and the way a
   * physical knob turns under a thumb.
   */
  const onClick = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      const rect = event.currentTarget.getBoundingClientRect();
      const up = event.clientX >= rect.left + rect.width / 2;
      onChange(clamp(value + (up ? STEP : -STEP)));
    },
    [onChange, value],
  );

  const onWheel = useCallback(
    (event: React.WheelEvent<HTMLDivElement>) => {
      onChange(clamp(value - Math.sign(event.deltaY) * STEP));
    },
    [onChange, value],
  );

  const onKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      const map: Record<string, number> = {
        ArrowUp: STEP,
        ArrowRight: STEP,
        ArrowDown: -STEP,
        ArrowLeft: -STEP,
      };
      const delta = map[event.key];
      if (delta !== undefined) {
        event.preventDefault();
        event.stopPropagation();
        onChange(clamp(value + delta));
        return;
      }
      if (event.key === "Home") {
        event.preventDefault();
        event.stopPropagation();
        onChange(0);
      } else if (event.key === "End") {
        event.preventDefault();
        event.stopPropagation();
        onChange(1);
      }
    },
    [onChange, value],
  );

  const angle = -sweep / 2 + value * sweep;
  const percent = Math.round(value * 100);

  return (
    <div
      className={styles.knob}
      style={style}
      role="slider"
      tabIndex={0}
      aria-label={labelJa}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent}
      aria-valuetext={`${labelJa} ${percent}パーセント`}
      onClick={onClick}
      onWheel={onWheel}
      onKeyDown={onKeyDown}
    >
      <span className={styles.pointer} style={{ transform: `rotate(${angle}deg)` }} aria-hidden="true" />
      {showValue && (
        <span className={styles.readout} style={{ fontSize: fontSize(16) }} aria-hidden="true">
          {percent}
        </span>
      )}
    </div>
  );
}
