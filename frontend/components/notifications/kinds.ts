import {
  BellIcon,
  CakeIcon,
  CheckCircle2Icon,
  ClockIcon,
  CrownIcon,
  GiftIcon,
  MegaphoneIcon,
  MessageSquareIcon,
  ReceiptIcon,
  UserPlusIcon,
  UsersIcon,
  type LucideIcon,
} from 'lucide-react';

import type { NotificationRealm } from '@/lib/notification-actions';

export interface KindInfo {
  kind: string;
  label: string;
  icon: LucideIcon;
  /** Shown behind an "i" in settings. */
  info?: string;
  /** Masters only. */
  masterOnly?: boolean;
  /** Not offered in settings. */
  hidden?: boolean;
}

export const KINDS: Record<NotificationRealm, KindInfo[]> = {
  staff: [
    { kind: 'player_message', label: 'Player messages', icon: MessageSquareIcon },
    {
      kind: 'player_waiting',
      label: 'Waiting players',
      icon: ClockIcon,
      info: 'When one of your players has had no reply for 15 minutes.',
    },
    { kind: 'team_message', label: 'Team messages', icon: UsersIcon },
    {
      kind: 'registration',
      label: 'New registrations',
      icon: UserPlusIcon,
      masterOnly: true,
    },
    {
      kind: 'broadcast_done',
      label: 'Broadcasts finished',
      icon: MegaphoneIcon,
      info: 'When a broadcast you sent has gone out, with how many were delivered.',
    },
  ],
  customer: [
    { kind: 'team_reply', label: 'Replies from your team', icon: MessageSquareIcon },
    { kind: 'visit_recorded', label: 'Visits recorded', icon: ReceiptIcon },
    { kind: 'vip_tier', label: 'VIP tiers', icon: CrownIcon },
    { kind: 'milestone', label: 'Milestones', icon: CakeIcon },
    { kind: 'referral_bonus', label: 'Invite bonuses', icon: GiftIcon },
    { kind: 'account_approved', label: 'Account approved', icon: CheckCircle2Icon, hidden: true },
  ],
};

export function kindIcon(realm: NotificationRealm, kind: string): LucideIcon {
  return KINDS[realm].find((entry) => entry.kind === kind)?.icon ?? BellIcon;
}
