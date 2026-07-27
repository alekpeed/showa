/**
 * The physical album on the low table. The whole book is the target; hovering
 * lifts the cover slightly so it reads as something you can open.
 *
 * It carried a 写真を見る label in a pill over the middle of the book. An open
 * photo album on a table does not need a caption explaining that it is a photo
 * album -- the object says it, which is the whole premise of the scene -- and the
 * pill sat on top of the very photographs it was describing. The label survives
 * as the accessible name, so nothing is lost to a screen reader.
 */
import { place } from "../scene/designSystem";
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
    />
  );
}
