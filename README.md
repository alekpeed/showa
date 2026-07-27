# 昭和ビデオ・キャビネット — Showa Video Cabinet

A private macOS media app built as a gift: Showa-era songs, nostalgic footage of
Japan, personal videos filmed in Kyushu, a photo album, and a Japanese oldies
radio station — presented as a warm wooden entertainment cabinet rather than as
software.

The physical objects **are** the interface. There is no sidebar, no settings
page, no login, no browser and no file system. She clicks a media sleeve, clicks
a picture, and it plays on the television.

---

## Requirements

| Tool         | Version used            | Notes                                     |
| ------------ | ----------------------- | ----------------------------------------- |
| Node.js      | 22.22.2                 | 20.19+ or 22.12+ required by Vite 7        |
| npm          | 10.9.7                  |                                            |
| Rust         | 1.94.1                  | 1.77.2 minimum (Tauri 2)                   |
| Tauri CLI    | 2.x (`@tauri-apps/cli`) | installed as a dev dependency              |
| Xcode CLT    | any current             | macOS only, needed for the native build    |

## Setup

```bash
npm install
npm run dev          # browser preview at http://localhost:1420
npm run tauri dev    # the real desktop app
```

### Trying it without installing anything

`.github/workflows/pages.yml` publishes the scene to GitHub Pages on every push,
so it can be opened in any browser on any machine. Enable it once under
**Settings → Pages → Source: GitHub Actions**.

The scene, all three sleeves, video playback, the photo album, the queue, the
keyboard shortcuts and the radio all work there. The daily news reading and the
conversation phone do not and cannot: both route HTTP through Tauri's Rust layer
to sidestep CORS, which does not exist in a browser. They are no-ops in the
preview rather than errors.

## Build

```bash
npm run build            # validate content, typecheck, bundle the frontend
npm run tauri build      # produces the .app and .dmg (macOS only)
```

Output lands in `src-tauri/target/release/bundle/`:

```
macos/Showa Video Cabinet.app
dmg/Showa Video Cabinet_0.1.0_aarch64.dmg
```

**Getting it shipped for the first time:** [`docs/SHIP.md`](docs/SHIP.md) — the
minimum set of by-hand steps, in dependency order, each with a check.

Signing and notarization are covered in [`docs/SIGNING.md`](docs/SIGNING.md).
Shipping an update to a Mac you cannot reach is covered in
[`docs/UPDATES.md`](docs/UPDATES.md) — **read that before the first build you
give her**, because the updater has to be compiled into the version she has.

---

## How it works

The approved artwork is the background. Live interactive overlays are positioned
on top of it in a fixed **1586 × 992** design coordinate system, converted to
percentages in exactly one place, so everything stays welded to the painting as
the window scales. The canvas letterboxes rather than distorting.

```
src/
  scene/
    designSystem.ts     the only place design pixels become CSS
    hotspots.ts         every interactive region, measured off the artwork
    SceneCanvas.tsx     the fixed 16:10 canvas
  components/           television, sleeves, queue, transport, radio, album
  player/
    usePlayerController.ts  one adapter alive at a time
    YouTubeAdapter.ts       YouTube IFrame Player API
    BunnyAdapter.ts         Bunny Stream embed over postMessage
  radio/useRadio.ts     J1 GOLD via a single HTMLAudioElement
  news/                 the daily gentle-news reading
    newsService.ts      web search -> spoken Japanese -> audio
    newsCache.ts        IndexedDB, so the app needs no filesystem access
  phone/                the conversation phone (Realtime API over WebRTC)
    companionPrompt.ts  an interlocutor, not an assistant
    companionMemory.ts  short notes carried between calls
  update/               silent background updates, no prompt she could see
  health/               the beacon: version and counts, never content
  content/              JSON manifests + Zod schemas
  state/store.ts        app state and the audio-focus rules
public/assets/          thumbnails and photographs (referenced by JSON path)
src-tauri/              the native shell
scripts/                content and asset tooling
```

### Two rules worth knowing before editing

1. **No absolute coordinate lives outside `hotspots.ts`.** If an overlay drifts
   off its painted object, that file and `scripts/clean-background.mjs` are the
   only two places to change.
2. **Exactly one audible source at a time.** Video, radio, the news reading and
   the phone each take audio focus from the others, and opening the album pauses
   all of them. Enforced in `src/state/store.ts`, not in the components.

### Keyboard

| Key     | Action                                            |
| ------- | ------------------------------------------------- |
| `Space` | play / pause                                      |
| `←` `→` | previous / next video, or turn the album page     |
| `H`     | Home                                              |
| `Esc`   | close the album, or leave full screen             |
| `⇧D`    | outline every hotspot (development builds only)   |
| `⌃⇧⌥S`  | open the hidden settings panel (then a PIN)       |

---

## Content

All content is static JSON in `src/content/`. Nothing is fetched at startup and
nothing is scraped at runtime.

See [`docs/CONTENT.md`](docs/CONTENT.md) for how to add a video, add album pages,
change the radio station, or set up the daily news reading.

The manifests currently ship with **placeholder entries** — realistic titles with
`REPLACE_WITH_*` identifiers, and generated stand-in thumbnails, so the cabinet
looks and behaves correctly before the real media arrives. `npm run build` warns
about each unfilled entry but does not fail.

## Scripts

| Command                        | What it does                                              |
| ------------------------------ | --------------------------------------------------------- |
| `npm run validate:content`     | schema, duplicate ids, missing asset files                 |
| `npm run import:urls -- f.txt` | a list of YouTube links → a library manifest                |
| `npm run import:csv -- f.csv`  | spreadsheet → the three video manifests                    |
| `npm run import:bunny`         | read a Bunny library → personal-videos.json                |
| `npm run clean:background`     | regenerate the scene background from the reference art     |
| `npm run generate:placeholders`| stand-in thumbnails for any entry that lacks a real one    |
| `npm run fetch:thumbnails`     | pull each YouTube video's own still, cropped to 640×360     |
| `npm run generate:icon`        | redraw the app icon source                                 |
| `npm run release:manifest`     | build `latest.json` for a release from the built artifacts  |
| `npm run check:links`          | verify every YouTube id, embed, stream and feed still works |

Deploying the health monitor is covered in [`monitor/README.md`](monitor/README.md).

## Privacy

No analytics, no third-party tracking, no external logging service, no viewing
history beyond an optional local "last played". Photographs are bundled locally
and never uploaded.

There **is** a health beacon, and it is off unless a URL is configured. It exists
for one reason: she will never report a fault, so without it a break in March
gets noticed in September. It carries app version, timestamp, and counts of what
worked and what failed. It carries **no titles, nothing said on the phone, no
memory notes, no durations, and nothing about what she watched.** The exact
payload is visible in the settings panel under *What would be sent right now*.
See `monitor/`.

Network traffic, in full:

- Video embeds and the radio stream — only after she chooses to play something.
- **If the daily news reading is configured:** two requests to the OpenAI API at
  app startup to build that day's clip. Nothing about her is sent — the request
  asks for public news and nothing else.
- **If the conversation phone is used:** her speech goes to the OpenAI Realtime
  API for the duration of a call, and a short summary of each call is stored
  locally and sent back at the start of the next one. Readable and deletable in
  the settings panel.

- **If a health beacon URL is configured:** one small POST 30 seconds after
  launch, to an endpoint you host.

Leave the API key and the beacon URL unset and none of that happens at all.

The app is granted outbound HTTP to five pinned hosts
(`src-tauri/capabilities/default.json`) — the news feed, the OpenAI API, and the
two GitHub hosts the silent updater fetches from — plus the microphone, used only
while a call is open — the tracks are stopped on hang-up so the macOS recording
indicator goes out. No filesystem, shell, camera, location or notification
access at all.

## Known limitations

See [`docs/LIMITATIONS.md`](docs/LIMITATIONS.md).
