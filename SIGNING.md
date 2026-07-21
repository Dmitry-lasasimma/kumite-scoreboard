# macOS Code Signing & Notarization

## The problem

When a macOS app is **not** signed with an Apple "Developer ID" certificate and
notarized by Apple, macOS blocks it after download. On Apple Silicon (M1–M4) the
message is usually:

> "Kumite Scoreboard" is damaged and can't be opened. You should move it to the Trash.

Nothing is actually wrong with the app — macOS quarantines unsigned downloads and
refuses to launch them.

There are two independent layers:

- **Code signing** — proves the app comes from a known developer (needs a paid
  Apple Developer ID certificate).
- **Notarization** — Apple scans the signed app and "staples" an approval ticket
  so it opens with no warning on any Mac.

Both require an **Apple Developer Program** membership ($99/year). There is no way
to remove the warning for downloaded builds without it — this is Apple policy.

---

## Quick fix for an already-downloaded unsigned build

Run this once in Terminal (adjust the path if the app is elsewhere):

```bash
xattr -cr "/Applications/Kumite Scoreboard.app" && \
codesign --force --deep --sign - "/Applications/Kumite Scoreboard.app" && \
open "/Applications/Kumite Scoreboard.app"
```

- `xattr -cr` removes the quarantine flag.
- `codesign --sign -` applies a local **ad-hoc** signature (required for unsigned
  arm64 apps to launch at all).

This must be repeated for every new unsigned build you download.

---

## Proper fix: sign + notarize in CI

The project is already wired for this. Once you add the secrets below to the
GitHub repo, the **Build & Release** workflow signs and notarizes automatically.
Until then it builds unsigned (and CI keeps working).

### 1. Enroll in the Apple Developer Program

https://developer.apple.com/programs/ — $99/year.

### 2. Create a "Developer ID Application" certificate

In Xcode (*Settings → Accounts → Manage Certificates → + → Developer ID
Application*) or on the Apple Developer website. Then export it as a `.p12` file
with a password (Keychain Access → right-click the cert → Export).

### 3. Base64-encode the certificate

```bash
base64 -i Certificates.p12 | pbcopy   # copies the encoded value to clipboard
```

### 4. Create an app-specific password for notarization

At https://appleid.apple.com → Sign-In and Security → App-Specific Passwords.

### 5. Find your Team ID

https://developer.apple.com/account → Membership details (a 10-character string).

### 6. Add GitHub repo secrets

*Repo → Settings → Secrets and variables → Actions → New repository secret*:

| Secret name                   | Value                                            |
|-------------------------------|--------------------------------------------------|
| `MAC_CSC_LINK`                | the base64 string from step 3                    |
| `MAC_CSC_KEY_PASSWORD`        | the `.p12` export password from step 2           |
| `APPLE_ID`                    | your Apple ID email                              |
| `APPLE_APP_SPECIFIC_PASSWORD` | the app-specific password from step 4            |
| `APPLE_TEAM_ID`               | your 10-character Team ID from step 5            |

That's it. The next tagged build (`git tag v1.0.4 && git push --tags`) produces a
signed, notarized DMG that opens with no warnings.

---

## Building locally with signing

If you have the certificate installed in your login keychain:

```bash
export APPLE_ID="you@example.com"
export APPLE_APP_SPECIFIC_PASSWORD="xxxx-xxxx-xxxx-xxxx"
export APPLE_TEAM_ID="XXXXXXXXXX"
npm run build && npx electron-builder --mac --arm64 -c.mac.notarize=true
```

Without those variables, `npm run dist:mac` builds an unsigned DMG as before.

---

## Windows note

Windows shows a SmartScreen warning for the same reason (no code-signing
certificate). Fixing it needs an OV/EV code-signing certificate from a CA
(e.g. DigiCert, Sectigo). The DMG fix above is macOS-only.
