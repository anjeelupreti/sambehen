'use client';

import { useState } from 'react';
import { DownloadIcon, Loader2Icon } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';

/** The 14 lists the API can export. */
type ExportKey =
  | 'customers'
  | 'transactions'
  | 'staff'
  | 'games'
  | 'vips'
  | 'vip-criteria'
  | 'referrals'
  | 'referral-programs'
  | 'spin-events'
  | 'spin-winners'
  | 'conversations'
  | 'email-campaigns'
  | 'email-recipients'
  | 'audit-logs';

/**
 * Downloads the current list as a spreadsheet.
 *
 * Goes through `/api/exports/[key]` on this origin rather than calling the
 * API directly. The bearer token is in an httpOnly cookie that browser
 * JavaScript cannot read and that is not sent to the API's origin, so the
 * direct call this used to make failed with a 401 every time — silently,
 * because the failure arrived as a blob nobody inspected.
 *
 * The filters currently on screen travel with the request, so the file
 * matches the list the user is looking at rather than the whole table.
 */
export function ExportButton({
  exportKey,
  params,
}: {
  exportKey: ExportKey;
  /**
   * Fixed query params to send instead of the page's own filters — for an
   * export scoped to something the URL does not carry, like a single
   * campaign's recipients.
   */
  params?: Record<string, string>;
}) {
  const [exporting, setExporting] = useState(false);
  const searchParams = useSearchParams();

  const handleExport = async () => {
    setExporting(true);

    try {
      const query = params ? new URLSearchParams(params).toString() : searchParams.toString();
      const response = await fetch(`/api/exports/${exportKey}${query ? `?${query}` : ''}`);

      if (!response.ok) {
        // A failure before the stream opens is still the JSON envelope.
        const payload = (await response.json().catch(() => null)) as { message?: string } | null;
        throw new Error(payload?.message ?? 'Export failed.');
      }

      // The API names the file; only fall back if it did not.
      const disposition = response.headers.get('content-disposition') ?? '';
      const match = /filename="?([^";]+)"?/i.exec(disposition);
      const filename = match?.[1] ?? `${exportKey}.xlsx`;

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);

      toast.success('Export downloaded.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to export.');
    } finally {
      setExporting(false);
    }
  };

  return (
    <Button variant="outline" size="sm" onClick={handleExport} disabled={exporting}>
      {exporting ? (
        <Loader2Icon className="size-4 animate-spin" />
      ) : (
        <DownloadIcon className="size-4" />
      )}
      {exporting ? 'Preparing…' : 'Export'}
    </Button>
  );
}
