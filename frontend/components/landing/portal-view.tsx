import { PORTAL, formatMoney } from './landing-data';

/** The player portal as a player sees it on their phone. */
export function PortalView() {
  return (
    <div className="border-lp-line bg-lp-raised mx-auto w-full max-w-sm overflow-hidden rounded-[1.75rem] border shadow-[0_30px_70px_-40px_rgb(18_26_43/0.45)]">
      <div className="border-lp-line flex items-center justify-between border-b px-5 py-4">
        <p className="font-bold [font-stretch:125%]">Sambehen</p>
        <p className="text-lp-dim text-xs">{PORTAL.store}</p>
      </div>

      <div className="space-y-5 p-5">
        <div>
          <p className="text-lp-dim text-sm">Hi {PORTAL.firstName}, your balance</p>
          <p className="tabular mt-1 text-4xl font-extrabold [font-stretch:118%]">
            {formatMoney(PORTAL.balance)}
          </p>
        </div>

        <div className="bg-lp-chip/15 rounded-xl p-4">
          <div className="flex items-baseline justify-between">
            <p className="text-sm font-semibold">{PORTAL.tier} member</p>
            <p className="text-lp-chip-text text-xs font-semibold">This quarter</p>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-white">
            <div className="bg-lp-chip h-full w-3/4 rounded-full" />
          </div>
          <p className="text-lp-dim mt-2 text-xs">
            {formatMoney(PORTAL.toNextTier)} more keeps Gold next quarter
          </p>
        </div>

        <div>
          <p className="text-lp-dim text-xs">Recent rewards</p>
          <ul className="divide-lp-line mt-1 divide-y">
            {PORTAL.rewards.map((reward) => (
              <li key={reward.name} className="flex items-baseline justify-between gap-3 py-2.5">
                <span className="min-w-0 text-sm">
                  {reward.name}
                  <span className="text-lp-dim block text-xs">{reward.when}</span>
                </span>
                <span className="tabular text-lp-ok text-sm font-semibold">
                  +{formatMoney(reward.amount)}
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div className="border-lp-line flex items-center justify-between gap-3 rounded-xl border px-4 py-3">
          <div className="min-w-0">
            <p className="text-lp-dim text-xs">Your referral code</p>
            <p className="tabular truncate font-semibold tracking-wide">{PORTAL.referralCode}</p>
          </div>
          <span className="bg-lp-sunk rounded-md px-3 py-1.5 text-xs font-semibold">Copy link</span>
        </div>

        <span className="bg-lp-primary flex h-11 items-center justify-center rounded-xl text-sm font-semibold text-white">
          Message {PORTAL.store}
        </span>
      </div>
    </div>
  );
}
