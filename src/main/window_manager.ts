import { BrowserWindow, screen } from 'electron';
import path from 'path';

let operator_window: BrowserWindow | null = null;
let spectator_window: BrowserWindow | null = null;

const is_dev = process.env.NODE_ENV !== 'production' || !require('electron').app.isPackaged;

export function create_operator_window(): BrowserWindow {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;

  operator_window = new BrowserWindow({
    width: Math.min(1400, width),
    height: Math.min(900, height),
    minWidth: 1024,
    minHeight: 700,
    title: 'Kumite Scoreboard - Operator',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
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
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
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
