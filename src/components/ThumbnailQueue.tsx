/**
 * The video queue in the recess beneath the television.
 *
 * Four cards per page rather than five: at 116 design pixels each they match the
 * width of the cards in the approved artwork, which leaves the titles legible
 * instead of shrinking them to fit a fifth.
 */
import { assetUrl } from "../content/assetUrl";
import { CONTENT } from "../content/loadContent";
import { fontSize, length, place } from "../scene/designSystem";
import {
  HOTSPOTS,
  QUEUE_CARD_GAP,
  QUEUE_CARD_LANE,
  QUEUE_CARD_WIDTH,
  QUEUE_VISIBLE_COUNT,
} from "../scene/hotspots";
import { selectCurrentItems, useStore } from "../state/store";
import styles from "./ThumbnailQueue.module.css";

const prevHotspot = HOTSPOTS.find((h) => h.id === "queue-page-previous")!;
const nextHotspot = HOTSPOTS.find((h) => h.id === "queue-page-next")!;

function formatDuration(seconds: number | undefined): string | null {
  if (!seconds) return null;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function ThumbnailQueue() {
  const items = useStore(selectCurrentItems);
  const currentVideoId = useStore((s) => s.currentVideoId);
  const queuePage = useStore((s) => s.queuePage);
  const playVideo = useStore((s) => s.playVideo);
  const nextQueuePage = useStore((s) => s.nextQueuePage);
  const previousQueuePage = useStore((s) => s.previousQueuePage);
  const favorites = useStore((s) => s.favoriteVideoIds);

  const pageCount = Math.max(1, Math.ceil(items.length / QUEUE_VISIBLE_COUNT));
  const page = Math.min(queuePage, pageCount - 1);
  const visible = items.slice(page * QUEUE_VISIBLE_COUNT, page * QUEUE_VISIBLE_COUNT + QUEUE_VISIBLE_COUNT);

  return (
    <>
      <button
        type="button"
        className={styles.pageArrow}
        style={place(prevHotspot)}
        onClick={previousQueuePage}
        disabled={page === 0}
        aria-label={prevHotspot.ariaLabelJa}
      >
        <span aria-hidden="true">‹</span>
      </button>

      <div className={styles.lane} style={{ ...place(QUEUE_CARD_LANE), gap: length(QUEUE_CARD_GAP) }}>
        {visible.map((item) => {
          const isCurrent = item.id === currentVideoId;
          const duration = formatDuration(item.durationSeconds);
          return (
            <button
              key={item.id}
              type="button"
              className={styles.card}
              style={{ width: length(QUEUE_CARD_WIDTH) }}
              data-current={isCurrent || undefined}
              aria-current={isCurrent ? "true" : undefined}
              aria-label={`${item.titleJa}${item.artistJa ? `　${item.artistJa}` : ""}`}
              onClick={() => playVideo(item.id)}
            >
              <span className={styles.frame}>
                <img className={styles.image} src={assetUrl(item.thumbnail)} alt="" loading="lazy" />
                {duration && (
                  <span className={styles.duration} style={{ fontSize: fontSize(14) }}>
                    {duration}
                  </span>
                )}
                {favorites.includes(item.id) && (
                  <span className={styles.favorite} aria-label="お気に入り">
                    ✿
                  </span>
                )}
                {/* A playing marker, so "which one is on" survives without colour. */}
                {isCurrent && <span className={styles.nowPlaying} aria-hidden="true" />}
              </span>
              <span className={styles.title} style={{ fontSize: fontSize(21) }}>
                {item.titleJa}
              </span>
            </button>
          );
        })}

        {visible.length === 0 && (
          <p className={styles.empty} style={{ fontSize: fontSize(24) }}>
            このケースにはまだビデオがありません。
          </p>
        )}
      </div>

      <button
        type="button"
        className={styles.pageArrow}
        style={place(nextHotspot)}
        onClick={nextQueuePage}
        disabled={page >= pageCount - 1}
        aria-label={nextHotspot.ariaLabelJa}
      >
        <span aria-hidden="true">›</span>
      </button>

      <span className="visually-hidden" aria-live="polite">
        {CONTENT.appConfig.appNameJa}　{items.length}本のビデオ
      </span>
    </>
  );
}
