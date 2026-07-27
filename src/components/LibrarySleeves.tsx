/**
 * The three media sleeves on the left of the cabinet.
 *
 * Each sleeve is a single large button covering the whole painted object. The
 * selected state is signalled three ways at once -- a forward shift, a
 * brightness lift, and an indicator lamp -- because the spec forbids relying on
 * colour alone. None of the three depends on the hit box matching the painted
 * edge, which is why there is no outline.
 */
import { LIBRARY_LABELS, type LibraryId } from "../content/schema";
import { place } from "../scene/designSystem";
import { HOTSPOTS, type Hotspot } from "../scene/hotspots";
import { useStore } from "../state/store";
import styles from "./LibrarySleeves.module.css";

const SLEEVE_LIBRARY: Record<string, LibraryId> = {
  "sleeve-showa": "showa-songs",
  "sleeve-nostalgic": "nostalgic-japan",
  "sleeve-personal": "personal-videos",
};

const sleeves: Hotspot[] = HOTSPOTS.filter((h) => h.id in SLEEVE_LIBRARY);

export function LibrarySleeves() {
  const selectedLibrary = useStore((s) => s.selectedLibrary);
  const selectLibrary = useStore((s) => s.selectLibrary);

  return (
    <>
      {sleeves.map((sleeve) => {
        const library = SLEEVE_LIBRARY[sleeve.id]!;
        const isSelected = selectedLibrary === library;
        return (
          <button
            key={sleeve.id}
            type="button"
            className={styles.sleeve}
            style={place(sleeve)}
            data-selected={isSelected || undefined}
            aria-pressed={isSelected}
            aria-label={`${LIBRARY_LABELS[library].ja}（${LIBRARY_LABELS[library].en}）`}
            onClick={() => selectLibrary(library)}
          >
            <span className={styles.lamp} aria-hidden="true" />
          </button>
        );
      })}
    </>
  );
}
