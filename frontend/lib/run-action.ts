import 'server-only';

import { ApiError } from './api';
import { actionFailed, actionOk, type ActionResult } from './action-result';

/**
 * Wraps an API call made from a server action.
 *
 * Two rules encoded here rather than repeated at every call site:
 *
 * 1. A 404 is reported as "not found". The API deliberately cannot tell a
 *    missing record apart from one in another manager's chain, and any
 *    wording that says "no access" would confirm the record exists — which
 *    is exactly what the scoping is hiding.
 * 2. `error.code` is contractual and `message` is not, so the message goes
 *    to the user and the code is what anything else branches on.
 *
 * `redirect()` and `notFound()` work by throwing, so those are re-thrown
 * untouched — swallowing them would turn a redirect into a silent no-op.
 */
export async function runAction<TData>(
  work: () => Promise<TData>,
  successMessage: string,
): Promise<ActionResult<TData>> {
  try {
    return actionOk(successMessage, await work());
  } catch (error) {
    if (isFrameworkSignal(error)) throw error;

    if (error instanceof ApiError) {
      if (error.status === 404) {
        return actionFailed('Not found.', error.code);
      }

      const fieldErrors = error.fieldErrors;
      return actionFailed(
        error.message,
        error.code,
        Object.keys(fieldErrors).length > 0 ? fieldErrors : undefined,
      );
    }

    console.error('Unexpected failure in a server action', error);
    return actionFailed('Something went wrong. Please try again.', 'UNKNOWN_ERROR');
  }
}

/** Next signals control flow by throwing; those must not be caught. */
function isFrameworkSignal(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'digest' in error &&
    typeof (error as { digest: unknown }).digest === 'string' &&
    ((error as { digest: string }).digest.startsWith('NEXT_REDIRECT') ||
      (error as { digest: string }).digest === 'NEXT_NOT_FOUND')
  );
}
