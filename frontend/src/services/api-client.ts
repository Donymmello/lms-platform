import { env } from "@/config/env";
import { ApiErrorResponse } from "@/types/auth";

/** Thrown for any non-2xx API response, carrying the server's status code and message. */
export class ApiError extends Error {
  public readonly statusCode: number;
  public readonly details?: unknown;

  constructor(statusCode: number, message: string, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.statusCode = statusCode;
    this.details = details;
  }
}

interface ApiFetchOptions {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  body?: unknown;
  /** Appended as a URL query string; `undefined`/`null`/`""` values are omitted. */
  query?: Record<string, string | number | boolean | undefined | null>;
}

function toQueryString(query: ApiFetchOptions["query"]): string {
  if (!query) return "";
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === "") continue;
    params.set(key, String(value));
  }
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

/**
 * The browser always uses NEXT_PUBLIC_API_URL (the only thing it can
 * resolve). Code running server-side — Server Components, generateMetadata,
 * route handlers — prefers INTERNAL_API_URL when set, since in Docker the
 * two containers can't reach each other via `localhost` (see config/env.ts).
 */
function resolveBaseUrl(): string {
  if (typeof window === "undefined" && env.INTERNAL_API_URL) {
    return env.INTERNAL_API_URL;
  }
  return env.NEXT_PUBLIC_API_URL;
}

/**
 * The absolute URL of an API path, for the cases a plain link or a media
 * element has to reach the API directly rather than going through `apiFetch` —
 * a file download, for instance. The session cookie is `SameSite=Lax`, so it
 * travels with a top-level navigation like a download link.
 */
export function apiUrl(path: string): string {
  return `${resolveBaseUrl()}${path}`;
}

/** Shared response handling for both `apiFetch` and `apiUpload` — parses JSON when present and throws `ApiError` for any non-2xx status. */
async function handleResponse<T>(response: Response): Promise<T> {
  const isJson = response.headers.get("content-type")?.includes("application/json");
  const payload = isJson ? await response.json() : null;

  if (!response.ok) {
    const errorPayload = payload as ApiErrorResponse | null;
    throw new ApiError(
      response.status,
      errorPayload?.message ?? "Something went wrong. Please try again.",
      errorPayload?.details
    );
  }

  return payload as T;
}

/**
 * Thin fetch wrapper for the backend API.
 * `credentials: "include"` is what makes the HTTP-only auth cookies travel
 * with every request — the access/refresh tokens are never read or stored
 * in JS, so there is nothing here for XSS to steal.
 */
export async function apiFetch<T>(path: string, options: ApiFetchOptions = {}): Promise<T> {
  const response = await fetch(`${resolveBaseUrl()}${path}${toQueryString(options.query)}`, {
    method: options.method ?? "GET",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
    cache: "no-store",
  });

  return handleResponse<T>(response);
}

/**
 * Multipart upload variant of `apiFetch`, for endpoints that accept a file
 * (e.g. lesson video uploads). Deliberately omits the `Content-Type` header
 * — the browser sets `multipart/form-data` with the correct boundary itself
 * when the body is a `FormData` instance; setting it manually breaks the
 * boundary and the server can't parse the upload.
 */
export async function apiUpload<T>(
  path: string,
  formData: FormData,
  options: { method?: "POST" | "PUT" } = {}
): Promise<T> {
  const response = await fetch(`${resolveBaseUrl()}${path}`, {
    method: options.method ?? "POST",
    credentials: "include",
    body: formData,
    cache: "no-store",
  });

  return handleResponse<T>(response);
}
