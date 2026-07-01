import { UserRepository } from '../infrastructure/dynamodb/UserRepository';
import { BodyLogRepository } from '../infrastructure/dynamodb/BodyLogRepository';
import { MealRepository } from '../infrastructure/dynamodb/MealRepository';
import { AvatarRepository } from '../infrastructure/dynamodb/AvatarRepository';
import { BadgeRepository } from '../infrastructure/dynamodb/BadgeRepository';
import { GroupRepository } from '../infrastructure/dynamodb/GroupRepository';
import { AdviceRepository } from '../infrastructure/dynamodb/AdviceRepository';
import { RewardTokenRepository } from '../infrastructure/dynamodb/RewardTokenRepository';
import { InquiryRepository } from '../infrastructure/dynamodb/InquiryRepository';
import { TokenBlacklistRepository } from '../infrastructure/dynamodb/TokenBlacklistRepository';
import { AiService } from '../infrastructure/gemini/AiService';
import { StorageService } from '../infrastructure/s3/StorageService';
import { BadgeService } from '../domain/badge/BadgeService';
import { AuthApplicationService } from '../application/auth/AuthApplicationService';
import { UserApplicationService } from '../application/user/UserApplicationService';
import { BodyLogApplicationService } from '../application/body-log/BodyLogApplicationService';
import { MealApplicationService } from '../application/meal/MealApplicationService';
import { AiApplicationService } from '../application/ai/AiApplicationService';
import { AvatarApplicationService } from '../application/avatar/AvatarApplicationService';
import { SubscriptionApplicationService } from '../application/subscription/SubscriptionApplicationService';
import { SocialApplicationService } from '../application/social/SocialApplicationService';

// Infrastructure
const userRepo     = new UserRepository();
const bodyLogRepo  = new BodyLogRepository();
const mealRepo     = new MealRepository();
const avatarRepo   = new AvatarRepository();
const badgeRepo    = new BadgeRepository();
const groupRepo    = new GroupRepository();
const adviceRepo        = new AdviceRepository();
const rewardTokenRepo   = new RewardTokenRepository();
export const inquiryRepo     = new InquiryRepository();
const blacklist         = new TokenBlacklistRepository();
const aiSvc        = new AiService();
const storageSvc   = new StorageService();
const badgeSvc     = new BadgeService(badgeRepo);

// Application Services
export const authSvc         = new AuthApplicationService(userRepo, blacklist);
export const userSvc         = new UserApplicationService(userRepo, userRepo, userRepo, badgeRepo, avatarRepo, mealRepo, bodyLogRepo);
export const bodyLogSvc      = new BodyLogApplicationService(userRepo, userRepo, userRepo, bodyLogRepo, avatarRepo, mealRepo, aiSvc, badgeSvc);
export const mealSvc         = new MealApplicationService(userRepo, mealRepo, storageSvc, aiSvc, badgeSvc, userRepo, rewardTokenRepo);
export const aiSvcApp        = new AiApplicationService(userRepo, userRepo, userRepo, avatarRepo, bodyLogRepo, mealRepo, adviceRepo, rewardTokenRepo, aiSvc);
export const avatarSvc       = new AvatarApplicationService(userRepo, userRepo, avatarRepo, storageSvc, aiSvc);
export const subscriptionSvc = new SubscriptionApplicationService(userRepo);
export const socialSvc       = new SocialApplicationService(groupRepo, userRepo, userRepo, badgeRepo);

export { storageSvc };
