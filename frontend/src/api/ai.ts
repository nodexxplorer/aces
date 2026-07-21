import apiClient, { unwrap } from './client';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

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

export interface AISettings {
  id: string;
  user_id: string;
  chatbot_enabled: boolean;
  personalization_enabled: boolean;
  face_recognition_enabled: boolean;
  data_collection_consent: boolean;
  preferred_language: string;
}

export interface AIInteraction {
  id: string;
  feature: string;
  session_id?: string;
  input_text: string;
  output_text: string;
  confidence_score?: number;
  was_accurate?: boolean;
  user_feedback?: string;
  model_used?: string;
  response_time_ms?: number;
  created_at: string;
}

export const sendChatMessage = async (message: string, sessionId?: string) => {
  const res = await apiClient.post('/ai/chat', { message, session_id: sessionId });
  return unwrap<ChatResponse>(res);
};

export const getQuickActions = async () => {
  const res = await apiClient.get('/ai/quick-actions');
  return unwrap<QuickAction[]>(res);
};

export const sendChatFeedback = async (interactionId: string, feedback: 'positive' | 'negative' | 'neutral', wasAccurate?: boolean) => {
  const res = await apiClient.post('/ai/feedback', {
    interaction_id: interactionId,
    feedback,
    was_accurate: wasAccurate,
  });
  return res.data;
};

export const getChatHistory = async (sessionId?: string) => {
  const params = sessionId ? { session_id: sessionId } : {};
  const res = await apiClient.get('/ai/history', { params });
  return unwrap<AIInteraction[]>(res);
};

export const getAISettings = async () => {
  const res = await apiClient.get('/ai/settings');
  return unwrap<AISettings>(res);
};

export const updateAISettings = async (settings: Partial<AISettings>) => {
  const res = await apiClient.put('/ai/settings', settings);
  return res.data;
};
