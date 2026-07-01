export type InquiryCategory = 'bug' | 'feature' | 'other';

export type Inquiry = {
  inquiryId: string;
  userId?: string;
  email: string;
  category: InquiryCategory;
  subject: string;
  body: string;
  errorCode?: string;
  createdAt: string;
  status: 'new' | 'in_progress' | 'resolved';
};
