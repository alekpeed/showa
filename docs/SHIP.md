# Getting it shipped

The minimum set of things that must be done by hand, in dependency order. Each
one has a check at the end so you know it worked rather than assuming.

Total hands-on time is a few hours. The calendar time is set almost entirely by
Apple.

---

## 1. Apple Developer Program — start this first

Everything else waits on it, and it is the only step whose duration is not up to
you. Usually hours; occasionally days if they verify your identity.

1. <https://developer.apple.com/programs/> → Enroll. $99/year, individual is fine.
2. Once approved, note your **Team ID** at <https://developer.apple.com/account> →
   Membership. Ten characters, like `A1B2C3D4E5`.
3. Create the certificate. In Xcode: Settings → Accounts → add your Apple ID →
   select the team → **Manage Certificates…** → `+` → **Developer ID Application**.

   The type matters. Not "Apple Development", not "Mac App Distribution".

4. Create an app-specific password for notarization at <https://account.apple.com>
   → Sign-In and Security → App-Specific Passwords. Shown once; copy it.

**Check:**
```bash
security find-identity -v -p codesigning
```
You want a line reading `Developer ID Application: Your Name (TEAMID)`.

---

## 2. Updater keypair — irreversible, do before the first build

```bash
npm run tauri signer generate -- -w ~/.tauri/showa-updater.key
```

Paste the printed **public** key into `src-tauri/tauri.conf.json`, replacing
`REPLACE_WITH_UPDATER_PUBLIC_KEY`.

**Back the private key up somewhere that outlives this laptop.** A password
manager, an encrypted drive — not just `~/.tauri`. If it is lost, her machine
will never accept another update, by design.

**Check:** `npm run release:manifest` stops complaining about the placeholder.

---

## 3. Make the repository public

The updater fetches from a GitHub release URL and the app carries no
credentials. Private repo means every update 404s silently, forever.

Settings → General → Danger Zone → Change visibility.

**Check:** open the repo in a private browser window.

---

## 4. GitHub secrets

Settings → Secrets and variables → Actions. Add all eight from the table in
[`UPDATES.md`](UPDATES.md).

For the certificate:
```bash
# Keychain Access → find the certificate → right-click the private key under it
# → Export → .p12, set a password
base64 -i certificate.p12 | pbcopy     # paste as APPLE_CERTIFICATE
```

**Check:** Actions tab → Release → **Run workflow**. It builds without tagging,
and the last step verifies `codesign`, `spctl` and `stapler`.

---

## 5. The videos

The part that makes it a gift rather than a demo. Four or five real songs is
enough to ship.

For each one:

1. **Confirm it embeds.** Open `https://www.youtube.com/embed/VIDEO_ID`. If it
   says it cannot be played on other websites, the uploader disabled embedding
   and no amount of code will fix it. Find a different upload.
2. Put the id and titles into `src/content/showa-songs.json` (or
   `nostalgic-japan.json`). The id is the `v=` part of a watch URL.

Then, once:

```bash
npm run fetch:thumbnails    # each video's own still, cropped to 640x360
npm run validate:content
npm run check:links         # confirms every one actually still plays
```

For a large batch, put them in a spreadsheet and use
`npm run import:csv -- videos.csv` instead — it accepts pasted YouTube URLs and
extracts the ids itself.

**Check:** `npm run dev`, click a sleeve, click a card, watch it play.

---

## 6. The photographs

The most personal part, and the least technical.

1. Export as JPEG or WebP, long edge around 2400px, lowercase hyphenated names.
2. Drop them into `public/assets/photos/kyushu/` or `.../other-japan/`.
3. Either name them over the existing placeholder paths — in which case nothing
   else is needed — or add pages to `src/content/photo-album.json` with captions.

Captions are Japanese-first and short. Pages show two at a time, so an even
number reads best.

**Check:** `npm run validate:content`, then open the album in `npm run dev`.

---

## 7. J1 GOLD

The station's own listen page redirects to a stream that is already wired in:

```json
"streamUrl": "https://jenny.torontocast.com:2000/stream/J1GOLD"
```

**The stream is confirmed working.** Its host is allowed in `media-src` and
`connect-src`, so nothing further is needed to ship.

One check left, and it is worth doing: play it **inside the app** rather than in
a browser.

```bash
npm run tauri dev     # not npm run dev -- the CSP only applies in the real app
```

Turn the input selector on the amplifier. A CSP-blocked origin fails *silently* —
no error she would see, and none you would either without looking. That is the
only remaining way this can go wrong.

If the station ever moves, the hidden settings panel (⌃⇧⌥S) has a *Radio stream
override* that fixes it without a rebuild. A different host would still need
adding to the CSP.

Sources: [J1 Radio](https://www.j1fm.tokyo/) · [J1 GOLD player](https://www.j1fm.tokyo/player/j1gold/)

---

## 8. Bunny Stream — optional for shipping

Only needed for **your own footage**. The Showa songs and archival material stay
on YouTube; downloading and re-hosting those would be both a copyright problem
and a lot of work for no gain.

If you have no personal videos ready, set every entry in
`personal-videos.json` to `"enabled": false` and ship without that sleeve. Add it
in an update later.

Otherwise:

1. Sign up at <https://bunny.net> → **Stream** → Add Video Library. Pick a region
   near her.
2. Upload your videos through the dashboard.
3. From the library settings, copy the **Video Library ID** (a number).
4. For each video, copy its **GUID** from the video's page (a long
   `xxxxxxxx-xxxx-…` string).
5. Fill them into `src/content/personal-videos.json`:

```json
"bunnyLibraryId": "123456",
"bunnyVideoId": "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee"
```

`bunnyEmbedUrl` is derived from those two and can be omitted.

In the library's **Security** settings, leave token authentication **off** — the
app uses public embed URLs. Turning it on would require signed URLs the app
cannot generate.

> **Never put a Bunny API key in this project.** Playback needs only the embed
> URL. The management key must stay out of the bundle.

Thumbnails are not fetched automatically for Bunny items — save one per video to
`public/assets/thumbnails/personal/<id>.webp`, or leave the generated placeholder.

**Check:** `npm run check:links`, then play one in `npm run dev`.

---

## 9. Release

```bash
# bump BOTH files to the same version
npm version 0.1.0 --no-git-tag-version
# edit "version" in src-tauri/tauri.conf.json to match

git commit -am "Release 0.1.0"
git tag v0.1.0
git push --follow-tags
```

CI builds, signs, notarizes and publishes. Download the DMG from the release.

---

## 10. On her Mac — half an hour, at handover

Nothing above proves the app works on the machine it has to work on.

- [ ] Open the DMG, drag to Applications, **launch with no Gatekeeper warning**
- [ ] A video plays on the television
- [ ] Radio starts and stops
- [ ] The album opens and turns pages
- [ ] Paste the OpenAI key in the settings panel, hit *Generate today's reading*,
      and **listen to the whole clip** — including the last sentence
- [ ] Paste the health beacon URL if you deployed the monitor
- [ ] Right-click the Dock icon → Options → **Keep in Dock**
- [ ] Tell her about the beacon: "if it stops working, I'll see it and fix it"

The phone is off in this build, so the microphone is never requested and there is
no permission prompt to accept. When you turn it on later, that half-hour needs
repeating for the mic — accept that prompt yourself.

---

## What can wait

Everything else. The updater is in the first build, so the phone, more videos,
more photos, the news and the monitoring can all land later as a `git tag`.
