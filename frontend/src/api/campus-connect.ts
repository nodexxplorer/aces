import apiClient, { unwrap } from './client';
import type { Connection, Message, Group, GroupMember, GroupMessage } from '../types';

// --- Connections ---
export const sendConnectionRequest = async (receiverId: string, message?: string) => {
  const res = await apiClient.post('/campus-connect/connections', { receiver_id: receiverId, message });
  return unwrap<Connection>(res);
};

export const getMyConnections = async () => {
  const res = await apiClient.get('/campus-connect/connections');
  return unwrap<Connection[]>(res);
};

export const getPendingRequests = async () => {
  const res = await apiClient.get('/campus-connect/connections/pending');
  return unwrap<Connection[]>(res);
};

export const respondToConnection = async (connectionId: string, status: 'accepted' | 'rejected') => {
  const res = await apiClient.put(`/campus-connect/connections/${connectionId}`, { status });
  return unwrap<Connection>(res);
};

// --- Messages ---
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

// --- Groups ---
export const getGroups = async () => {
  const res = await apiClient.get('/campus-connect/groups');
  return unwrap<Group[]>(res);
};

export const getMyGroups = async () => {
  const res = await apiClient.get('/campus-connect/groups/my');
  return unwrap<Group[]>(res);
};

export const getGroup = async (groupId: string) => {
  const res = await apiClient.get(`/campus-connect/groups/${groupId}`);
  return unwrap<Group>(res);
};

export const createGroup = async (payload: {
  name: string;
  description?: string;
  category: string;
  avatar_url?: string;
  max_members?: number;
  is_private?: boolean;
}) => {
  const res = await apiClient.post('/campus-connect/groups', payload);
  return unwrap<Group>(res);
};

export const joinGroup = async (groupId: string) => {
  const res = await apiClient.post(`/campus-connect/groups/${groupId}/join`);
  return unwrap<GroupMember>(res);
};

export const leaveGroup = async (groupId: string) => {
  await apiClient.post(`/campus-connect/groups/${groupId}/leave`);
};

export const getGroupMembers = async (groupId: string) => {
  const res = await apiClient.get(`/campus-connect/groups/${groupId}/members`);
  return unwrap<GroupMember[]>(res);
};

export const getGroupMessages = async (groupId: string) => {
  const res = await apiClient.get(`/campus-connect/groups/${groupId}/messages`);
  return unwrap<GroupMessage[]>(res);
};

export const sendGroupMessage = async (groupId: string, content: string) => {
  const res = await apiClient.post(`/campus-connect/groups/${groupId}/messages`, { content });
  return unwrap<GroupMessage>(res);
};

// --- Directories ---
export const getStudentDirectory = async () => {
  const res = await apiClient.get('/campus-connect/directory/students');
  return unwrap<any[]>(res);
};

export const getAlumniDirectory = async () => {
  const res = await apiClient.get('/campus-connect/directory/alumni');
  return unwrap<any[]>(res);
};
