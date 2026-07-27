/**
 * A cabinet knob: click where you want it pointing, drag to refine, or use the
 * scroll wheel and arrow keys.
 *
 * A single click sets the value, because "click, hold and move" is not a gesture
 * to hand to a ninety-year-old -- on a first attempt it looks like the knob is
 * broken. The angle under the pointer becomes the setting, which is how a real
 * dial behaves: you turn it to where you want it. Dragging then continues from
 * there for anyone who wants finer adjustment.
 *
 * The visible brass cap is small because the artwork's knobs are small, but the
 * hit box is the full hotspot rectangle -- the spec's "large hit targets, even if
 * the visible knob is smaller". It is a real `role="slider"`, so keyboard and
 * VoiceOver work without a parallel control.
 */
import { useCallback, useRef } from "react";

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

const STEP = 0.05;

/**
 * Inside this fraction of the knob's radius the angle is noise -- a click a few
 * pixels off dead centre would swing the value wildly. Clicks landing there are
 * ignored rather than obeyed.
 */
const DEAD_ZONE = 0.22;

export function Knob({ value, onChange, labelJa, sweep = 270, style, showValue }: KnobProps) {
  const draggingRef = useRef(false);

  const clamp = (n: number) => Math.min(1, Math.max(0, n));

  /**
   * Maps a pointer position to a value using the angle from the knob's centre,
   * measured clockwise from straight up -- the same convention the brass index
   * line is drawn with, so the line lands under the pointer.
   *
   * Returns null inside the dead zone, and for angles in the gap at the bottom
   * of the sweep, where there is no honest reading to give.
   */
  const valueAt = useCallback(
    (element: HTMLElement, clientX: number, clientY: number): number | null => {
      const rect = element.getBoundingClientRect();
      const dx = clientX - (rect.left + rect.width / 2);
      const dy = clientY - (rect.top + rect.height / 2);

      const radius = Math.min(rect.width, rect.height) / 2;
      if (Math.hypot(dx, dy) < radius * DEAD_ZONE) return null;

      const degrees = (Math.atan2(dx, -dy) * 180) / Math.PI;
      const half = sweep / 2;
      // Below the sweep's ends the knob simply does not travel; snapping there
      // would let a click under the knob jump the volume from silent to full.
      if (degrees < -half || degrees > half) return null;

      return clamp((degrees + half) / sweep);
    },
    [sweep],
  );

  const onPointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      event.currentTarget.setPointerCapture(event.pointerId);
      draggingRef.current = true;
      const next = valueAt(event.currentTarget, event.clientX, event.clientY);
      if (next !== null) onChange(next);
    },
    [onChange, valueAt],
  );

  const onPointerMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!draggingRef.current) return;
      const next = valueAt(event.currentTarget, event.clientX, event.clientY);
      if (next !== null) onChange(next);
    },
    [onChange, valueAt],
  );

  const endDrag = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    draggingRef.current = false;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }, []);

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
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
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
