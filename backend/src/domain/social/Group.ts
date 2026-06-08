import { UserId, GroupId, GroupRole, DateString } from '../shared/types';

export type Group = {
  groupId: GroupId;
  name: string;
  createdBy: UserId;
  inviteCode: string;
  createdAt: DateString;
};

export type GroupMember = {
  groupId: GroupId;
  userId: UserId;
  role: GroupRole;
  joinedAt: DateString;
};
