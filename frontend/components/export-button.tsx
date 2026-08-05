'use client';

import { useState } from 'react';
import { DownloadIcon, Loader2Icon } from 'lucide-react';
import { useSearchParams } from 'next/navigation';

import { Button } from '@/components/ui/button';

import { toast } from 'sonner';

interface ExportButtonProps {
  exportKey: 'customers' | 'transactions' | 'staff' | 'vips' | 'spin-winners';
}

export function ExportButton({ exportKey }: ExportButtonProps) {
  const [isExporting, setIsExporting] = useState(false);
  const searchParams = useSearchParams();

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const params = new URLSearchParams(searchParams.toString());

      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1'}/team/exports/${exportKey}?${params.toString()}`,
        {
          method: 'GET',
          credentials: 'include',
        },
      );

      if (!res.ok) throw new Error('Export failed');

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${exportKey}-export.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      console.error(err);
      toast.error('Failed to export data');
    } finally {
      setIsExporting(false);
    }
  };

  const handleImport = () => {
    toast.info('Import functionality is scheduled for the next sprint.');
  };

  return (
    <>
      <Button variant="outline" size="sm" onClick={handleImport}>
        Import
      </Button>
      <Button variant="outline" size="sm" onClick={handleExport} disabled={isExporting}>
        {isExporting ? (
          <Loader2Icon className="mr-2 size-4 animate-spin" />
        ) : (
          <DownloadIcon className="mr-2 size-4" />
        )}
        Export
      </Button>
    </>
  );
}
