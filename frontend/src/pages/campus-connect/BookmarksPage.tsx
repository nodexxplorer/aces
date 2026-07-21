import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Bookmark, Loader2, Trash2 } from 'lucide-react';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import { useAuth } from '../../hooks/useAuth';
import { useNotification } from '../../hooks/useNotification';
import { listUserBookmarks, togglePostBookmark } from '../../api/campus-connect-v2';
import type { FeedPost } from '../../api/campus-connect-v2';

const BookmarksPage = () => {
  const { user } = useAuth();
  const { success, error } = useNotification();
  const [bookmarks, setBookmarks] = useState<FeedPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [removingId, setRemovingId] = useState<string | null>(null);

  useEffect(() => {
    const fetchBookmarks = async () => {
      try {
        const data = await listUserBookmarks();
        setBookmarks(data);
      } catch {
        error('Failed to load', 'Could not fetch your bookmarks.');
      } finally {
        setLoading(false);
      }
    };
    fetchBookmarks();
  }, [error]);

  const handleRemoveBookmark = async (post: FeedPost) => {
    setRemovingId(post.id);
    try {
      await togglePostBookmark(post.id);
      setBookmarks((prev) => prev.filter((b) => b.id !== post.id));
      success('Removed', 'Bookmark removed successfully.');
    } catch {
      error('Failed', 'Could not remove bookmark.');
    } finally {
      setRemovingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-surface-900 dark:text-white">Bookmarks</h1>
        <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
          Posts you have saved for later.
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center p-12 text-surface-400">
          <Loader2 className="w-6 h-6 animate-spin mr-2" />
          Loading bookmarks...
        </div>
      ) : bookmarks.length === 0 ? (
        <Card className="p-12 text-center text-surface-400 text-sm">
          <Bookmark className="w-8 h-8 mx-auto mb-3 text-surface-300" />
          No bookmarks yet.
        </Card>
      ) : (
        <div className="max-w-2xl mx-auto space-y-4">
          {bookmarks.map((post) => (
            <Card key={post.id} className="p-5 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <Link to="/connect/feed" className="block group">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-400 to-accent-500 flex items-center justify-center text-white text-xs font-semibold shrink-0">
                        {post.author_avatar ? (
                          <img src={post.author_avatar} alt="" className="w-full h-full rounded-full object-cover" />
                        ) : (
                          post.author_name?.split(' ').map((n: string) => n[0]).join('').slice(0, 2)
                        )}
                      </div>
                      <span className="text-sm font-semibold text-surface-900 dark:text-white group-hover:text-primary-500 transition-colors truncate">
                        {post.author_name || 'Unknown'}
                      </span>
                      <span className="px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider rounded-full bg-surface-100 dark:bg-surface-700 text-surface-500 dark:text-surface-400 shrink-0">
                        {post.post_type}
                      </span>
                    </div>
                    <p className="text-sm text-surface-600 dark:text-surface-300 line-clamp-3">
                      {post.content}
                    </p>
                    <span className="text-xs text-surface-400 mt-2 block">
                      {new Date(post.created_at).toLocaleDateString(undefined, {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </Link>
                </div>
                <Button
                  variant="danger"
                  size="xs"
                  leftIcon={removingId === post.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                  onClick={() => handleRemoveBookmark(post)}
                  disabled={removingId === post.id}
                >
                  Remove
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default BookmarksPage;
