/**
 * IndexedDB cache for the generated news audio.
 *
 * IndexedDB rather than a file on disk, deliberately: it keeps the app at zero
 * filesystem permissions. Audio blobs are a megabyte or so, which IndexedDB
 * handles comfortably.
 *
 * Entries are keyed by Japan-local date, since it is Japanese news being read on
 * a Japanese schedule regardless of where the Mac happens to be sitting.
 */

const DB_NAME = "showa-video-cabinet.news";
const DB_VERSION = 1;
const STORE = "clips";
const KEEP_DAYS = 5;

export interface NewsClip {
  /** Japan-local date, YYYY-MM-DD. Doubles as the primary key. */
  date: string;
  audio: Blob;
  /** The spoken text, kept so the panel can show what was read. */
  script: string;
  headlines: string[];
  sourceNameJa: string;
  createdAt: number;
}

/** Today's date in Japan, as YYYY-MM-DD. */
export function japanDate(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  return parts;
}

/** Japan-local date formatted for speech and display, e.g. 7月27日（月）. */
export function japanDateLabel(date: string): string {
  const parsed = new Date(`${date}T12:00:00+09:00`);
  return new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    month: "long",
    day: "numeric",
    weekday: "short",
  }).format(parsed);
}

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "date" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function getClip(date: string): Promise<NewsClip | null> {
  try {
    const db = await open();
    return await new Promise<NewsClip | null>((resolve, reject) => {
      const request = db.transaction(STORE, "readonly").objectStore(STORE).get(date);
      request.onsuccess = () => resolve((request.result as NewsClip) ?? null);
      request.onerror = () => reject(request.error);
    });
  } catch {
    return null;
  }
}

/** The most recent clip on hand, whatever day it is from. */
export async function getLatestClip(): Promise<NewsClip | null> {
  try {
    const db = await open();
    const clips = await new Promise<NewsClip[]>((resolve, reject) => {
      const request = db.transaction(STORE, "readonly").objectStore(STORE).getAll();
      request.onsuccess = () => resolve((request.result as NewsClip[]) ?? []);
      request.onerror = () => reject(request.error);
    });
    if (!clips.length) return null;
    return clips.sort((a, b) => b.date.localeCompare(a.date))[0] ?? null;
  } catch {
    return null;
  }
}

export async function putClip(clip: NewsClip): Promise<void> {
  const db = await open();
  await new Promise<void>((resolve, reject) => {
    const request = db.transaction(STORE, "readwrite").objectStore(STORE).put(clip);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
  await prune();
}

/** Keeps the last few days so the cache cannot grow without bound. */
async function prune(): Promise<void> {
  try {
    const db = await open();
    const clips = await new Promise<NewsClip[]>((resolve, reject) => {
      const request = db.transaction(STORE, "readonly").objectStore(STORE).getAll();
      request.onsuccess = () => resolve((request.result as NewsClip[]) ?? []);
      request.onerror = () => reject(request.error);
    });
    const stale = clips.sort((a, b) => b.date.localeCompare(a.date)).slice(KEEP_DAYS);
    if (!stale.length) return;
    const store = db.transaction(STORE, "readwrite").objectStore(STORE);
    for (const clip of stale) store.delete(clip.date);
  } catch {
    // A failed prune is not worth surfacing.
  }
}

export async function clearClips(): Promise<void> {
  const db = await open();
  await new Promise<void>((resolve, reject) => {
    const request = db.transaction(STORE, "readwrite").objectStore(STORE).clear();
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}
