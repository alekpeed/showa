# Health monitor

A Cloudflare Worker that receives the app's health beacon, keeps the last sixty,
and emails you when her Mac goes quiet or errors pile up.

## Deploy

```bash
cd monitor
npx wrangler kv namespace create SHOWA_HEALTH   # paste the id into wrangler.toml
npx wrangler secret put ALERT_WEBHOOK           # optional; see below
npx wrangler deploy
```

Then paste the Worker URL into the app's hidden settings panel (⌃⇧⌥S).

## Alerting

`ALERT_WEBHOOK` is deliberately generic — point it at whatever you already read:
a Slack or Discord incoming webhook, an [ntfy](https://ntfy.sh) topic, or an
email relay. It receives `{"text": "..."}`.

Leave it unset and alerts are still recorded; you just have to open the
dashboard to see them.

## Reading it

`GET` the Worker URL:

```json
{
  "status": "ok",
  "quietDays": 1,
  "latest": { "appVersion": "0.2.0", "counters": { "videosPlayed": 6, ... } },
  "recent": [ ... ]
}
```

`status: "QUIET"` means no beacon in ten days.

## What fires an alert

| Trigger | Meaning |
| --- | --- |
| 3+ failures in one launch | Something is broken *now* — sent immediately |
| 10 days without a beacon | Holiday, shut laptop, or she has stopped using it |

Ten days rather than three, so a week away does not cry wolf. The silence alert
fires once per silence, not daily, or it becomes noise you learn to ignore.

## What it will never contain

No video titles, no photographs, no anything said on the phone, no memory notes,
no durations. Counts and version numbers only. `installId` is a random UUID
generated on her machine, not derived from her or the hardware — it exists only
so a beacon from your test build is distinguishable from hers.
