import { useState } from 'react';
import { saveBackup } from '../db/backup';
import type { Settings } from '../db/schema';
import { date } from '../lib/format';

const DAY = 86_400_000;

export const backupDue = (settings: Settings, sessionCount: number, days: number) =>
  sessionCount > 0 && (!settings.lastBackupAt || Date.now() - settings.lastBackupAt > days * DAY);

export function BackupBanner({ settings, text }: { settings: Settings; text?: string }) {
  const [busy, setBusy] = useState(false);
  return (
    <div className="banner">
      <span className="grow">
        {text ??
          (settings.lastBackupAt
            ? `Last backup ${date(settings.lastBackupAt)}. Your data lives only on this phone.`
            : 'No backup yet. Your data lives only on this phone.')}
      </span>
      <button
        className="btn primary"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          await saveBackup();
          setBusy(false);
        }}
      >
        Save backup
      </button>
    </div>
  );
}

export const isStandalone = () =>
  window.matchMedia?.('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone === true;

const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent);

export function InstallBanner() {
  const [hidden, setHidden] = useState(() => {
    try {
      return localStorage.getItem('felt-install-dismissed') === '1';
    } catch {
      return false;
    }
  });
  if (hidden || isStandalone()) return null;
  return (
    <div className="banner">
      <span className="grow">
        {isIos()
          ? 'Install Felt: tap Share ⎋ then “Add to Home Screen”. Safari can wipe data of sites not added there.'
          : 'Install Felt: browser menu ⋮ → “Install app” / “Add to Home screen”, so it works offline and keeps its data.'}
      </span>
      <button
        className="btn"
        onClick={() => {
          setHidden(true);
          try {
            localStorage.setItem('felt-install-dismissed', '1');
          } catch {
            /* private mode */
          }
        }}
      >
        Later
      </button>
    </div>
  );
}
