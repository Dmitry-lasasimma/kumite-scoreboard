import { app, ipcMain } from 'electron';
import {
  create_operator_window,
  create_spectator_window,
  create_splash_window,
  get_spectator_window,
  get_splash_window,
} from './window_manager';
import { IPC_CHANNELS } from '../services/ipc_service';
import { cleanup_installer_file } from './installer_cleanup';

app.whenReady().then(() => {
  // Remove the leftover installer file (.dmg / Setup.exe) on first launch.
  cleanup_installer_file();

  // Show the splash video first while the operator window preloads hidden behind it.
  const splash = create_splash_window();
  const operator = create_operator_window(false);

  let revealed = false;
  const reveal_operator = (): void => {
    if (revealed) return;
    revealed = true;
    const splash_win = get_splash_window() || splash;
    if (splash_win && !splash_win.isDestroyed()) splash_win.close();
    if (operator && !operator.isDestroyed()) {
      operator.show();
      operator.focus();
    }
  };

  // Reveal when the splash video finishes (or is skipped); fall back on a timeout
  // in case the video fails to load so the app never gets stuck on the splash.
  ipcMain.once(IPC_CHANNELS.SPLASH_DONE, reveal_operator);
  setTimeout(reveal_operator, 15000);

  // Forward score/timer/penalty channels to spectator window
  // Dima test push code
  const forward_channels = [
    IPC_CHANNELS.SCORE_UPDATED,
    IPC_CHANNELS.PENALTY_UPDATED,
    IPC_CHANNELS.TIMER_UPDATED,
    IPC_CHANNELS.MATCH_STARTED,
    IPC_CHANNELS.MATCH_ENDED,
    IPC_CHANNELS.COMPETITOR_INFO,
  ];

  for (const channel of forward_channels) {
    ipcMain.on(channel, (_event, data) => {
      const spectator = get_spectator_window();
      if (spectator && !spectator.isDestroyed()) {
        spectator.webContents.send(channel, data);
      }
    });
  }

  // Open spectator window on demand
  ipcMain.on(IPC_CHANNELS.OPEN_SPECTATOR, () => {
    const existing = get_spectator_window();
    if (existing && !existing.isDestroyed()) {
      existing.focus();
    } else {
      create_spectator_window();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  create_operator_window();
});
