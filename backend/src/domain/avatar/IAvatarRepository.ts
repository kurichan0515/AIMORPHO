import { UserId } from '../shared/types';
import { Avatar } from './Avatar';

export interface IAvatarRepository {
  get(userId: UserId): Promise<Avatar | null>;
  save(avatar: Avatar): Promise<void>;
  updateBodyState(userId: UserId, bodyState: number, updatedAt: string): Promise<Avatar>;
  delete(userId: UserId): Promise<void>;
}
