/**
 * Health beacon receiver, for Cloudflare Workers.
 *
 * Two jobs:
 *   POST /   receive a beacon from her Mac and store it
 *   GET  /   show the last few beacons, so you can glance at it
 *   cron     alert you when the machine has gone quiet, or errors are piling up
 *
 * The alert on *silence* is the point. A dashboard you have to remember to open
 * is one you will stop opening; being emailed when she has not launched the app
 * in ten days is what actually catches a problem she would never report.
 *
 * Deploy:
 *   npx wrangler kv namespace create SHOWA_HEALTH
 *   # put the returned id into wrangler.toml
 *   npx wrangler secret put ALERT_EMAIL_URL     # optional, see notify() below
 *   npx wrangler deploy
 *
 * Then paste the Worker URL into the app's hidden settings panel.
 */

/** Days of silence before it is treated as a problem rather than a quiet week. */
const SILENCE_DAYS = 10;

/** Failures in a single launch that are worth an alert on their own. */
const FAILURE_THRESHOLD = 3;

const KEY_LATEST = "latest";
const KEY_HISTORY = "history";
const HISTORY_LIMIT = 60;

const json = (body, status = 200) =>
  new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });

/**
 * Sends an alert. Deliberately generic: point ALERT_WEBHOOK at whatever you
 * already read -- a Slack/Discord webhook, an email relay, an ntfy topic. If it
 * is unset, alerts are recorded but not delivered, and the dashboard still shows
 * them.
 */
async function notify(env, subject, detail) {
  const record = { at: new Date().toISOString(), subject, detail };
  await env.SHOWA_HEALTH.put("last-alert", JSON.stringify(record));

  if (!env.ALERT_WEBHOOK) return;
  try {
    await fetch(env.ALERT_WEBHOOK, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: `${subject}\n${detail}` }),
    });
  } catch {
    // An alerting failure must not take the receiver down with it.
  }
}

async function readHistory(env) {
  const raw = await env.SHOWA_HEALTH.get(KEY_HISTORY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function receive(request, env) {
  let beacon;
  try {
    beacon = await request.json();
  } catch {
    return json({ error: "expected JSON" }, 400);
  }

  if (typeof beacon?.installId !== "string" || typeof beacon?.appVersion !== "string") {
    return json({ error: "missing installId or appVersion" }, 400);
  }

  const record = {
    receivedAt: new Date().toISOString(),
    installId: beacon.installId,
    appVersion: beacon.appVersion,
    platform: beacon.platform ?? "unknown",
    date: beacon.date ?? null,
    counters: beacon.counters ?? {},
  };

  await env.SHOWA_HEALTH.put(KEY_LATEST, JSON.stringify(record));

  const history = await readHistory(env);
  history.unshift(record);
  await env.SHOWA_HEALTH.put(KEY_HISTORY, JSON.stringify(history.slice(0, HISTORY_LIMIT)));

  // Failures in this launch are alerted immediately rather than waiting for the
  // nightly sweep -- a television that will not play is worth knowing today.
  const c = record.counters;
  const failures =
    (c.newsFailures ?? 0) + (c.radioFailures ?? 0) + (c.videoFailures ?? 0) + (c.phoneFailures ?? 0);
  if (failures >= FAILURE_THRESHOLD) {
    await notify(
      env,
      `Showa Video Cabinet: ${failures} failures on ${record.appVersion}`,
      `news ${c.newsFailures ?? 0}, radio ${c.radioFailures ?? 0}, ` +
        `video ${c.videoFailures ?? 0}, phone ${c.phoneFailures ?? 0}`,
    );
  }

  return json({ ok: true });
}

async function dashboard(env) {
  const latestRaw = await env.SHOWA_HEALTH.get(KEY_LATEST);
  const latest = latestRaw ? JSON.parse(latestRaw) : null;
  const history = await readHistory(env);

  const quietDays = latest
    ? Math.floor((Date.now() - Date.parse(latest.receivedAt)) / 86_400_000)
    : null;

  return json({
    status: !latest ? "no beacon yet" : quietDays >= SILENCE_DAYS ? "QUIET" : "ok",
    quietDays,
    silenceThresholdDays: SILENCE_DAYS,
    latest,
    // Enough to see whether use is tailing off, without any content.
    recent: history.slice(0, 20),
  });
}

async function sweep(env) {
  const latestRaw = await env.SHOWA_HEALTH.get(KEY_LATEST);
  if (!latestRaw) return;

  const latest = JSON.parse(latestRaw);
  const quietDays = Math.floor((Date.now() - Date.parse(latest.receivedAt)) / 86_400_000);
  if (quietDays < SILENCE_DAYS) return;

  // Once per silence, not once per day, or it becomes noise you learn to ignore.
  const alreadyRaw = await env.SHOWA_HEALTH.get("silence-alerted-for");
  if (alreadyRaw === latest.receivedAt) return;

  await notify(
    env,
    `Showa Video Cabinet: no sign of life for ${quietDays} days`,
    `Last beacon ${latest.receivedAt}, version ${latest.appVersion}. ` +
      `Could be a holiday or a shut laptop. Worth a phone call either way.`,
  );
  await env.SHOWA_HEALTH.put("silence-alerted-for", latest.receivedAt);
}

export default {
  async fetch(request, env) {
    const { pathname } = new URL(request.url);
    if (request.method === "POST" && pathname === "/") return receive(request, env);
    if (request.method === "GET" && pathname === "/") return dashboard(env);
    return json({ error: "not found" }, 404);
  },

  async scheduled(_event, env, ctx) {
    ctx.waitUntil(sweep(env));
  },
};
