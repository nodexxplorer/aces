import apiClient from './client';
import type { Connection, Message, Group, GroupMember, GroupMessage, PaginationParams } from '../types';

// --- Connections ---
export const sendConnectionRequest = async (recipientId: string, message?: string) => {
  const { data } = await apiClient.post<{ data: Connection }>('/campus-connect/connections', { recipientId, message });
  return data.data;
};

export const getMyConnections = async () => {
  const { data } = await apiClient.get<{ data: Connection[] }>('/campus-connect/connections/my');
  return data.data;
};

export const getPendingRequests = async () => {
  const { data } = await apiClient.get<{ data: Connection[] }>('/campus-connect/connections/pending');
  return data.data;
};

export const respondToConnection = async (connectionId: string, accept: boolean) => {
  const { data } = await apiClient.post<{ data: Connection }>(`/campus-connect/connections/${connectionId}/respond`, { accept });
  return data.data;
};

export const removeConnection = async (connectionId: string) => {
  await apiClient.delete(`/campus-connect/connections/${connectionId}`);
};

// --- Messages ---
export const getConversation = async (userId: string) => {
  const { data } = await apiClient.get<{ data: Message[] }>(`/campus-connect/messages/${userId}`);
  return data.data;
};

export const sendMessage = async (recipientId: string, content: string) => {
  const { data } = await apiClient.post<{ data: Message }>('/campus-connect/messages', { recipientId, content });
  return data.data;
};

// --- Groups ---
export const getGroups = async (params?: PaginationParams & { type?: string }) => {
  const { data } = await apiClient.get<{ data: Group[] }>('/campus-connect/groups', { params });
  return data.data;
};

export const getGroup = async (groupId: string) => {
  const { data } = await apiClient.get<{ data: Group }>(`/campus-connect/groups/${groupId}`);
  return data.data;
};

export const createGroup = async (payload: Pick<Group, 'name' | 'description' | 'type' | 'isPrivate' | 'maxMembers'>) => {
  const { data } = await apiClient.post<{ data: Group }>('/campus-connect/groups', payload);
  return data.data;
};

export const joinGroup = async (groupId: string) => {
  const { data } = await apiClient.post<{ data: GroupMember }>(`/campus-connect/groups/${groupId}/join`);
  return data.data;
};

export const leaveGroup = async (groupId: string) => {
  await apiClient.post(`/campus-connect/groups/${groupId}/leave`);
};

export const getGroupMessages = async (groupId: string) => {
  const { data } = await apiClient.get<{ data: GroupMessage[] }>(`/campus-connect/groups/${groupId}/messages`);
  return data.data;
};

export const sendGroupMessage = async (groupId: string, content: string) => {
  const { data } = await apiClient.post<{ data: GroupMessage }>(`/campus-connect/groups/${groupId}/messages`, { content });
  return data.data;
};
