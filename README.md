# Desktop Pet

A 3D low-poly cat that lives on your Mac desktop. Wanders around, looks at your cursor, and spins (with the OIIA meme music) when you click it.

## Setup

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
- **Type anywhere on your computer**: the cat spins while you type. The faster you type, the faster it spins. Spinning stops ~1s after your last keystroke. (Silent — only clicks play music.)
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
