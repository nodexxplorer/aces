import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Heart,
  MessageCircle,
  Bookmark,
  MoreHorizontal,
  Send,
  ChevronDown,
  Image,
  Megaphone,
  CalendarDays,
  Briefcase,
  Trophy,
  FileText,
  Trash2,
  EyeOff,
  Flag,
  SmilePlus,
  ThumbsUp,
  PartyPopper,
  Lightbulb,
  Laugh,
  X,
} from 'lucide-react';
import {
  createFeedPost,
  listFeedPosts,
  togglePostReaction,
  createPostComment,
  listPostComments,
  togglePostBookmark,
  hideFeedPost,
  deleteFeedPost,
  type FeedPost as FeedPostType,
  type FeedComment,
  type ReactionCount,
} from '../../api/campus-connect-v2';
import { useAuth } from '../../hooks/useAuth';
import { useNotification } from '../../hooks/useNotification';
import Button from '../../components/ui/Button';

const REACTIONS = [
  { type: 'like', icon: ThumbsUp, label: 'Like' },
  { type: 'love', icon: Heart, label: 'Love' },
  { type: 'celebrate', icon: PartyPopper, label: 'Celebrate' },
  { type: 'insightful', icon: Lightbulb, label: 'Insightful' },
  { type: 'funny', icon: Laugh, label: 'Funny' },
] as const;

const POST_TYPES = [
  { value: 'text', label: 'Text', icon: FileText },
  { value: 'photo', label: 'Photo', icon: Image },
  { value: 'announcement', label: 'Announcement', icon: Megaphone },
  { value: 'event', label: 'Event', icon: CalendarDays },
  { value: 'job', label: 'Job', icon: Briefcase },
  { value: 'achievement', label: 'Achievement', icon: Trophy },
] as const;

const TARGET_AUDIENCES = [
  { value: 'all', label: 'Everyone' },
  { value: 'students', label: 'Students' },
  { value: 'alumni', label: 'Alumni' },
  { value: 'staff', label: 'Staff' },
];

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const seconds = Math.floor((now - then) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
}

function PostTypeBadge({ type }: { type: string }) {
  const entry = POST_TYPES.find((p) => p.value === type);
  if (!entry || type === 'text') return null;
  const Icon = entry.icon;
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-primary-50 text-primary-600 dark:bg-primary-500/10 dark:text-primary-400">
      <Icon className="w-3 h-3" />
      {entry.label}
    </span>
  );
}

function ReactionPicker({
  postId,
  onReact,
  onClose,
}: {
  postId: string;
  onReact: (postId: string, type: string) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  return (
    <div
      ref={ref}
      className="absolute bottom-full mb-2 left-0 flex gap-1 bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-xl shadow-lg px-2 py-1.5 z-20"
    >
      {REACTIONS.map((r) => (
        <button
          key={r.type}
          title={r.label}
          onClick={() => {
            onReact(postId, r.type);
            onClose();
          }}
          className="p-1.5 rounded-lg hover:bg-surface-100 dark:hover:bg-surface-700 transition-colors"
        >
          <r.icon className="w-5 h-5 text-surface-600 dark:text-surface-300" />
        </button>
      ))}
    </div>
  );
}

function CommentSection({
  postId,
  commentCount,
}: {
  postId: string;
  commentCount: number;
}) {
  const { user } = useAuth();
  const { error: notifyError } = useNotification();
  const [comments, setComments] = useState<FeedComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [newComment, setNewComment] = useState('');
  const [replyTo, setReplyTo] = useState<FeedComment | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await listPostComments(postId);
        if (!cancelled) setComments(data);
      } catch {
        if (!cancelled) notifyError('Error', 'Failed to load comments');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [postId, notifyError]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || submitting) return;
    setSubmitting(true);
    try {
      const created = await createPostComment(postId, newComment.trim(), replyTo?.id);
      setComments((prev) => [...prev, created]);
      setNewComment('');
      setReplyTo(null);
    } catch {
      notifyError('Error', 'Failed to post comment');
    } finally {
      setSubmitting(false);
    }
  };

  const topLevel = comments.filter((c) => !c.parent_comment_id);
  const replies = comments.filter((c) => c.parent_comment_id);

  return (
    <div className="border-t border-surface-100 dark:border-surface-800 pt-3 mt-3 space-y-3">
      {loading ? (
        <p className="text-xs text-surface-400">Loading comments...</p>
      ) : (
        <>
          {topLevel.map((c) => (
            <div key={c.id} className="space-y-2">
              <div className="flex items-start gap-2">
                <div className="w-7 h-7 rounded-full bg-surface-200 dark:bg-surface-700 flex items-center justify-center flex-shrink-0 text-xs font-semibold text-surface-600 dark:text-surface-300 overflow-hidden">
                  {c.author_avatar ? (
                    <img src={c.author_avatar} alt="" className="w-full h-full object-cover" />
                  ) : (
                    (c.author_name?.[0] || '?').toUpperCase()
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-surface-800 dark:text-surface-200">
                      {c.author_name}
                    </span>
                    <span className="text-[10px] text-surface-400">{timeAgo(c.created_at)}</span>
                  </div>
                  <p className="text-xs text-surface-700 dark:text-surface-300 mt-0.5 break-words">
                    {c.content}
                  </p>
                  <button
                    onClick={() => {
                      setReplyTo(c);
                      inputRef.current?.focus();
                    }}
                    className="text-[10px] text-primary-500 hover:text-primary-600 font-medium mt-1"
                  >
                    Reply
                  </button>
                </div>
              </div>
              {replies
                .filter((r) => r.parent_comment_id === c.id)
                .map((r) => (
                  <div key={r.id} className="flex items-start gap-2 ml-9">
                    <div className="w-6 h-6 rounded-full bg-surface-200 dark:bg-surface-700 flex items-center justify-center flex-shrink-0 text-[10px] font-semibold text-surface-600 dark:text-surface-300 overflow-hidden">
                      {r.author_avatar ? (
                        <img src={r.author_avatar} alt="" className="w-full h-full object-cover" />
                      ) : (
                        (r.author_name?.[0] || '?').toUpperCase()
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-surface-800 dark:text-surface-200">
                          {r.author_name}
                        </span>
                        <span className="text-[10px] text-surface-400">{timeAgo(r.created_at)}</span>
                      </div>
                      <p className="text-xs text-surface-700 dark:text-surface-300 mt-0.5 break-words">
                        {r.content}
                      </p>
                    </div>
                  </div>
                ))}
            </div>
          ))}
          {topLevel.length === 0 && (
            <p className="text-xs text-surface-400 text-center py-2">No comments yet. Be the first!</p>
          )}
        </>
      )}

      {replyTo && (
        <div className="flex items-center gap-2 text-xs text-surface-500 bg-surface-50 dark:bg-surface-800/50 rounded-lg px-3 py-1.5">
          <span>
            Replying to <span className="font-semibold text-surface-700 dark:text-surface-300">{replyTo.author_name}</span>
          </span>
          <button onClick={() => setReplyTo(null)} className="ml-auto">
            <X className="w-3 h-3" />
          </button>
        </div>
      )}

      {commentCount > 0 && comments.length >= commentCount && (
        <p className="text-[10px] text-surface-400 text-center">
          Showing {comments.length} comment{comments.length !== 1 && 's'}
        </p>
      )}

      <form onSubmit={handleSubmit} className="flex gap-2">
        <div className="w-7 h-7 rounded-full bg-surface-200 dark:bg-surface-700 flex items-center justify-center flex-shrink-0 text-xs font-semibold text-surface-600 dark:text-surface-300 overflow-hidden">
          {user?.avatar || user?.avatarUrl ? (
            <img
              src={user.avatar || user.avatarUrl || ''}
              alt=""
              className="w-full h-full object-cover"
            />
          ) : (
            (user?.fullName?.[0] || user?.full_name?.[0] || '?').toUpperCase()
          )}
        </div>
        <div className="flex-1 flex gap-2">
          <input
            ref={inputRef}
            type="text"
            placeholder={replyTo ? `Reply to ${replyTo.author_name}...` : 'Write a comment...'}
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            className="flex-1 text-xs px-3 py-1.5 rounded-full bg-surface-50 dark:bg-surface-800 border border-surface-200 dark:border-surface-700 focus:outline-none focus:ring-2 focus:ring-primary-500/20 text-surface-800 dark:text-surface-200 placeholder-surface-400"
          />
          <Button
            type="submit"
            size="xs"
            disabled={!newComment.trim() || submitting}
            leftIcon={<Send className="w-3 h-3" />}
          />
        </div>
      </form>
    </div>
  );
}

function PostMenu({
  post,
  currentUserId,
  onHide,
  onDelete,
}: {
  post: FeedPostType;
  currentUserId?: string;
  onHide: (postId: string) => void;
  onDelete: (postId: string) => void;
}) {
  const { error: notifyError, success: notifySuccess } = useNotification();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const isAuthor = post.author_id === currentUserId;

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleHide = async () => {
    try {
      await hideFeedPost(post.id);
      onHide(post.id);
      notifySuccess('Hidden', 'Post hidden from your feed');
    } catch {
      notifyError('Error', 'Failed to hide post');
    }
    setOpen(false);
  };

  const handleDelete = async () => {
    try {
      await deleteFeedPost(post.id);
      onDelete(post.id);
      notifySuccess('Deleted', 'Post has been deleted');
    } catch {
      notifyError('Error', 'Failed to delete post');
    }
    setOpen(false);
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="p-1.5 rounded-lg text-surface-400 hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors"
      >
        <MoreHorizontal className="w-4 h-4" />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 w-44 bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-xl shadow-lg z-20 overflow-hidden">
          {!isAuthor && (
            <button
              onClick={handleHide}
              className="w-full flex items-center gap-2 px-3 py-2 text-xs text-surface-700 dark:text-surface-300 hover:bg-surface-50 dark:hover:bg-surface-700 transition-colors"
            >
              <EyeOff className="w-3.5 h-3.5" />
              Hide from feed
            </button>
          )}
          {!isAuthor && (
            <button
              onClick={() => {
                notifySuccess('Reported', 'Post has been reported');
                setOpen(false);
              }}
              className="w-full flex items-center gap-2 px-3 py-2 text-xs text-surface-700 dark:text-surface-300 hover:bg-surface-50 dark:hover:bg-surface-700 transition-colors"
            >
              <Flag className="w-3.5 h-3.5" />
              Report
            </button>
          )}
          {isAuthor && (
            <button
              onClick={handleDelete}
              className="w-full flex items-center gap-2 px-3 py-2 text-xs text-danger-500 hover:bg-danger-50 dark:hover:bg-danger-500/10 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Delete post
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function PostCard({
  post,
  currentUserId,
  onDelete,
  onHide,
}: {
  post: FeedPostType;
  currentUserId?: string;
  onDelete: (postId: string) => void;
  onHide: (postId: string) => void;
}) {
  const { success: notifySuccess, error: notifyError } = useNotification();
  const [reactions, setReactions] = useState<ReactionCount[]>([]);
  const [myReaction, setMyReaction] = useState<string | null>(null);
  const [bookmarked, setBookmarked] = useState(false);
  const [showReactionPicker, setShowReactionPicker] = useState(false);
  const [showComments, setShowComments] = useState(false);

  const handleReaction = useCallback(
    async (postId: string, type: string) => {
      try {
        const result = await togglePostReaction(postId, type);
        if (result.reaction_type) {
          setMyReaction(result.reaction_type);
          setReactions((prev) => {
            const updated = prev.map((r) => ({
              ...r,
              count: r.reaction_type === result.reaction_type ? r.count + 1 : r.count,
            }));
            if (!updated.find((r) => r.reaction_type === result.reaction_type)) {
              updated.push({ reaction_type: result.reaction_type, count: 1 });
            }
            return updated;
          });
        } else {
          setMyReaction(null);
          setReactions((prev) =>
            prev
              .map((r) => ({
                ...r,
                count: r.count - 1,
              }))
              .filter((r) => r.count > 0)
          );
        }
      } catch {
        notifyError('Error', 'Failed to react');
      }
    },
    [notifyError]
  );

  const handleBookmark = useCallback(async () => {
    try {
      const result = await togglePostBookmark(post.id);
      setBookmarked(result.bookmarked);
      notifySuccess(
        result.bookmarked ? 'Bookmarked' : 'Removed',
        result.bookmarked ? 'Post saved to bookmarks' : 'Post removed from bookmarks'
      );
    } catch {
      notifyError('Error', 'Failed to update bookmark');
    }
  }, [post.id, notifySuccess, notifyError]);

  const totalReactionCount = post.like_count + reactions.reduce((sum, r) => sum + r.count, 0);

  return (
    <div className="bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-800 rounded-2xl p-5 space-y-4">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-surface-200 dark:bg-surface-700 flex items-center justify-center flex-shrink-0 overflow-hidden">
            {post.author_avatar ? (
              <img src={post.author_avatar} alt="" className="w-full h-full object-cover" />
            ) : (
              <span className="text-sm font-semibold text-surface-600 dark:text-surface-300">
                {(post.author_name?.[0] || '?').toUpperCase()}
              </span>
            )}
          </div>
          <div>
            <h3 className="text-sm font-semibold text-surface-900 dark:text-surface-100">
              {post.author_name}
            </h3>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-xs text-surface-400">{timeAgo(post.created_at)}</span>
              {post.target_audience !== 'all' && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-surface-100 dark:bg-surface-800 text-surface-500 capitalize">
                  {post.target_audience}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <PostTypeBadge type={post.post_type} />
          <PostMenu post={post} currentUserId={currentUserId} onHide={onHide} onDelete={onDelete} />
        </div>
      </div>

      <p className="text-sm text-surface-700 dark:text-surface-300 whitespace-pre-wrap leading-relaxed">
        {post.content}
      </p>

      {post.media_urls?.length > 0 && (
        <div className="grid grid-cols-2 gap-2 rounded-xl overflow-hidden">
          {post.media_urls.slice(0, 4).map((url, i) => (
            <img
              key={i}
              src={url}
              alt={`Post media ${i + 1}`}
              className="w-full h-40 object-cover"
            />
          ))}
        </div>
      )}

      {(totalReactionCount > 0 || post.comment_count > 0) && (
        <div className="flex items-center justify-between text-xs text-surface-400 px-1">
          <div className="flex items-center gap-1">
            {totalReactionCount > 0 && (
              <span className="flex items-center gap-1">
                <ThumbsUp className="w-3.5 h-3.5 text-primary-500" />
                {totalReactionCount}
              </span>
            )}
          </div>
          {post.comment_count > 0 && (
            <span>{post.comment_count} comment{post.comment_count !== 1 && 's'}</span>
          )}
        </div>
      )}

      <div className="flex items-center border-t border-surface-100 dark:border-surface-800 pt-2 -mx-1">
        <div className="relative flex-1">
          <button
            onClick={() => setShowReactionPicker(!showReactionPicker)}
            className={`w-full flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium transition-colors ${
              myReaction
                ? 'text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-500/10'
                : 'text-surface-500 hover:bg-surface-50 dark:hover:bg-surface-800'
            }`}
          >
            <ThumbsUp className="w-4 h-4" />
            {myReaction
              ? REACTIONS.find((r) => r.type === myReaction)?.label || 'Liked'
              : 'Like'}
          </button>
          {showReactionPicker && (
            <ReactionPicker
              postId={post.id}
              onReact={handleReaction}
              onClose={() => setShowReactionPicker(false)}
            />
          )}
        </div>
        <button
          onClick={() => setShowComments(!showComments)}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium text-surface-500 hover:bg-surface-50 dark:hover:bg-surface-800 transition-colors"
        >
          <MessageCircle className="w-4 h-4" />
          Comment
        </button>
        <button
          onClick={handleBookmark}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium transition-colors ${
            bookmarked
              ? 'text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-500/10'
              : 'text-surface-500 hover:bg-surface-50 dark:hover:bg-surface-800'
          }`}
        >
          <Bookmark className="w-4 h-4" />
          {bookmarked ? 'Saved' : 'Save'}
        </button>
      </div>

      {showComments && <CommentSection postId={post.id} commentCount={post.comment_count} />}
    </div>
  );
}

function CreatePostCard({ onCreated }: { onCreated: (post: FeedPostType) => void }) {
  const { user } = useAuth();
  const { success: notifySuccess, error: notifyError } = useNotification();
  const [content, setContent] = useState('');
  const [postType, setPostType] = useState('text');
  const [targetAudience, setTargetAudience] = useState('all');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim() || submitting) return;
    setSubmitting(true);
    try {
      const post = await createFeedPost({
        content: content.trim(),
        post_type: postType,
        target_audience: targetAudience,
      });
      onCreated(post);
      setContent('');
      setPostType('text');
      setTargetAudience('all');
      notifySuccess('Posted', 'Your post is now live!');
    } catch {
      notifyError('Error', 'Failed to create post');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-800 rounded-2xl p-5 space-y-4">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-full bg-surface-200 dark:bg-surface-700 flex items-center justify-center flex-shrink-0 overflow-hidden">
          {user?.avatar || user?.avatarUrl ? (
            <img
              src={user.avatar || user.avatarUrl || ''}
              alt=""
              className="w-full h-full object-cover"
            />
          ) : (
            <span className="text-sm font-semibold text-surface-600 dark:text-surface-300">
              {(user?.fullName?.[0] || user?.full_name?.[0] || '?').toUpperCase()}
            </span>
          )}
        </div>
        <textarea
          placeholder="What's on your mind?"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={3}
          className="flex-1 text-sm px-4 py-2.5 rounded-xl bg-surface-50 dark:bg-surface-800 border border-surface-200 dark:border-surface-700 focus:outline-none focus:ring-2 focus:ring-primary-500/20 resize-none text-surface-800 dark:text-surface-200 placeholder-surface-400"
        />
      </div>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <select
            value={postType}
            onChange={(e) => setPostType(e.target.value)}
            className="text-xs px-3 py-1.5 rounded-lg bg-surface-50 dark:bg-surface-800 border border-surface-200 dark:border-surface-700 text-surface-700 dark:text-surface-300 focus:outline-none focus:ring-2 focus:ring-primary-500/20 appearance-none cursor-pointer"
          >
            {POST_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
          <select
            value={targetAudience}
            onChange={(e) => setTargetAudience(e.target.value)}
            className="text-xs px-3 py-1.5 rounded-lg bg-surface-50 dark:bg-surface-800 border border-surface-200 dark:border-surface-700 text-surface-700 dark:text-surface-300 focus:outline-none focus:ring-2 focus:ring-primary-500/20 appearance-none cursor-pointer"
          >
            {TARGET_AUDIENCES.map((a) => (
              <option key={a.value} value={a.value}>
                {a.label}
              </option>
            ))}
          </select>
        </div>
        <Button
          onClick={handleSubmit}
          size="sm"
          disabled={!content.trim() || submitting}
          isLoading={submitting}
          leftIcon={<Send className="w-3.5 h-3.5" />}
        >
          Post
        </Button>
      </div>
    </div>
  );
}

const FeedPage = () => {
  const { user } = useAuth();
  const { error: notifyError } = useNotification();
  const [posts, setPosts] = useState<FeedPostType[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const limit = 20;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await listFeedPosts(limit, 0);
        const postsData = Array.isArray(data) ? data : [];
        if (!cancelled) {
          setPosts(postsData);
          setOffset(postsData.length);
          setHasMore(postsData.length === limit);
        }
      } catch {
        if (!cancelled) notifyError('Error', 'Failed to load feed');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [notifyError]);

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const data = await listFeedPosts(limit, offset);
      const postsData = Array.isArray(data) ? data : [];
      setPosts((prev) => [...prev, ...postsData]);
      setOffset((prev) => prev + postsData.length);
      setHasMore(postsData.length === limit);
    } catch {
      notifyError('Error', 'Failed to load more posts');
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, hasMore, offset, notifyError]);

  useEffect(() => {
    const sentinel = document.getElementById('feed-sentinel');
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) loadMore();
      },
      { rootMargin: '200px' }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [loadMore]);

  const handlePostCreated = (post: FeedPostType) => {
    setPosts((prev) => [post, ...prev]);
  };

  const handleDelete = (postId: string) => {
    setPosts((prev) => prev.filter((p) => p.id !== postId));
  };

  const handleHide = (postId: string) => {
    setPosts((prev) => prev.filter((p) => p.id !== postId));
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
      <h1 className="text-2xl font-bold text-surface-900 dark:text-surface-100">Campus Feed</h1>

      <CreatePostCard onCreated={handlePostCreated} />

      {loading ? (
        <div className="space-y-6">
          {[1, 2, 3].map((n) => (
            <div
              key={n}
              className="bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-800 rounded-2xl p-5 space-y-4 animate-pulse"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-surface-200 dark:bg-surface-800" />
                <div className="space-y-2">
                  <div className="h-3 w-24 rounded bg-surface-200 dark:bg-surface-800" />
                  <div className="h-2 w-16 rounded bg-surface-200 dark:bg-surface-800" />
                </div>
              </div>
              <div className="space-y-2">
                <div className="h-3 w-full rounded bg-surface-200 dark:bg-surface-800" />
                <div className="h-3 w-3/4 rounded bg-surface-200 dark:bg-surface-800" />
              </div>
            </div>
          ))}
        </div>
      ) : posts.length === 0 ? (
        <div className="bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-800 rounded-2xl p-12 text-center">
          <MessageCircle className="w-10 h-10 text-surface-300 dark:text-surface-600 mx-auto mb-3" />
          <p className="text-sm text-surface-500">No posts yet. Be the first to share something!</p>
        </div>
      ) : (
        <div className="space-y-6">
          {posts.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              currentUserId={user?.id}
              onDelete={handleDelete}
              onHide={handleHide}
            />
          ))}
          <div id="feed-sentinel" className="h-1" />
          {loadingMore && (
            <div className="flex justify-center py-4">
              <div className="flex items-center gap-2 text-sm text-surface-400">
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Loading more...
              </div>
            </div>
          )}
          {!hasMore && posts.length > 0 && (
            <p className="text-center text-xs text-surface-400 py-4">
              You've reached the end of the feed
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export default FeedPage;
