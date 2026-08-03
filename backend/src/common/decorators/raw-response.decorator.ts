import { SetMetadata, CustomDecorator } from '@nestjs/common';

export const RAW_RESPONSE_KEY = 'raw_response';

/**
 * Opts a route out of the JSON response envelope.
 *
 * Required for binary and streamed payloads — the Excel/CSV export
 * endpoints — where wrapping the body in `{ success, data, ... }` would
 * corrupt the file.
 *
 * Errors thrown *before* the stream opens still produce the standard JSON
 * error envelope, because the exception filter is unaffected by this flag.
 */
export const RawResponse = (): CustomDecorator<string> => SetMetadata(RAW_RESPONSE_KEY, true);
