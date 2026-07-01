import { UserId } from '../shared/types';
import { RewardToken } from './RewardToken';

export interface IRewardTokenRepository {
  create(token: RewardToken): Promise<void>;
  findById(tokenId: string): Promise<RewardToken | null>;
  markVerified(tokenId: string): Promise<void>;
  delete(tokenId: string): Promise<void>;
  // verified=true かつ userId 一致の場合のみ削除（条件付き原子操作）。
  // 競合リクエストが同じトークンを使おうとした場合、一方だけが成功する。
  findAndDeleteVerified(tokenId: string, userId: string): Promise<boolean>;
}
