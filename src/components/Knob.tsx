/**
 * A cabinet knob: drag vertically, scroll, or use arrow keys.
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
const DRAG_RANGE_PX = 160;

export function Knob({ value, onChange, labelJa, sweep = 270, style, showValue }: KnobProps) {
  const dragRef = useRef<{ startY: number; startValue: number } | null>(null);

  const clamp = (n: number) => Math.min(1, Math.max(0, n));

  const onPointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      event.currentTarget.setPointerCapture(event.pointerId);
      dragRef.current = { startY: event.clientY, startValue: value };
    },
    [value],
  );

  const onPointerMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const drag = dragRef.current;
      if (!drag) return;
      // Upward drag increases, which is the direction a physical knob's near
      // edge travels when you turn it clockwise.
      const delta = (drag.startY - event.clientY) / DRAG_RANGE_PX;
      onChange(clamp(drag.startValue + delta));
    },
    [onChange],
  );

  const endDrag = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    dragRef.current = null;
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
