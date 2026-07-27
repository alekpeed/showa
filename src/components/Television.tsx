/**
 * The television: the app's only video surface.
 *
 * The player mount is clipped to the screen aperture measured off the artwork.
 * Above it sits a non-interactive glass overlay, and above that the title and
 * transport chrome, which fade out after the pointer goes still.
 */
import { useCallback, useEffect, useRef, useState } from "react";

import { CONTENT } from "../content/loadContent";
import { usePlayerController } from "../player/usePlayerController";
import { fontSize, place } from "../scene/designSystem";
import { TELEVISION_SCREEN } from "../scene/hotspots";
import { selectCurrentItem, useStore } from "../state/store";
import styles from "./Television.module.css";

const CHROME_IDLE_MS = 2600;

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const total = Math.floor(seconds);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function Television() {
  const mountRef = useRef<HTMLDivElement>(null);
  const item = useStore(selectCurrentItem);
  const playbackStatus = useStore((s) => s.playbackStatus);
  const radioStatus = useStore((s) => s.radioStatus);
  const togglePlayback = useStore((s) => s.togglePlayback);

  const progress = usePlayerController(mountRef, item);
  const [chromeVisible, setChromeVisible] = useState(true);
  const idleTimer = useRef<number | null>(null);

  const wakeChrome = useCallback(() => {
    setChromeVisible(true);
    if (idleTimer.current !== null) window.clearTimeout(idleTimer.current);
    idleTimer.current = window.setTimeout(() => setChromeVisible(false), CHROME_IDLE_MS);
  }, []);

  useEffect(() => {
    wakeChrome();
    return () => {
      if (idleTimer.current !== null) window.clearTimeout(idleTimer.current);
    };
  }, [wakeChrome, item?.id, playbackStatus]);

  const showEnglish = CONTENT.appConfig.showEnglishSubtitles;
  const isPlaying = playbackStatus === "playing";
  const isLoading = playbackStatus === "loading";
  const idle = !item;

  const subtitleJa = item?.artistJa ?? item?.subtitleJa ?? item?.locationJa;
  const subtitleEn = item?.artistEn ?? item?.subtitleEn ?? item?.locationEn;

  return (
    <div className={styles.screen} style={place(TELEVISION_SCREEN)} onPointerMove={wakeChrome}>
      <div ref={mountRef} className={styles.mount} aria-hidden={idle} />

      {/* Whenever the video is not actually running, YouTube paints its own
          screen inside the iframe: a title bar, a large play button, a scrubber,
          a related-video thumbnail and its logo. None of that can be switched
          off with player parameters -- controls=0 removes the controls, not this
          -- and it lands on top of the artwork looking like a browser was left
          open. So the paused state is covered outright and the cabinet draws its
          own, matching the screen's resting state.

          Opaque rather than translucent on purpose: at any alpha that lets the
          paused frame show through, YouTube's white play button shows through
          with it, and two play buttons is worse than none. Rendered before the
          loading indicator so that indicator stays on top. */}
      {item && !isPlaying && <div className={styles.veil} aria-hidden="true" />}

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

      {isLoading && (
        <div className={styles.loading} role="status">
          <span className={styles.loadingDot} aria-hidden="true" />
          <span style={{ fontSize: fontSize(24) }}>読み込み中…</span>
        </div>
      )}

      {/* Clicking the glass toggles playback, as a physical set would. */}
      {item && (
        <button
          type="button"
          className={styles.hitArea}
          onClick={togglePlayback}
          onDoubleClick={() => void document.documentElement.requestFullscreen?.()}
          aria-label={isPlaying ? "一時停止" : "再生"}
        />
      )}

      <div className={styles.glass} aria-hidden="true" />

      {item && (
        <div className={styles.chrome} data-visible={chromeVisible || !isPlaying || undefined}>
          {/* The cabinet's own play mark, standing in for the one that used to
              come from YouTube. Hidden while loading so it never sits next to
              the 読み込み中 indicator saying two different things. */}
          {!isPlaying && !isLoading && (
            <span className={styles.playBadge} aria-hidden="true">
              ▶
            </span>
          )}

          <div className={styles.titleBar}>
            <p className={styles.titleJa} style={{ fontSize: fontSize(30) }}>
              {item.titleJa}
            </p>
            {subtitleJa && (
              <p className={styles.titleSub} style={{ fontSize: fontSize(22) }}>
                {subtitleJa}
                {item.year ? `　${item.year}` : ""}
              </p>
            )}
            {showEnglish && item.titleEn && (
              <p className={styles.titleEn} style={{ fontSize: fontSize(16) }}>
                {item.titleEn}
                {subtitleEn ? ` — ${subtitleEn}` : ""}
              </p>
            )}
          </div>

          {progress.duration > 0 && (
            <div className={styles.progressBar}>
              <span className={styles.time} style={{ fontSize: fontSize(18) }}>
                {formatTime(progress.currentTime)}
              </span>
              <div className={styles.track}>
                <div
                  className={styles.fill}
                  style={{ width: `${(progress.currentTime / progress.duration) * 100}%` }}
                />
              </div>
              <span className={styles.time} style={{ fontSize: fontSize(18) }}>
                {formatTime(progress.duration)}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
