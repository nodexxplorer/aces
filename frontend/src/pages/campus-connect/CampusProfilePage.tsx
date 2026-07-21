import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Edit3, Save, X, Loader2, MapPin, Calendar, Briefcase, Heart } from 'lucide-react';
import Button from '../../components/ui/Button';
import { useAuth } from '../../hooks/useAuth';
import { useNotification } from '../../hooks/useNotification';
import { getCampusProfile, upsertCampusProfile } from '../../api/campus-connect-v2';
import type { CampusProfile } from '../../api/campus-connect-v2';

const CampusProfilePage = () => {
  const { id } = useParams();
  const { user } = useAuth();
  const { success, error } = useNotification();

  const [profile, setProfile] = useState<CampusProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);

  const [bio, setBio] = useState('');
  const [skillsInput, setSkillsInput] = useState('');
  const [interestsInput, setInterestsInput] = useState('');
  const [availability, setAvailability] = useState('online');

  const isOwnProfile = !id || id === user?.id;
  const profileUserId = id || user?.id || '';

  useEffect(() => {
    if (!profileUserId) return;
    const fetchProfile = async () => {
      try {
        const data = await getCampusProfile(profileUserId);
        setProfile(data);
      } catch {
        error('Error', 'Could not load profile.');
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, [profileUserId, error]);

  useEffect(() => {
    if (profile) {
      setBio(profile.bio || '');
      setSkillsInput(profile.skills?.join(', ') || '');
      setInterestsInput(profile.interests?.join(', ') || '');
      setAvailability(profile.availability_status || 'online');
    }
  }, [profile]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const updated = await upsertCampusProfile({
        bio: bio.trim(),
        skills: skillsInput.split(',').map((s) => s.trim()).filter(Boolean),
        interests: interestsInput.split(',').map((s) => s.trim()).filter(Boolean),
        availability_status: availability,
      });
      setProfile(updated);
      setEditing(false);
      success('Profile Updated', 'Your campus profile has been saved.');
    } catch {
      error('Save Failed', 'Could not update your profile.');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    if (profile) {
      setBio(profile.bio || '');
      setSkillsInput(profile.skills?.join(', ') || '');
      setInterestsInput(profile.interests?.join(', ') || '');
      setAvailability(profile.availability_status || 'online');
    }
    setEditing(false);
  };

  const getInitials = () => {
    const name = user?.fullName || user?.full_name || user?.email || '';
    return name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2) || '?';
  };

  const getDisplayName = () => {
    return user?.fullName || user?.full_name || user?.email || 'User';
  };

  const statusColors: Record<string, string> = {
    online: 'bg-green-400',
    away: 'bg-yellow-400',
    busy: 'bg-red-400',
    offline: 'bg-surface-400',
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-surface-400">
        <Loader2 className="w-6 h-6 animate-spin mr-2" />
        Loading profile...
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-surface-900 dark:text-white">
            {isOwnProfile ? 'My Profile' : 'Campus Profile'}
          </h1>
          <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
            {isOwnProfile ? 'Manage your campus presence.' : 'Viewing campus profile.'}
          </p>
        </div>
        {isOwnProfile && !editing && (
          <Button
            variant="outline"
            size="sm"
            leftIcon={<Edit3 className="w-4 h-4" />}
            onClick={() => setEditing(true)}
          >
            Edit
          </Button>
        )}
        {isOwnProfile && editing && (
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              leftIcon={<X className="w-4 h-4" />}
              onClick={handleCancel}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              leftIcon={<Save className="w-4 h-4" />}
              isLoading={saving}
              onClick={handleSave}
            >
              Save
            </Button>
          </div>
        )}
      </div>

      <div className="bg-white dark:bg-surface-800 rounded-2xl border border-surface-200 dark:border-surface-700 shadow-sm overflow-hidden">
        <div className="h-24 bg-gradient-to-r from-primary-500 to-accent-500" />

        <div className="px-6 pb-6">
          <div className="flex flex-col items-center -mt-12">
            <div className="w-24 h-24 rounded-full bg-white dark:bg-surface-800 border-4 border-white dark:border-surface-800 flex items-center justify-center text-2xl font-bold text-primary-600 dark:text-primary-400 overflow-hidden">
              {user?.avatar_url || user?.avatarUrl ? (
                <img
                  src={user.avatar_url || user.avatarUrl}
                  alt=""
                  className="w-full h-full object-cover rounded-full"
                />
              ) : (
                getInitials()
              )}
            </div>
            <div className="mt-3 text-center">
              <h2 className="text-xl font-bold text-surface-900 dark:text-white">
                {getDisplayName()}
              </h2>
              {profile?.availability_status && (
                <div className="flex items-center justify-center gap-1.5 mt-1">
                  <span className={`w-2 h-2 rounded-full ${statusColors[profile.availability_status] || statusColors.offline}`} />
                  <span className="text-xs text-surface-500 dark:text-surface-400 capitalize">
                    {profile.availability_status}
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className="flex justify-center gap-8 mt-5 pt-5 border-t border-surface-200 dark:border-surface-700">
            <div className="text-center">
              <p className="text-2xl font-bold text-surface-900 dark:text-white">
                {profile?.post_count ?? 0}
              </p>
              <p className="text-xs text-surface-500 dark:text-surface-400">Posts</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-surface-900 dark:text-white">
                {profile?.connection_count ?? 0}
              </p>
              <p className="text-xs text-surface-500 dark:text-surface-400">Connections</p>
            </div>
          </div>

          <div className="mt-6 space-y-5">
            {editing ? (
              <>
                <div>
                  <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1.5">
                    Bio
                  </label>
                  <textarea
                    rows={3}
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-surface-50 dark:bg-surface-900 border border-surface-300 dark:border-surface-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/20 resize-none"
                    placeholder="Tell people about yourself..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1.5">
                    Skills
                  </label>
                  <input
                    type="text"
                    value={skillsInput}
                    onChange={(e) => setSkillsInput(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-surface-50 dark:bg-surface-900 border border-surface-300 dark:border-surface-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                    placeholder="e.g. React, Python, Design"
                  />
                  <p className="text-xs text-surface-400 mt-1">Separate skills with commas</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1.5">
                    Interests
                  </label>
                  <input
                    type="text"
                    value={interestsInput}
                    onChange={(e) => setInterestsInput(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-surface-50 dark:bg-surface-900 border border-surface-300 dark:border-surface-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                    placeholder="e.g. AI, Music, Entrepreneurship"
                  />
                  <p className="text-xs text-surface-400 mt-1">Separate interests with commas</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1.5">
                    Availability
                  </label>
                  <select
                    value={availability}
                    onChange={(e) => setAvailability(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-surface-50 dark:bg-surface-900 border border-surface-300 dark:border-surface-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                  >
                    <option value="online">Online</option>
                    <option value="away">Away</option>
                    <option value="busy">Busy</option>
                    <option value="offline">Offline</option>
                  </select>
                </div>
              </>
            ) : (
              <>
                {profile?.bio && (
                  <div>
                    <p className="text-sm text-surface-700 dark:text-surface-300 leading-relaxed">
                      {profile.bio}
                    </p>
                  </div>
                )}

                {profile?.skills && profile.skills.length > 0 && (
                  <div>
                    <div className="flex items-center gap-1.5 mb-2">
                      <Briefcase className="w-4 h-4 text-surface-400" />
                      <h3 className="text-sm font-medium text-surface-500 dark:text-surface-400">Skills</h3>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {profile.skills.map((skill, i) => (
                        <span
                          key={i}
                          className="px-2.5 py-0.5 text-xs font-medium rounded-full bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300"
                        >
                          {skill}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {profile?.interests && profile.interests.length > 0 && (
                  <div>
                    <div className="flex items-center gap-1.5 mb-2">
                      <Heart className="w-4 h-4 text-surface-400" />
                      <h3 className="text-sm font-medium text-surface-500 dark:text-surface-400">Interests</h3>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {profile.interests.map((interest, i) => (
                        <span
                          key={i}
                          className="px-2.5 py-0.5 text-xs font-medium rounded-full bg-accent-100 dark:bg-accent-900/30 text-accent-700 dark:text-accent-300"
                        >
                          {interest}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {!profile?.bio && (!profile?.skills || profile.skills.length === 0) && (!profile?.interests || profile.interests.length === 0) && (
                  <p className="text-sm text-surface-400 text-center py-4">
                    {isOwnProfile ? 'Your profile is empty. Click Edit to add details.' : 'This user hasn\'t filled out their profile yet.'}
                  </p>
                )}
              </>
            )}
          </div>

          {profile && (
            <div className="mt-6 pt-4 border-t border-surface-200 dark:border-surface-700 flex items-center justify-center gap-4 text-xs text-surface-400">
              <div className="flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" />
                <span>Joined {new Date(profile.created_at).toLocaleDateString()}</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CampusProfilePage;
