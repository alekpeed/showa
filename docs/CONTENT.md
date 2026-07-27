# Maintenance guide — adding and changing content

Everything she sees is declared in JSON under `src/content/`. Adding content is
always: edit a JSON file, drop an image in `public/assets/`, rebuild.

After any change:

```bash
npm run validate:content
```

That fails the build on a duplicate id, a missing title, a missing source id, a
missing `sortOrder`, or a thumbnail/photo path that does not exist on disk.

---

## Where files go

Content paths in JSON are **web-absolute** and resolve against `public/`:

| JSON path                            | File on disk                                  |
| ------------------------------------ | --------------------------------------------- |
| `/assets/thumbnails/showa/x.webp`    | `public/assets/thumbnails/showa/x.webp`       |
| `/assets/photos/kyushu/y.webp`       | `public/assets/photos/kyushu/y.webp`          |

Dropping a real file at a placeholder's path replaces it. No JSON edit needed.

---

## Add a YouTube video

1. Confirm the video is embeddable — open
   `https://www.youtube.com/embed/VIDEO_ID` in a browser. If it says the video
   cannot be played on other websites, the uploader has disabled embedding and
   it **will not work in the app**. Pick a different upload.
2. Save a thumbnail as `public/assets/thumbnails/showa/<id>.webp`
   (640×360 or larger, 16:9). Leave the title out of the image — the app draws it.
3. Add an entry to `src/content/showa-songs.json` (or `nostalgic-japan.json`):

```json
{
  "id": "showa-example-song",
  "library": "showa-songs",
  "source": "youtube",
  "titleJa": "曲名",
  "titleEn": "Song Title",
  "artistJa": "歌手名",
  "year": 1978,
  "youtubeVideoId": "dQw4w9WgXcQ",
  "thumbnail": "/assets/thumbnails/showa/showa-example-song.webp",
  "durationSeconds": 215,
  "sortOrder": 70,
  "enabled": true
}
```

`sortOrder` controls queue order — leave gaps of 10 so items can be inserted
later without renumbering. Set `"enabled": false` to hide something without
deleting it.

## Add a Bunny Stream video (her grandson's own footage)

1. Upload to your Bunny Stream library.
2. Copy the **library id** and the **video GUID** from the Bunny dashboard.
3. Save a thumbnail to `public/assets/thumbnails/personal/<id>.webp`.
4. Add an entry to `src/content/personal-videos.json`:

```json
{
  "id": "personal-example",
  "library": "personal-videos",
  "source": "bunny",
  "titleJa": "動画のタイトル",
  "locationJa": "熊本県",
  "year": 2023,
  "bunnyLibraryId": "123456",
  "bunnyVideoId": "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
  "thumbnail": "/assets/thumbnails/personal/personal-example.webp",
  "sortOrder": 50,
  "enabled": true
}
```

`bunnyEmbedUrl` is optional — it is derived from the two ids if omitted.

> **Never put a Bunny API key in this project.** Playback uses public embed URLs
> only. The management API key must stay out of the app bundle.

## Import a whole spreadsheet at once

Export a sheet with the columns from `06-asset-manifest.md` section E, then:

```bash
npm run import:csv -- ~/Desktop/videos.csv
npm run validate:content
```

This **overwrites** all three video manifests, so once you start using the CSV,
keep it as the source of truth. YouTube URLs in any common form are accepted —
the video id is extracted automatically.

---

## Add photo album pages

1. Export the photographs as JPEG or WebP, long edge around 2400px, lowercase
   hyphenated filenames. Keep the originals backed up outside this project.
2. Put them in `public/assets/photos/kyushu/` or `public/assets/photos/other-japan/`.
3. Add a page to `src/content/photo-album.json`:

```json
{
  "id": "page-004",
  "pageNumber": 4,
  "layout": "collage",
  "titleJa": "秋の日",
  "noteJa": "祖母の家にて",
  "photos": [
    {
      "id": "photo-008",
      "src": "/assets/photos/kyushu/garden-autumn.webp",
      "captionJa": "庭のもみじ",
      "locationJa": "熊本県",
      "year": 2023,
      "rotationDegrees": -1.2
    }
  ]
}
```

- `layout`: `"collage"` (2 columns, an odd third photo spans the width),
  `"double"` (2 columns), `"single"` (one photo per page).
- `rotationDegrees` is the slight tilt of a photo pasted by hand. Keep it small
  — between about −2 and 2.
- Pages are shown two at a time, so an even number of pages reads best.
- Captions are Japanese-first and should be short.

---

## Change the radio station

Edit `src/content/radio.json`:

```json
{
  "id": "j1-gold",
  "name": "J1 GOLD",
  "streamUrl": "https://example-stream-host/j1gold",
  "enabled": true,
  "initialVolume": 0.55
}
```

The URL **must be https** — macOS blocks insecure media. It is not referenced
anywhere else in the code.

One extra step when the host changes: the stream's origin has to be allowed in
the Content Security Policy, or the WebView will block it silently. Edit
`src-tauri/tauri.conf.json` and add the host to both `media-src` and
`connect-src`. The current entries assume `*.j1fm.com`.

Set `"enabled": false` to hide the radio entirely.

---

## The hidden settings panel

Press **⌃⇧⌥S** (Control + Shift + Option + S), then enter the PIN. The PIN is
`settingsPin` in `app-config.json` — currently `1958`. Change it there.

She will never find this by accident: there is nothing in the scene that opens
it, and the chord is not one anyone hits by mistake. It is a lock against
wandering in, **not** a security boundary — anyone with the Mac can read
`localStorage` directly.

Two things live here rather than in JSON, both for the same reason: there is no
auto-update, so anything baked into the bundle costs a full rebuild,
notarization and reinstall on someone else's Mac to change.

| Setting | Why it is here |
| --- | --- |
| OpenAI API key | Never in the repo, never in the bundle. |
| Radio stream override | A dead stream URL becomes a one-minute fix. |

The panel also shows the generated news script and the source links behind it,
so you can read what she is about to hear and check it against what was
actually published.

---

## The daily news reading

The stack of magazines on the table plays a short spoken reading of the day's
gentle news from Japan — festivals, seasons, harvests, awards, animals, food,
long lives. Roughly 90 seconds.

### Setting it up

1. Create an OpenAI API key.
2. **Set a hard monthly spend limit on it** in the OpenAI dashboard. This is the
   control that matters: it turns a leaked key from an open-ended problem into a
   bounded one. See Cost below.
3. Open the settings panel (⌃⇧⌥S), paste the key, press **Save**.
4. Press **Generate today's reading now** to confirm it works end to end.

Without a key, the magazines are simply not shown — no dead control.

### How it behaves

- Generation runs **in the background at app startup**, not on a schedule. A
  scheduled job is no use on a Mac that is off most of the time.
- Nothing blocks. The scene is interactive immediately, and a failed search or a
  rate-limited API produces nothing she has to react to.
- The magazines always play the newest clip that already exists and **state
  which day it is from**. A two-day-old reading is never presented as today's.
- The last five days are cached in IndexedDB, then pruned.

### Configuring it

`src/content/news.json`:

```json
{
  "enabled": true,
  "mode": "web-search",
  "searchModel": "gpt-5.6",
  "speechModel": "tts-1",
  "voice": "shimmer",
  "maxHeadlines": 5,
  "regionHintJa": "九州",
  "feedUrl": "https://www3.nhk.or.jp/rss/news/cat2.xml",
  "feedNameJa": "NHKニュース　文化・エンタメ",
  "textModel": "gpt-4o-mini"
}
```

There are two modes.

#### `"web-search"` — the default

A search-enabled model is asked to go and find the day's genuinely gentle news
from Japan: festivals, seasonal flowers, harvests, awards, crafts, animals,
food, children, long lives, reunions. It is told explicitly to exclude
accidents, fires, disasters, crime, illness, death, war, political conflict and
scandal — and to return fewer items rather than pad the list on a quiet day.

This is the only way to filter by *tone*. RSS categories filter by subject, and
"culture" still carries obituaries.

`regionHintJa` asks it to favour Kyushu when the day offers something.

#### `"feed"` — the fallback

Reads a fixed RSS feed and rephrases the headlines. Cheaper, fully
deterministic, and already verified working against NHK. Flip `mode` to
`"feed"` if search proves unreliable or costly.

NHK's category feeds: `cat0` main, `cat1` society, `cat2` culture and
entertainment, `cat3` science and medicine, `cat4` politics, `cat5` economy,
`cat6` international, `cat7` sport. `cat2` is the gentlest of them, and is what
`feedUrl` points at.

Changing `feedUrl` to a different host **also** requires adding that host to
`src-tauri/capabilities/default.json`. `npm run validate:content` fails the
build if you forget — otherwise the request fails silently once packaged.

### The accuracy rule

The model is never allowed to invent news, and in `web-search` mode this is
enforced structurally rather than by asking nicely:

> **A response that comes back with no web citations is thrown away, not spoken.**

That matters because the failure it prevents is invisible. A model answering
from its own training data instead of live search will produce fluent, confident,
completely fictional Japanese news — real-sounding place names, real-sounding
numbers. She has no way to catch it and no reason to doubt it. Prompt wording
alone cannot guarantee a model actually searched; the presence of citations can.

If you change `searchModel`, **it must be a model that supports the `web_search`
tool.** Pointing it at an ordinary chat model removes the grounding entirely
while still appearing to work.

The settings panel lists the source links behind each reading next to the
script. Read the two against each other a few times early on: if a detail in the
reading is not in one of those pages, the prompt needs tightening.

### Cost

Web search calls are billed per call on top of tokens, so this mode costs
meaningfully more than a plain completion — on the order of cents per day rather
than a fraction of one. At once a day that is still a few dollars a year. Check
OpenAI's current pricing page, and keep a hard spend cap on the key.

`"feed"` mode is roughly ten times cheaper if that ever matters.

---

## Change app behaviour

`src/content/app-config.json`:

| Key                         | Effect                                              |
| --------------------------- | --------------------------------------------------- |
| `appNameJa` / `appNameEn`   | the app's name (also change `productName` in `tauri.conf.json`) |
| `defaultLibrary`            | which sleeve is selected on first launch            |
| `autoplayNext`              | play the next video when one finishes               |
| `pauseRadioWhenVideoStarts` | audio focus rule                                    |
| `pauseVideoWhenRadioStarts` | audio focus rule                                    |
| `homeStopsPlayback`         | whether Home also stops what is playing             |
| `showEnglishSubtitles`      | small English text under Japanese titles            |
| `enableFullScreenOnLaunch`  | open full screen                                    |

---

## Rebuild and reinstall after a content change

```bash
npm run validate:content
npm run tauri build
```

Then follow the notarization steps in [`SIGNING.md`](SIGNING.md) and give her
the new `.dmg`. Her favourites, volume settings and last library survive the
update — preferences live in `localStorage` under
`showa-video-cabinet.state.v1`, separate from the app bundle.
