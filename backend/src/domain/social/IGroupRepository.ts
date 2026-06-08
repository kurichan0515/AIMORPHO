import { UserId, GroupId } from '../shared/types';
import { Group, GroupMember } from './Group';

export interface IGroupRepository {
  create(group: Group, ownerMember: GroupMember): Promise<void>;
  findByInviteCode(inviteCode: string): Promise<Group | null>;
  findById(groupId: GroupId): Promise<Group | null>;
  addMember(member: GroupMember): Promise<void>;
  getMember(groupId: GroupId, userId: UserId): Promise<GroupMember | null>;
  getMembers(groupId: GroupId): Promise<GroupMember[]>;
  removeMember(groupId: GroupId, userId: UserId): Promise<void>;
  getGroupsByUser(userId: UserId): Promise<Group[]>;
}
