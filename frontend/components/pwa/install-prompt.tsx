'use client';

import { useEffect, useState } from 'react';
import { ShareIcon, SquarePlusIcon } from 'lucide-react';
import Image from 'next/image';

import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

interface InstallEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

declare global {
  interface Window {
    /** Caught by the inline script in the root layout, before React loads. */
    __howdiInstall?: InstallEvent | null;
  }
}

const SNOOZE_KEY = 'howdi:install-prompt-snoozed';
const SNOOZE_DAYS = 14;

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

export function isInstalled(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

const isIos = () =>
  /iphone|ipad|ipod/i.test(navigator.userAgent) ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

/** Phones and tablets only; on a computer the browser's own install button is enough. */
const isTouchDevice = () => window.matchMedia('(pointer: coarse)').matches;

export type InstallMode = 'native' | 'ios' | null;

/** Whether, and how, to offer adding Howdi chat to the home screen. */
export function useInstallMode(): InstallMode | undefined {
  const [mode, setMode] = useState<InstallMode | undefined>(undefined);

  useEffect(() => {
    if (isInstalled() || !isTouchDevice() || snoozed()) {
      setMode(null);
      return;
    }
    if (window.__howdiInstall) {
      setMode('native');
    } else {
      setMode(isIos() ? 'ios' : null);
    }
    const onPrompt = (event: Event) => {
      event.preventDefault();
      window.__howdiInstall = event as InstallEvent;
      setMode('native');
    };
    const onInstalled = () => setMode(null);
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  return mode;
}

/**
 * "Add Howdi to your home screen", on phones that haven't yet. Android
 * gets the browser's install sheet; iPhone can't be prompted, so it gets
 * the two taps that do it.
 */
export function InstallPrompt({
  mode,
  onDone,
  className,
}: {
  mode: 'native' | 'ios';
  onDone: () => void;
  className?: string;
}) {
  const install = async () => {
    const event = window.__howdiInstall;
    if (!event) return onDone();
    await event.prompt();
    const { outcome } = await event.userChoice;
    window.__howdiInstall = null;
    if (outcome === 'dismissed') snooze();
    onDone();
  };

  return (
    <div
      role="region"
      aria-label="Add to home screen"
      className={cn(
        'bg-popover text-popover-foreground animate-in fade-in-0 slide-in-from-bottom-2 fixed right-4 left-4 z-40 flex items-center gap-3 rounded-2xl border p-3 shadow-lg sm:left-auto sm:w-auto',
        className,
      )}
    >
      <Image
        src="/pwa/icon-192.png"
        alt=""
        width={36}
        height={36}
        className="size-9 shrink-0 rounded-xl"
      />
      <p className="min-w-0 flex-1 text-sm font-medium">Add Howdi to your home screen?</p>
      <div className="flex shrink-0 gap-1">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            snooze();
            onDone();
          }}
        >
          Not now
        </Button>
        {mode === 'native' ? (
          <Button size="sm" onClick={() => void install()}>
            Add
          </Button>
        ) : (
          <Popover>
            <PopoverTrigger asChild>
              <Button size="sm">How</Button>
            </PopoverTrigger>
            <PopoverContent side="top" align="end" className="w-64 p-3 text-sm">
              <ol className="space-y-2">
                <li className="flex items-center gap-2">
                  <span className="text-muted-foreground w-4 text-xs">1</span>
                  Tap <ShareIcon className="size-4" aria-label="Share" /> in Safari
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-muted-foreground w-4 text-xs">2</span>
                  Choose <SquarePlusIcon className="size-4" aria-hidden /> Add to Home Screen
                </li>
              </ol>
            </PopoverContent>
          </Popover>
        )}
      </div>
    </div>
  );
}
