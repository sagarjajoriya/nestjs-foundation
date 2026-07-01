/**
 * The single, stable error envelope returned by the API for every failure.
 *
 * Keeping this shape consistent across all error sources (validation, HTTP,
 * database, unexpected) means clients can rely on one contract, and the
 * `requestId` lets support correlate a client-visible error with server logs.
 */
export interface ApiErrorResponse {
  /** HTTP status code, mirrored in the body for convenience. */
  statusCode: number;
  /** Short, machine-stable reason phrase (e.g. `"Unprocessable Entity"`). */
  error: string;
  /** Human-readable message(s). An array for multi-field validation errors. */
  message: string | string[];
  /** Correlation id (also emitted as the `x-request-id` response header). */
  requestId: string;
  /** ISO-8601 timestamp of when the error response was produced. */
  timestamp: string;
  /** The request path that produced the error. */
  path: string;
}
