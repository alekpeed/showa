# Shipping an update to her Mac

The app checks for updates on its own and applies them silently. She never sees a
prompt, a progress bar or a restart request — a new version simply takes effect
the next time she opens the app from the Dock.

This document is the release procedure.

---

## One-time setup — do this before the first build you give her

> **The updater only works if it is compiled into the version she has.** It
> cannot be added remotely later. If the first DMG ships without it, the only
> route to her Mac is physical access, permanently.

### 1. Generate the updater signing keypair

This is **separate from Apple code signing** and serves a different purpose:
Apple's signature proves the app is safe to run, this one proves an update
actually came from you.

```bash
npm run tauri signer generate -- -w ~/.tauri/showa-updater.key
```

Two things come out: a private key at that path, and a public key printed to the
terminal.

> **Back the private key up somewhere you will still have in ten years.** Lose it
> and you can never publish another update to her machine — the app will refuse
> anything signed with a different key, by design. A password manager or an
> encrypted backup, not just this laptop.

### 2. Put the public key in the config

`src-tauri/tauri.conf.json` currently reads:

```json
"updater": {
  "pubkey": "REPLACE_WITH_UPDATER_PUBLIC_KEY",
  "endpoints": ["https://github.com/alekpeed/showa/releases/latest/download/latest.json"]
}
```

Replace the placeholder with the public key text. It is not a secret and belongs
in the repository.

Check the endpoint URL matches your repo. **The repository must be public**, or
GitHub's release download URLs will 404 for her machine — the app has no
credentials.

### 3. Set the signing key at build time

An environment variable, not a `.env` file:

```bash
export TAURI_SIGNING_PRIVATE_KEY="$(cat ~/.tauri/showa-updater.key)"
export TAURI_SIGNING_PRIVATE_KEY_PASSWORD=""   # only if you set one
```

---

## Releasing from GitHub Actions (the easy path)

`.github/workflows/release.yml` does the whole thing on a hosted Mac runner:
build, sign, notarize, generate `latest.json`, publish the release. You never
need to own or rent a Mac for a release.

### Repository secrets it needs

| Secret | What it is |
| --- | --- |
| `APPLE_CERTIFICATE` | Your Developer ID `.p12`, base64 encoded |
| `APPLE_CERTIFICATE_PASSWORD` | The password you set when exporting the `.p12` |
| `APPLE_SIGNING_IDENTITY` | `Developer ID Application: Your Name (TEAMID)` |
| `APPLE_ID` | Your Apple ID email |
| `APPLE_PASSWORD` | App-specific password (see SIGNING.md) |
| `APPLE_TEAM_ID` | Your 10-character Team ID |
| `TAURI_SIGNING_PRIVATE_KEY` | Contents of `~/.tauri/showa-updater.key` |
| `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` | Only if you set one; otherwise empty |

Export the certificate from Keychain Access (right-click the *private key* under
the certificate, Export, `.p12`), then:

```bash
base64 -i certificate.p12 | pbcopy
```

### Cutting a release

```bash
npm version patch --no-git-tag-version     # bumps package.json
# bump "version" in src-tauri/tauri.conf.json to match
git commit -am "Release 0.1.1"
git tag v0.1.1
git push --follow-tags
```

The workflow takes it from there. Watch the run; the final step verifies
`codesign`, `spctl` and `stapler` on the built bundle, so a signing problem
fails loudly rather than shipping.

Use **Run workflow** on the Actions tab to rehearse the pipeline without tagging.

---

## Releasing by hand

1. **Bump the version in both places** — `package.json` and
   `src-tauri/tauri.conf.json`. They must match, and it must be higher than what
   she is running or her app will ignore it.

2. **Build**, with both the Apple and the updater signing variables exported
   (see `docs/SIGNING.md` for the Apple half):

   ```bash
   set -a && source .env && set +a
   export TAURI_SIGNING_PRIVATE_KEY="$(cat ~/.tauri/showa-updater.key)"
   npm run tauri build
   ```

   Alongside the usual `.app` and `.dmg`, this now produces two extra files in
   `src-tauri/target/release/bundle/macos/`:

   ```
   Showa Video Cabinet.app.tar.gz
   Showa Video Cabinet.app.tar.gz.sig
   ```

3. **Write `latest.json`.** `npm run release:manifest` generates it from the
   built artifacts — it reads the version and pastes in the signature, which is
   the step most easily got wrong by hand.

4. **Create a GitHub release** and attach three files: the `.tar.gz`, the `.sig`,
   and `latest.json`. Tag it with the version.

5. **Verify from a machine that is not yours.** Install the *previous* version on
   a fresh macOS user account, launch it, wait a minute, quit, and launch again.
   It should now be the new version.

---

## Checking that nothing has rotted

`.github/workflows/canary.yml` runs `npm run check:links` every Monday and emails
you if anything has broken. It checks:

- every enabled YouTube id, via oEmbed — the same thing a player does, so it
  catches deletions, region locks and embedding being disabled *after* release
- every Bunny embed URL
- the radio stream host
- the news feed URL, in `feed` mode

Run it yourself any time with `npm run check:links`.

**It tells you nothing about her Mac.** It checks whether the current build's
dependencies still exist — not whether her machine took the update, not whether
she is using the app, not whether the API key still has credit. There is no
telemetry and deliberately so.

The only way to know how it is going for her is to ask her.

---

## What she experiences

Nothing. Twenty seconds after launch — well after the scene is interactive — the
app quietly asks GitHub whether there is a newer version. If there is, it
downloads in the background and stages it. The next time she opens the app, it is
the new one.

Every failure is silent by design: an unreachable endpoint, a dropped download, a
Mac that slept mid-transfer. The worst outcome is that she carries on using the
version she already has, which is exactly where she would be without an updater.

`relaunch()` is deliberately never called. Restarting the app under her would
take the television away mid-song.

---

## Risks worth respecting

**A bad release cannot be recalled.** Once she has downloaded it, there is no
remote rollback — you would have to publish a *higher* version containing the
fix, and wait for her to launch twice. Publishing a broken build is the one
mistake here that costs a visit.

So, before every release:

- Run it yourself for more than a minute.
- Check the television actually plays something.
- If you changed anything about the phone or the news, exercise both.

**Version numbers only go up.** There is no downgrade path. Publishing 0.3.0 by
mistake means the fix must be 0.3.1, not a re-release of 0.2.0.

**The endpoint has to stay alive.** If the repository is deleted or made private,
updates stop — silently. Nothing breaks for her, but you lose the channel.

---

## What this does *not* cover

Every release still gets signed and notarized (`docs/SIGNING.md`) — the GitHub
Actions workflow does that on a hosted Mac runner, so you do not need one
yourself, but Apple stays in the loop either way.

What no amount of automation covers: **the microphone.** A hosted or rented Mac
has no audio input, so the conversation phone cannot be functionally tested
anywhere except real hardware. Given the mic entitlement fails by notarizing
cleanly and then silently not working, that test belongs on her Mac at handover
— which is also the only moment the permission prompt can be accepted by you
rather than by her.
