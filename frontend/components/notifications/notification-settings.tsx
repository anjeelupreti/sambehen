'use client';

import { useEffect, useId, useState } from 'react';
import { toast } from 'sonner';

import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { InfoTip } from '@/components/ui/info-tip';
import {
  loadPreferences,
  loadPushKey,
  savePreference,
  type NotificationRealm,
} from '@/lib/notification-actions';
import { KINDS, type KindInfo } from './kinds';
import { setSoundEnabled, soundEnabled } from './alert';
import {
  disablePush,
  enablePush,
  needsHomeScreen,
  PushError,
  pushState,
  type PushState,
} from './push';

function DeviceHelp({ state }: { state: PushState }) {
  if (state === 'unsupported') {
    return (
      <InfoTip>
        {needsHomeScreen()
          ? 'On iPhone and iPad, tap Share, then Add to Home Screen, and open Howdi chat from there.'
          : 'This browser can’t show notifications.'}
      </InfoTip>
    );
  }
  if (state === 'denied') {
    return (
      <InfoTip>
        Notifications are blocked for this site. Allow them in your browser’s site settings, then
        come back here.
      </InfoTip>
    );
  }
  return (
    <InfoTip>
      Alerts on this device, even when Howdi chat is closed. Each device is set up separately.
    </InfoTip>
  );
}

function Row({
  label,
  info,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  info?: React.ReactNode;
  checked: boolean;
  disabled?: boolean;
  onChange: (value: boolean) => void;
}) {
  const id = useId();
  return (
    <div className="flex min-h-11 items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-1">
        <Label htmlFor={id} className="font-normal">
          {label}
        </Label>
        {info}
      </div>
      <Switch id={id} checked={checked} disabled={disabled} onCheckedChange={onChange} />
    </div>
  );
}

/**
 * Push on this device, then one switch per kind. A kind switched off is
 * off everywhere: no bell entry and no push.
 */
export function NotificationSettings({
  realm,
  isMaster = false,
}: {
  realm: NotificationRealm;
  isMaster?: boolean;
}) {
  const [device, setDevice] = useState<PushState | null>(null);
  const [pushAvailable, setPushAvailable] = useState(false);
  const [busy, setBusy] = useState(false);
  const [prefs, setPrefs] = useState<Record<string, boolean> | null>(null);
  const [sound, setSound] = useState(true);

  useEffect(() => {
    void pushState().then(setDevice);
    void loadPushKey(realm).then((key) => setPushAvailable(Boolean(key)));
    void loadPreferences(realm).then(setPrefs);
    setSound(soundEnabled());
  }, [realm]);

  const toggleDevice = async (on: boolean) => {
    setBusy(true);
    try {
      setDevice(on ? await enablePush(realm) : await disablePush(realm));
    } catch (error) {
      toast.error(error instanceof PushError ? error.message : 'That didn’t work. Try again.', {
        duration: 10_000,
      });
      setDevice(await pushState().catch(() => 'off' as const));
    } finally {
      setBusy(false);
    }
  };

  const toggleKind = async (kind: string, enabled: boolean) => {
    setPrefs((current) => ({ ...current, [kind]: enabled }));
    const saved = await savePreference(realm, kind, enabled);
    if (saved) setPrefs(saved);
    else {
      setPrefs((current) => ({ ...current, [kind]: !enabled }));
      toast.error('That didn’t save. Try again.');
    }
  };

  const kinds = KINDS[realm].filter(
    (entry: KindInfo) => !entry.hidden && (!entry.masterOnly || isMaster),
  );

  return (
    <div className="divide-y">
      <div className="pb-2">
        {pushAvailable && device && (
          <Row
            label="Push on this device"
            info={<DeviceHelp state={device} />}
            checked={device === 'on'}
            disabled={busy || device === 'unsupported' || device === 'denied'}
            onChange={toggleDevice}
          />
        )}
        <Row
          label="Sound"
          info={<InfoTip>A short ting when something arrives while Howdi chat is open.</InfoTip>}
          checked={sound}
          onChange={(on) => {
            setSound(on);
            setSoundEnabled(on);
          }}
        />
      </div>
      <div className="pt-2">
        {kinds.map((entry) => (
          <Row
            key={entry.kind}
            label={entry.label}
            info={entry.info ? <InfoTip>{entry.info}</InfoTip> : undefined}
            checked={prefs?.[entry.kind] ?? true}
            disabled={!prefs}
            onChange={(value) => void toggleKind(entry.kind, value)}
          />
        ))}
      </div>
    </div>
  );
}
