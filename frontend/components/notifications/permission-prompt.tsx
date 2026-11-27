'use client';

import { useEffect, useState } from 'react';
import { BellRingIcon } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { InfoTip } from '@/components/ui/info-tip';
import { loadPushKey, type NotificationRealm } from '@/lib/notification-actions';
import { cn } from '@/lib/utils';
import { enablePush, PushError, pushSupported } from './push';

const SNOOZE_KEY = 'howdi:push-prompt-snoozed';
const SNOOZE_DAYS = 7;

function snoozed(): boolean {
  try {
    const at = Number(localStorage.getItem(SNOOZE_KEY));
    return Boolean(at) && Date.now() - at < SNOOZE_DAYS * 86_400_000;
  } catch {
    return false;
  }
}

function snooze() {
  try {
    localStorage.setItem(SNOOZE_KEY, String(Date.now()));
  } catch {
    // Without storage the card simply comes back next visit.
  }
}

/**
 * Asks once, gently, before the browser's own prompt: a browser that has
 * been asked and refused can't be asked again, so the real prompt only
 * appears when someone has said yes here. "Not now" waits a week.
 */
export function PermissionPrompt({
  realm,
  className,
}: {
  realm: NotificationRealm;
  className?: string;
}) {
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!pushSupported() || Notification.permission !== 'default' || snoozed()) return;
    let cancelled = false;
    void loadPushKey(realm).then((key) => {
      if (!cancelled && key) setShow(true);
    });
    return () => {
      cancelled = true;
    };
  }, [realm]);

  if (!show) return null;

  const turnOn = async () => {
    setBusy(true);
    try {
      const state = await enablePush(realm);
      if (state === 'on') toast.success('Notifications are on');
      else if (state === 'off') snooze();
    } catch (error) {
      toast.error(
        error instanceof PushError
          ? error.message
          : 'That didn’t work. Try again from notification settings.',
        { duration: 10_000 },
      );
    } finally {
      setBusy(false);
      setShow(false);
    }
  };

  return (
    <div
      role="region"
      aria-label="Turn on notifications"
      className={cn(
        'bg-popover text-popover-foreground animate-in fade-in-0 slide-in-from-bottom-2 fixed right-4 left-4 z-40 flex items-center gap-3 rounded-2xl border p-3 shadow-lg sm:left-auto sm:w-auto',
        className,
      )}
    >
      <span className="bg-primary/10 text-primary hidden size-9 shrink-0 place-items-center rounded-full sm:grid">
        <BellRingIcon className="size-4" />
      </span>
      <div className="flex min-w-0 flex-1 items-center gap-1">
        <p className="text-sm font-medium sm:whitespace-nowrap">Turn on notifications?</p>
        <InfoTip>
          {realm === 'staff'
            ? 'Get player messages and anything waiting on you, even when Howdi chat is closed. Choose which kinds from the bell.'
            : 'Get replies from your team, visits and rewards, even when Howdi chat is closed. Choose which kinds from your profile.'}
        </InfoTip>
      </div>
      <div className="flex shrink-0 gap-1">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            snooze();
            setShow(false);
          }}
        >
          Not now
        </Button>
        <Button size="sm" disabled={busy} onClick={() => void turnOn()}>
          Turn on
        </Button>
      </div>
    </div>
  );
}
