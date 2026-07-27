# Known limitations

Honest list of what is not done, what is deliberately out of scope, and what
still has to be proven on the actual target Mac.

---

## Not yet verified on real hardware

These cannot be tested from a Linux build container. They are the first things
to check on the target Mac, and they are the items most likely to need work.

1. **YouTube embeds inside the packaged WebView.** Verified working in Chromium
   against the dev server. The IFrame API behaves differently under Tauri's
   WKWebView with a CSP applied — this is the single highest-risk item and the
   build plan says to prove it before any polish.
2. **Bunny Stream embeds inside the packaged WebView.** Same caveat. The adapter
   is written against Bunny's Player.js postMessage protocol but has never
   spoken to a real Bunny library.
3. **J1 GOLD playback.** No verified stream URL yet (see below). The CSP guesses
   `*.j1fm.com`; once the real host is known it must be added to `media-src` and
   `connect-src` or the WebView will block it silently.
4. **Gatekeeper.** No Apple Developer ID yet, so nothing has been signed or
   notarized.
5. **Alignment in real full screen** at the target Mac's native resolution.
   Verified at 1512×982 and 1200×750 in a browser.

## Placeholder content

- All 15 video entries carry `REPLACE_WITH_*` identifiers. The build warns about
  each one and does not fail. An unfilled entry is treated at runtime exactly
  like an unavailable video: the Japanese "could not play" notice with a retry.
- Thumbnails and album photographs are generated stand-ins — warm cards carrying
  their own Japanese title. Dropping a real file at the same path replaces it.
- `radio.json` has a placeholder stream URL, so the radio currently goes to its
  error state on purpose.

## Design compromises

- **Queue card titles are small.** The queue recess in the artwork is 108 design
  pixels tall, which caps the title at 21 design pixels — about 16 CSS px at the
  1200×750 minimum window, below the spec's 20px floor. Mitigations: four cards
  instead of five so each is as wide as in the reference art, thumbnails do the
  primary recognition work, and the *playing* title is drawn large inside the
  television. Raising it further would mean redesigning the cabinet's queue
  drawer in the artwork.
- **The transport controls are invented.** The approved artwork has no
  play/previous/next/home buttons, so they are rendered as four brass plaques
  inlaid into the drawer beneath the sleeves. The "カテゴリ" plaque that was
  painted there is cleared by `scripts/clean-background.mjs`.
- **The radio power control is the amplifier's input selector.** Its painted
  labels read PHONO / TUNER / AUX, so "switch to the tuner" is a physically
  honest reading, and it avoids adding an object the artwork does not have.
- **The background is the reference render, cleaned.** The fake video still, the
  fake thumbnail cards and the drawer plaque are painted out; every other pixel
  is the original. A purpose-made clean render would look better in the cleared
  regions, which currently hold flat gradients.

## Deliberately out of scope for V1

Per `02-v1-scope.md`: no accounts, no backend, no database, no search, no
in-app playlists, no uploading, no Google Photos sync, no auto-update, no
offline copies, no picture-in-picture, no analytics, and one radio preset only.

Adding content means editing JSON and rebuilding. That is the intended model —
a remote manifest would add a failure mode that could leave her staring at an
empty cabinet.

## Smaller things

- **Volume knobs are app-level, not system-level.** The 音量 knob sets the
  player's volume; the other three amplifier knobs (バランス / 低音 / 高音) are
  decorative and do nothing.
- **YouTube's own volume is capped at 100 of its 0–100 scale**, so the knob
  cannot make a quiet upload louder.
- **No seek control.** Progress is displayed but the bar is not draggable. The
  spec asks for play/pause/next/previous/progress/volume; scrubbing was not
  requested and a draggable target that small conflicts with the 52px rule.
- **`enableFullScreenOnLaunch` is read but not yet acted on** — the window opens
  at 1512×945 and full screen is reached through the green traffic-light button
  or the standard macOS shortcut.
- **Album pages are shown two at a time**, so an odd number of pages leaves the
  right-hand sheet blank on the last spread.
- **The `favoriteByDefault` field is accepted by the schema but not yet applied**
  at first launch; favourites can only be set through the store's
  `toggleFavorite`, which no control currently calls. Favourites display
  correctly (a brass ✿ on the card) once set.
- **Progress polling for YouTube runs on a 500ms interval** rather than an event
  stream, because the IFrame API exposes no time-update event.

## The daily news reading

Built, but the least proven part of the app.

- **Never run end to end against the real APIs.** The RSS parser is verified
  against a live NHK feed, and the settings flow is verified in a browser, but
  no OpenAI key has ever been used. Model names (`gpt-4o-mini`, `tts-1`), the
  request shapes and the Japanese output quality are all unconfirmed.
- **Not testable in `npm run dev`.** The feed request goes through Tauri's Rust
  HTTP layer to sidestep CORS, which does not exist in a plain browser. Use
  `npm run tauri dev`.
- **The voice is a guess.** `shimmer` reading Japanese at 0.95 speed has not
  been heard by anyone. It may well need changing, and it is worth listening to
  a full clip before she does.
- **`cat0.xml` is NHK general news**, which routinely includes fires, accidents
  and deaths. Whether that is the right thing to read aloud to a 90-year-old
  living alone is a judgement call, not a technical one. A narrower category
  feed is a one-line change in `news.json`.
- **The generated script is shown in the settings panel** specifically so its
  accuracy can be checked against the headlines before she hears it. Worth doing
  a few times early on.
- **No retry.** If startup generation fails, it is not attempted again until the
  next launch. She still gets the most recent cached clip, correctly dated.
- **The PIN is a speed bump, not security.** Anyone with the Mac can read the
  key straight out of `localStorage`. The real control is the spend cap on the
  key, which is why the docs insist on it.

## What the news feature changed about the app's posture

Worth being explicit, because V1 deliberately had none of this:

- The app now makes **network requests at startup** rather than only when she
  chooses to play something.
- It now has **outbound HTTP permission**, scoped to three pinned hosts in
  `src-tauri/capabilities/default.json`.
- It still has **zero filesystem access** — audio is cached in IndexedDB
  specifically to avoid granting it.
