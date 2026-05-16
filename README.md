# Desktop Pet

A 3D low-poly cat that lives on your desktop. Wanders around, looks at your cursor, and spins (with the OIIA meme music) when you click it or type.

## Install

### macOS

Download `Desktop.Pet-1.0.0-arm64.dmg` from the [latest release](https://github.com/codmso/oiia-cat-desktop-pet/releases/latest), drag the app to **Applications**, then run this **once** in Terminal to clear the Gatekeeper quarantine flag:

```bash
xattr -cr "/Applications/Desktop Pet.app"
```

> Why? The app isn't notarized (Apple Developer Program costs $99/yr). Without that command, macOS shows a misleading "Desktop Pet is damaged" warning. The app is fine — `xattr` just removes the "downloaded from internet" flag.

### Windows

**Option A — Scoop (recommended, no warnings):**

```powershell
scoop bucket add codmso https://github.com/codmso/scoop-bucket
scoop install oiia-cat-desktop-pet
```

**Option B — Direct download:** Grab `Desktop.Pet.Setup.1.0.0.exe` (installer) or `Desktop.Pet.1.0.0.exe` (portable) from the [latest release](https://github.com/codmso/oiia-cat-desktop-pet/releases/latest). Windows SmartScreen will warn that the publisher is unknown — click **More info → Run anyway**.

### Build from source

```bash
npm install
npm start
```

## Behavior

- Frameless, transparent, always-on-top window that covers the desktop.
- Click-through everywhere *except* directly over the cat — your normal app interactions are unaffected.
- The cat idles, walks, sits, and yawns on its own.
- Hover: the cat turns its head toward your cursor.
- Click: spin animation + meme music. Big happiness boost.
- **Type anywhere on your computer**: the cat spins while you type. The faster you type, the faster the spin — and the music speeds up too (slow typing = slowed music, fast typing = normal speed). Spinning stops ~1s after your last keystroke.
- Drag: grab the cat and move it anywhere on screen.
- Mood: happiness slowly decays over time. Petting/clicking restores it. Sad cat looks desaturated and dim; happy cat is bright and saturated.

## Menu bar

Look for the 🐱 in your menu bar:
- **Toggle Pet** — hide/show
- **Mute Sound** — silence the meme music played on click
- **Quit** — exit

## macOS permissions

The first time you run the app, macOS will prompt you to grant **Input Monitoring** (and possibly **Accessibility**) permission so the cat can detect global keystrokes. Grant it in **System Settings → Privacy & Security**, then restart the app. Without it, typing-spin will be disabled but everything else still works.

The app has no Dock icon by design.

## Assets

- 3D model: `assets/cat/scene.gltf` (the "oiiaioooooiai_cat" GLTF model)
- Audio: `assets/spin.mp3` (oiia spinning cat meme)

## Notes

- Three.js is loaded from a CDN (unpkg) via an import map.
- `uiohook-napi` is required for global keystroke detection (the typing-spin feature).
- If you're offline, the CDN load will fail; vendor `three` locally if you need offline support.
