/**
 * Events that other modules listen for (today: notifications). Kept here,
 * apart from the modules that emit them, so a listener never has to import
 * the emitting module and no import cycle can form.
 */

export const CUSTOMER_REGISTERED = 'customer.registered';
export class CustomerRegisteredEvent {
  constructor(
    readonly customerId: string,
    readonly name: string,
  ) {}
}

export const CUSTOMER_APPROVED = 'customer.approved';
export class CustomerApprovedEvent {
  constructor(readonly customerId: string) {}
}

export const VIP_TIER_REACHED = 'vip.tier_reached';
export class VipTierReachedEvent {
  constructor(
    readonly customerId: string,
    readonly tier: number,
    readonly criteriaName: string,
  ) {}
}

export const REFERRAL_REWARDED = 'referral.rewarded';
export class ReferralRewardedEvent {
  constructor(
    readonly referrerCustomerId: string,
    readonly refereeCustomerId: string,
    readonly referrerReward: string,
    readonly refereeReward: string = '0',
  ) {}
}

export const CAMPAIGN_FINISHED = 'campaign.finished';
export class CampaignFinishedEvent {
  constructor(
    readonly campaignId: string,
    readonly createdByStaffId: string | null,
    readonly subject: string,
    readonly status: string,
    readonly sentCount: number,
    readonly failedCount: number,
  ) {}
}

/** A notification was stored; the gateway pushes it to open apps. */
export const NOTIFICATION_CREATED = 'notification.created';
export class NotificationCreatedEvent {
  constructor(
    readonly realm: 'team' | 'customer',
    readonly recipientId: string,
    readonly notification: {
      id: string;
      kind: string;
      title: string;
      body: string | null;
      link: string | null;
      createdAt: Date;
    },
  ) {}
}

/** A big win was recorded (or shown again); open player apps add it to the feed. */
export const WIN_RECORDED = 'win.recorded';
export class WinRecordedEvent {
  constructor(
    readonly win: {
      id: string;
      displayName: string;
      gameName: string | null;
      gameImageUrl: string | null;
      amount: string;
      wonAt: Date;
    },
  ) {}
}
