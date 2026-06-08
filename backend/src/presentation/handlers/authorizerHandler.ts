import { verifyToken } from '../../infrastructure/auth/JwtService';

type AuthorizerEvent = {
  authorizationToken: string;
  methodArn: string;
};

type PolicyStatement = {
  Action: string;
  Effect: 'Allow' | 'Deny';
  Resource: string;
};

const policy = (principalId: string, effect: 'Allow' | 'Deny', resource: string, context?: Record<string, string>) => ({
  principalId,
  policyDocument: {
    Version: '2012-10-17',
    Statement: [{ Action: 'execute-api:Invoke', Effect: effect, Resource: resource } as PolicyStatement],
  },
  context,
});

export const handler = async (event: AuthorizerEvent) => {
  const token = event.authorizationToken?.replace('Bearer ', '');
  if (!token) return policy('user', 'Deny', event.methodArn);

  try {
    const payload = await verifyToken(token);
    return policy(payload.sub, 'Allow', event.methodArn, { userId: payload.sub });
  } catch {
    return policy('user', 'Deny', event.methodArn);
  }
};
