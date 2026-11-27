/** What staff can be notified about. */
export enum StaffNotificationKind {
  PLAYER_MESSAGE = 'player_message',
  PLAYER_WAITING = 'player_waiting',
  REGISTRATION = 'registration',
  TEAM_MESSAGE = 'team_message',
  BROADCAST_DONE = 'broadcast_done',
}

/** What players can be notified about. */
export enum PlayerNotificationKind {
  TEAM_REPLY = 'team_reply',
  VISIT_RECORDED = 'visit_recorded',
  VIP_TIER = 'vip_tier',
  MILESTONE = 'milestone',
  REFERRAL_BONUS = 'referral_bonus',
  ACCOUNT_APPROVED = 'account_approved',
}

export type NotificationRealm = 'team' | 'customer';

export const KINDS: Record<NotificationRealm, string[]> = {
  team: Object.values(StaffNotificationKind),
  customer: Object.values(PlayerNotificationKind),
};

/** Minutes a player waits for a reply before their store is nudged. */
export const WAITING_NUDGE_MINUTES = 15;
