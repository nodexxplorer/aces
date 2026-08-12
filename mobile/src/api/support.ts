import apiClient, { unwrap } from './client';

export interface HelpArticle {
  id: string;
  title: string;
  content: string;
  category: string;
  view_count?: number;
  helpful_count?: number;
}

export const listHelpArticles = async (category?: string) => {
  const res = await apiClient.get('/help', { params: category ? { category } : {} });
  return unwrap<HelpArticle[]>(res);
};

export interface Feedback {
  id: string;
  feedback_type: string;
  title: string;
  description: string;
  rating?: number;
  status?: string;
  created_at?: string;
}

export const createFeedback = async (data: { feedback_type: string; title: string; description: string }) => {
  const res = await apiClient.post('/feedback', data);
  return unwrap<Feedback>(res);
};

export const listMyFeedback = async () => {
  const res = await apiClient.get('/feedback/my');
  return unwrap<Feedback[]>(res);
};
