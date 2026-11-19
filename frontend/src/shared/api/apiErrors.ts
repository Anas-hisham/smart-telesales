import { errorText } from '@/shared/api/client';

export const API_ERROR_EVENT = 'crm:api-error';

export const API_NOTICE_EVENT = 'crm:api-notice';

/** Show a neutral info banner (not an error), e.g. "the lead went back to the pool". */
export function reportNotice(message: string) {
  window.dispatchEvent(new CustomEvent<string>(API_NOTICE_EVENT, { detail: message }));
}

/** Show an error banner (see ApiErrorBanner). Accepts a thrown error or a plain message. */
export function reportError(error: unknown) {
  window.dispatchEvent(new CustomEvent<string>(API_ERROR_EVENT, { detail: typeof error === 'string' ? error : errorText(error) }));
}
