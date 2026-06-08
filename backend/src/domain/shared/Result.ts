export type Result<T> =
  | { ok: true; value: T }
  | { ok: false; error: string; statusCode: number };

export const ok = <T>(value: T): Result<T> => ({ ok: true, value });
export const err = (error: string, statusCode = 400): Result<never> => ({
  ok: false,
  error,
  statusCode,
});

export type HttpResponse = {
  statusCode: number;
  headers: Record<string, string>;
  body: string;
};

export const httpOk = (body: unknown, statusCode = 200): HttpResponse => ({
  statusCode,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

export const httpError = (message: string, statusCode = 400): HttpResponse => ({
  statusCode,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ error: message }),
});
