/**
 * The single source of truth for scene geometry.
 *
 * Every interactive region in the app is authored in *design pixels* against the
 * approved artwork, then converted to percentages exactly once, here. Nothing
 * else in the codebase is allowed to hold an absolute coordinate -- that rule is
 * what keeps overlays welded to the background at every window size.
 */

export const DESIGN_WIDTH = 1586;
export const DESIGN_HEIGHT = 992;
export const DESIGN_ASPECT = DESIGN_WIDTH / DESIGN_HEIGHT;

export interface DesignRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** CSS properties that place an absolutely-positioned box over the scene. */
export interface PlacedStyle {
  left: string;
  top: string;
  width: string;
  height: string;
}

export function place(rect: DesignRect): PlacedStyle {
  return {
    left: `${(rect.x / DESIGN_WIDTH) * 100}%`,
    top: `${(rect.y / DESIGN_HEIGHT) * 100}%`,
    width: `${(rect.width / DESIGN_WIDTH) * 100}%`,
    height: `${(rect.height / DESIGN_HEIGHT) * 100}%`,
  };
}

/**
 * Type sizes are authored in design pixels too, so text scales with the scene
 * instead of drifting out of its painted panel. Emitted as a `cqw` value: 1cqw
 * is one percent of the scene's own width, so the ratio holds at any scale.
 */
export function fontSize(designPx: number): string {
  return `${(designPx / DESIGN_WIDTH) * 100}cqw`;
}

/** Same idea for any length that must track the scene (padding, radii, gaps). */
export function length(designPx: number): string {
  return `${(designPx / DESIGN_WIDTH) * 100}cqw`;
}

/**
 * Smallest window the scene is specified to support (03-ui-ux-specification.md).
 * Hit targets are checked against the scale factor this implies so that the
 * 52x52 CSS pixel minimum still holds at the smallest supported window.
 */
export const MIN_WINDOW_WIDTH = 1200;
export const MIN_WINDOW_HEIGHT = 750;
export const MIN_SCALE = Math.min(MIN_WINDOW_WIDTH / DESIGN_WIDTH, MIN_WINDOW_HEIGHT / DESIGN_HEIGHT);

/** Effective CSS-pixel size of a design-pixel box at the smallest supported window. */
export function effectiveSize(designPx: number): number {
  return designPx * MIN_SCALE;
}
