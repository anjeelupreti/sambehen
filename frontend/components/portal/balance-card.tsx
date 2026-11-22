import { formatMoney } from '@/lib/money';

/** The player's balance, the one large figure on the page, with what sits behind it. */
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
    <section aria-labelledby="balance-title" className="bg-card rounded-xl border p-6">
      <h2 id="balance-title" className="text-muted-foreground text-sm font-normal">
        Balance
      </h2>
      <p className="mt-2 text-5xl font-semibold tracking-tight [font-stretch:115%]">
        {formatMoney(balance)}
      </p>
      <dl className="mt-6 grid grid-cols-3 gap-4 border-t pt-5">
        <Figure label="Bonus" value={bonusBalance} />
        <Figure label="Money in" value={moneyIn} />
        <Figure label="Money out" value={moneyOut} />
      </dl>
    </section>
  );
}

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-muted-foreground text-xs sm:text-sm">{label}</dt>
      <dd className="mt-1 truncate text-sm font-semibold sm:text-base">{formatMoney(value)}</dd>
    </div>
  );
}
