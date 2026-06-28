import { v4 as uuidv4 } from 'uuid';
import { IGroupRepository } from '../../domain/social/IGroupRepository';
import { IUserRepository } from '../../domain/user/IUserRepository';
import { IStreakRepository } from '../../domain/user/IStreakRepository';
import { IBadgeRepository } from '../../domain/badge/IBadgeRepository';
import { isPremium } from '../../domain/user/User';
import { Group, GroupMember } from '../../domain/social/Group';
import { Result, ok, err } from '../../domain/shared/Result';
import { UserId, GroupId } from '../../domain/shared/types';

const FREE_GROUP_LIMIT = 1;

export class SocialApplicationService {
  constructor(
    private readonly groupRepo: IGroupRepository,
    private readonly userRepo: IUserRepository,
    private readonly streakRepo: IStreakRepository,
    private readonly badgeRepo: IBadgeRepository,
  ) {}

  async createGroup(userId: UserId, name: string): Promise<Result<{ groupId: string; inviteCode: string; name: string }>> {
    const groupId = uuidv4();
    const inviteCode = Math.random().toString(36).slice(2, 8).toUpperCase();
    const now = new Date().toISOString();
    const group: Group = { groupId, name, createdBy: userId, inviteCode, createdAt: now };
    const owner: GroupMember = { groupId, userId, role: 'owner', joinedAt: now };
    await this.groupRepo.create(group, owner);
    return ok({ groupId, inviteCode, name });
  }

  async joinGroup(userId: UserId, inviteCode: string): Promise<Result<unknown>> {
    const group = await this.groupRepo.findByInviteCode(inviteCode);
    if (!group) return err('Invalid invite code', 404);

    const [existing, user, myGroups] = await Promise.all([
      this.groupRepo.getMember(group.groupId, userId),
      this.userRepo.findById(userId),
      this.groupRepo.getGroupsByUser(userId),
    ]);
    if (existing) return err('Already a member', 409);
    if (user && !isPremium(user) && myGroups.length >= FREE_GROUP_LIMIT) {
      return err('Group limit reached', 403);
    }

    const member: GroupMember = { groupId: group.groupId, userId, role: 'member', joinedAt: new Date().toISOString() };
    await this.groupRepo.addMember(member);
    return ok({ groupId: group.groupId, groupName: group.name, joinedAt: member.joinedAt });
  }

  async getMyGroups(userId: UserId): Promise<Result<unknown>> {
    const groups = await this.groupRepo.getGroupsByUser(userId);
    return ok(groups);
  }

  async getGroup(userId: UserId, groupId: GroupId): Promise<Result<unknown>> {
    const [meta, members] = await Promise.all([
      this.groupRepo.findById(groupId),
      this.groupRepo.getMembers(groupId),
    ]);
    if (!meta) return err('Group not found', 404);
    if (!members.some(m => m.userId === userId)) return err('Forbidden', 403);
    return ok({ ...meta, members });
  }

  async getGroupFeed(userId: UserId, groupId: GroupId): Promise<Result<unknown>> {
    const member = await this.groupRepo.getMember(groupId, userId);
    if (!member) return err('Forbidden', 403);

    const members = await this.groupRepo.getMembers(groupId);
    const feedItems = await Promise.all(
      members.map(async m => {
        const [user, streak, badges] = await Promise.all([
          this.userRepo.findById(m.userId),
          this.streakRepo.getStreak(m.userId),
          this.badgeRepo.listByUser(m.userId),
        ]);
        if (!user || user.deleted) return null;
        return {
          userId: m.userId,
          displayName: user.displayName ?? '',
          currentDays: streak?.currentDays ?? 0,
          badgeCount: badges.length,
        };
      })
    );

    const visibleItems = feedItems.filter((item): item is NonNullable<typeof item> => item !== null);
    return ok(visibleItems.sort((a, b) => b.currentDays - a.currentDays));
  }

  async leaveGroup(userId: UserId, groupId: GroupId): Promise<Result<{ message: string }>> {
    const member = await this.groupRepo.getMember(groupId, userId);
    if (!member) return err('Not a member', 404);
    await this.groupRepo.removeMember(groupId, userId);
    return ok({ message: 'left group' });
  }
}
