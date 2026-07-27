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

Signing and notarization are covered in [`docs/SIGNING.md`](docs/SIGNING.md).

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
2. **Exactly one audible source at a time.** Video, radio and the news reading
   each take audio focus from the other two, and opening the album pauses all
   three. This is enforced in `src/state/store.ts`, not in the components.

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
| `npm run import:csv -- f.csv`  | spreadsheet → the three video manifests                    |
| `npm run clean:background`     | regenerate the scene background from the reference art     |
| `npm run generate:placeholders`| stand-in thumbnails for any entry that lacks a real one    |
| `npm run generate:icon`        | redraw the app icon source                                 |

## Privacy

No analytics, no telemetry, no external logging, no viewing history beyond an
optional local "last played". Photographs are bundled locally and never
uploaded.

Network traffic, in full:

- Video embeds and the radio stream — only after she chooses to play something.
- **If the daily news reading is configured:** two requests to the OpenAI API at
  app startup to build that day's clip. Nothing about her is sent — the request
  asks for public news and nothing else. Leave the API key unset and none of
  this happens.

The app is granted outbound HTTP to exactly three pinned hosts
(`src-tauri/capabilities/default.json`) and has no filesystem, shell, camera,
microphone, location or notification access at all.

## Known limitations

See [`docs/LIMITATIONS.md`](docs/LIMITATIONS.md).
