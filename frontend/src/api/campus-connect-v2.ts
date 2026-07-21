import apiClient, { unwrap } from './client';

// --- Types ---
export interface CampusProfile {
  id: string;
  user_id: string;
  bio: string | null;
  interests: string[];
  skills: string[];
  availability_status: string;
  post_count: number;
  connection_count: number;
  created_at: string;
  updated_at: string;
}

export interface FeedPost {
  id: string;
  author_id: string;
  author_name: string;
  author_avatar: string | null;
  post_type: string;
  content: string;
  media_urls: string[];
  target_audience: string;
  group_id: string | null;
  like_count: number;
  comment_count: number;
  share_count: number;
  is_hidden: boolean;
  created_at: string;
}

export interface FeedReaction {
  id: string;
  post_id: string;
  user_id: string;
  reaction_type: string;
  full_name: string;
  created_at: string;
}

export interface ReactionCount {
  reaction_type: string;
  count: number;
}

export interface FeedComment {
  id: string;
  post_id: string;
  author_id: string;
  author_name: string;
  author_avatar: string | null;
  parent_comment_id: string | null;
  content: string;
  created_at: string;
}

export interface ConnectionSuggestion {
  id: string;
  full_name: string;
  avatar_url: string | null;
  role: string;
  matric_number: string | null;
  level: number | null;
  bio: string;
  skills: string[];
  interests: string[];
  department: string;
  mutual_connections: number;
}

export interface SearchResult {
  id: string;
  full_name: string;
  avatar_url: string | null;
  role: string;
  email: string;
  matric_number: string | null;
  level: number | null;
  bio: string;
  skills: string[];
}

export interface GroupFile {
  id: string;
  group_id: string;
  uploaded_by: string;
  uploaded_by_name: string;
  file_name: string;
  file_url: string;
  file_type: string | null;
  file_size: number | null;
  created_at: string;
}

export interface CampusReport {
  id: string;
  reporter_id: string;
  target_type: string;
  target_id: string;
  reason: string;
  description: string | null;
  status: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  action_taken: string | null;
  created_at: string;
}

export interface PostBookmark {
  id: string;
  user_id: string;
  post_id: string;
  created_at: string;
}

// --- Profiles ---
export const upsertCampusProfile = async (data: {
  bio?: string;
  interests?: string[];
  skills?: string[];
  availability_status?: string;
}): Promise<CampusProfile> => {
  const res = await apiClient.post('/campus-profile', data);
  return unwrap<CampusProfile>(res);
};

export const getCampusProfile = async (userId: string): Promise<CampusProfile> => {
  const res = await apiClient.get(`/campus-profile/${userId}`);
  return unwrap<CampusProfile>(res);
};

// --- Feed Posts ---
export const createFeedPost = async (data: {
  content: string;
  post_type?: string;
  media_urls?: string[];
  target_audience?: string;
  group_id?: string;
}): Promise<FeedPost> => {
  const res = await apiClient.post('/feed', data);
  return unwrap<FeedPost>(res);
};

export const listFeedPosts = async (limit = 20, offset = 0): Promise<FeedPost[]> => {
  const res = await apiClient.get('/feed', { params: { limit, offset } });
  return unwrap<FeedPost[]>(res);
};

export const getFeedPost = async (postId: string): Promise<FeedPost> => {
  const res = await apiClient.get(`/feed/${postId}`);
  return unwrap<FeedPost>(res);
};

export const deleteFeedPost = async (postId: string): Promise<void> => {
  await apiClient.delete(`/feed/${postId}`);
};

export const hideFeedPost = async (postId: string): Promise<void> => {
  await apiClient.post(`/feed/${postId}/hide`);
};

// --- Reactions ---
export const togglePostReaction = async (
  postId: string,
  reactionType: string
): Promise<{ reaction_type: string | null; message: string }> => {
  const res = await apiClient.post(`/feed/${postId}/react`, {
    reaction_type: reactionType,
  });
  return unwrap<{ reaction_type: string | null; message: string }>(res);
};

export const listPostReactions = async (
  postId: string
): Promise<{ data: FeedReaction[]; counts: ReactionCount[] }> => {
  const res = await apiClient.get(`/feed/${postId}/reactions`);
  return { data: unwrap<FeedReaction[]>(res), counts: res.data.counts };
};

// --- Comments ---
export const createPostComment = async (
  postId: string,
  content: string,
  parentCommentId?: string
): Promise<FeedComment> => {
  const res = await apiClient.post(`/feed/${postId}/comments`, {
    content,
    parent_comment_id: parentCommentId,
  });
  return unwrap<FeedComment>(res);
};

export const listPostComments = async (postId: string): Promise<FeedComment[]> => {
  const res = await apiClient.get(`/feed/${postId}/comments`);
  return unwrap<FeedComment[]>(res);
};

export const deletePostComment = async (commentId: string): Promise<void> => {
  await apiClient.delete(`/comments/${commentId}`);
};

// --- Bookmarks ---
export const togglePostBookmark = async (
  postId: string
): Promise<{ bookmarked: boolean }> => {
  const res = await apiClient.post(`/feed/${postId}/bookmark`);
  return unwrap<{ bookmarked: boolean }>(res);
};

export const listUserBookmarks = async (): Promise<FeedPost[]> => {
  const res = await apiClient.get('/feed/bookmarks');
  return unwrap<FeedPost[]>(res);
};

// --- Message Reactions ---
export const toggleMessageReaction = async (
  messageId: string,
  reactionType: string
): Promise<{ reaction_type: string | null; message: string }> => {
  const res = await apiClient.post(`/messages/${messageId}/react`, {
    reaction_type: reactionType,
  });
  return unwrap<{ reaction_type: string | null; message: string }>(res);
};

// --- Group Files ---
export const uploadGroupFile = async (
  groupId: string,
  data: { file_name: string; file_url: string; file_type?: string; file_size?: number }
): Promise<GroupFile> => {
  const res = await apiClient.post(`/groups/${groupId}/files`, data);
  return unwrap<GroupFile>(res);
};

export const listGroupFiles = async (groupId: string): Promise<GroupFile[]> => {
  const res = await apiClient.get(`/groups/${groupId}/files`);
  return unwrap<GroupFile[]>(res);
};

// --- Connection Suggestions ---
export const getConnectionSuggestions = async (): Promise<ConnectionSuggestion[]> => {
  const res = await apiClient.get('/feed/suggestions');
  return unwrap<ConnectionSuggestion[]>(res);
};

// --- Search People ---
export const searchPeople = async (query: string): Promise<SearchResult[]> => {
  const res = await apiClient.get('/feed/search', { params: { q: query } });
  return unwrap<SearchResult[]>(res);
};

// --- Reports & Moderation ---
export const createCampusReport = async (data: {
  target_type: string;
  target_id: string;
  reason: string;
  description?: string;
}): Promise<CampusReport> => {
  const res = await apiClient.post('/reports/campus', data);
  return unwrap<CampusReport>(res);
};

export const listCampusReports = async (status?: string): Promise<CampusReport[]> => {
  const params: Record<string, string> = {};
  if (status) params.status = status;
  const res = await apiClient.get('/reports/campus', { params });
  return unwrap<CampusReport[]>(res);
};

export const updateCampusReportStatus = async (
  reportId: string,
  status: string,
  actionTaken?: string
): Promise<void> => {
  await apiClient.put(`/reports/campus/${reportId}/status`, {
    status,
    action_taken: actionTaken,
  });
};

export const issueStrike = async (
  targetUserId: string,
  reason: string
): Promise<{ message: string; strike_number: number }> => {
  const res = await apiClient.post('/strikes', {
    target_user_id: targetUserId,
    reason,
  });
  return unwrap<{ message: string; strike_number: number }>(res);
};
