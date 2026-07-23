import { isAxiosError } from 'axios';

/** Human-readable message from any API error. */
export function apiErrorMessage(error: unknown): string {
  if (isAxiosError(error)) {
    const data = error.response?.data as { message?: unknown } | undefined;
    const msg = data?.message;
    if (typeof msg === 'string' && msg.trim()) return msg;
    if (Array.isArray(msg) && msg.length) {
      return msg.map((m) => (typeof m === 'string' ? m : JSON.stringify(m))).join(', ');
    }
    if (msg && typeof msg === 'object') {
      try {
        return JSON.stringify(msg);
      } catch {
        /* fall through */
      }
    }
    if (error.code === 'ECONNABORTED') return 'The request timed out. Please try again.';
    if (!error.response) return 'Cannot reach the server. Check your connection.';
  }
  if (error instanceof Error && error.message) return error.message;
  return 'Something went wrong. Please try again.';
}
