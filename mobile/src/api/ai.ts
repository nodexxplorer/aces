import apiClient, { unwrap } from './client';

export interface ChatResponse {
  reply: string;
  confidence: number;
  model_used: string;
  response_time_ms: number;
  suggestions?: string[];
}

export interface QuickAction {
  id: string;
  label: string;
  icon: string;
  query: string;
}

export const sendChatMessage = async (message: string, sessionId?: string) => {
  const res = await apiClient.post('/ai/chat', { message, session_id: sessionId });
  return unwrap<ChatResponse>(res);
};

export const getQuickActions = async () => {
  const res = await apiClient.get('/ai/quick-actions');
  return unwrap<QuickAction[]>(res);
};
