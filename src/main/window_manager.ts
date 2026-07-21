import { BrowserWindow, screen } from 'electron';
import path from 'path';

let operator_window: BrowserWindow | null = null;
let spectator_window: BrowserWindow | null = null;
let splash_window: BrowserWindow | null = null;

const is_dev = process.env.NODE_ENV !== 'production' || !require('electron').app.isPackaged;

const APP_ICON = path.join(__dirname, '../renderer/icon.png');

/**
 * Create the frameless splash window that plays the intro video on launch.
 * @returns The splash BrowserWindow instance.
 */
export function create_splash_window(): BrowserWindow {
  splash_window = new BrowserWindow({
    width: 640,
    height: 360,
    frame: false,
    transparent: true,
    resizable: false,
    movable: false,
    center: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    icon: APP_ICON,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (is_dev) {
    splash_window.loadURL('http://localhost:3000/splash.html');
  } else {
    splash_window.loadFile(path.join(__dirname, '../renderer/splash.html'));
  }

  splash_window.on('closed', () => { splash_window = null; });
  return splash_window;
}

/**
 * Get the current splash window instance, if any.
 * @returns The splash BrowserWindow or null.
 */
export function get_splash_window(): BrowserWindow | null {
  return splash_window;
}

/**
 * Create the main operator window.
 * @param show Whether to show the window immediately (false lets it preload behind the splash).
 * @returns The operator BrowserWindow instance.
 */
export function create_operator_window(show: boolean = true): BrowserWindow {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;

  operator_window = new BrowserWindow({
    width: Math.min(1400, width),
    height: Math.min(900, height),
    minWidth: 1024,
    minHeight: 700,
    show,
    title: 'Kumite Scoreboard - Operator',
    icon: APP_ICON,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      plugins: true, // enable Chromium's built-in PDF viewer for export previews
      // Keep the match clock running at full rate even when this window is not
      // the focused one — Chromium otherwise throttles timers and animation
      // frames in background windows, which stalls the countdown.
      backgroundThrottling: false,
    },
  });

  if (is_dev) {
    operator_window.loadURL('http://localhost:3000');
  } else {
    operator_window.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  operator_window.on('closed', () => { operator_window = null; });
  return operator_window;
}

export function create_spectator_window(): BrowserWindow {
  const displays = screen.getAllDisplays();
  const external = displays.find(d => d.id !== screen.getPrimaryDisplay().id);
  const display = external || screen.getPrimaryDisplay();

  spectator_window = new BrowserWindow({
    x: display.bounds.x,
    y: display.bounds.y,
    width: display.bounds.width,
    height: display.bounds.height,
    fullscreen: !!external,
    title: 'Kumite Scoreboard - Spectator Display',
    icon: APP_ICON,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      // The operator window always holds focus, so without this the spectator
      // board is throttled to a few frames a second and the hundredths crawl.
      backgroundThrottling: false,
    },
  });

  if (is_dev) {
    spectator_window.loadURL('http://localhost:3000/spectator.html');
  } else {
    spectator_window.loadFile(path.join(__dirname, '../renderer/spectator.html'));
  }

  spectator_window.on('closed', () => { spectator_window = null; });
  return spectator_window;
}

export function get_spectator_window(): BrowserWindow | null {
  return spectator_window;
}
