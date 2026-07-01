import { UserId } from '../shared/types';

export type RewardToken = {
  tokenId: string;
  userId: UserId;
  createdAt: string;
  ttl: number; // Unix epoch seconds, DynamoDB TTL auto-delete
  verified: boolean;
};
