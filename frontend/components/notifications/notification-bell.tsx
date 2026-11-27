'use client';

import { useCallback, useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { BellIcon, SettingsIcon } from 'lucide-react';

import { useSocketEvent } from '@/components/chat/socket';
import { listTime } from '@/components/chat/format';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  loadNotifications,
  markNotificationsRead,
  type AppNotification,
  type NotificationRealm,
} from '@/lib/notification-actions';
import { cn } from '@/lib/utils';
import { kindIcon } from './kinds';
import { NotificationSettingsDialog } from './notification-settings-dialog';
import { syncPush } from './push';
import { flagTitle, playTing, primeSound, watchVisibility } from './alert';

/**
 * The bell: the latest notifications, newest first, kept live over the
 * chat socket. Opening one goes to where it points and marks it read.
 */
export function NotificationBell({
  realm,
  isMaster,
}: {
  realm: NotificationRealm;
  isMaster?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [items, setItems] = useState<AppNotification[]>([]);
  const [unread, setUnread] = useState(0);

  const refresh = useCallback(async () => {
    const list = await loadNotifications(realm);
    setItems(list.items);
    setUnread(list.unread);
  }, [realm]);

  useEffect(() => {
    void refresh();
    // A browser that was set up under another account now belongs to this one.
    void syncPush(realm).catch(() => {});
  }, [realm, refresh]);

  useEffect(() => {
    const unprime = primeSound();
    const unwatch = watchVisibility();
    return () => {
      unprime();
      unwatch();
    };
  }, []);

  useSocketEvent<AppNotification>('notification:new', (notification) => {
    playTing(notification.id);
    flagTitle(notification.kind);
    setItems((current) =>
      [
        { ...notification, readAt: null },
        ...current.filter((item) => item.id !== notification.id),
      ].slice(0, 30),
    );
    setUnread((count) => count + 1);
  });

  // A player reading their thread has seen the replies it announced.
  useEffect(() => {
    if (realm !== 'customer') return;
    const seen = items.filter((item) => !item.readAt && item.link === pathname);
    if (!seen.length) return;
    const now = new Date().toISOString();
    setItems((current) =>
      current.map((item) => (seen.some((s) => s.id === item.id) ? { ...item, readAt: now } : item)),
    );
    setUnread((count) => Math.max(0, count - seen.length));
    for (const item of seen) void markNotificationsRead(realm, item.id);
  }, [realm, pathname, items]);

  const openItem = (item: AppNotification) => {
    setOpen(false);
    if (!item.readAt) {
      setItems((current) =>
        current.map((entry) =>
          entry.id === item.id ? { ...entry, readAt: new Date().toISOString() } : entry,
        ),
      );
      setUnread((count) => Math.max(0, count - 1));
      void markNotificationsRead(realm, item.id);
    }
    if (item.link) router.push(item.link);
  };

  const markAll = () => {
    const now = new Date().toISOString();
    setItems((current) => current.map((item) => ({ ...item, readAt: item.readAt ?? now })));
    setUnread(0);
    void markNotificationsRead(realm);
  };

  return (
    <>
      <Popover
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (next) void refresh();
        }}
      >
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="relative"
            aria-label={unread ? `Notifications, ${unread} unread` : 'Notifications'}
          >
            <BellIcon className="size-4" />
            {unread > 0 && (
              <span className="bg-destructive ring-background absolute top-1 right-1 grid h-4 min-w-4 place-items-center rounded-full px-1 text-[10px] font-bold text-white tabular-nums ring-2">
                {unread > 99 ? '99+' : unread}
              </span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-[min(22rem,calc(100vw-2rem))] p-0">
          <div className="flex items-center justify-between gap-2 border-b py-2 pr-2 pl-4">
            <h2 className="text-sm font-semibold">Notifications</h2>
            <div className="flex items-center">
              {unread > 0 && (
                <Button variant="ghost" size="xs" onClick={markAll}>
                  Mark all read
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Notification settings"
                onClick={() => {
                  setOpen(false);
                  setSettingsOpen(true);
                }}
              >
                <SettingsIcon className="size-4" />
              </Button>
            </div>
          </div>

          {items.length === 0 ? (
            <p className="text-muted-foreground px-4 py-10 text-center text-sm">Nothing yet</p>
          ) : (
            <ul className="max-h-[min(26rem,70svh)] overflow-y-auto py-1">
              {items.map((item) => {
                const Icon = kindIcon(realm, item.kind);
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => openItem(item)}
                      className="hover:bg-accent focus-visible:bg-accent flex w-full gap-3 px-4 py-2.5 text-left outline-none"
                    >
                      <span
                        className={cn(
                          'mt-0.5 grid size-8 shrink-0 place-items-center rounded-full',
                          item.readAt
                            ? 'bg-muted text-muted-foreground'
                            : 'bg-primary/10 text-primary',
                        )}
                      >
                        <Icon className="size-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-baseline justify-between gap-2">
                          <span
                            className={cn(
                              'truncate text-sm',
                              item.readAt ? 'text-muted-foreground' : 'font-semibold',
                            )}
                          >
                            {item.title}
                          </span>
                          <span className="text-muted-foreground shrink-0 text-xs">
                            {listTime(item.createdAt)}
                          </span>
                        </span>
                        {item.body && (
                          <span className="text-muted-foreground line-clamp-2 text-xs">
                            {item.body}
                          </span>
                        )}
                      </span>
                      {!item.readAt && (
                        <span className="bg-primary mt-2 size-2 shrink-0 rounded-full">
                          <span className="sr-only">Unread</span>
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </PopoverContent>
      </Popover>

      <NotificationSettingsDialog
        realm={realm}
        isMaster={isMaster}
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
      />
    </>
  );
}
