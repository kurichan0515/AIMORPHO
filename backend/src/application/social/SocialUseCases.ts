import { v4 as uuidv4 } from 'uuid';
import { IGroupRepository } from '../../domain/social/IGroupRepository';
import { Group, GroupMember } from '../../domain/social/Group';
import { IUserRepository } from '../../domain/user/IUserRepository';
import { IBadgeRepository } from '../../domain/badge/IBadgeRepository';
import { UserId, GroupId } from '../../domain/shared/types';

type Deps = { groupRepo: IGroupRepository; userRepo: IUserRepository; badgeRepo: IBadgeRepository };

export const createGroup = async (deps: Deps, userId: UserId, name: string) => {
  const groupId = uuidv4();
  const inviteCode = Math.random().toString(36).slice(2, 8).toUpperCase();
  const now = new Date().toISOString();
  const group: Group = { groupId, name, createdBy: userId, inviteCode, createdAt: now };
  const owner: GroupMember = { groupId, userId, role: 'owner', joinedAt: now };
  await deps.groupRepo.create(group, owner);
  return { data: { groupId, inviteCode, name }, statusCode: 201 } as const;
};

export const joinGroup = async (deps: Deps, userId: UserId, inviteCode: string) => {
  const group = await deps.groupRepo.findByInviteCode(inviteCode);
  if (!group) return { error: 'Invalid invite code', statusCode: 404 } as const;

  const existing = await deps.groupRepo.getMember(group.groupId, userId);
  if (existing) return { error: 'Already a member', statusCode: 409 } as const;

  const member: GroupMember = { groupId: group.groupId, userId, role: 'member', joinedAt: new Date().toISOString() };
  await deps.groupRepo.addMember(member);
  return { data: { groupId: group.groupId, groupName: group.name, joinedAt: member.joinedAt }, statusCode: 200 } as const;
};

export const getMyGroups = async (deps: Deps, userId: UserId) => {
  const groups = await deps.groupRepo.getGroupsByUser(userId);
  return { data: groups, statusCode: 200 } as const;
};

export const getGroup = async (deps: Deps, userId: UserId, groupId: GroupId) => {
  const [meta, members] = await Promise.all([
    deps.groupRepo.findById(groupId),
    deps.groupRepo.getMembers(groupId),
  ]);
  if (!meta) return { error: 'Group not found', statusCode: 404 } as const;
  if (!members.some(m => m.userId === userId)) return { error: 'Forbidden', statusCode: 403 } as const;
  return { data: { ...meta, members }, statusCode: 200 } as const;
};

export const getGroupFeed = async (deps: Deps, userId: UserId, groupId: GroupId) => {
  const member = await deps.groupRepo.getMember(groupId, userId);
  if (!member) return { error: 'Forbidden', statusCode: 403 } as const;

  const members = await deps.groupRepo.getMembers(groupId);
  const feedItems = await Promise.all(
    members.map(async m => {
      const [user, streak, badges] = await Promise.all([
        deps.userRepo.findById(m.userId),
        deps.userRepo.getStreak(m.userId),
        deps.badgeRepo.listByUser(m.userId),
      ]);
      return {
        userId: m.userId,
        displayName: user?.displayName ?? '',
        currentDays: streak?.currentDays ?? 0,
        badgeCount: badges.length,
      };
    })
  );

  return { data: feedItems.sort((a, b) => b.currentDays - a.currentDays), statusCode: 200 } as const;
};

export const leaveGroup = async (deps: Deps, userId: UserId, groupId: GroupId) => {
  const member = await deps.groupRepo.getMember(groupId, userId);
  if (!member) return { error: 'Not a member', statusCode: 404 } as const;
  await deps.groupRepo.removeMember(groupId, userId);
  return { data: { message: 'left group' }, statusCode: 200 } as const;
};
