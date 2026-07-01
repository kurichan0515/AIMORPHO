import { PutCommand, QueryCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { db, TABLE_NAME } from './client';
import { IInquiryRepository } from '../../domain/inquiry/IInquiryRepository';
import { Inquiry } from '../../domain/inquiry/Inquiry';

// PK = 'INQUIRIES', SK = createdAt#inquiryId → 時系列順でクエリ可能
const PARTITION = 'INQUIRIES';

export class InquiryRepository implements IInquiryRepository {
  async save(inquiry: Inquiry): Promise<void> {
    await db.send(new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        PK: PARTITION,
        SK: `${inquiry.createdAt}#${inquiry.inquiryId}`,
        inquiryId: inquiry.inquiryId,
        userId: inquiry.userId ?? null,
        email: inquiry.email,
        category: inquiry.category,
        subject: inquiry.subject,
        body: inquiry.body,
        errorCode: inquiry.errorCode ?? null,
        status: inquiry.status,
        createdAt: inquiry.createdAt,
      },
    }));
  }

  async list(limit: number, cursor?: string): Promise<{ items: Inquiry[]; nextCursor: string | null }> {
    const r = await db.send(new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: 'PK = :pk',
      ExpressionAttributeValues: { ':pk': PARTITION },
      ScanIndexForward: false,
      Limit: limit,
      ExclusiveStartKey: cursor ? JSON.parse(Buffer.from(cursor, 'base64').toString()) : undefined,
    }));
    const nextCursor = r.LastEvaluatedKey
      ? Buffer.from(JSON.stringify(r.LastEvaluatedKey)).toString('base64')
      : null;
    return { items: (r.Items ?? []).map(this.#map), nextCursor };
  }

  async updateStatus(inquiryId: string, status: Inquiry['status']): Promise<void> {
    // contains()はKeyConditionExpressionで使用不可のため、PK全件queryしてFilterExpressionで絞り込む
    const r = await db.send(new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: 'PK = :pk',
      FilterExpression: 'inquiryId = :id',
      ExpressionAttributeValues: { ':pk': PARTITION, ':id': inquiryId },
      Limit: 200,
    }));
    const item = r.Items?.[0];
    if (!item) { return; }
    await db.send(new UpdateCommand({
      TableName: TABLE_NAME,
      Key: { PK: PARTITION, SK: item.SK as string },
      UpdateExpression: 'SET #s = :status',
      ExpressionAttributeNames: { '#s': 'status' },
      ExpressionAttributeValues: { ':status': status },
    }));
  }

  #map(i: Record<string, unknown>): Inquiry {
    return {
      inquiryId: i.inquiryId as string,
      userId: i.userId as string | undefined,
      email: i.email as string,
      category: i.category as Inquiry['category'],
      subject: i.subject as string,
      body: i.body as string,
      errorCode: i.errorCode as string | undefined,
      status: i.status as Inquiry['status'],
      createdAt: i.createdAt as string,
    };
  }
}
