/**
 * Rolling notes carried between calls.
 *
 * Without this, every call starts from nothing: she would introduce herself
 * daily and no thread could ever be picked back up. That is not a conversation,
 * it is a series of first meetings. A few short notes are what let the next call
 * open with "last time you were telling me about..." instead.
 *
 * Notes are kept local. They are sent to the API only as part of the session
 * instructions on the next call, and can be read and cleared from the settings
 * panel -- these are her private conversations, and whoever maintains this
 * should be able to see exactly what is being retained.
 */

export const MEMORY_KEY = "showa-video-cabinet.companion-memory.v1";

export interface MemoryNote {
  /** Japan-local date of the call this came from. */
  date: string;
  text: string;
}

interface MemoryFile {
  schemaVersion: 1;
  notes: MemoryNote[];
}

export function readMemory(): MemoryNote[] {
  try {
    const raw = window.localStorage.getItem(MEMORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Partial<MemoryFile>;
    if (parsed.schemaVersion !== 1 || !Array.isArray(parsed.notes)) return [];
    return parsed.notes.filter(
      (note): note is MemoryNote =>
        typeof note?.text === "string" && typeof note?.date === "string",
    );
  } catch {
    return [];
  }
}

export function writeMemory(notes: MemoryNote[]): void {
  try {
    const file: MemoryFile = { schemaVersion: 1, notes };
    window.localStorage.setItem(MEMORY_KEY, JSON.stringify(file));
  } catch {
    // Losing a note is not worth interrupting anything for.
  }
}

export function appendNote(note: MemoryNote, maxNotes: number): MemoryNote[] {
  const notes = [...readMemory(), note].slice(-maxNotes);
  writeMemory(notes);
  return notes;
}

export function clearMemory(): void {
  try {
    window.localStorage.removeItem(MEMORY_KEY);
  } catch {
    // Ignore.
  }
}

/** Renders the notes into the block injected at the top of a new session. */
export function formatMemory(notes: MemoryNote[]): string {
  if (!notes.length) return "";
  return [
    "これまでの会話でわかっていること：",
    ...notes.map((note) => `・（${note.date}）${note.text}`),
  ].join("\n");
}
