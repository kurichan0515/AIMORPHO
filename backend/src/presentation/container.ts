import { UserRepository } from '../infrastructure/dynamodb/UserRepository';
import { BodyLogRepository } from '../infrastructure/dynamodb/BodyLogRepository';
import { MealRepository } from '../infrastructure/dynamodb/MealRepository';
import { AvatarRepository } from '../infrastructure/dynamodb/AvatarRepository';
import { BadgeRepository } from '../infrastructure/dynamodb/BadgeRepository';
import { GroupRepository } from '../infrastructure/dynamodb/GroupRepository';
import { AdviceRepository, TokenBlacklistRepository } from '../infrastructure/dynamodb/AdviceRepository';
import { BadgeService } from '../domain/badge/BadgeService';

const userRepo     = new UserRepository();
const bodyLogRepo  = new BodyLogRepository();
const mealRepo     = new MealRepository();
const avatarRepo   = new AvatarRepository();
const badgeRepo    = new BadgeRepository();
const groupRepo    = new GroupRepository();
const adviceRepo   = new AdviceRepository();
const blacklist    = new TokenBlacklistRepository();
const badgeSvc     = new BadgeService(badgeRepo);

export const deps = {
  userRepo, bodyLogRepo, mealRepo, avatarRepo,
  badgeRepo, groupRepo, adviceRepo, blacklist, badgeSvc,
};
