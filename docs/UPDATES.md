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

## Releasing a new version

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

Signing and notarization still happen on your Mac for every release
(`docs/SIGNING.md`). The updater removes the need to physically reach her
machine; it does not remove Apple from the loop.
