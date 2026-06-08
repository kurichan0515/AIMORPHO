import { GetCommand, PutCommand, DeleteCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { db, TABLE_NAME } from './client';
import { IGroupRepository } from '../../domain/social/IGroupRepository';
import { Group, GroupMember } from '../../domain/social/Group';
import { UserId, GroupId } from '../../domain/shared/types';

export class GroupRepository implements IGroupRepository {
  async create(group: Group, ownerMember: GroupMember): Promise<void> {
    await Promise.all([
      db.send(new PutCommand({
        TableName: TABLE_NAME,
        Item: {
          PK: `GROUP#${group.groupId}`,
          SK: 'META',
          name: group.name,
          createdBy: group.createdBy,
          inviteCode: group.inviteCode,
          createdAt: group.createdAt,
          GSI1PK: `INVITE#${group.inviteCode}`,
          GSI1SK: `GROUP#${group.groupId}`,
        },
      })),
      db.send(new PutCommand({
        TableName: TABLE_NAME,
        Item: {
          PK: `GROUP#${ownerMember.groupId}`,
          SK: `MEMBER#${ownerMember.userId}`,
          role: ownerMember.role,
          joinedAt: ownerMember.joinedAt,
          GSI1PK: `USER#${ownerMember.userId}`,
          GSI1SK: `GROUP#${ownerMember.groupId}`,
        },
      })),
    ]);
  }

  async findByInviteCode(inviteCode: string): Promise<Group | null> {
    const r = await db.send(new QueryCommand({
      TableName: TABLE_NAME,
      IndexName: 'GSI1',
      KeyConditionExpression: 'GSI1PK = :inv',
      ExpressionAttributeValues: { ':inv': `INVITE#${inviteCode}` },
    }));
    const item = r.Items?.[0];
    if (!item) return null;
    return this.#mapGroup(item);
  }

  async findById(groupId: GroupId): Promise<Group | null> {
    const r = await db.send(new GetCommand({ TableName: TABLE_NAME, Key: { PK: `GROUP#${groupId}`, SK: 'META' } }));
    if (!r.Item) return null;
    return this.#mapGroup(r.Item);
  }

  async addMember(member: GroupMember): Promise<void> {
    await db.send(new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        PK: `GROUP#${member.groupId}`,
        SK: `MEMBER#${member.userId}`,
        role: member.role,
        joinedAt: member.joinedAt,
        GSI1PK: `USER#${member.userId}`,
        GSI1SK: `GROUP#${member.groupId}`,
      },
    }));
  }

  async getMember(groupId: GroupId, userId: UserId): Promise<GroupMember | null> {
    const r = await db.send(new GetCommand({ TableName: TABLE_NAME, Key: { PK: `GROUP#${groupId}`, SK: `MEMBER#${userId}` } }));
    if (!r.Item) return null;
    return { groupId, userId, role: r.Item.role, joinedAt: r.Item.joinedAt };
  }

  async getMembers(groupId: GroupId): Promise<GroupMember[]> {
    const r = await db.send(new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :prefix)',
      ExpressionAttributeValues: { ':pk': `GROUP#${groupId}`, ':prefix': 'MEMBER#' },
    }));
    return (r.Items ?? []).map(i => ({
      groupId,
      userId: (i.SK as string).replace('MEMBER#', ''),
      role: i.role,
      joinedAt: i.joinedAt,
    }));
  }

  async removeMember(groupId: GroupId, userId: UserId): Promise<void> {
    await db.send(new DeleteCommand({ TableName: TABLE_NAME, Key: { PK: `GROUP#${groupId}`, SK: `MEMBER#${userId}` } }));
  }

  async getGroupsByUser(userId: UserId): Promise<Group[]> {
    const r = await db.send(new QueryCommand({
      TableName: TABLE_NAME,
      IndexName: 'GSI1',
      KeyConditionExpression: 'GSI1PK = :pk',
      ExpressionAttributeValues: { ':pk': `USER#${userId}` },
    }));
    const groupIds = (r.Items ?? []).map(i => (i.GSI1SK as string).replace('GROUP#', '')).filter(Boolean);
    const groups = await Promise.all(groupIds.map(id => this.findById(id)));
    return groups.filter((g): g is Group => g !== null);
  }

  #mapGroup(i: Record<string, unknown>): Group {
    return {
      groupId: (i.PK as string).replace('GROUP#', ''),
      name: i.name as string,
      createdBy: i.createdBy as string,
      inviteCode: i.inviteCode as string,
      createdAt: i.createdAt as string,
    };
  }
}
