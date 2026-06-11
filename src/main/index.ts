import { app, ipcMain } from 'electron';
import { create_operator_window, create_spectator_window, get_spectator_window } from './window_manager';
import { IPC_CHANNELS } from '../services/ipc_service';

app.whenReady().then(() => {
  create_operator_window();

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
