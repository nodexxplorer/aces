import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import { useNotification } from '../../hooks/useNotification';
import { useAuth } from '../../hooks/useAuth';
import { getMyConnections, getStudentDirectory, getAlumniDirectory } from '../../api/campus-connect';
import { User, MessageSquare, Loader2 } from 'lucide-react';
import type { Connection } from '../../types';

interface ProfileData {
  id: string;
  full_name?: string;
  avatar_url?: string;
  email?: string;
  role?: string;
  level?: number;
  matric_number?: string;
  graduation_year?: number;
  current_company?: string;
  current_position?: string;
  is_mentor_available?: boolean;
}

const ConnectionProfilePage = () => {
  const { id } = useParams();
  const { user } = useAuth();
  const { error } = useNotification();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    const fetchProfile = async () => {
      try {
        const [connections, students, alumni] = await Promise.all([
          getMyConnections(),
          getStudentDirectory(),
          getAlumniDirectory(),
        ]);
        const allUsers = [...students, ...alumni];
        const found = allUsers.find((u: ProfileData) => u.id === id);
        if (found) {
          setProfile(found);
        } else {
          const conn = connections.find((c: Connection) => c.requesterId === id || c.recipientId === id);
          if (conn) {
            setProfile({
              id,
              full_name: (conn as unknown as { full_name?: string }).full_name || 'User',
              avatar_url: (conn as unknown as { avatar_url?: string }).avatar_url,
              role: (conn as unknown as { role?: string }).role,
            });
          }
        }
      } catch {
        error('Failed to load', 'Could not fetch profile.');
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, [id, error]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-surface-400">
        <Loader2 className="w-6 h-6 animate-spin mr-2" />
        Loading profile...
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="space-y-6 max-w-xl mx-auto">
        <div>
          <h1 className="text-3xl font-bold text-surface-900 dark:text-white">Connection Profile</h1>
        </div>
        <Card className="p-12 text-center text-surface-400 text-sm">User not found.</Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold text-surface-900 dark:text-white">Connection Profile</h1>
        <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
          Detailed profile of your connection.
        </p>
      </div>

      <Card className="p-6">
        <div className="flex flex-col items-center text-center space-y-4">
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary-400 to-accent-500 flex items-center justify-center text-white overflow-hidden">
            {profile.avatar_url ? (
              <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
            ) : (
              <User className="w-10 h-10" />
            )}
          </div>
          <div>
            <h3 className="font-semibold text-xl text-surface-900 dark:text-white">{profile.full_name || 'User'}</h3>
            {profile.role && <p className="text-sm text-surface-500 capitalize">{profile.role}</p>}
            {profile.level && <p className="text-sm text-surface-500">{profile.level}00 Level</p>}
            {profile.matric_number && <p className="text-xs text-surface-400 mt-1">Matric: {profile.matric_number}</p>}
            {profile.graduation_year && (
              <p className="text-xs text-surface-400 mt-1">Class of {profile.graduation_year}</p>
            )}
            {profile.current_company && (
              <p className="text-xs text-surface-400 mt-1">{profile.current_position} at {profile.current_company}</p>
            )}
            {profile.email && <p className="text-xs text-surface-400 mt-1">{profile.email}</p>}
            {profile.is_mentor_available !== undefined && (
              <div className="mt-2">
                {profile.is_mentor_available ? (
                  <Badge variant="success" dot>Available for Mentorship</Badge>
                ) : (
                  <Badge variant="outline">Mentorship Unavailable</Badge>
                )}
              </div>
            )}
          </div>
          {user?.id !== id && (
            <Link to={`/connect/messages?userId=${id}`}>
              <Button leftIcon={<MessageSquare className="w-4 h-4" />}>
                Send Message
              </Button>
            </Link>
          )}
        </div>
      </Card>
    </div>
  );
};

export default ConnectionProfilePage;
