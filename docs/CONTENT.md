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
