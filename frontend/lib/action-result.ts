/**
 * The shape every server action returns.
 *
 * Actions never throw across the server/client boundary: a thrown error in
 * production is replaced with a generic digest, which would turn a precise
 * "username already taken" into "something went wrong". Returning the
 * failure keeps the API's own message and code intact so the UI can show
 * the user what to actually fix.
 */
export type ActionResult<TData = undefined> =
  | { ok: true; message: string; data?: TData }
  | { ok: false; message: string; code: string; fieldErrors?: Record<string, string> };

export function actionOk<TData>(message: string, data?: TData): ActionResult<TData> {
  return { ok: true, message, data };
}

export function actionFailed(
  message: string,
  code: string,
  fieldErrors?: Record<string, string>,
): ActionResult<never> {
  return { ok: false, message, code, fieldErrors };
}
