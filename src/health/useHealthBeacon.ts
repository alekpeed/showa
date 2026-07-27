/**
 * Sends the health beacon once per launch, in the background.
 *
 * Fire-and-forget, like the updater and the news generation: an unreachable
 * endpoint must never produce anything she has to react to, and must never
 * delay the scene becoming usable. If the send fails, the counters are kept and
 * roll into the next launch rather than being lost.
 *
 * With no endpoint configured, nothing is sent and nothing is stored beyond the
 * local counters -- so the whole feature is off by default until a URL is put in
 * the settings panel.
 */
import { useEffect, useRef } from "react";

import { japanDate } from "../news/newsCache";
import { useSettings } from "../state/settings";
import { buildPayload, markSent } from "./healthBeacon";

/** After the updater's check, so a cold launch does as little as possible. */
const SEND_DELAY_MS = 30_000;

async function post(url: string, body: unknown): Promise<Response> {
  try {
    const { fetch: tauriFetch } = await import("@tauri-apps/plugin-http");
    return await tauriFetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    return await globalThis.fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }
}

export function useHealthBeacon(appVersion: string): void {
  const startedRef = useRef(false);
  const endpoint = useSettings((s) => s.healthEndpoint);

  useEffect(() => {
    if (startedRef.current) return;
    const url = endpoint.trim();
    if (!url) return;
    startedRef.current = true;

    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const response = await post(url, buildPayload(appVersion, japanDate()));
          // Only clear the counters on a confirmed 2xx. A failed send keeps them
          // so a bad week still gets reported once the endpoint comes back.
          if (response.ok) markSent();
        } catch (error) {
          if (import.meta.env.DEV) console.warn("[health]", error);
        }
      })();
    }, SEND_DELAY_MS);

    return () => window.clearTimeout(timer);
  }, [appVersion, endpoint]);
}
