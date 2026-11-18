import { Subject } from 'rxjs';
import { common } from '../i18n/common.messages';
import { format } from '../i18n/format';
import { ApiError } from '../api/api-error';

// 04-ARCH 5.5.1: unhandled API errors from every mutation, turned into one toast each by the shell.
export const globalErrors$ = new Subject<unknown>();

function rateLimited(error: ApiError): string {
  return error.retryAfterSec === null
    ? common.errors.rateLimitedSoon
    : format(common.errors.rateLimited, { seconds: error.retryAfterSec });
}

// 04-ARCH 6.4. A 401 is the session's job, and validation and conflicts belong to their form.
export function errorToMessage(error: unknown): string {
  if (!(error instanceof ApiError)) return common.errors.server;
  if (error.status === 0) return common.errors.network;
  if (error.status === 403) return common.errors.forbidden;
  if (error.status === 429) return rateLimited(error);
  if (error.status >= 500) return common.errors.server;
  return error.message;
}
