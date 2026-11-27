'use client';

import { useState } from 'react';

import { PermissionPrompt } from '@/components/notifications/permission-prompt';
import type { NotificationRealm } from '@/lib/notification-actions';
import { InstallPrompt, useInstallMode } from './install-prompt';

/**
 * One card at a time: adding to the home screen comes first (on iPhone it
 * is what makes notifications possible at all), then notifications.
 */
export function AppPrompts({ realm, className }: { realm: NotificationRealm; className?: string }) {
  const mode = useInstallMode();
  const [installDone, setInstallDone] = useState(false);

  if (mode === undefined) return null;
  if (mode && !installDone) {
    return <InstallPrompt mode={mode} onDone={() => setInstallDone(true)} className={className} />;
  }
  return <PermissionPrompt realm={realm} className={className} />;
}
