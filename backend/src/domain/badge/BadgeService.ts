import { UserId, BadgeId, BadgeType } from '../shared/types';
import { Badge, BadgeDef, BADGE_DEFINITIONS } from './Badge';
import { IBadgeRepository } from './IBadgeRepository';

export class BadgeService {
  constructor(private readonly repo: IBadgeRepository) {}

  async award(userId: UserId, badgeId: BadgeId): Promise<Badge | null> {
    const existing = await this.repo.find(userId, badgeId);
    if (existing) return null;

    const def = BADGE_DEFINITIONS.find(b => b.id === badgeId);
    if (!def) return null;

    const badge: Badge = {
      userId,
      badgeId,
      name: def.name,
      description: def.description,
      earnedAt: new Date().toISOString(),
    };
    await this.repo.save(badge);
    return badge;
  }

  async checkStreakBadges(userId: UserId, currentDays: number): Promise<Badge[]> {
    const results: Badge[] = [];
    for (const def of BADGE_DEFINITIONS.filter(b => b.type === 'streak')) {
      if (currentDays >= def.threshold) {
        const awarded = await this.award(userId, def.id);
        if (awarded) results.push(awarded);
      }
    }
    return results;
  }

  async checkCountBadges(userId: UserId, type: BadgeType, count: number): Promise<Badge[]> {
    const results: Badge[] = [];
    for (const def of BADGE_DEFINITIONS.filter(b => b.type === type)) {
      if (count >= def.threshold) {
        const awarded = await this.award(userId, def.id);
        if (awarded) results.push(awarded);
      }
    }
    return results;
  }
}
