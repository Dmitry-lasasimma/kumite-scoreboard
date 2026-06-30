import { app } from 'electron';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Self-cleaning installer logic.
 *
 * After the app is installed and launched for the first time, the original
 * installer file the user downloaded (a `.dmg` on macOS or a `Setup .exe` on
 * Windows) is no longer needed. This module locates that leftover installer in
 * the common download locations and deletes it.
 *
 * It runs only once per machine (guarded by a marker file in `userData`) and
 * only in a packaged build, so it never touches anything during development.
 *
 * On Windows the NSIS installer (`build/installer.nsh`) already removes the
 * running installer immediately after setup finishes; this module is a
 * cross-platform safety net and is the primary mechanism on macOS, where the
 * `.dmg` cannot delete itself.
 */

/** Folders that are scanned for a leftover installer file. */
const get_search_dirs = (): string[] => {
  const dirs: string[] = [];
  const safe_path = (name: 'downloads' | 'desktop'): void => {
    try {
      dirs.push(app.getPath(name));
    } catch {
      /* path may be unavailable on some systems — ignore */
    }
  };
  safe_path('downloads');
  safe_path('desktop');
  // Also check the directory the app was launched from (e.g. a mounted DMG copy).
  try {
    dirs.push(path.dirname(app.getPath('exe')));
  } catch {
    /* ignore */
  }
  return Array.from(new Set(dirs));
};

/**
 * Returns true when `file_name` looks like this app's installer artifact.
 * Matches the electron-builder artifact names for both platforms, ignoring
 * the version number so it keeps working across releases:
 *   macOS   -> "Kumite Scoreboard-1.0.0-mac-arm64.dmg"
 *   Windows -> "Kumite Scoreboard Setup 1.0.0.exe"
 */
const is_installer_file = (file_name: string): boolean => {
  const name = file_name.toLowerCase();
  if (process.platform === 'darwin') {
    return name.startsWith('kumite scoreboard') && name.endsWith('.dmg');
  }
  if (process.platform === 'win32') {
    // Matches "Kumite Scoreboard-1.0.0-win-x64.exe" and a "Setup" variant.
    return (
      name.startsWith('kumite scoreboard') &&
      (name.includes('win') || name.includes('setup')) &&
      name.endsWith('.exe')
    );
  }
  return false;
};

/** Path to the marker file that records cleanup has already run. */
const get_marker_path = (): string =>
  path.join(app.getPath('userData'), '.installer_cleaned');

/**
 * Find and delete any leftover installer file for this app.
 * Safe to call unconditionally — it no-ops in dev, after the first run, and
 * if no matching installer is found.
 */
export const cleanup_installer_file = (): void => {
  // Never run while developing — only on real installed builds.
  if (!app.isPackaged) return;

  const marker = get_marker_path();
  if (fs.existsSync(marker)) return;

  try {
    for (const dir of get_search_dirs()) {
      let entries: string[];
      try {
        entries = fs.readdirSync(dir);
      } catch {
        continue; // directory missing or not readable
      }

      for (const entry of entries) {
        if (!is_installer_file(entry)) continue;
        const full_path = path.join(dir, entry);
        try {
          fs.unlinkSync(full_path);
          // eslint-disable-next-line no-console
          console.log(`[installer-cleanup] removed installer: ${full_path}`);
        } catch (err) {
          // File may be locked (e.g. DMG still mounted) — skip, try next run.
          // eslint-disable-next-line no-console
          console.warn(`[installer-cleanup] could not remove ${full_path}:`, err);
        }
      }
    }
  } finally {
    // Write the marker so this only ever runs once, even if nothing was found.
    try {
      fs.writeFileSync(marker, new Date().toISOString());
    } catch {
      /* if we can't write the marker, worst case we re-scan next launch */
    }
  }
};
