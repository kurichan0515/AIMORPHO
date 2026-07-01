import api from './client';

export type InquiryCategory = 'bug' | 'feature' | 'other';

export const submitInquiry = (input: {
  email: string;
  category: InquiryCategory;
  subject: string;
  body: string;
  errorCode?: string;
}) => api.post('/inquiries', input).then(r => r.data);
