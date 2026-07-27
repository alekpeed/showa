/**
 * The hidden settings panel.
 *
 * Opened with Ctrl+Shift+Option+S, then a PIN. She will never find it by
 * accident and cannot reach it by clicking anything in the scene.
 *
 * What lives here is specifically the set of values that would otherwise cost a
 * rebuild, a notarization round trip and a reinstall on someone else's Mac to
 * change: the API key and the radio stream URL. Everything else stays in JSON.
 *
 * This panel is the only English-first surface in the app, because the only
 * person who will ever see it is the one maintaining it.
 */
import { useEffect, useState } from "react";

import { CONTENT } from "../content/loadContent";
import { clearClips } from "../news/newsCache";
import type { NewsState } from "../news/useNews";
import type { CompanionState } from "../phone/useCompanion";
import { readCounters, readLastSentAt } from "../health/healthBeacon";
import { useSettings } from "../state/settings";
import styles from "./SettingsPanel.module.css";

export function SettingsPanel({
  news,
  companion,
}: {
  news: NewsState;
  companion: CompanionState;
}) {
  const panelOpen = useSettings((s) => s.panelOpen);
  const unlocked = useSettings((s) => s.unlocked);
  const openPanel = useSettings((s) => s.openPanel);
  const closePanel = useSettings((s) => s.closePanel);
  const unlock = useSettings((s) => s.unlock);
  const update = useSettings((s) => s.update);

  const apiKey = useSettings((s) => s.openAiApiKey);
  const newsEnabled = useSettings((s) => s.newsEnabled);
  const companionEnabled = useSettings((s) => s.companionEnabled);
  const radioOverride = useSettings((s) => s.radioStreamUrlOverride);
  const healthEndpoint = useSettings((s) => s.healthEndpoint);

  const [pin, setPin] = useState("");
  const [pinError, setPinError] = useState(false);
  const [keyDraft, setKeyDraft] = useState("");
  const [radioDraft, setRadioDraft] = useState("");
  const [healthDraft, setHealthDraft] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey && event.shiftKey && event.altKey && event.code === "KeyS") {
        event.preventDefault();
        openPanel();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [openPanel]);

  useEffect(() => {
    if (panelOpen) {
      setPin("");
      setPinError(false);
      setSaved(false);
      setKeyDraft(apiKey);
      setRadioDraft(radioOverride);
      setHealthDraft(healthEndpoint);
    }
  }, [panelOpen, apiKey, radioOverride, healthEndpoint]);

  if (!panelOpen) return null;

  if (!unlocked) {
    return (
      <div className={styles.backdrop} role="dialog" aria-modal="true" aria-label="Settings">
        <form
          className={styles.pinBox}
          onSubmit={(event) => {
            event.preventDefault();
            if (!unlock(pin, CONTENT.appConfig.settingsPin)) {
              setPinError(true);
              setPin("");
            }
          }}
        >
          <label className={styles.pinLabel} htmlFor="settings-pin">
            Enter code
          </label>
          <input
            id="settings-pin"
            className={styles.pinInput}
            type="password"
            inputMode="numeric"
            autoFocus
            value={pin}
            onChange={(event) => {
              setPin(event.target.value);
              setPinError(false);
            }}
          />
          {pinError && <p className={styles.pinError}>Incorrect</p>}
          <div className={styles.pinActions}>
            <button type="submit" className={styles.primary}>
              Unlock
            </button>
            <button type="button" className={styles.secondary} onClick={closePanel}>
              Cancel
            </button>
          </div>
        </form>
      </div>
    );
  }

  const save = () => {
    update({
      openAiApiKey: keyDraft.trim(),
      radioStreamUrlOverride: radioDraft.trim(),
      healthEndpoint: healthDraft.trim(),
    });
    setSaved(true);
  };

  const maskedKey = apiKey ? `${apiKey.slice(0, 7)}…${apiKey.slice(-4)}` : "not set";
  // Read at render rather than subscribed: these change constantly during use
  // and re-rendering the panel on every counter bump would be pointless churn.
  const counters = readCounters();
  const lastSent = readLastSentAt();

  return (
    <div className={styles.backdrop} role="dialog" aria-modal="true" aria-label="Settings">
      <div className={styles.panel}>
        <header className={styles.header}>
          <h2 className={styles.heading}>Settings</h2>
          <button type="button" className={styles.close} onClick={closePanel} aria-label="Close">
            ✕
          </button>
        </header>

        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>Daily news reading</h3>
          <p className={styles.note}>
            Stored on this Mac only, never in the app bundle or the repository. Changing it here
            takes effect immediately — no rebuild.
          </p>

          <label className={styles.field}>
            <span className={styles.fieldLabel}>OpenAI API key</span>
            <input
              className={styles.input}
              type="password"
              spellCheck={false}
              autoComplete="off"
              placeholder="sk-…"
              value={keyDraft}
              onChange={(event) => {
                setKeyDraft(event.target.value);
                setSaved(false);
              }}
            />
            <span className={styles.hint}>Currently: {maskedKey}</span>
          </label>

          <label className={styles.checkbox}>
            <input
              type="checkbox"
              checked={newsEnabled}
              onChange={(event) => update({ newsEnabled: event.target.checked })}
            />
            <span>Show the news on the table</span>
          </label>

          <div className={styles.statusRow}>
            <button
              type="button"
              className={styles.primary}
              disabled={news.generating || !keyDraft.trim()}
              onClick={() => {
                update({ openAiApiKey: keyDraft.trim() });
                void news.generateNow();
              }}
            >
              {news.generating ? "Generating…" : "Generate today's reading now"}
            </button>
            <button
              type="button"
              className={styles.secondary}
              onClick={() => void clearClips().then(news.refresh)}
            >
              Clear cache
            </button>
          </div>

          {news.lastError && <p className={styles.error}>Last error: {news.lastError}</p>}

          {news.clip && (
            <details className={styles.details}>
              <summary>
                Latest clip: {news.clip.date} — {news.clip.sources.length || news.clip.headlines.length}{" "}
                {news.clip.sources.length ? "sources" : "headlines"}
              </summary>
              <p className={styles.script}>{news.clip.script}</p>

              {/* Read these against the script. If a detail in the reading is not
                  in one of these pages, the prompt needs tightening. */}
              {news.clip.sources.length > 0 && (
                <ul className={styles.sources}>
                  {news.clip.sources.map((source) => (
                    <li key={source.url}>
                      <a href={source.url} target="_blank" rel="noreferrer noopener">
                        {source.title}
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </details>
          )}
        </section>

        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>Conversation phone</h3>
          <p className={styles.note}>
            Uses the same API key. Needs microphone permission — <strong>accept that prompt
            yourself during setup</strong>, the first time you pick up the handset. A macOS
            permission dialog is exactly the thing that will stop her.
          </p>

          <label className={styles.checkbox}>
            <input
              type="checkbox"
              checked={companionEnabled}
              onChange={(event) => update({ companionEnabled: event.target.checked })}
            />
            <span>Show the phone on the table</span>
          </label>

          <p className={styles.hint}>
            Status: {companion.status}
            {companion.lastError ? "" : " — no errors"}
          </p>
          {companion.lastError && <p className={styles.error}>Last error: {companion.lastError}</p>}

          {/* Her private conversations, in summary. Whoever maintains this should
              be able to see exactly what is being kept, and delete it. */}
          <details className={styles.details}>
            <summary>What it remembers ({companion.memory.length} notes)</summary>
            {companion.memory.length === 0 ? (
              <p className={styles.hint}>Nothing yet.</p>
            ) : (
              <div className={styles.script}>
                {companion.memory.map((note, index) => (
                  <div key={`${note.date}-${index}`}>
                    {note.date}
                    {"\n"}
                    {note.text}
                    {"\n"}
                  </div>
                ))}
              </div>
            )}
            <button
              type="button"
              className={styles.secondary}
              onClick={companion.forgetEverything}
              style={{ marginTop: 10 }}
            >
              Forget everything
            </button>
          </details>
        </section>

        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>Radio stream override</h3>
          <p className={styles.note}>
            Overrides <code>radio.json</code> when set. Use this if the J1 GOLD stream URL changes —
            it saves a full rebuild and notarization. Must be https.
          </p>
          <label className={styles.field}>
            <span className={styles.fieldLabel}>Stream URL</span>
            <input
              className={styles.input}
              type="url"
              spellCheck={false}
              placeholder={CONTENT.radio.streamUrl}
              value={radioDraft}
              onChange={(event) => {
                setRadioDraft(event.target.value);
                setSaved(false);
              }}
            />
            <span className={styles.hint}>
              A new host also has to be allowed in the CSP in tauri.conf.json.
            </span>
          </label>
        </section>

        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>Health monitoring</h3>
          <p className={styles.note}>
            Sends app version and counts of what worked and what failed, once per launch, so
            you find out when something breaks — she never will. <strong>No titles, nothing
            said on the phone, no durations.</strong> Leave blank to send nothing at all.
            See <code>monitor/README.md</code> to deploy the receiver.
          </p>
          <label className={styles.field}>
            <span className={styles.fieldLabel}>Beacon URL</span>
            <input
              className={styles.input}
              type="url"
              spellCheck={false}
              placeholder="https://showa-health.you.workers.dev"
              value={healthDraft}
              onChange={(event) => {
                setHealthDraft(event.target.value);
                setSaved(false);
              }}
            />
            <span className={styles.hint}>
              {lastSent
                ? `Last sent ${new Date(lastSent).toLocaleString()}`
                : healthEndpoint
                  ? "Configured, nothing sent yet"
                  : "Off"}
            </span>
          </label>

          <details className={styles.details}>
            <summary>What would be sent right now</summary>
            <pre className={styles.script}>{JSON.stringify(counters, null, 2)}</pre>
          </details>
        </section>

        <footer className={styles.footer}>
          {saved && <span className={styles.saved}>Saved</span>}
          <button type="button" className={styles.primary} onClick={save}>
            Save
          </button>
          <button type="button" className={styles.secondary} onClick={closePanel}>
            Done
          </button>
        </footer>
      </div>
    </div>
  );
}
