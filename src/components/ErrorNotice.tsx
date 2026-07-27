/**
 * The one place user-facing failure appears.
 *
 * Every notice is Japanese-first, one short sentence, and carries exactly one
 * recovery action plus a close -- the modal rule from the accessibility spec.
 * Technical detail stays in the console during development and never reaches her.
 */
import { fontSize, place } from "../scene/designSystem";
import { NOTICE_AREA } from "../scene/hotspots";
import { useStore } from "../state/store";
import styles from "./ErrorNotice.module.css";

export function ErrorNotice() {
  const notice = useStore((s) => s.notice);
  const retryNotice = useStore((s) => s.retryNotice);
  const dismissNotice = useStore((s) => s.dismissNotice);

  if (!notice) return null;

  return (
    <div className={styles.notice} style={place(NOTICE_AREA)} role="alert">
      <p className={styles.message} style={{ fontSize: fontSize(20) }}>
        {notice.messageJa}
      </p>
      <div className={styles.actions}>
        <button
          type="button"
          className={styles.retry}
          style={{ fontSize: fontSize(20) }}
          onClick={retryNotice}
        >
          {notice.retryLabelJa}
        </button>
        <button
          type="button"
          className={styles.close}
          style={{ fontSize: fontSize(20) }}
          onClick={dismissNotice}
        >
          閉じる
        </button>
      </div>
    </div>
  );
}
