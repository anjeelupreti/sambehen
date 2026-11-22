import { EXPORT, IMPORT, type ImportRowState } from './landing-data';
import { Frame } from './product-frame';
import { cn } from '@/lib/utils';

const ROW_NOTE: Record<ImportRowState, string> = {
  ready: 'Ready',
  duplicate: 'Email already in use',
  missing: 'Email is missing',
};

/** The spreadsheet import preview, and a filtered export beside it. */
export function ImportExportView() {
  const ready = IMPORT.rows.filter((row) => row.state === 'ready').length;

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
      <Frame title={`Import preview: ${IMPORT.file}`}>
        <table className="w-full min-w-[28rem] text-sm">
          <thead>
            <tr className="text-lp-dim text-left text-xs">
              <th scope="col" className="w-10 px-4 py-2.5 font-medium">
                <span className="sr-only">Include</span>
              </th>
              <th scope="col" className="py-2.5 pr-4 font-medium">
                Player
              </th>
              <th scope="col" className="py-2.5 pr-4 text-right font-medium">
                Check
              </th>
            </tr>
          </thead>
          <tbody className="divide-lp-line divide-y">
            {IMPORT.rows.map((row) => {
              const ok = row.state === 'ready';
              return (
                <tr key={row.name} className={cn(!ok && 'bg-lp-stop/[0.04]')}>
                  <td className="px-4 py-2.5">
                    <span
                      aria-hidden
                      className={cn(
                        'grid size-4 place-items-center rounded border text-[10px] leading-none',
                        ok
                          ? 'bg-lp-primary border-lp-primary text-white'
                          : 'border-lp-line-strong bg-lp-raised',
                      )}
                    >
                      {ok ? '✓' : ''}
                    </span>
                  </td>
                  <td className="py-2.5 pr-4">
                    <span className="font-medium">{row.name}</span>
                    <span className="text-lp-dim block truncate text-xs">
                      {row.email || 'No email'}
                    </span>
                  </td>
                  <td
                    className={cn(
                      'py-2.5 pr-4 text-right text-xs font-medium',
                      ok ? 'text-lp-ok' : 'text-lp-stop',
                    )}
                  >
                    {ROW_NOTE[row.state]}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div className="border-lp-line flex items-center justify-between gap-3 border-t px-4 py-3">
          <p className="text-lp-dim text-xs">
            <span className="text-lp-text tabular font-semibold">{ready}</span> of{' '}
            {IMPORT.rows.length} rows will be added
          </p>
          <span className="bg-lp-primary rounded-md px-3 py-1.5 text-xs font-semibold text-white">
            Import {ready} players
          </span>
        </div>
      </Frame>

      <Frame title={`Export ${EXPORT.list.toLowerCase()}`}>
        <div className="space-y-5 p-4">
          <div>
            <p className="text-lp-dim text-xs">Filters on screen</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {EXPORT.filters.map((filter) => (
                <span
                  key={filter}
                  className="border-lp-line-strong rounded-md border px-2.5 py-1 text-xs"
                >
                  {filter}
                </span>
              ))}
            </div>
          </div>
          <p className="text-sm">
            <span className="tabular text-2xl font-semibold [font-stretch:112%]">
              {EXPORT.rows}
            </span>{' '}
            <span className="text-lp-dim">rows, exactly what the list shows</span>
          </p>
          <div className="flex gap-2">
            <span className="bg-lp-primary rounded-md px-3 py-1.5 text-xs font-semibold text-white">
              Download Excel
            </span>
            <span className="border-lp-line-strong rounded-md border px-3 py-1.5 text-xs font-semibold">
              CSV
            </span>
          </div>
        </div>
      </Frame>
    </div>
  );
}
