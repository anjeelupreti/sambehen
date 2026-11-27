import { formatMoney } from '@/lib/money';
import { AnimatedMoney } from './animated-money';

/**
 * The player's balance, the one large figure on the page, with what sits
 * behind it. A cobalt card with a gold rule: the brand, at night.
 */
export function BalanceCard({
  balance,
  bonusBalance,
  moneyIn,
  moneyOut,
}: {
  balance: string;
  bonusBalance: string;
  moneyIn: string;
  moneyOut: string;
}) {
  return (
    <section
      aria-labelledby="balance-title"
      className="relative overflow-hidden rounded-2xl border border-[#2f4fbf]/60 bg-[radial-gradient(140%_120%_at_0%_0%,#2f5bff_0%,#1a2f86_42%,#111a3a_100%)] p-6 shadow-[0_20px_50px_-24px_rgb(47_91_255/0.7)]"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-1.5 rounded-[14px] border border-gold/25"
      />
      <div className="relative">
        <h2
          id="balance-title"
          className="text-[11px] font-bold tracking-[0.16em] text-[#c9d4ff] uppercase"
        >
          Balance
        </h2>
        <p className="mt-2 text-5xl font-bold tracking-tight text-white [font-stretch:115%]">
          <AnimatedMoney value={balance} />
        </p>
        <dl className="mt-6 grid grid-cols-3 gap-4 border-t border-white/15 pt-5">
          <Figure label="Bonus" value={bonusBalance} gold />
          <Figure label="Money in" value={moneyIn} />
          <Figure label="Money out" value={moneyOut} />
        </dl>
      </div>
    </section>
  );
}

function Figure({ label, value, gold }: { label: string; value: string; gold?: boolean }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-[#b5c2f2] sm:text-sm">{label}</dt>
      <dd
        className={
          gold
            ? 'mt-1 truncate text-sm font-bold text-gold sm:text-base'
            : 'mt-1 truncate text-sm font-semibold text-white sm:text-base'
        }
      >
        {formatMoney(value)}
      </dd>
    </div>
  );
}
