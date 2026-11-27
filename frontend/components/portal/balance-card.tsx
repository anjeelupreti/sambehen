import { formatMoney } from '@/lib/money';
import { AnimatedMoney } from './animated-money';

/**
 * The player's balance, the one large figure on the page. Drawn as a
 * cobalt ticket: notched sides, a dashed gold rule inside, the figure set
 * in the slab face like a prize board.
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
      className="ticket relative rounded-2xl bg-[#2a52ea] px-7 py-6 text-white"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-2 rounded-xl border border-dashed border-gold/60"
      />
      <div className="relative">
        <h2
          id="balance-title"
          className="text-[11px] font-bold tracking-[0.18em] text-white/75 uppercase"
        >
          Balance
        </h2>
        <p className="font-slab mt-2 text-[2.75rem] leading-none sm:text-5xl">
          <AnimatedMoney value={balance} />
        </p>
        <dl className="mt-6 grid grid-cols-3 gap-4 border-t border-dashed border-white/30 pt-4">
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
      <dt className="flex items-center gap-1 text-xs text-white/75 sm:text-sm">
        {gold && (
          <span aria-hidden className="text-gold">
            ★
          </span>
        )}
        {label}
      </dt>
      <dd className="mt-1 truncate text-sm font-semibold sm:text-base">{formatMoney(value)}</dd>
    </div>
  );
}
