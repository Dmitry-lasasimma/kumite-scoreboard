import { contextBridge, ipcRenderer } from 'electron';
import { IPC_CHANNELS } from '../services/ipc_service';

const allowed_channels = Object.values(IPC_CHANNELS);

contextBridge.exposeInMainWorld('kumiteAPI', {
  send: (channel: string, data: any) => {
    if (allowed_channels.includes(channel as any)) {
      ipcRenderer.send(channel, data);
    }
  },
  on: (channel: string, callback: (...args: any[]) => void) => {
    if (allowed_channels.includes(channel as any)) {
      ipcRenderer.on(channel, (_event, ...args) => callback(...args));
    }
  },
  removeAllListeners: (channel: string) => {
    if (allowed_channels.includes(channel as any)) {
      ipcRenderer.removeAllListeners(channel);
    }
  },
});
