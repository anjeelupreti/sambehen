import { DASHBOARD, formatMoney } from './landing-data';
import { Frame } from './product-frame';

/** The chart's ceiling; ticks sit at 0, half and full so every label is a value drawn to scale. */
const SCALE_MAX = 14000;
const TICKS = [SCALE_MAX, SCALE_MAX / 2, 0];

const compact = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  notation: 'compact',
  maximumFractionDigits: 0,
});

/** The operator dashboard: this month's figures, money over time, top games. */
export function DashboardView() {
  return (
    <div className="space-y-4">
      <dl className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {DASHBOARD.kpis.map((kpi) => (
          <div key={kpi.label} className="border-lp-line bg-lp-raised rounded-xl border p-4">
            <dt className="text-lp-dim text-xs">{kpi.label}</dt>
            <dd className="tabular mt-2 text-xl font-semibold [font-stretch:112%] sm:text-2xl">
              {typeof kpi.value === 'number'
                ? formatMoney(kpi.value).replace(/\.00$/, '')
                : kpi.value}
            </dd>
            <p className="text-lp-dim mt-1 text-xs">{'delta' in kpi ? kpi.delta : kpi.note}</p>
          </div>
        ))}
      </dl>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Frame
          title="Money in and out, by week"
          action={
            <span className="text-lp-dim flex items-center gap-3 text-xs">
              <span className="flex items-center gap-1.5">
                <span className="bg-lp-signal size-2 rounded-sm" /> In
              </span>
              <span className="flex items-center gap-1.5">
                <span className="bg-lp-line-strong size-2 rounded-sm" /> Out
              </span>
            </span>
          }
        >
          <div className="flex min-w-[26rem] gap-3 px-4 pt-5 pb-4">
            <div className="text-lp-dim tabular flex h-44 flex-col justify-between pb-5 text-right text-[11px]">
              {TICKS.map((tick) => (
                <span key={tick} className="-translate-y-1/2 leading-none">
                  {compact.format(tick)}
                </span>
              ))}
            </div>
            <div className="relative flex-1">
              <div
                aria-hidden
                className="absolute inset-x-0 top-0 bottom-5 flex flex-col justify-between"
              >
                {TICKS.map((tick) => (
                  <span key={tick} className="border-lp-line block border-t" />
                ))}
              </div>
              <ol className="relative grid h-44 grid-cols-8 gap-2">
                {DASHBOARD.weeks.map((week) => (
                  <li key={week.label} className="flex flex-col items-center gap-1.5">
                    <div className="flex w-full flex-1 items-end justify-center gap-1">
                      <span
                        className="bg-lp-signal w-2.5 rounded-t-sm sm:w-3"
                        style={{ height: `${(week.moneyIn / SCALE_MAX) * 100}%` }}
                        title={`${week.label} in: ${formatMoney(week.moneyIn)}`}
                      />
                      <span
                        className="bg-lp-line-strong w-2.5 rounded-t-sm sm:w-3"
                        style={{ height: `${(week.moneyOut / SCALE_MAX) * 100}%` }}
                        title={`${week.label} out: ${formatMoney(week.moneyOut)}`}
                      />
                    </div>
                    <span className="text-lp-dim text-[11px] leading-none">{week.label}</span>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </Frame>

        <Frame title="Top games by money in">
          <ul className="space-y-4 p-4">
            {DASHBOARD.topGames.map((game) => (
              <li key={game.name}>
                <div className="flex justify-between text-sm">
                  <span>{game.name}</span>
                  <span className="tabular text-lp-dim">{Math.round(game.share * 100)}%</span>
                </div>
                <div className="bg-lp-sunk mt-1.5 h-1.5 overflow-hidden rounded-full">
                  <div
                    className="bg-lp-signal h-full rounded-full"
                    style={{ width: `${game.share * 100}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        </Frame>
      </div>
    </div>
  );
}
