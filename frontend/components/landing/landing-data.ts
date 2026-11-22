/**
 * Example data for the landing page's product views.
 *
 * Shaped like the seeded demo data (games, VIP criteria, referral program,
 * the master → manager → store chain) so the page shows what the product
 * really holds. None of it is fetched: the landing page is public and must
 * never expose a real operator's records.
 */

export const CURRENCY = process.env.NEXT_PUBLIC_CURRENCY ?? 'USD';
export const LOCALE = process.env.NEXT_PUBLIC_LOCALE ?? 'en-US';

const money = new Intl.NumberFormat(LOCALE, { style: 'currency', currency: CURRENCY });
export const formatMoney = (amount: number): string => money.format(amount);

export type EntryType = 'debit' | 'credit' | 'correction';

export interface LedgerEntry {
  id: string;
  when: string;
  game: string;
  type: EntryType;
  amount: number;
}

export const HERO_PLAYER = {
  name: 'Savannah Pruitt',
  username: 'customer12',
  store: 'Store 11',
  manager: 'Manager 1',
  balance: 1240.5,
  lifetimeIn: 3640,
  vip: { tier: 'Gold', period: 'This quarter', threshold: 5000 },
};

export const HERO_LEDGER: LedgerEntry[] = [
  { id: 't5', when: 'Today, 14:02', game: 'Ocean Quest', type: 'debit', amount: 200 },
  { id: 't4', when: 'Today, 11:47', game: 'Turbo Kart', type: 'credit', amount: 350 },
  { id: 't3', when: 'Yesterday', game: 'Puzzle Rush', type: 'debit', amount: 80 },
  { id: 't2', when: 'Mon', game: 'Star Arena', type: 'debit', amount: 500 },
];

/** The entry that lands in the hero's one animated moment. */
export const HERO_NEW_ENTRY: LedgerEntry = {
  id: 't6',
  when: 'Just now',
  game: 'Star Arena',
  type: 'debit',
  amount: 120,
};

export const HERO_THREAD = [
  { from: 'player', text: 'Did my Friday top-up go through?' },
  { from: 'team', text: 'Yes, $200 on Ocean Quest. It counts toward Gold.' },
] as const;

export type PlayerStatus = 'active' | 'inactive' | 'suspended' | 'pending';

export const CUSTOMERS: {
  name: string;
  store: string;
  status: PlayerStatus;
  balance: number;
}[] = [
  { name: 'Savannah Pruitt', store: 'Store 11', status: 'active', balance: 1240.5 },
  { name: 'Travis McCoy', store: 'Store 12', status: 'active', balance: 312 },
  { name: 'Jolene Harper', store: 'Store 11', status: 'inactive', balance: 48.25 },
  { name: 'Wade Henderson', store: 'Store 13', status: 'suspended', balance: 0 },
  { name: 'Darla Briggs', store: 'Unassigned', status: 'pending', balance: 0 },
];

export const TRANSACTIONS: (LedgerEntry & { player: string; correctionOf?: string })[] = [
  {
    id: 'TX-1093',
    when: '14:02',
    player: 'Savannah Pruitt',
    game: 'Ocean Quest',
    type: 'debit',
    amount: 200,
  },
  {
    id: 'TX-1092',
    when: '13:40',
    player: 'Travis McCoy',
    game: 'Puzzle Rush',
    type: 'debit',
    amount: 60,
  },
  {
    id: 'TX-1091',
    when: '12:15',
    player: 'Travis McCoy',
    game: 'Puzzle Rush',
    type: 'correction',
    amount: 40,
    correctionOf: 'TX-1088',
  },
  {
    id: 'TX-1090',
    when: '11:47',
    player: 'Savannah Pruitt',
    game: 'Turbo Kart',
    type: 'credit',
    amount: 350,
  },
];

export const VIP_CRITERIA = [
  { tier: 'Gold', rule: 'Spend $5,000 in the quarter', qualified: 9 },
  { tier: 'Silver', rule: 'Spend $1,500 in the quarter', qualified: 21 },
];

export const REWARD_EVENT = {
  name: 'Gold quarter rewards',
  pool: 5000,
  eligible: 9,
  recipients: [
    { name: 'Savannah Pruitt', amount: 2500 },
    { name: 'Travis McCoy', amount: 1500 },
    { name: 'Rhett Calloway', amount: 1000 },
  ],
};

export const REFERRAL_PROGRAM = {
  name: 'Bring a Friend',
  referrer: 50,
  referee: 25,
  minSpend: 100,
};

export type ReferralStatus = 'pending' | 'qualified' | 'rewarded';

export const REFERRALS: {
  referrer: string;
  referee: string;
  spent: number;
  status: ReferralStatus;
}[] = [
  { referrer: 'Savannah Pruitt', referee: 'Lacey Dawson', spent: 140, status: 'rewarded' },
  { referrer: 'Travis McCoy', referee: 'Colt Barrett', spent: 100, status: 'qualified' },
  { referrer: 'Savannah Pruitt', referee: 'Hank Whitfield', spent: 35, status: 'pending' },
];

export const CAMPAIGN = {
  subject: 'Gold rewards close Sunday',
  filters: ['Active in 30 days', 'Silver or Gold', 'Store 11, 12, 13'],
  audience: 214,
};

export const INBOX = [
  {
    name: 'Savannah Pruitt',
    preview: 'Did my Friday top-up go through?',
    unread: 1,
    when: '14:05',
  },
  { name: 'Travis McCoy', preview: 'Thanks, got the bonus.', unread: 0, when: '12:30' },
  {
    name: 'Store 12',
    preview: 'Can you approve Darla today?',
    unread: 2,
    when: '11:02',
    staff: true,
  },
];

/**
 * The access chain, with how many players each role can see. Counts follow
 * the seed: five players per store, plus two owned directly by each manager.
 */
export interface AccessNode {
  id: string;
  label: string;
  role: 'master' | 'manager' | 'store';
  players: number;
  parent?: string;
  sees: string;
}

export const ACCESS_NODES: AccessNode[] = [
  {
    id: 'master',
    label: 'Master',
    role: 'master',
    players: 36,
    sees: 'Every manager, store and player, plus the audit trail.',
  },
  {
    id: 'm1',
    label: 'Manager 1',
    role: 'manager',
    parent: 'master',
    players: 17,
    sees: 'Stores 11, 12 and 13, and two players of their own.',
  },
  {
    id: 'm2',
    label: 'Manager 2',
    role: 'manager',
    parent: 'master',
    players: 12,
    sees: 'Stores 21 and 22, and two players of their own.',
  },
  {
    id: 'm3',
    label: 'Manager 3',
    role: 'manager',
    parent: 'master',
    players: 7,
    sees: 'Store 31, and two players of their own.',
  },
  {
    id: 's11',
    label: 'Store 11',
    role: 'store',
    parent: 'm1',
    players: 5,
    sees: 'Only the five players assigned to Store 11.',
  },
  {
    id: 's12',
    label: 'Store 12',
    role: 'store',
    parent: 'm1',
    players: 5,
    sees: 'Only the five players assigned to Store 12.',
  },
  {
    id: 's13',
    label: 'Store 13',
    role: 'store',
    parent: 'm1',
    players: 5,
    sees: 'Only the five players assigned to Store 13.',
  },
  {
    id: 's21',
    label: 'Store 21',
    role: 'store',
    parent: 'm2',
    players: 5,
    sees: 'Only the five players assigned to Store 21.',
  },
  {
    id: 's22',
    label: 'Store 22',
    role: 'store',
    parent: 'm2',
    players: 5,
    sees: 'Only the five players assigned to Store 22.',
  },
  {
    id: 's31',
    label: 'Store 31',
    role: 'store',
    parent: 'm3',
    players: 5,
    sees: 'Only the five players assigned to Store 31.',
  },
];

/* ── Dashboard ─────────────────────────────────────────────────────────── */

export const DASHBOARD = {
  kpis: [
    { label: 'Players', value: '36', note: '24 active this month' },
    { label: 'Money in, this month', value: 48320, delta: '+12% on last month' },
    { label: 'Money out, this month', value: 31975, delta: '+4% on last month' },
    { label: 'Net, this month', value: 16345, delta: '+31% on last month' },
  ],
  /** Weekly money in / out, oldest first, for the bar chart. */
  weeks: [
    { label: 'W1', moneyIn: 8200, moneyOut: 6100 },
    { label: 'W2', moneyIn: 9400, moneyOut: 7300 },
    { label: 'W3', moneyIn: 7600, moneyOut: 5200 },
    { label: 'W4', moneyIn: 10300, moneyOut: 7900 },
    { label: 'W5', moneyIn: 11200, moneyOut: 8400 },
    { label: 'W6', moneyIn: 9900, moneyOut: 6600 },
    { label: 'W7', moneyIn: 12100, moneyOut: 8800 },
    { label: 'W8', moneyIn: 13400, moneyOut: 9100 },
  ],
  topGames: [
    { name: 'Star Arena', share: 0.34 },
    { name: 'Ocean Quest', share: 0.27 },
    { name: 'Turbo Kart', share: 0.21 },
    { name: 'Puzzle Rush', share: 0.18 },
  ],
};

/* ── Player portal ─────────────────────────────────────────────────────── */

export const PORTAL = {
  firstName: 'Savannah',
  store: 'Store 11',
  balance: 1360.5,
  tier: 'Gold',
  toNextTier: 1240,
  referralCode: 'SAVANNAH25',
  rewards: [
    { name: 'Gold quarter rewards', amount: 250, when: 'Oct 2' },
    { name: 'Bring a Friend bonus', amount: 25, when: 'Sep 18' },
  ],
};

/* ── Import and export ─────────────────────────────────────────────────── */

export type ImportRowState = 'ready' | 'duplicate' | 'missing';

export const IMPORT = {
  file: 'players-october.xlsx',
  rows: [
    { name: 'Cody Wallace', email: 'cody.w@example.com', state: 'ready' as ImportRowState },
    { name: 'Lacey Dawson', email: 'lacey.d@example.com', state: 'ready' as ImportRowState },
    { name: 'Travis McCoy', email: 'travis.m@example.com', state: 'duplicate' as ImportRowState },
    { name: 'Boone Gentry', email: '', state: 'missing' as ImportRowState },
    { name: 'Mae Ellison', email: 'mae.e@example.com', state: 'ready' as ImportRowState },
  ],
};

export const EXPORT = {
  list: 'Transactions',
  filters: ['Store 11', 'Last 30 days', 'Money in only'],
  rows: 412,
};
