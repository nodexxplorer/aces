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
  const res = await apiClient.post('/campus-connect/connections', {
    receiver_id: receiverId,
    message: message || null,
  });
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

export interface DMConversation {
  connection_id: string;
  other_user_id: string;
  other_full_name: string;
  other_avatar_url: string | null;
  last_message: string | null;
  last_message_at: string | null;
  last_message_mine: boolean;
  unread_count: number;
}

export const getMyConversations = async () => {
  const res = await apiClient.get('/campus-connect/conversations');
  return unwrap<DMConversation[]>(res);
};

export interface Group {
  id: string;
  name: string;
  description: string | null;
  category: string;
  avatar_url: string | null;
  max_members: number | null;
  is_private: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface GroupConversation {
  id: string;
  name: string;
  description: string | null;
  category: string;
  avatar_url: string | null;
  is_private: boolean;
  member_role: string;
  member_count: number;
  last_message: string | null;
  last_message_at: string | null;
  last_message_sender: string | null;
  created_at: string;
}

export interface GroupMember {
  id: string;
  group_id: string;
  user_id: string;
  role: string;
  joined_at: string;
  full_name: string;
  avatar_url: string | null;
  email: string;
}

export interface GroupMessage {
  id: string;
  group_id: string;
  sender_id: string;
  content: string;
  created_at: string;
  full_name: string;
  avatar_url: string | null;
}

export interface PublicGroup {
  id: string;
  name: string;
  description: string | null;
  category: string;
  avatar_url: string | null;
  is_private: boolean;
  member_count: number;
}

export const createGroup = async (payload: {
  name: string;
  description?: string;
  category?: string;
  is_private?: boolean;
  member_ids?: string[];
}) => {
  const res = await apiClient.post('/groups', payload);
  return unwrap<Group>(res);
};

export const getMyGroups = async () => {
  const res = await apiClient.get('/groups/mine');
  return unwrap<GroupConversation[]>(res);
};

export const getPublicGroups = async () => {
  const res = await apiClient.get('/groups');
  return unwrap<PublicGroup[]>(res);
};

export const getGroup = async (groupId: string) => {
  const res = await apiClient.get(`/groups/${groupId}`);
  return unwrap<Group>(res);
};

export const getGroupInviteCode = async (groupId: string) => {
  const res = await apiClient.get(`/groups/${groupId}/invite-code`);
  return unwrap<{ invite_code: string }>(res);
};

export interface GroupPreview {
  id: string;
  name: string;
  description: string | null;
  avatar_url: string | null;
  is_private: boolean;
  member_count: number;
}

export const getGroupByInviteCode = async (code: string) => {
  const res = await apiClient.get(`/groups/join/${code}`);
  return unwrap<GroupPreview>(res);
};

export const joinGroup = async (groupId: string) => {
  const res = await apiClient.post(`/groups/${groupId}/join`);
  return unwrap<GroupMember>(res);
};

export const leaveGroup = async (groupId: string) => {
  await apiClient.post(`/groups/${groupId}/leave`);
};

export const getGroupMembers = async (groupId: string) => {
  const res = await apiClient.get(`/groups/${groupId}/members`);
  return unwrap<GroupMember[]>(res);
};

export const addGroupMember = async (groupId: string, userId: string) => {
  const res = await apiClient.post(`/groups/${groupId}/members`, { user_id: userId });
  return unwrap<GroupMember>(res);
};

export const sendGroupMessage = async (groupId: string, content: string) => {
  const res = await apiClient.post(`/groups/${groupId}/messages`, { content });
  return unwrap<GroupMessage>(res);
};

export const getGroupMessages = async (groupId: string) => {
  const res = await apiClient.get(`/groups/${groupId}/messages`);
  return unwrap<GroupMessage[]>(res);
};
