import { reportError } from '@/shared/api/apiErrors';

/** Run an API call; on failure show the error banner and return `fallback`. */
export async function attempt<T, F = undefined>(apiCall: () => Promise<T>, fallback?: F): Promise<T | F | undefined> {
  try { return await apiCall(); } catch (error) { reportError(error); return fallback; }
}
