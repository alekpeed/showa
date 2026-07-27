# Signing, notarizing and installing

The app is distributed privately as a signed and notarized `.dmg`, outside the
Mac App Store. Without notarization, macOS shows a Gatekeeper warning that a
90-year-old should never have to reason about — so this step is not optional.

Everything here runs **on a Mac**. A Linux or Windows machine cannot produce or
notarize a macOS bundle.

---

## One-time setup

### 1. Apple Developer Program

Enrol at <https://developer.apple.com/programs/> ($99/year). An individual
account is enough — no company is required.

Note your **Team ID**: <https://developer.apple.com/account> → Membership.
It is a 10-character string like `A1B2C3D4E5`.

### 2. Developer ID Application certificate

The certificate type matters. **Developer ID Application** is the one for apps
distributed outside the App Store — not "Apple Development", not "Mac App
Distribution".

Easiest path, in Xcode:

1. Xcode → Settings → Accounts → add your Apple ID.
2. Select the team → **Manage Certificates…**
3. `+` → **Developer ID Application**.

Confirm it landed in the login keychain:

```bash
security find-identity -v -p codesigning
```

You want a line reading `Developer ID Application: Your Name (TEAMID)`. Copy that
full string — it is your signing identity.

### 3. App-specific password for notarization

Notarization authenticates separately from signing.

1. <https://account.apple.com> → Sign-In and Security → App-Specific Passwords.
2. Generate one, name it something like `showa-notarize`.
3. Copy it — it is shown only once. Format is `abcd-efgh-ijkl-mnop`.

### 4. Fill in `.env`

```bash
cp .env.example .env
```

```bash
APPLE_SIGNING_IDENTITY="Developer ID Application: Your Name (A1B2C3D4E5)"
APPLE_ID="you@example.com"
APPLE_PASSWORD="abcd-efgh-ijkl-mnop"
APPLE_TEAM_ID="A1B2C3D4E5"
```

`.env` is gitignored. **Never commit it**, and never commit the certificate's
private key or its export password.

### 5. Set the bundle identifier

`src-tauri/tauri.conf.json` ships with the placeholder
`com.alek.showavideocabinet`. Change it to a reverse-domain identifier you
control if you prefer, then keep it stable forever — changing it later makes
macOS treat the app as a different application.

---

## Building the signed DMG

```bash
set -a && source .env && set +a
npm run tauri build
```

Tauri signs with Hardened Runtime and a secure timestamp (both already
configured in `tauri.conf.json`), then submits to Apple's notary service and
staples the ticket. The notarization round trip usually takes 2–15 minutes.

Output:

```
src-tauri/target/release/bundle/macos/Showa Video Cabinet.app
src-tauri/target/release/bundle/dmg/Showa Video Cabinet_0.1.0_aarch64.dmg
```

### Which architecture

`aarch64` (Apple Silicon) is the default and is right for any Mac from 2020
onwards. If her Mac is Intel, or you don't know:

```bash
npm run tauri build -- --target universal-apple-darwin
```

Check hers with `uname -m` — `arm64` means Apple Silicon, `x86_64` means Intel.

---

## Verifying before you hand it over

```bash
APP="src-tauri/target/release/bundle/macos/Showa Video Cabinet.app"

# Signature is valid and satisfies the Developer ID requirement
codesign --verify --deep --strict --verbose=2 "$APP"

# Gatekeeper accepts it
spctl --assess --type execute --verbose "$APP"     # expect: accepted, source=Notarized Developer ID

# The notarization ticket is stapled (works offline)
xcrun stapler validate "$APP"

# And on the DMG itself
xcrun stapler validate "src-tauri/target/release/bundle/dmg/Showa Video Cabinet_0.1.0_aarch64.dmg"
```

If `spctl` says `rejected`, the app was signed but not notarized — check the
notarization log:

```bash
xcrun notarytool history --apple-id "$APPLE_ID" --team-id "$APPLE_TEAM_ID" --password "$APPLE_PASSWORD"
xcrun notarytool log <submission-id> --apple-id "$APPLE_ID" --team-id "$APPLE_TEAM_ID" --password "$APPLE_PASSWORD"
```

**Test on a machine that has never seen the app** — a fresh macOS user account
is enough. Your own Mac trusts things it built locally, so it will happily launch
a bundle that would be blocked on hers.

---

## Installing on her Mac

1. Open the `.dmg`.
2. Drag **Showa Video Cabinet** to Applications.
3. Eject the disk image.
4. Open it once from Applications to confirm no warning appears.
5. Right-click the Dock icon → Options → **Keep in Dock**.

Do this yourself before giving her the machine, so her first interaction is the
cabinet and not an installer.

---

## Updating later

There is no auto-update. To ship a new version:

1. Bump `version` in both `package.json` and `src-tauri/tauri.conf.json`.
2. `npm run tauri build`
3. Verify as above.
4. Drag the new app to Applications, replacing the old one.

Her preferences (favourites, volumes, last library) live in the WebView's
`localStorage`, not the app bundle, so they survive the replacement.

---

## Things that commonly go wrong

| Symptom | Cause |
| --- | --- |
| `errSecInternalComponent` while signing | The signing identity is not in the login keychain, or the keychain is locked. Unlock it and re-run. |
| Notarization rejected, "not signed with a valid Developer ID" | Wrong certificate type — you have "Apple Development", not "Developer ID Application". |
| App launches but the television stays black | A CSP origin is missing. See the CSP block in `src-tauri/tauri.conf.json`. |
| Radio never connects in the packaged app but works in `npm run dev` | The stream host is not in `media-src`/`connect-src`. The dev server has no CSP; the packaged app does. |
| Works on your Mac, blocked on hers | You tested on the machine that built it. Retest in a fresh user account. |
