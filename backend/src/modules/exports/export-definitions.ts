import { Injectable, OnModuleInit } from '@nestjs/common';
import { StaffRole } from '@common/constants/app.constants';
import { ValidationException } from '@common/exceptions/business.exception';
import { ICurrentStaff } from '@common/interfaces/auth.interface';
import { AuditService } from '@shared/audit/audit.service';
import { CustomersService } from '@modules/customers/customers.service';
import { TransactionsService } from '@modules/transactions/transactions.service';
import { StaffService } from '@modules/staff/staff.service';
import { GamesService } from '@modules/games/games.service';
import { VipService } from '@modules/vip/vip.service';
import { ReferralsService } from '@modules/referrals/referrals.service';
import { SpinsService } from '@modules/spins/spins.service';
import { MessagingService } from '@modules/messaging/messaging.service';
import { EmailingService } from '@modules/emailing/emailing.service';
import { ExportService } from './export.service';
import { IExportPage } from './export.types';

/**
 * Turns an export page window into the pagination shape a list service
 * expects. Every list already paginates, so exports reuse that rather
 * than introducing a second traversal.
 */
const asPage = (filters: Record<string, unknown>, page: IExportPage): Record<string, unknown> => ({
  ...filters,
  page: Math.floor(page.offset / page.limit) + 1,
  limit: page.limit,
});

/**
 * Registers every exportable list.
 *
 * Each definition's `fetch` calls the SAME service method the HTTP list
 * calls. That is the whole safety argument: the export cannot see rows the
 * list would hide, because it is literally the same query with the same
 * actor and the same filters. A definition that assembled its own SQL
 * would silently bypass scoping, which is the single most likely way this
 * feature could leak data.
 */
@Injectable()
export class ExportDefinitions implements OnModuleInit {
  constructor(
    private readonly exportService: ExportService,
    private readonly customersService: CustomersService,
    private readonly transactionsService: TransactionsService,
    private readonly staffService: StaffService,
    private readonly gamesService: GamesService,
    private readonly vipService: VipService,
    private readonly referralsService: ReferralsService,
    private readonly spinsService: SpinsService,
    private readonly messagingService: MessagingService,
    private readonly emailingService: EmailingService,
    private readonly auditService: AuditService,
  ) {}

  onModuleInit(): void {
    this.registerCustomers();
    this.registerTransactions();
    this.registerStaff();
    this.registerGames();
    this.registerVips();
    this.registerReferrals();
    this.registerSpins();
    this.registerConversations();
    this.registerEmail();
    this.registerAuditLogs();
  }

  private registerCustomers(): void {
    this.exportService.register({
      key: 'customers',
      sheetName: 'Customers',
      filename: 'customers',
      columns: [
        { header: 'Customer ID', path: 'id', width: 38 },
        { header: 'Username', path: 'username' },
        { header: 'Full Name', path: 'fullName' },
        { header: 'Email', path: 'email', width: 28 },
        { header: 'Phone', path: 'phone', width: 16 },
        { header: 'City', path: 'city', width: 16 },
        { header: 'Country', path: 'country', width: 16 },
        { header: 'Status', path: 'status', width: 12 },
        { header: 'Manager', path: 'managerUsername', width: 16 },
        { header: 'Store', path: 'storeUsername', width: 16 },
        { header: 'Transactions', path: 'totalTransactions', format: 'number' },
        { header: 'Total Spent', path: 'totalSpent', format: 'currency' },
        { header: 'Total Withdrawn', path: 'totalWithdrawn', format: 'currency' },
        { header: 'Corrections', path: 'totalCorrections', format: 'currency' },
        { header: 'Net Balance', path: 'netBalance', format: 'currency' },
        { header: 'Balance', path: 'balance', format: 'currency' },
        { header: 'Bonus Balance', path: 'bonusBalance', format: 'currency' },
        { header: 'Last Activity', path: 'lastActivityAt', format: 'datetime' },
        { header: 'Registered', path: 'registeredAt', format: 'datetime' },
      ],
      fetch: async (actor, filters, page) =>
        (await this.customersService.findAll(actor, asPage(filters, page) as never)).data,
    });
  }

  private registerTransactions(): void {
    this.exportService.register({
      key: 'transactions',
      sheetName: 'Transactions',
      filename: 'transactions',
      columns: [
        { header: 'Transaction ID', path: 'id', width: 38 },
        { header: 'Customer', path: 'customerUsername' },
        { header: 'Type', path: 'type', width: 10 },
        { header: 'Amount', path: 'amount', format: 'currency' },
        { header: 'Game', path: 'gameName' },
        { header: 'Status', path: 'status', width: 12 },
        { header: 'Channel', path: 'channel', width: 16 },
        { header: 'Reference', path: 'referenceNo', width: 20 },
        // Kept adjacent so a reader can see at a glance that a credit with
        // a parent is a correction, not a withdrawal.
        { header: 'Is Correction', path: 'isCorrection', format: 'boolean' },
        { header: 'Corrects', path: 'parentTransactionId', width: 38 },
        { header: 'Note', path: 'note', width: 30 },
        { header: 'Entered By', path: 'enteredByUsername', width: 16 },
        { header: 'Occurred At', path: 'occurredAt', format: 'datetime' },
      ],
      fetch: async (actor, filters, page) =>
        (await this.transactionsService.findAll(actor, asPage(filters, page) as never)).data,
    });
  }

  private registerStaff(): void {
    this.exportService.register({
      key: 'staff',
      sheetName: 'Staff',
      filename: 'staff',
      columns: [
        { header: 'Staff ID', path: 'id', width: 38 },
        { header: 'Username', path: 'username' },
        { header: 'Email', path: 'email', width: 28 },
        { header: 'First Name', path: 'firstName' },
        { header: 'Last Name', path: 'lastName' },
        { header: 'Role', path: 'role', width: 12 },
        { header: 'Reports To', path: 'parentId', width: 38 },
        { header: 'Active', path: 'isActive', format: 'boolean' },
        { header: 'Last Login', path: 'lastLoginAt', format: 'datetime' },
        { header: 'Created', path: 'createdAt', format: 'datetime' },
      ],
      fetch: async (actor, filters, page) =>
        (await this.staffService.findAll(actor, asPage(filters, page) as never)).data,
    });
  }

  private registerGames(): void {
    this.exportService.register({
      key: 'games',
      sheetName: 'Games',
      filename: 'games',
      columns: [
        { header: 'Game ID', path: 'id', width: 38 },
        { header: 'Name', path: 'name' },
        { header: 'Code', path: 'code', width: 18 },
        { header: 'Category', path: 'category', width: 16 },
        { header: 'Active', path: 'isActive', format: 'boolean' },
        { header: 'Created', path: 'createdAt', format: 'datetime' },
      ],
      fetch: async (_actor, filters, page) =>
        (await this.gamesService.findAll(asPage(filters, page) as never)).data,
    });
  }

  private registerVips(): void {
    this.exportService.register({
      key: 'vips',
      sheetName: 'VIPs',
      filename: 'vips',
      columns: [
        { header: 'Customer', path: 'customerUsername' },
        { header: 'Full Name', path: 'customerFullName' },
        { header: 'Criteria', path: 'criteriaName' },
        { header: 'Tier', path: 'tier', format: 'number' },
        { header: 'Metric', path: 'metric', width: 18 },
        { header: 'Achieved', path: 'achievedAmount', format: 'currency' },
        { header: 'Threshold', path: 'thresholdAmount', format: 'currency' },
        { header: 'Window From', path: 'periodStart', format: 'date' },
        { header: 'Window To', path: 'periodEnd', format: 'date' },
        { header: 'Currently Active', path: 'isCurrentlyActive', format: 'boolean' },
        { header: 'Qualified At', path: 'qualifiedAt', format: 'datetime' },
      ],
      fetch: async (actor, filters, page) =>
        (await this.vipService.findVips(actor, asPage(filters, page) as never)).data,
    });

    this.exportService.register({
      key: 'vip-criteria',
      sheetName: 'VIP Criteria',
      filename: 'vip-criteria',
      columns: [
        { header: 'Criteria ID', path: 'id', width: 38 },
        { header: 'Name', path: 'name' },
        { header: 'Tier', path: 'tier', format: 'number' },
        { header: 'Metric', path: 'metric', width: 18 },
        { header: 'Threshold', path: 'thresholdAmount', format: 'currency' },
        { header: 'Window From', path: 'periodStart', format: 'date' },
        { header: 'Window To', path: 'periodEnd', format: 'date' },
        { header: 'Active', path: 'isActive', format: 'boolean' },
        { header: 'Currently Active', path: 'isCurrentlyActive', format: 'boolean' },
        { header: 'Qualified Count', path: 'qualifiedCount', format: 'number' },
      ],
      fetch: async (_actor, filters, page) =>
        (await this.vipService.findAllCriteria(asPage(filters, page) as never)).data,
    });
  }

  private registerReferrals(): void {
    this.exportService.register({
      key: 'referrals',
      sheetName: 'Referrals',
      filename: 'referrals',
      columns: [
        { header: 'Referral ID', path: 'id', width: 38 },
        { header: 'Program', path: 'programName' },
        { header: 'Referrer', path: 'referrerUsername' },
        { header: 'Referee', path: 'refereeUsername' },
        { header: 'Status', path: 'status', width: 12 },
        { header: 'Referrer Reward', path: 'referrerReward', format: 'currency' },
        { header: 'Referee Reward', path: 'refereeReward', format: 'currency' },
        { header: 'Rewarded At', path: 'rewardedAt', format: 'datetime' },
        { header: 'Created', path: 'createdAt', format: 'datetime' },
      ],
      fetch: async (actor, filters, page) =>
        (await this.referralsService.findReferrals(actor, asPage(filters, page) as never)).data,
    });

    this.exportService.register({
      key: 'referral-programs',
      sheetName: 'Referral Programs',
      filename: 'referral-programs',
      columns: [
        { header: 'Program ID', path: 'id', width: 38 },
        { header: 'Name', path: 'name' },
        { header: 'Reward Type', path: 'rewardType', width: 14 },
        { header: 'Referrer Bonus', path: 'referrerBonus', format: 'currency' },
        { header: 'Referee Bonus', path: 'refereeBonus', format: 'currency' },
        { header: 'Min Deposit', path: 'minQualifyingDebit', format: 'currency' },
        { header: 'Valid From', path: 'validFrom', format: 'date' },
        { header: 'Valid To', path: 'validTo', format: 'date' },
        { header: 'Active', path: 'isActive', format: 'boolean' },
        { header: 'Issued Codes', path: 'issuedCodes', format: 'number' },
      ],
      fetch: async (_actor, filters, page) =>
        (await this.referralsService.findAllPrograms(asPage(filters, page) as never)).data,
    });
  }

  private registerSpins(): void {
    this.exportService.register({
      key: 'spin-events',
      sheetName: 'Spin Events',
      filename: 'spin-events',
      columns: [
        { header: 'Event ID', path: 'id', width: 38 },
        { header: 'Name', path: 'name' },
        { header: 'Criteria', path: 'vipCriteriaName' },
        { header: 'Selection Mode', path: 'selectionMode', width: 16 },
        { header: 'Status', path: 'status', width: 12 },
        { header: 'Scheduled', path: 'scheduledAt', format: 'datetime' },
        { header: 'Window From', path: 'periodStart', format: 'date' },
        { header: 'Window To', path: 'periodEnd', format: 'date' },
        { header: 'Prize Pool', path: 'prizePool', format: 'currency' },
        { header: 'Winners', path: 'winnerCount', format: 'number' },
      ],
      fetch: async (_actor, filters, page) =>
        (await this.spinsService.findAllEvents(asPage(filters, page) as never)).data,
    });

    this.exportService.register({
      key: 'spin-winners',
      sheetName: 'Spin Winners',
      filename: 'spin-winners',
      columns: [
        { header: 'Winner ID', path: 'id', width: 38 },
        { header: 'Event', path: 'eventName' },
        { header: 'Event Status', path: 'eventStatus', width: 12 },
        { header: 'Customer', path: 'customerUsername' },
        { header: 'Full Name', path: 'customerFullName' },
        { header: 'Manager', path: 'managerUsername', width: 16 },
        { header: 'Store', path: 'storeUsername', width: 16 },
        { header: 'Prize', path: 'prizeLabel', width: 24 },
        { header: 'Prize Amount', path: 'prizeAmount', format: 'currency' },
        { header: 'Rank', path: 'rank', format: 'number' },
        { header: 'Preselected', path: 'isPreselected', format: 'boolean' },
        { header: 'Announced', path: 'announcedAt', format: 'datetime' },
      ],
      // The scoped register, not the masked public feed — an export of
      // anonymised rows would be useless to the staff downloading it.
      fetch: async (actor, filters, page) =>
        (await this.spinsService.findWinners(actor, asPage(filters, page) as never)).data,
    });
  }

  private registerConversations(): void {
    this.exportService.register({
      key: 'conversations',
      sheetName: 'Conversations',
      filename: 'conversations',
      columns: [
        { header: 'Conversation ID', path: 'id', width: 38 },
        { header: 'Customer', path: 'customerUsername' },
        { header: 'Full Name', path: 'customerFullName' },
        { header: 'Status', path: 'status', width: 12 },
        { header: 'Messages', path: 'messageCount', format: 'number' },
        // Unread is the exporting staff member's own count, matching what
        // they see in their inbox rather than some shared total.
        { header: 'Unread (yours)', path: 'unreadCount', format: 'number' },
        { header: 'Awaiting Reply', path: 'awaitingReply', format: 'boolean' },
        { header: 'Last Message', path: 'lastMessageAt', format: 'datetime' },
        { header: 'Preview', path: 'lastMessagePreview', width: 40 },
      ],
      fetch: async (actor, filters, page) =>
        (await this.messagingService.findInbox(actor, asPage(filters, page) as never)).data,
    });
  }

  private registerEmail(): void {
    this.exportService.register({
      key: 'email-campaigns',
      sheetName: 'Email Campaigns',
      filename: 'email-campaigns',
      // Campaign history exposes who was targeted across the business, so
      // it stays with the roles that can send.
      allowedRoles: [StaffRole.MASTER, StaffRole.MANAGER],
      columns: [
        { header: 'Campaign ID', path: 'id', width: 38 },
        { header: 'Subject', path: 'subject', width: 34 },
        { header: 'Kind', path: 'emailKind', width: 14 },
        { header: 'Status', path: 'status', width: 12 },
        { header: 'Recipients', path: 'recipientCount', format: 'number' },
        { header: 'Sent', path: 'sentCount', format: 'number' },
        { header: 'Failed', path: 'failedCount', format: 'number' },
        { header: 'Scheduled', path: 'scheduledAt', format: 'datetime' },
        { header: 'Completed', path: 'completedAt', format: 'datetime' },
        { header: 'Created', path: 'createdAt', format: 'datetime' },
      ],
      fetch: async (_actor, filters, page) =>
        (await this.emailingService.findAll(asPage(filters, page) as never)).data,
    });

    this.exportService.register({
      key: 'email-recipients',
      sheetName: 'Email Recipients',
      filename: 'email-recipients',
      // Per-recipient delivery detail, including addresses and bounce
      // reasons. Same roles as the campaign list it belongs to.
      allowedRoles: [StaffRole.MASTER, StaffRole.MANAGER],
      columns: [
        { header: 'Recipient ID', path: 'id', width: 38 },
        { header: 'Customer ID', path: 'customerId', width: 38 },
        { header: 'Email', path: 'email', width: 30 },
        { header: 'Status', path: 'status', width: 12 },
        { header: 'Error', path: 'error', width: 40 },
        { header: 'Sent At', path: 'sentAt', format: 'datetime' },
      ],
      fetch: async (_actor, filters, page) => {
        // The only export scoped to a single parent record. Without a
        // campaign this would dump every recipient of every campaign ever
        // sent, so it refuses rather than guessing.
        const campaignId = typeof filters.campaignId === 'string' ? filters.campaignId : undefined;
        if (!campaignId) {
          throw new ValidationException(
            [
              {
                field: 'campaignId',
                constraint: 'isNotEmpty',
                message: 'campaignId is required to export campaign recipients',
              },
            ],
            'campaignId is required',
          );
        }

        const paged = asPage(filters, page) as { page: number; limit: number };
        const status = typeof filters.status === 'string' ? filters.status : undefined;

        return (
          await this.emailingService.findRecipients(
            campaignId,
            paged.page,
            paged.limit,
            status as never,
          )
        ).data;
      },
    });
  }

  private registerAuditLogs(): void {
    this.exportService.register({
      key: 'audit-logs',
      sheetName: 'Audit Logs',
      filename: 'audit-logs',
      // Master-only, matching the list. The trail spans every chain and
      // names customers, so there is no narrower view to hand a manager.
      allowedRoles: [StaffRole.MASTER],
      columns: [
        { header: 'Entry ID', path: 'id', width: 38 },
        { header: 'When', path: 'createdAt', format: 'datetime' },
        { header: 'Actor Type', path: 'actorType', width: 12 },
        { header: 'Actor ID', path: 'actorId', width: 38 },
        { header: 'Actor Role', path: 'actorRole', width: 12 },
        { header: 'Action', path: 'action', width: 28 },
        { header: 'Entity Type', path: 'entityType', width: 18 },
        { header: 'Entity ID', path: 'entityId', width: 38 },
        { header: 'Method', path: 'method', width: 8 },
        { header: 'Path', path: 'path', width: 40 },
        { header: 'Status', path: 'statusCode', format: 'number' },
        { header: 'IP', path: 'ip', width: 16 },
        { header: 'Correlation ID', path: 'correlationId', width: 38 },
      ],
      fetch: async (_actor, filters, page) =>
        (await this.auditService.findAll(asPage(filters, page) as never)).data,
    });
  }
}

/** Exposed for the controller's Swagger enum. */
export const EXPORT_KEYS = [
  'customers',
  'transactions',
  'staff',
  'games',
  'vips',
  'vip-criteria',
  'referrals',
  'referral-programs',
  'spin-events',
  'spin-winners',
  'conversations',
  'email-campaigns',
  'email-recipients',
  'audit-logs',
] as const;

export type ExportKey = (typeof EXPORT_KEYS)[number];
export type { ICurrentStaff };
