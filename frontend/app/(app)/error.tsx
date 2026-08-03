'use client';

import { useEffect } from 'react';
import { AlertCircleIcon, RotateCcwIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

/**
 * Error boundary for the signed-in area.
 *
 * The wording matters. A 404 from the API may mean the record does not
 * exist OR that it belongs to another manager's chain — the backend makes
 * those deliberately indistinguishable, because saying "forbidden" would
 * confirm the record exists. So this never says "no access": it says not
 * found, exactly as the API intends.
 */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  const message = error.message || 'Something went wrong.';
  const unreachable = message.includes('Could not reach the API');

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <AlertCircleIcon className="text-destructive size-5" />
            {unreachable ? 'Cannot reach the API' : 'Something went wrong'}
          </CardTitle>
          <CardDescription>{message}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {unreachable ? (
            <p className="text-muted-foreground text-sm">
              Check that the backend is running and that <code>API_URL</code> points at it.
            </p>
          ) : null}

          {error.digest ? (
            <p className="text-muted-foreground text-xs">
              Reference: <code className="tabular">{error.digest}</code>
            </p>
          ) : null}

          <Button onClick={reset} variant="outline" size="sm">
            <RotateCcwIcon />
            Try again
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
