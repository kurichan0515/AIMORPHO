export type LambdaEvent = {
  httpMethod: string;
  path: string;
  pathParameters?: Record<string, string>;
  queryStringParameters?: Record<string, string> | null;
  headers?: Record<string, string>;
  body?: string | null;
  requestContext?: { authorizer?: { userId?: string } };
};

export type HttpResponse = {
  statusCode: number;
  headers: Record<string, string>;
  body: string;
};

export const ok = (body: unknown, statusCode = 200): HttpResponse => ({
  statusCode,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

export const error = (message: string, statusCode = 400): HttpResponse => ({
  statusCode,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ error: message }),
});

export const parseBody = (raw?: string | null): Record<string, unknown> => {
  if (!raw) return {};
  try { return JSON.parse(raw); } catch { return {}; }
};

export const getUserId = (event: LambdaEvent): string | null =>
  event.requestContext?.authorizer?.userId ?? null;

type UseCaseResult =
  | { data: unknown; statusCode: number }
  | { error: string; statusCode: number };

export const toResponse = (result: UseCaseResult): HttpResponse =>
  'error' in result ? error(result.error, result.statusCode) : ok(result.data, result.statusCode);
