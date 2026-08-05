'use client';

import { useCallback, useState, useTransition } from 'react';
import { toast } from 'sonner';

import type { ActionResult } from '@/lib/action-result';

/**
 * Runs a server action and reports the outcome.
 *
 * Every mutation gets a toast, success included. A silent success is
 * indistinguishable from a click that did nothing, and on a list that
 * re-renders with the same rows there is often no other visible sign the
 * action landed.
 *
 * Field errors are handed back rather than toasted: a 422 belongs next to
 * the input that caused it, not in a corner of the screen.
 */
export function useAction<TArgs extends unknown[], TData>(
  action: (...args: TArgs) => Promise<ActionResult<TData>>,
) {
  const [pending, startTransition] = useTransition();
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const run = useCallback(
    (...args: TArgs) =>
      new Promise<ActionResult<TData>>((resolve) => {
        startTransition(async () => {
          setFieldErrors({});
          const result = await action(...args);

          if (result.ok) {
            toast.success(result.message);
          } else if (result.fieldErrors) {
            setFieldErrors(result.fieldErrors);
            toast.error('Check the highlighted fields.');
          } else {
            toast.error(result.message);
          }

          resolve(result);
        });
      }),
    [action],
  );

  const clearFieldErrors = useCallback(() => setFieldErrors({}), []);

  return { run, pending, fieldErrors, clearFieldErrors };
}
