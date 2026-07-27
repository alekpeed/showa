/**
 * The magazine stack on the table: today's news reading.
 *
 * The label always states the date of the clip it will actually play, so a
 * two-day-old reading is never mistaken for today's. If nothing has been
 * generated yet, the object simply is not shown -- better than a dead control.
 */
import type { NewsState } from "../news/useNews";
import { japanDate, japanDateLabel } from "../news/newsCache";
import { fontSize, place } from "../scene/designSystem";
import { HOTSPOTS } from "../scene/hotspots";
import { useStore } from "../state/store";
import styles from "./NewspaperHotspot.module.css";

const hotspot = HOTSPOTS.find((h) => h.id === "newspaper")!;

export function NewspaperHotspot({ news }: { news: NewsState }) {
  const newsStatus = useStore((s) => s.newsStatus);
  const startNews = useStore((s) => s.startNews);
  const stopNews = useStore((s) => s.stopNews);

  if (!news.clip) return null;

  const isPlaying = newsStatus === "playing";
  const isToday = news.clip.date === japanDate();
  const dateLabel = japanDateLabel(news.clip.date);

  return (
    <button
      type="button"
      className={styles.newspaper}
      style={place(hotspot)}
      data-playing={isPlaying || undefined}
      onClick={() => (isPlaying ? stopNews() : startNews())}
      aria-label={
        isPlaying ? "ニュースを止める" : `${dateLabel}のニュースを聞く　${news.clip.sourceNameJa}`
      }
    >
      <span className={styles.plate}>
        <span className={styles.title} style={{ fontSize: fontSize(23) }}>
          {isPlaying ? "ニュースを止める" : "今日のニュース"}
        </span>
        <span className={styles.meta} style={{ fontSize: fontSize(17) }}>
          {/* Naming the day matters more than naming it "today": on a Mac that
              has been shut for two days, this is the only honest label. */}
          {isToday ? dateLabel : `${dateLabel}のニュース`}　{news.clip.sourceNameJa}
        </span>
      </span>
    </button>
  );
}
