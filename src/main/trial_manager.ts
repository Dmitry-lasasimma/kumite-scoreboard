/**
 * trial_manager.ts
 * ---------------------------------------------------------------------------
 * Secure, OFFLINE, usage-based trial system for the Kumite Scoreboard app.
 *
 * Expiration is based on ACTIVE USAGE TIME (minutes the app was actually
 * running), not calendar time. Usage is tracked with a heartbeat timer and
 * persisted to two encrypted files: a primary file and a hidden "ghost"
 * fallback in a different directory, so deleting one file does not reset the
 * trial.
 *
 * Wire-up: call init_trial_guard() ONCE at the very top of app.whenReady(),
 * before any window is created. See src/main/index.ts.
 *
 * NOTE: This is client-side, offline anti-tampering. It raises the effort bar
 * for casual bypass but is NOT unbreakable (a determined user with the source
 * can defeat any local scheme). For stronger protection use a licensing server.
 * ---------------------------------------------------------------------------
 */

import { app, dialog } from 'electron';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as crypto from 'crypto';
import { execSync } from 'child_process';

/* ===========================================================================
 * GLOBAL CONFIGURATION  —  EDIT THESE VALUES FOR TESTING
 * ===========================================================================
 * MAX_ALLOWED_MINUTES : total active-usage minutes before the trial expires.
 *     525600  => 1 year of active tracking
 *     1440    => 24 hours
 *     2       => 2 minutes (handy for a quick local test)
 *
 * HEARTBEAT_INTERVAL_MS : how often usage is incremented and saved to disk.
 *     60000 => 1 minute. Each tick adds (HEARTBEAT_INTERVAL_MS / 60000) minutes.
 * ------------------------------------------------------------------------- */
const MAX_ALLOWED_MINUTES = 131400; // <-- change this for your tests
const HEARTBEAT_INTERVAL_MS = 60000; // <-- change this for your tests

/* Secret used to derive the AES key. Change it to your own random string. */
const ENCRYPTION_SECRET = 'CHANGE_ME_kumite_trial_2026_a7Fq!x93';

/* File names (kept generic on purpose so the ghost file is less obvious). */
const PRIMARY_FILE_NAME = 'app_state.dat';
const GHOST_FILE_NAME = '.sysprofile.cache';

/* ===========================================================================
 * INTERNAL STATE
 * ========================================================================= */
const ALGORITHM = 'aes-256-cbc';
const IV_LENGTH = 16;
const KEY = crypto.createHash('sha256').update(ENCRYPTION_SECRET).digest();

let heartbeat_handle: NodeJS.Timeout | null = null;
let current_minutes = 0;

interface TrialPayload {
  used_minutes: number;
  machine_id: string;
  last_saved: string;
}

/* ===========================================================================
 * ENCRYPTION / DECRYPTION HELPERS
 * ========================================================================= */

/**
 * Encrypt an object into a disk-safe string "<ivHex>:<cipherHex>".
 * A fresh random IV is used every time.
 */
function encrypt_payload(payload: TrialPayload): string {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, KEY, iv);
  const json = JSON.stringify(payload);
  const encrypted = Buffer.concat([cipher.update(json, 'utf8'), cipher.final()]);
  return iv.toString('hex') + ':' + encrypted.toString('hex');
}

/**
 * Decrypt a string produced by encrypt_payload. Returns null if the data is
 * missing, malformed, or tampered with.
 */
function decrypt_payload(data: string | null): TrialPayload | null {
  try {
    if (!data || typeof data !== 'string' || !data.includes(':')) return null;
    const [iv_hex, cipher_hex] = data.split(':');
    const iv = Buffer.from(iv_hex, 'hex');
    const encrypted = Buffer.from(cipher_hex, 'hex');
    const decipher = crypto.createDecipheriv(ALGORITHM, KEY, iv);
    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    return JSON.parse(decrypted.toString('utf8')) as TrialPayload;
  } catch {
    return null;
  }
}

/* ===========================================================================
 * FILE READ / WRITE LOGIC (primary + ghost)
 * ========================================================================= */

/** Absolute path to the primary save file (userData is app-specific). */
function get_primary_path(): string {
  return path.join(app.getPath('userData'), PRIMARY_FILE_NAME);
}

/** Absolute path to the ghost fallback file (generic appData location). */
function get_ghost_path(): string {
  return path.join(app.getPath('appData'), GHOST_FILE_NAME);
}

/** Write the usage payload to a given path, creating parent dirs as needed. */
function write_file(file_path: string, payload: TrialPayload): void {
  try {
    fs.mkdirSync(path.dirname(file_path), { recursive: true });
    fs.writeFileSync(file_path, encrypt_payload(payload), 'utf8');
    if (process.platform === 'win32' && path.basename(file_path) === GHOST_FILE_NAME) {
      try {
        execSync(`attrib +h "${file_path}"`);
      } catch {
        /* non-fatal */
      }
    }
  } catch (err) {
    console.error('[trial] Failed to write', file_path, (err as Error).message);
  }
}

/** Read and decrypt a usage payload from a given path (null if unreadable). */
function read_file(file_path: string): TrialPayload | null {
  try {
    if (!fs.existsSync(file_path)) return null;
    return decrypt_payload(fs.readFileSync(file_path, 'utf8'));
  } catch {
    return null;
  }
}

/** Build the payload object we persist, including a light machine fingerprint. */
function build_payload(minutes: number): TrialPayload {
  return {
    used_minutes: minutes,
    machine_id: crypto
      .createHash('sha256')
      .update(os.hostname() + os.userInfo().username)
      .digest('hex')
      .slice(0, 16),
    last_saved: new Date().toISOString(),
  };
}

/** Persist the current minute count to BOTH the primary and ghost files. */
function save_both(minutes: number): void {
  const payload = build_payload(minutes);
  write_file(get_primary_path(), payload);
  write_file(get_ghost_path(), payload);
}

/* ===========================================================================
 * STARTUP RECONCILIATION (anti-tampering logic)
 * ========================================================================= */

interface ReconcileResult {
  minutes: number;
  expired: boolean;
  tampered: boolean;
}

/**
 * Read both files, reconcile them, decide the authoritative minute count, and
 * re-sync both files so they always agree afterwards.
 */
function reconcile_on_startup(): ReconcileResult {
  const primary = read_file(get_primary_path());
  const ghost = read_file(get_ghost_path());

  let minutes = 0;
  let tampered = false;

  if (!primary && !ghost) {
    // Case A: fresh install — neither file exists. Start a new trial at 0.
    minutes = 0;
  } else if (primary && ghost) {
    // Case B: both exist — trust the HIGHER count (defeats "restore old file").
    minutes = Math.max(Number(primary.used_minutes) || 0, Number(ghost.used_minutes) || 0);
  } else if (!primary && ghost) {
    // Case C: primary deleted but ghost survives => tampering detected.
    minutes = Number(ghost.used_minutes) || 0;
    tampered = true;
  } else if (primary) {
    // Case D: ghost deleted but primary survives => restore from primary.
    minutes = Number(primary.used_minutes) || 0;
    tampered = true;
  }

  save_both(minutes);

  return {
    minutes,
    expired: minutes >= MAX_ALLOWED_MINUTES,
    tampered,
  };
}

/* ===========================================================================
 * ENFORCEMENT
 * ========================================================================= */

/** Show the expiry dialog and hard-quit before any window loads. */
function block_and_exit(message?: string): void {
  try {
    dialog.showErrorBox(
      'Trial Expired',
      message ||
      `Your trial has ended. It allows ${MAX_ALLOWED_MINUTES} minutes of active usage.\n\n` +
      'Please purchase a license to continue using the application.'
    );
  } finally {
    app.exit(0);
  }
}

/* ===========================================================================
 * HEARTBEAT
 * ========================================================================= */

/** Start the heartbeat: increment usage, save both files, enforce the limit. */
function start_heartbeat(): void {
  const minutes_per_tick = HEARTBEAT_INTERVAL_MS / 60000;

  heartbeat_handle = setInterval(() => {
    current_minutes += minutes_per_tick;
    save_both(current_minutes);

    if (current_minutes >= MAX_ALLOWED_MINUTES) {
      stop_heartbeat();
      block_and_exit();
    }
  }, HEARTBEAT_INTERVAL_MS);

  if (heartbeat_handle.unref) heartbeat_handle.unref();
}

/** Stop the heartbeat timer if running. */
function stop_heartbeat(): void {
  if (heartbeat_handle) {
    clearInterval(heartbeat_handle);
    heartbeat_handle = null;
  }
}

/* ===========================================================================
 * PUBLIC ENTRY POINT
 * ===========================================================================
 * Call ONCE, early inside app.whenReady(), BEFORE creating any windows.
 * Returns true if allowed to run; false if the trial is expired (dialog shown
 * and app.exit() already called).
 * ------------------------------------------------------------------------- */

/**
 * Initialize the trial system: reconcile storage, enforce the limit, and start
 * the heartbeat if still within the allowance.
 * @returns true if allowed to continue, false if expired/blocked
 */
export function init_trial_guard(): boolean {
  const state = reconcile_on_startup();
  current_minutes = state.minutes;

  if (state.expired) {
    block_and_exit();
    return false;
  }

  start_heartbeat();

  app.on('before-quit', () => save_both(current_minutes));
  app.on('window-all-closed', () => save_both(current_minutes));

  const remaining = Math.max(0, MAX_ALLOWED_MINUTES - current_minutes);
  console.log(
    `[trial] Active usage: ${current_minutes.toFixed(2)} / ${MAX_ALLOWED_MINUTES} min ` +
    `(${remaining.toFixed(2)} remaining).`
  );
  return true;
}

export { encrypt_payload, decrypt_payload, reconcile_on_startup };
