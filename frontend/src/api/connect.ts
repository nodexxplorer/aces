import apiClient, { unwrap } from './client';

export interface DirectoryUser {
  id: string;
  full_name: string;
  avatar_url: string | null;
  email: string;
  matric_number: string;
  level: number;
}

export interface Connection {
  id: string;
  requester_id: string;
  receiver_id: string;
  status: string;
  message: string | null;
  responded_at: string | null;
  created_at: string;
  full_name: string;
  avatar_url: string | null;
  role: string;
}

export interface Message {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  is_read: boolean;
  read_at: string | null;
  created_at: string;
}

export const getDirectory = async () => {
  const res = await apiClient.get('/campus-connect/directory');
  return unwrap<DirectoryUser[]>(res);
};

export const getMyConnections = async () => {
  const res = await apiClient.get('/campus-connect/connections');
  return unwrap<Connection[]>(res);
};

export const getPendingRequests = async () => {
  const res = await apiClient.get('/campus-connect/connections/pending');
  return unwrap<Connection[]>(res);
};

export const sendConnectionRequest = async (receiverId: string, message?: string) => {
  const res = await apiClient.post('/campus-connect/connections', { receiver_id: receiverId, message: message || null });
  return unwrap<Connection>(res);
};

export const respondToConnection = async (connectionId: string, status: 'accepted' | 'rejected') => {
  const res = await apiClient.put(`/campus-connect/connections/${connectionId}`, { status });
  return unwrap<Connection>(res);
};

export const getConversation = async (userId: string) => {
  const res = await apiClient.get(`/campus-connect/messages/${userId}`);
  return unwrap<Message[]>(res);
};

export const sendMessage = async (receiverId: string, content: string) => {
  const res = await apiClient.post('/campus-connect/messages', { receiver_id: receiverId, content });
  return unwrap<Message>(res);
};

export const markMessageRead = async (messageId: string) => {
  const res = await apiClient.put(`/campus-connect/messages/${messageId}/read`);
  return unwrap<Message>(res);
};

export const getUnreadCounts = async () => {
  const res = await apiClient.get('/campus-connect/messages/unread');
  return unwrap<Record<string, number>>(res);
};

export const getConnectionUserIds = async () => {
  const res = await apiClient.get('/campus-connect/connections/user-ids');
  return unwrap<string[]>(res);
};
