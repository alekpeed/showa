/**
 * The photo album, as a full-screen scrapbook spread.
 *
 * Two pages are shown side by side. Adjacent pages are preloaded so a turn never
 * shows an empty frame. Page turns are a cross-fade with a slight lift rather
 * than a page-curl library -- cheaper, and it keeps to the "no bouncing" rule.
 */
import { useEffect, useRef } from "react";

import { CONTENT } from "../content/loadContent";
import type { AlbumPage } from "../content/schema";
import { useStore } from "../state/store";
import styles from "./PhotoAlbumOverlay.module.css";

function PageSpread({ page }: { page: AlbumPage | undefined }) {
  if (!page) return <div className={styles.page} aria-hidden="true" />;
  return (
    <div className={styles.page} data-layout={page.layout}>
      {(page.titleJa || page.noteJa) && (
        <header className={styles.pageHeader}>
          {page.titleJa && <h2 className={styles.pageTitle}>{page.titleJa}</h2>}
          {page.noteJa && <p className={styles.pageNote}>{page.noteJa}</p>}
        </header>
      )}
      <div className={styles.photos}>
        {page.photos.map((photo) => (
          <figure
            key={photo.id}
            className={styles.photo}
            style={{ transform: `rotate(${photo.rotationDegrees ?? 0}deg)` }}
          >
            <img src={photo.src} alt={photo.captionJa ?? photo.captionEn ?? ""} />
            {(photo.captionJa || photo.locationJa) && (
              <figcaption className={styles.caption}>
                {photo.captionJa}
                {photo.locationJa ? (
                  <span className={styles.nowrap}>
                    {photo.captionJa ? "　" : ""}
                    {photo.locationJa}
                  </span>
                ) : null}
                {/* Japanese wraps between any two characters, so the year is held
                    together explicitly to stop "2023" and "年" splitting. */}
                {photo.year ? <span className={styles.nowrap}>　{photo.year}年</span> : null}
              </figcaption>
            )}
          </figure>
        ))}
      </div>
    </div>
  );
}

export function PhotoAlbumOverlay() {
  const albumOpen = useStore((s) => s.albumOpen);
  const pageIndex = useStore((s) => s.albumPageIndex);
  const closeAlbum = useStore((s) => s.closeAlbum);
  const nextAlbumPage = useStore((s) => s.nextAlbumPage);
  const previousAlbumPage = useStore((s) => s.previousAlbumPage);

  const closeRef = useRef<HTMLButtonElement>(null);
  const pages = CONTENT.albumPages;

  // Move focus into the overlay so Escape and the arrows work immediately.
  useEffect(() => {
    if (albumOpen) closeRef.current?.focus();
  }, [albumOpen]);

  // Preload the neighbouring spread so a turn is instant.
  useEffect(() => {
    if (!albumOpen) return;
    for (const offset of [-2, -1, 1, 2, 3]) {
      const page = pages[pageIndex + offset];
      page?.photos.forEach((photo) => {
        const img = new Image();
        img.src = photo.src;
      });
    }
  }, [albumOpen, pageIndex, pages]);

  if (!albumOpen) return null;

  const left = pages[pageIndex];
  const right = pages[pageIndex + 1];
  const atStart = pageIndex === 0;
  const atEnd = pageIndex + 2 >= pages.length;

  return (
    <div className={styles.backdrop} role="dialog" aria-modal="true" aria-label="写真アルバム">
      <div className={styles.book}>
        <button
          type="button"
          className={`${styles.turn} ${styles.turnLeft}`}
          onClick={previousAlbumPage}
          disabled={atStart}
          aria-label="前のページ"
        >
          <span aria-hidden="true">‹</span>
        </button>

        <div className={styles.spread} key={pageIndex}>
          <PageSpread page={left} />
          <div className={styles.spine} aria-hidden="true" />
          <PageSpread page={right} />
        </div>

        <button
          type="button"
          className={`${styles.turn} ${styles.turnRight}`}
          onClick={nextAlbumPage}
          disabled={atEnd}
          aria-label="次のページ"
        >
          <span aria-hidden="true">›</span>
        </button>
      </div>

      {/* The single close action, styled as a ribbon pull on the album's edge. */}
      <button ref={closeRef} type="button" className={styles.close} onClick={closeAlbum}>
        閉じる
      </button>

      {pages.length === 0 && (
        <p className={styles.empty}>まだ写真がありません。</p>
      )}
    </div>
  );
}
