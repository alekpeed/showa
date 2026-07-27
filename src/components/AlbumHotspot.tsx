/**
 * The physical album on the low table. The whole book is the target; hovering
 * lifts the cover slightly so it reads as something you can open.
 */
import { fontSize, place } from "../scene/designSystem";
import { HOTSPOTS } from "../scene/hotspots";
import { useStore } from "../state/store";
import styles from "./AlbumHotspot.module.css";

const albumHotspot = HOTSPOTS.find((h) => h.id === "photo-album")!;

export function AlbumHotspot() {
  const openAlbum = useStore((s) => s.openAlbum);

  return (
    <button
      type="button"
      className={styles.album}
      style={place(albumHotspot)}
      onClick={openAlbum}
      aria-label="写真を見る"
    >
      <span className={styles.hint} style={{ fontSize: fontSize(22) }}>
        写真を見る
      </span>
    </button>
  );
}
