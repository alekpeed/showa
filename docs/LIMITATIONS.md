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

## The silent updater

- **It only works if it is in the build she receives.** It cannot be added
  remotely afterwards. This is the one decision in the project with a genuine
  point of no return.
- **The updater signing key is unrecoverable.** Lose the private key and no
  further update will ever be accepted by her machine, by design. Back it up
  somewhere that survives this laptop.
- **`pubkey` is still `REPLACE_WITH_UPDATER_PUBLIC_KEY`.** Until a keypair is
  generated and pasted in, the updater is configured but inert.
  `npm run release:manifest` refuses to run while the placeholder is there.
- **Never exercised.** No release has been published and no update has ever been
  downloaded or applied. The endpoint URL assumes a *public*
  `alekpeed/showa` repository; if it is private, GitHub's download URLs 404 for
  her machine, silently, since the app carries no credentials.
- **A bad release cannot be recalled.** There is no remote rollback and no
  downgrade path — a broken build has to be followed by a *higher* version
  containing the fix, and she has to launch twice for it to take. This is the
  single mistake here that costs a visit.
- **No update ever prompts her, and `relaunch()` is deliberately never called.**
  A staged update applies on next launch. If a future change adds a restart
  prompt, that is a regression, not a feature.

## Deliberately out of scope for V1

Per `02-v1-scope.md`: no accounts, no backend, no database, no search, no
in-app playlists, no uploading, no Google Photos sync, no offline copies, no
picture-in-picture, no analytics, and one radio preset only.

Auto-update *was* on that exclusion list and is now in, deliberately: without
physical access to her Mac, shipping without it would have made every later fix
require a visit.

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
  against a live NHK feed, the request shapes are written against OpenAI's
  current published docs, and the settings flow is verified in a browser — but
  no OpenAI key has ever been used. Model names, the exact Responses-API
  response shape and the Japanese output quality are all unconfirmed.
- **`tts-1` has a hard expiry: 20 January 2027.** OpenAI deprecated the legacy
  audio model families on 20 July 2026 with removal on that date. On that day the
  news reading stops working, silently, until the model name is changed. With the
  silent updater in place this is now fixable remotely rather than requiring a
  visit — but only if the updater was in the build she received, and only if you
  notice. Nothing tells you. Migration notes are in docs/CONTENT.md. Put it in a
  calendar.
- **`searchModel` must support the `web_search` tool.** Pointing it at an
  ordinary chat model silently removes the grounding: the app would still work,
  and would read her invented news. Content validation catches only obviously
  wrong model names (a TTS or embedding model), not a plausible-but-non-search
  one. This is the sharpest edge in the codebase.
- **How often "no gentle news today" happens is unknown.** The model is told to
  return fewer items rather than pad, and to say so plainly if it finds nothing.
  Whether that means a short reading once a month or a useless one once a week
  will only be clear after a few weeks of real use.
- **Not testable in `npm run dev`.** The feed request goes through Tauri's Rust
  HTTP layer to sidestep CORS, which does not exist in a plain browser. Use
  `npm run tauri dev`.
- **The voice is a guess.** `shimmer` reading Japanese at 0.95 speed has not
  been heard by anyone. It may well need changing, and it is worth listening to
  a full clip before she does.
- **Tone filtering is the model's judgement, not a rule.** `web-search` mode
  asks for gentle news and lists what to exclude, but nothing structurally
  prevents a sad story slipping through — "heartwarming" and "bereavement" sit
  closer together than a prompt can always separate. `feed` mode has the
  opposite problem: NHK categories filter by subject, so even culture and
  entertainment carries obituaries.
- **The generated script is shown in the settings panel** specifically so its
  accuracy can be checked against the headlines before she hears it. Worth doing
  a few times early on.
- **No retry.** If startup generation fails, it is not attempted again until the
  next launch. She still gets the most recent cached clip, correctly dated.
- **Web search is billed per call** on top of tokens, so this costs cents per
  day rather than a fraction of one. Still only a few dollars a year at once
  daily, but it is roughly ten times `feed` mode. Verify against OpenAI's
  current pricing.
- **Citations are shown only in the settings panel**, since the reading reaches
  her as audio. Worth checking that this satisfies OpenAI's requirement that
  search citations be visible in the UI.
- **The PIN is a speed bump, not security.** Anyone with the Mac can read the
  key straight out of `localStorage`. The real control is the spend cap on the
  key, which is why the docs insist on it.

## The conversation phone

Built, never once connected. Everything below is unverified.

- **No call has ever been placed.** The WebRTC flow follows OpenAI's current
  published guide — ephemeral client secret, SDP offer to `/v1/realtime/calls`,
  semantic VAD over the data channel — but no key has been used, so the request
  shapes, the event names used to collect the transcript, and the model id
  (`gpt-realtime-2.1`) are all unconfirmed.
- **The microphone cannot be tested from here.** `getUserMedia`, the Hardened
  Runtime entitlement and the `NSMicrophoneUsageDescription` string are all
  configured but unexercised. If the entitlement is wrong the app still notarizes
  cleanly and the phone silently fails — a nasty combination.
- **Accept the mic permission during setup.** The first pick-up triggers a macOS
  dialog. She should never meet it.
- **Turn-taking is the thing most likely to be wrong.** Semantic VAD at `low`
  eagerness is the right starting point for someone who pauses mid-sentence, but
  whether it actually gives a 90-year-old enough room is an empirical question.
  Have a long, slow conversation with it before handing it over. If it cuts her
  off, that single setting is the dial.
- **The voice is unheard.** `marin` was taken from a documentation example. Try
  several on real Japanese.
- **Register is unproven.** The instructions ask for natural spoken Japanese and
  forbid assistant phrasing, but whether the result sounds like a person or like
  a translated help desk needs a native ear.
- **Memory quality is unproven.** The closing summary is written by a text model
  from the call transcript. It could retain something trivial, or miss the thing
  that mattered. Read the notes in the settings panel for the first week.
- **Input transcription config is a guess.** OpenAI's Realtime conversation guide
  does not document how to enable transcription of the user's own audio, so
  `session.audio.input.transcription = { model }` is the documented-pattern shape
  rather than a verified one. If it is wrong, her half of the call is never
  transcribed. That failure is guarded: a note is only written when at least one
  line of the transcript is hers, so a broken config produces *no* memory rather
  than confident notes about a conversation she never had. Symptom to watch for:
  "What it remembers" stays empty after real calls.
- **Cost is per minute, not per day.** Unlike the news, a long conversation is
  a real spend. If the key hits its cap mid-call everything stops, including the
  news the next morning. Consider a separate key, or a cap sized for talking.
- **The handset position is a placeholder.** There is no telephone in the
  approved artwork, so the object renders its own plate on the bare table
  between the album and the magazines. It needs a scene render with a real
  handset; when that arrives, the rectangle in `hotspots.ts` is the only change.
- **No reconnection.** If the connection drops mid-call the phone returns to
  its resting state and she has to pick it up again. There is no automatic
  retry, deliberately — a phone that redials itself would be stranger than one
  that hangs up.

## What the news feature and the phone changed about the app's posture

Worth being explicit, because V1 deliberately had none of this:

- The app now makes **network requests at startup** rather than only when she
  chooses to play something.
- It now has **outbound HTTP permission**, scoped to three pinned hosts in
  `src-tauri/capabilities/default.json`.
- It now has **microphone access**, used only while a call is open. Tracks are
  stopped on hang-up so the macOS recording indicator goes out; if that ever
  stays lit after she puts the handset down, that is a bug worth chasing
  immediately.
- **Her speech leaves the machine** during a call, and a summary of each call is
  retained locally. Both are visible and deletable in the settings panel. This
  is the largest privacy change in the project and should be a deliberate choice,
  not a default.
- It still has **zero filesystem access** — audio is cached in IndexedDB
  specifically to avoid granting it.
