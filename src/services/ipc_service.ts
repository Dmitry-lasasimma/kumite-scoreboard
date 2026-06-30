export const IPC_CHANNELS = {
  SCORE_UPDATED: 'score-updated',
  PENALTY_UPDATED: 'penalty-updated',
  TIMER_UPDATED: 'timer-updated',
  MATCH_STARTED: 'match-started',
  MATCH_ENDED: 'match-ended',
  COMPETITOR_INFO: 'competitor-info',
  OPEN_SPECTATOR: 'open-spectator',
  SPLASH_DONE: 'splash-done',
} as const;

export type IpcChannel = typeof IPC_CHANNELS[keyof typeof IPC_CHANNELS];
