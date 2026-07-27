/**
 * The health beacon.
 *
 * This reverses the project's original no-telemetry stance, deliberately and
 * narrowly. The reason is specific: she will never report a fault. Someone of 90
 * who finds the television stopped working concludes she did something wrong,
 * stops opening that sleeve, and does not mention it because she does not want
 * to be a bother. Without a signal from the machine, a break in March gets
 * noticed in September.
 *
 * What it deliberately does NOT carry:
 *   - which videos she watched, or their titles
 *   - anything said on the phone, or any part of a memory note
 *   - which photographs she looked at
 *   - how long anything played
 *
 * What it carries is whether the app is alive, what version it is running, and
 * counts of things that failed. Plus coarse per-feature use counts, which are
 * the only way to learn whether the phone is something she actually likes.
 *
 * Counters accumulate in localStorage between launches and are sent, then reset,
 * on the next launch. So a failure on a machine that is then shut for a week
 * still gets reported when she next opens it.
 */
import { CONTENT } from "../content/loadContent";

export const HEALTH_KEY = "showa-video-cabinet.health.v1";

export interface HealthCounters {
  /** Failures. These are what an alert should fire on. */
  newsFailures: number;
  radioFailures: number;
  videoFailures: number;
  phoneFailures: number;
  /** Coarse use counts. No titles, no durations, no ordering. */
  videosPlayed: number;
  radioStarts: number;
  newsPlays: number;
  albumOpens: number;
  phoneCalls: number;
}

interface HealthFile {
  schemaVersion: 1;
  counters: HealthCounters;
  /** Epoch ms of the last successful send, so a dead endpoint is visible here. */
  lastSentAt?: number;
}

const EMPTY: HealthCounters = {
  newsFailures: 0,
  radioFailures: 0,
  videoFailures: 0,
  phoneFailures: 0,
  videosPlayed: 0,
  radioStarts: 0,
  newsPlays: 0,
  albumOpens: 0,
  phoneCalls: 0,
};

function read(): HealthFile {
  try {
    const raw = window.localStorage.getItem(HEALTH_KEY);
    if (!raw) return { schemaVersion: 1, counters: { ...EMPTY } };
    const parsed = JSON.parse(raw) as Partial<HealthFile>;
    if (parsed.schemaVersion !== 1) return { schemaVersion: 1, counters: { ...EMPTY } };
    return {
      schemaVersion: 1,
      counters: { ...EMPTY, ...(parsed.counters ?? {}) },
      lastSentAt: parsed.lastSentAt,
    };
  } catch {
    return { schemaVersion: 1, counters: { ...EMPTY } };
  }
}

function write(file: HealthFile): void {
  try {
    window.localStorage.setItem(HEALTH_KEY, JSON.stringify(file));
  } catch {
    // Losing a counter is never worth interrupting anything for.
  }
}

/** Bumps a counter. Safe to call from anywhere; never throws, never blocks. */
export function bump(key: keyof HealthCounters, by = 1): void {
  const file = read();
  file.counters[key] += by;
  write(file);
}

export function readCounters(): HealthCounters {
  return read().counters;
}

export function readLastSentAt(): number | undefined {
  return read().lastSentAt;
}

export interface HealthPayload {
  /** Distinguishes her machine from a test one, without identifying her. */
  installId: string;
  appVersion: string;
  platform: string;
  /** Japan-local date, matching how the news feature reckons days. */
  date: string;
  sentAt: string;
  counters: HealthCounters;
}

const INSTALL_ID_KEY = "showa-video-cabinet.install-id.v1";

/**
 * A random per-install id. Not derived from anything about her or the hardware,
 * and regenerated if storage is ever cleared -- it exists only so a beacon from
 * your own test build is distinguishable from hers.
 */
function installId(): string {
  try {
    const existing = window.localStorage.getItem(INSTALL_ID_KEY);
    if (existing) return existing;
    const fresh = crypto.randomUUID();
    window.localStorage.setItem(INSTALL_ID_KEY, fresh);
    return fresh;
  } catch {
    return "unknown";
  }
}

export function buildPayload(appVersion: string, date: string): HealthPayload {
  return {
    installId: installId(),
    appVersion,
    platform: navigator.userAgent.includes("Mac") ? "macos" : "other",
    date,
    sentAt: new Date().toISOString(),
    counters: readCounters(),
  };
}

/** Clears counters after a successful send, and records when that was. */
export function markSent(): void {
  write({ schemaVersion: 1, counters: { ...EMPTY }, lastSentAt: Date.now() });
}

export const APP_NAME = CONTENT.appConfig.appNameEn;
