/**
 * Device settings: the handful of values that must be changeable *without* a
 * rebuild.
 *
 * This exists because there is no auto-update. Anything baked into the bundle
 * costs a full build, notarization and reinstall to change, on a machine that
 * is not yours. An API key or a dead radio URL is not worth that trip, so both
 * live here instead, entered once through the hidden settings panel.
 *
 * The panel is behind a PIN. That is a lock against a 90-year-old wandering in,
 * not a security boundary -- anyone with the Mac can read localStorage.
 */
import { create } from "zustand";

export const SETTINGS_KEY = "showa-video-cabinet.settings.v1";

export interface DeviceSettings {
  schemaVersion: 1;
  /** OpenAI key for the daily news reading. Empty means the feature is off. */
  openAiApiKey: string;
  newsEnabled: boolean;
  companionEnabled: boolean;
  /** Health beacon target. Empty means nothing is ever sent. */
  healthEndpoint: string;
  /** Overrides radio.json when set, so a dead stream is a one-minute fix. */
  radioStreamUrlOverride: string;
}

const DEFAULTS: DeviceSettings = {
  schemaVersion: 1,
  openAiApiKey: "",
  newsEnabled: true,
  companionEnabled: true,
  healthEndpoint: "",
  radioStreamUrlOverride: "",
};

function read(): DeviceSettings {
  try {
    const raw = window.localStorage.getItem(SETTINGS_KEY);
    if (!raw) return DEFAULTS;
    const parsed = JSON.parse(raw) as Partial<DeviceSettings>;
    if (parsed.schemaVersion !== 1) return DEFAULTS;
    return {
      schemaVersion: 1,
      openAiApiKey: typeof parsed.openAiApiKey === "string" ? parsed.openAiApiKey : "",
      newsEnabled: typeof parsed.newsEnabled === "boolean" ? parsed.newsEnabled : true,
      companionEnabled:
        typeof parsed.companionEnabled === "boolean" ? parsed.companionEnabled : true,
      healthEndpoint: typeof parsed.healthEndpoint === "string" ? parsed.healthEndpoint : "",
      radioStreamUrlOverride:
        typeof parsed.radioStreamUrlOverride === "string" ? parsed.radioStreamUrlOverride : "",
    };
  } catch {
    return DEFAULTS;
  }
}

function write(settings: DeviceSettings): void {
  try {
    window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // Nothing useful to do, and nothing worth interrupting playback for.
  }
}

interface SettingsState extends DeviceSettings {
  panelOpen: boolean;
  unlocked: boolean;
  openPanel: () => void;
  closePanel: () => void;
  unlock: (pin: string, expected: string) => boolean;
  update: (patch: Partial<Omit<DeviceSettings, "schemaVersion">>) => void;
}

export const useSettings = create<SettingsState>((set, get) => ({
  ...read(),
  panelOpen: false,
  unlocked: false,

  openPanel: () => set({ panelOpen: true }),

  // Locking again on close means a second visit needs the PIN again.
  closePanel: () => set({ panelOpen: false, unlocked: false }),

  unlock: (pin, expected) => {
    const ok = pin === expected;
    if (ok) set({ unlocked: true });
    return ok;
  },

  update: (patch) => {
    set(patch);
    const {
      schemaVersion,
      openAiApiKey,
      newsEnabled,
      companionEnabled,
      healthEndpoint,
      radioStreamUrlOverride,
    } = get();
    write({
      schemaVersion,
      openAiApiKey,
      newsEnabled,
      companionEnabled,
      healthEndpoint,
      radioStreamUrlOverride,
    });
  },
}));

/** Resolved radio stream: the device override wins over the bundled manifest. */
export function resolveStreamUrl(bundled: string): string {
  const override = useSettings.getState().radioStreamUrlOverride.trim();
  return override || bundled;
}
