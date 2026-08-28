import { NextResponse } from "next/server";

/**
 * One error envelope for the whole `/api/v1` surface, so the mobile client has
 * a single error path (docs/API.md "Errors"). The HTTP status mirrors the code.
 * Messages are human-readable but must never leak internals or say which of
 * identifier/secret was wrong — matching the web login's behaviour.
 */
export type ApiErrorCode =
  | "unauthenticated"
  | "forbidden"
  | "not_found"
  | "rate_limited"
  | "validation"
  | "conflict"
  | "server";

const STATUS: Record<ApiErrorCode, number> = {
  unauthenticated: 401,
  forbidden: 403,
  not_found: 404,
  rate_limited: 429,
  validation: 422,
  conflict: 409,
  server: 500,
};

type ErrorBody = {
  error: {
    code: ApiErrorCode;
    message: string;
    fields?: Record<string, string>;
  };
};

export function apiError(
  code: ApiErrorCode,
  message: string,
  extra?: { fields?: Record<string, string>; retryAfterSec?: number },
): NextResponse {
  const body: ErrorBody = { error: { code, message } };
  if (extra?.fields) body.error.fields = extra.fields;
  const res = NextResponse.json(body, { status: STATUS[code] });
  if (extra?.retryAfterSec && extra.retryAfterSec > 0) {
    res.headers.set("Retry-After", String(extra.retryAfterSec));
  }
  return res;
}

/** A successful JSON response. The client tolerates unknown fields, so adding
 *  fields is always safe within v1. */
export function apiOk(data: unknown, status = 200): NextResponse {
  return NextResponse.json(data, { status });
}
