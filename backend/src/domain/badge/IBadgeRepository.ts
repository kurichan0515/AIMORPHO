import { UserId, BadgeId, BadgeType } from '../shared/types';
import { Badge } from './Badge';

export interface IBadgeRepository {
  find(userId: UserId, badgeId: BadgeId): Promise<Badge | null>;
  save(badge: Badge): Promise<void>;
  listByUser(userId: UserId): Promise<Badge[]>;
}
