import { Inquiry } from './Inquiry';

export interface IInquiryRepository {
  save(inquiry: Inquiry): Promise<void>;
  list(limit: number, cursor?: string): Promise<{ items: Inquiry[]; nextCursor: string | null }>;
  updateStatus(inquiryId: string, status: Inquiry['status']): Promise<void>;
}
