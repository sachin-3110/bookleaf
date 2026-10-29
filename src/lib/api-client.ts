/**
 * The one place the client talks to the API.
 *
 * Responsibilities:
 *  - unwrap the `{ data }` success envelope so callers get the payload directly
 *  - expose a separate helper for paginated responses, where the paging
 *    numbers live in `meta` rather than `data`
 *  - convert the `{ error }` envelope into a typed `ApiClientError`
 *  - send cookies (`credentials: "same-origin"`) so the httpOnly session works
 */

export class ApiClientError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = "ApiClientError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

interface Envelope<T> {
  data?: T;
  meta?: Record<string, unknown>;
  error?: { code?: string; message?: string; details?: unknown };
}

export interface PageMeta {
  page: number;
  limit: number;
  total: number;
}

/** Either the parsed envelope or a thrown `ApiClientError`. */
async function request<T>(
  path: string,
  init?: RequestInit,
): Promise<{ data: T; meta: Record<string, unknown> }> {
  const headers = new Headers(init?.headers);
  if (init?.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const res = await fetch(path, { ...init, headers, credentials: "same-origin" });

  const raw = await res.text();
  let body: Envelope<T> | null = null;
  if (raw) {
    try {
      body = JSON.parse(raw) as Envelope<T>;
    } catch {
      body = null;
    }
  }

  if (!res.ok) {
    throw new ApiClientError(
      res.status,
      body?.error?.code ?? "INTERNAL_ERROR",
      body?.error?.message ?? `Request failed with status ${res.status}.`,
      body?.error?.details,
    );
  }

  return { data: body?.data as T, meta: body?.meta ?? {} };
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const { data } = await request<T>(path, init);
  return data;
}

/** For endpoints that return `{ data: { items }, meta: { page, limit, total } }`. */
export async function apiFetchPage<T>(
  path: string,
  init?: RequestInit,
): Promise<{ items: T[] } & PageMeta> {
  const { data, meta } = await request<{ items: T[] }>(path, init);
  return {
    items: data?.items ?? [],
    page: Number(meta.page ?? 1),
    limit: Number(meta.limit ?? 0),
    total: Number(meta.total ?? 0),
  };
}

/** SWR fetcher for plain `{ data: T }` endpoints. */
export const swrFetcher = <T>(url: string) => apiFetch<T>(url);

/** SWR fetcher for paginated endpoints. */
export const swrPageFetcher = <T>(url: string) => apiFetchPage<T>(url);
