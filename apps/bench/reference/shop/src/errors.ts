export class ApiError extends Error {
  constructor(public status: number, public code: string, message?: string) {
    super(message ?? code);
  }
}
export const invalid = (message: string) => new ApiError(422, 'validation_error', message);
export const notFound = (message = 'not found') => new ApiError(404, 'not_found', message);
export const invalidState = (message: string) => new ApiError(409, 'invalid_state', message);
export const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
/** The time a request says to assume (`at`), or the real time when it gives none. */
export function timeOf(body: unknown): string {
  const at = isObject(body) ? body.at : undefined;
  if (at === undefined || at === null) return new Date().toISOString();
  if (typeof at !== 'string' || Number.isNaN(new Date(at).getTime())) throw invalid('at must be a date-time');
  return new Date(at).toISOString();
}
