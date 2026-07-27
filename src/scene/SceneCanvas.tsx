/**
 * The fixed 16:10 scene canvas.
 *
 * The canvas is sized with `aspect-ratio` and capped by both viewport dimensions,
 * which letterboxes rather than distorts at any window shape. Children position
 * themselves in percentages via `place()`, so they scale with the artwork for free.
 *
 * `container-type: size` is what makes design-pixel type sizes work: it turns the
 * canvas into a container-query context, so `cqw` units resolve against the scene
 * rather than the viewport.
 */
import type { ReactNode } from "react";

import backgroundUrl from "../assets/scene/entertainment-center-background.webp";
import styles from "./SceneCanvas.module.css";

export function SceneCanvas({ children }: { children: ReactNode }) {
  return (
    <div className={styles.letterbox}>
      <div
        className={styles.canvas}
        style={{ backgroundImage: `url(${backgroundUrl})` }}
        data-testid="scene-canvas"
      >
        {children}
      </div>
    </div>
  );
}
