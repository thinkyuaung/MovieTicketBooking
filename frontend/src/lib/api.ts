const TOKEN_KEY = "mt.token";

/**
 * Error thrown when the API answers with a non-2xx status.
 */
export class ApiError extends Error {
  readonly status: number;
  readonly details: unknown;

  /**
   * @param status - HTTP status code.
   * @param message - Error message from the API, or a fallback.
   * @param details - Extra data from the API, e.g. `{ seats: ["A1"] }`.
   */
  constructor(status: number, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

/**
 * Reads the saved login token.
 *
 * @returns The token, or null when logged out or storage is blocked.
 */
export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

/**
 * Saves or clears the login token.
 *
 * @param token - The token, or null to log out.
 */
export function setToken(token: string | null): void {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    // Storage blocked: the user stays logged in for this page only.
  }
}

/**
 * Options for {@link api}.
 */
export interface IApiOptions {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  body?: unknown;
  signal?: AbortSignal;
}

/**
 * Calls the backend API with the saved login token and returns the parsed JSON body.
 *
 * @param path - Path under `/api`, e.g. `/movies`.
 * @param options - Method, JSON body and abort signal.
 * @returns The response body (undefined for 204 No Content).
 * @throws ApiError if the response status is not 2xx.
 */
export async function api<T>(path: string, options: IApiOptions = {}): Promise<T> {
  const headers: Record<string, string> = {};
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (options.body !== undefined) headers["Content-Type"] = "application/json";

  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      method: options.method ?? "GET",
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: options.signal,
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") throw err;
    throw new ApiError(0, "Can't reach the server. Check that the backend is running.");
  }

  if (res.status === 204) return undefined as T;
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, body.error ?? `Request failed (${res.status})`, body.details);
  return body as T;
}

/**
 * Builds a query string from defined values.
 *
 * @param params - Query values; undefined, null and empty strings are skipped.
 * @returns e.g. `?from=2026-10-01&hallId=2`, or an empty string.
 */
export function query(params: Record<string, string | number | undefined | null>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") search.set(key, String(value));
  }
  const text = search.toString();
  return text ? `?${text}` : "";
}

/**
 * Returns a user-facing message for any error.
 *
 * @param err - The caught error.
 * @returns The message.
 */
export function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : "Something went wrong.";
}
