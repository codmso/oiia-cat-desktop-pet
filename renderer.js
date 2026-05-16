import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const canvas = document.getElementById('c');
const audio = document.getElementById('spin-audio');

let W = window.innerWidth;
let H = window.innerHeight;

const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(W, H, false);
renderer.setClearColor(0x000000, 0);

const scene = new THREE.Scene();

// Orthographic camera in screen-pixel space; y=0 at bottom
const camera = new THREE.OrthographicCamera(0, W, H, 0, -2000, 2000);
camera.position.set(0, 0, 500);
camera.lookAt(0, 0, 0);

scene.add(new THREE.AmbientLight(0xffffff, 0.85));
const key = new THREE.DirectionalLight(0xffffff, 0.9);
key.position.set(200, 400, 300);
scene.add(key);

// Pivot we move around in screen space. Cat model is parented to this.
const pivot = new THREE.Group();
pivot.position.set(W * 0.5, 140, 0);
scene.add(pivot);

// Inner rig for facing direction (flip on X)
const facing = new THREE.Group();
pivot.add(facing);

// Bob group (for breathing / hop)
const bob = new THREE.Group();
facing.add(bob);

// State
const state = {
  cat: null,
  mixer: null,
  spinAction: null,
  bbox: new THREE.Box2(), // screen-space AABB for hit-testing
  catHalfWidth: 80,
  catHeight: 240,
  mode: 'idle',     // idle | walk | sit | yawn | spin
  modeUntil: 0,
  walkTarget: W * 0.5,
  facingDir: 1,     // +1 right, -1 left
  hover: false,
  dragging: false,
  dragOffset: { x: 0, y: 0 },
  movedDuringDrag: false,
  happiness: 1.0,   // 0..1
  cursor: { x: W / 2, y: H / 2 },
  muted: false,
  typing: {
    active: false,
    lastKey: 0,
    rate: 0,        // keys per second (EMA)
    endsAt: 0,
  },
};

// ---- Mute sync from main ----
window.pet.getMuted().then((m) => { state.muted = !!m; });
window.pet.onMutedChange((m) => {
  state.muted = !!m;
  if (state.muted) { try { audio.pause(); } catch (_) {} }
});

// ---- Global keystroke hook → typing spin ----
window.pet.onKeystroke(() => {
  const now = performance.now();
  const dt = state.typing.lastKey ? (now - state.typing.lastKey) / 1000 : 0.2;
  state.typing.lastKey = now;
  // instantaneous keys-per-sec, clamped
  const inst = dt > 0 ? Math.min(1 / dt, 20) : 10;
  // EMA so it ramps up/down smoothly
  state.typing.rate = state.typing.rate * 0.6 + inst * 0.4;
  state.typing.active = true;
  state.typing.endsAt = now + 1200; // stop ~1.2s after last keystroke
  bumpHappiness(0.005);
});

// ---- Load GLTF ----
const loader = new GLTFLoader();
loader.load('assets/cat/scene.gltf', (gltf) => {
  const cat = gltf.scene;

  // Fit to ~240px tall
  const box = new THREE.Box3().setFromObject(cat);
  const size = new THREE.Vector3();
  box.getSize(size);
  const targetH = 240;
  const scale = targetH / size.y;
  cat.scale.setScalar(scale);

  // Recompute and center: place feet at y=0, center x
  const box2 = new THREE.Box3().setFromObject(cat);
  const center = new THREE.Vector3();
  box2.getCenter(center);
  cat.position.x -= center.x;
  cat.position.y -= box2.min.y;
  cat.position.z -= center.z;

  state.catHalfWidth = (box2.max.x - box2.min.x) / 2 + 12;
  state.catHeight = box2.max.y - box2.min.y;

  cat.traverse((o) => {
    if (o.isMesh) {
      o.material.transparent = false;
      // Save base color for mood desaturation
      if (o.material.color) {
        o.userData.baseColor = o.material.color.clone();
      }
    }
  });

  bob.add(cat);
  state.cat = cat;

  // Animations (spin)
  if (gltf.animations && gltf.animations.length) {
    state.mixer = new THREE.AnimationMixer(cat);
    state.spinAction = state.mixer.clipAction(gltf.animations[0]);
    state.spinAction.setLoop(THREE.LoopRepeat);
    state.spinAction.timeScale = 1.0;
    state.spinAction.enabled = false;
  }

  scheduleNextMode(0);
});

// ---- AI: random mode scheduling ----
function scheduleNextMode(now) {
  if (state.mode === 'spin') return; // spin handles its own exit
  const r = Math.random();
  if (r < 0.45) {
    state.mode = 'idle';
    state.modeUntil = now + 2000 + Math.random() * 3000;
  } else if (r < 0.8) {
    state.mode = 'walk';
    state.walkTarget = 60 + Math.random() * (W - 120);
    state.facingDir = state.walkTarget < pivot.position.x ? -1 : 1;
    state.modeUntil = now + 6000 + Math.random() * 4000;
  } else if (r < 0.92) {
    state.mode = 'sit';
    state.modeUntil = now + 2500 + Math.random() * 2500;
  } else {
    state.mode = 'yawn';
    state.modeUntil = now + 1200 + Math.random() * 800;
  }
}

// ---- Input handling ----
window.addEventListener('mousemove', (e) => {
  state.cursor.x = e.clientX;
  state.cursor.y = e.clientY;

  if (state.dragging) {
    pivot.position.x = clamp(e.clientX - state.dragOffset.x, 60, W - 60);
    pivot.position.y = clamp((H - e.clientY) - state.dragOffset.y, 20, H - state.catHeight);
    state.movedDuringDrag = true;
    return;
  }

  updateHoverState();
});

window.addEventListener('mousedown', (e) => {
  if (!state.hover) return;
  state.dragging = true;
  state.movedDuringDrag = false;
  state.dragOffset.x = e.clientX - pivot.position.x;
  state.dragOffset.y = (H - e.clientY) - pivot.position.y;
  state.mode = 'idle';
  state.modeUntil = performance.now() + 1500;
});

window.addEventListener('mouseup', () => {
  if (!state.dragging) return;
  state.dragging = false;
  if (!state.movedDuringDrag) {
    // It was a click → spin + pet
    triggerSpin();
  } else {
    // dragging counts as petting
    bumpHappiness(0.05);
  }
});

function updateHoverState() {
  // screen-space hit test against pivot in pixel coords
  // pivot.position.x is screen x; pivot.position.y is from bottom
  const sx = pivot.position.x;
  const syFromBottom = pivot.position.y;
  const syFromTop = H - syFromBottom;
  const left = sx - state.catHalfWidth;
  const right = sx + state.catHalfWidth;
  const top = syFromTop - state.catHeight;
  const bottom = syFromTop + 10;
  const over =
    state.cursor.x >= left &&
    state.cursor.x <= right &&
    state.cursor.y >= top &&
    state.cursor.y <= bottom;

  if (over !== state.hover) {
    state.hover = over;
    window.pet.setIgnoreMouse(!over);
  }
}

// ---- Actions ----
function triggerSpin() {
  if (!state.spinAction) return;
  state.mode = 'spin';
  state.modeUntil = performance.now() + 3200;
  state.spinAction.reset();
  state.spinAction.enabled = true;
  state.spinAction.play();
  if (!state.muted) {
    try {
      audio.loop = false;
      audio.playbackRate = 1.0;
      audio.currentTime = 0;
      audio.play().catch(() => {});
    } catch (_) {}
  }
  bumpHappiness(0.25);
}

function bumpHappiness(d) {
  state.happiness = clamp(state.happiness + d, 0, 1);
  applyMood();
}

function applyMood() {
  // CSS filter for cheap, expressive mood effect
  const h = state.happiness;
  const sat = 0.35 + 0.95 * h;       // 0.35..1.3
  const bright = 0.85 + 0.25 * h;    // 0.85..1.10
  canvas.style.filter = `saturate(${sat}) brightness(${bright})`;
}

// ---- Animation loop ----
const clock = new THREE.Clock();
let lastHappinessDecay = performance.now();

function tick() {
  const now = performance.now();
  const dt = clock.getDelta();

  // Happiness decay (~ -0.01 per second)
  if (now - lastHappinessDecay > 1000) {
    lastHappinessDecay = now;
    state.happiness = Math.max(0, state.happiness - 0.01);
    applyMood();
  }

  // Typing-driven spin overrides normal AI (except when mid click-spin)
  if (state.typing.active && state.mode !== 'spin' && state.spinAction) {
    // Map rate (keys/sec, ~0..10) → timeScale (0.6..4.5), more responsive curve
    const ts = clamp(0.6 + state.typing.rate * 0.5, 0.6, 4.5);
    state.spinAction.timeScale = ts;
    if (!state.spinAction.isRunning()) {
      state.spinAction.reset();
      state.spinAction.enabled = true;
      state.spinAction.play();
    }
    if (!state.muted) {
      try {
        if (audio.paused) {
          audio.loop = true;
          audio.currentTime = 0;
          audio.play().catch(() => {});
        }
        // Slow typing → slower music; fast typing caps at normal (1.0×) speed
        audio.playbackRate = clamp(0.5 + state.typing.rate * 0.1, 0.5, 1.0);
      } catch (_) {}
    }
    bob.position.y = 0;
    bob.scale.set(1, 1, 1);
    if (now >= state.typing.endsAt) {
      state.typing.active = false;
      state.typing.rate = 0;
      state.spinAction.stop();
      state.spinAction.enabled = false;
      state.spinAction.timeScale = 1.0;
      try {
        audio.pause();
        audio.loop = false;
        audio.playbackRate = 1.0;
      } catch (_) {}
      scheduleNextMode(now);
    }
  } else {
    // Rate decays even if no keystrokes arrive
    state.typing.rate *= 0.985;
  }

  if (state.mixer) state.mixer.update(dt);

  // Mode behavior
  if (state.mode === 'walk') {
    const dx = state.walkTarget - pivot.position.x;
    const dir = Math.sign(dx);
    state.facingDir = dir || state.facingDir;
    const speed = 60 * dt; // px/sec
    if (Math.abs(dx) > 2) {
      pivot.position.x += dir * Math.min(Math.abs(dx), speed);
      // little step bounce
      bob.position.y = Math.abs(Math.sin(now / 120)) * 6;
    } else {
      bob.position.y = 0;
    }
    if (now >= state.modeUntil || Math.abs(dx) < 2) scheduleNextMode(now);
  } else if (state.mode === 'idle') {
    // gentle breathing
    bob.position.y = Math.sin(now / 700) * 2.5;
    bob.scale.set(1, 1 + Math.sin(now / 700) * 0.015, 1);
    if (now >= state.modeUntil) scheduleNextMode(now);
  } else if (state.mode === 'sit') {
    bob.position.y = 0;
    bob.scale.set(1, 0.95, 1);
    if (now >= state.modeUntil) {
      bob.scale.set(1, 1, 1);
      scheduleNextMode(now);
    }
  } else if (state.mode === 'yawn') {
    const t = 1 - (state.modeUntil - now) / 2000;
    bob.scale.set(1, 1 + Math.sin(Math.min(1, t) * Math.PI) * 0.08, 1);
    if (now >= state.modeUntil) {
      bob.scale.set(1, 1, 1);
      scheduleNextMode(now);
    }
  } else if (state.mode === 'spin') {
    if (now >= state.modeUntil) {
      state.spinAction.stop();
      state.spinAction.enabled = false;
      try { audio.pause(); } catch (_) {}
      scheduleNextMode(now);
    }
  }

  // Facing flip
  const targetScaleX = state.facingDir >= 0 ? 1 : -1;
  facing.scale.x += (targetScaleX - facing.scale.x) * Math.min(1, dt * 8);

  // Look-at-cursor when hovering (subtle yaw)
  if (state.cat && state.mode !== 'spin') {
    const dx = state.cursor.x - pivot.position.x;
    const target = state.hover ? clamp(dx / 200, -0.6, 0.6) : 0;
    state.cat.rotation.y += (target - state.cat.rotation.y) * Math.min(1, dt * 4);
  }

  // Keep the click-through state honest even when cat moves
  updateHoverState();

  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}
tick();
applyMood();

window.addEventListener('resize', () => {
  W = window.innerWidth;
  H = window.innerHeight;
  renderer.setSize(W, H, false);
  camera.left = 0; camera.right = W; camera.top = H; camera.bottom = 0;
  camera.updateProjectionMatrix();
});

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
