const { app, BrowserWindow, Tray, Menu, screen, nativeImage, ipcMain } = require('electron');
const path = require('path');

let win = null;
let tray = null;
let muted = false;
let uiohookStarted = false;

const ICON_PATH = path.join(__dirname, 'build', 'icon.png');

function createWindow() {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;

  win = new BrowserWindow({
    width,
    height,
    x: 0,
    y: 0,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    hasShadow: false,
    resizable: false,
    movable: false,
    skipTaskbar: true,
    focusable: true,
    fullscreenable: false,
    backgroundColor: '#00000000',
    icon: ICON_PATH,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: false });
  win.setAlwaysOnTop(true, 'screen-saver');
  win.setIgnoreMouseEvents(true, { forward: true });

  win.loadFile('index.html');

  ipcMain.on('set-ignore-mouse', (_e, ignore) => {
    if (!win) return;
    if (ignore) win.setIgnoreMouseEvents(true, { forward: true });
    else win.setIgnoreMouseEvents(false);
  });

  ipcMain.handle('get-muted', () => muted);
}

function startGlobalKeyHook() {
  try {
    const { uIOhook } = require('uiohook-napi');
    uIOhook.on('keydown', () => {
      if (win && !win.isDestroyed()) win.webContents.send('global-keystroke');
    });
    uIOhook.start();
    uiohookStarted = true;
  } catch (err) {
    console.error('Failed to start global key hook:', err);
    console.error('On macOS, grant Input Monitoring & Accessibility permission in System Settings → Privacy & Security.');
  }
}

function buildTrayMenu() {
  return Menu.buildFromTemplate([
    { label: 'Toggle Pet', click: () => { if (win.isVisible()) win.hide(); else win.show(); } },
    {
      label: 'Mute Sound',
      type: 'checkbox',
      checked: muted,
      click: (item) => {
        muted = item.checked;
        if (win && !win.isDestroyed()) win.webContents.send('set-muted', muted);
      },
    },
    { type: 'separator' },
    { label: 'Quit', role: 'quit' },
  ]);
}

function createTray() {
  let trayImg = nativeImage.createFromPath(ICON_PATH);
  if (!trayImg.isEmpty()) {
    trayImg = trayImg.resize({ width: 18, height: 18 });
  }
  tray = new Tray(trayImg.isEmpty() ? nativeImage.createEmpty() : trayImg);
  if (trayImg.isEmpty()) tray.setTitle('🐱');
  tray.setToolTip('Desktop Pet');
  tray.setContextMenu(buildTrayMenu());
}

app.whenReady().then(() => {
  if (app.dock) app.dock.hide();
  createWindow();
  createTray();
  startGlobalKeyHook();
});

app.on('window-all-closed', (e) => {
  e.preventDefault();
});

app.on('before-quit', () => {
  if (uiohookStarted) {
    try { require('uiohook-napi').uIOhook.stop(); } catch (_) {}
  }
});
