/**
 * Silent background updates.
 *
 * The whole point is that she never learns this exists. Tauri's own example
 * prompts, shows a progress bar and offers to relaunch -- all of which are
 * written for developers. Here there is no dialog, no progress, no restart
 * prompt: the update is fetched quietly and takes effect the next time she opens
 * the app from the Dock, which she does anyway.
 *
 * Every failure is swallowed. An unreachable endpoint, a half-finished download,
 * a machine that went to sleep mid-transfer -- none of it may produce anything
 * she has to react to. The worst case is that she keeps running the version she
 * already has, which is exactly the situation without an updater at all.
 *
 * Because a bad release cannot be recalled from her house, the check is delayed
 * past launch so a broken update can never interfere with the app becoming
 * usable, and `relaunch()` is deliberately never called.
 */
import { useEffect, useRef } from "react";

/** Long enough that the scene is fully interactive first. */
const CHECK_DELAY_MS = 20_000;

export function useSilentUpdater(): void {
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const { check } = await import("@tauri-apps/plugin-updater");
          const update = await check();
          if (!update) return;

          // Downloads and stages the new version. It is applied on next launch;
          // relaunching under her would take the television away mid-song.
          await update.downloadAndInstall();

          if (import.meta.env.DEV) {
            console.info(`[updater] staged ${update.version}, applies on next launch`);
          }
        } catch (error) {
          // Deliberately silent. Not being on the latest version is never worth
          // interrupting a 90-year-old for.
          if (import.meta.env.DEV) console.warn("[updater]", error);
        }
      })();
    }, CHECK_DELAY_MS);

    return () => window.clearTimeout(timer);
  }, []);
}
