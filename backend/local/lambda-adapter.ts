import { Request, Response } from 'express';
import { LambdaEvent } from '../src/presentation/http';

const toEvent = (req: Request, userId: string | null = null): LambdaEvent => ({
  httpMethod: req.method,
  path: req.path,
  pathParameters: req.params as Record<string, string>,
  queryStringParameters: Object.keys(req.query).length ? req.query as Record<string, string> : null,
  body: req.body ? JSON.stringify(req.body) : null,
  requestContext: { authorizer: userId ? { userId } : {} },
});

type LambdaResponse = { statusCode: number; body?: string };

const fromResponse = (lambdaRes: LambdaResponse, res: Response): void => {
  const body = lambdaRes.body ? JSON.parse(lambdaRes.body) : {};
  res.status(lambdaRes.statusCode).json(body);
};

type LambdaHandler = (event: LambdaEvent) => Promise<LambdaResponse>;

export const wrap = (handler: LambdaHandler) => async (req: Request & { userId?: string }, res: Response): Promise<void> => {
  try {
    const event = toEvent(req, req.userId ?? null);
    const result = await handler(event);
    fromResponse(result, res);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
};
