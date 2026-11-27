'use client';

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import type { NotificationRealm } from '@/lib/notification-actions';
import { NotificationSettings } from './notification-settings';

export function NotificationSettingsDialog({
  realm,
  isMaster,
  open,
  onOpenChange,
}: {
  realm: NotificationRealm;
  isMaster?: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>Notifications</DialogTitle>
        </DialogHeader>
        {open && <NotificationSettings realm={realm} isMaster={isMaster} />}
      </DialogContent>
    </Dialog>
  );
}
