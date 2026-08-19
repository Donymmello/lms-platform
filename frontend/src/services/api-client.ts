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
 * Thin fetch wrapper for the backend API.
 * `credentials: "include"` is what makes the HTTP-only auth cookies travel
 * with every request — the access/refresh tokens are never read or stored
 * in JS, so there is nothing here for XSS to steal.
 */
export async function apiFetch<T>(path: string, options: ApiFetchOptions = {}): Promise<T> {
  const response = await fetch(`${env.NEXT_PUBLIC_API_URL}${path}${toQueryString(options.query)}`, {
    method: options.method ?? "GET",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
    cache: "no-store",
  });

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
