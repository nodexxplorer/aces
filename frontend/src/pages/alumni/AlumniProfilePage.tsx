import { useState, useEffect } from 'react';
import Card, { CardHeader, CardTitle } from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Badge from '../../components/ui/Badge';
import { useNotification } from '../../hooks/useNotification';
import { getMyAlumniStatus, updateAlumniProfileFull } from '../../api/alumni';
import type { AlumniFullProfile } from '../../types';
import { Save, Loader2, MapPin, Briefcase, Globe } from 'lucide-react';
import { FaLinkedin } from 'react-icons/fa';

const AlumniProfilePage = () => {
  const { success, error: notifyError } = useNotification();
  const [profile, setProfile] = useState<AlumniFullProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [location, setLocation] = useState('');
  const [industry, setIndustry] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [company, setCompany] = useState('');
  const [bio, setBio] = useState('');
  const [linkedinUrl, setLinkedinUrl] = useState('');
  const [portfolioUrl, setPortfolioUrl] = useState('');
  const [isMentor, setIsMentor] = useState(false);
  const [mentorTopics, setMentorTopics] = useState('');
  const [skills, setSkills] = useState('');
  const [privacyLevel, setPrivacyLevel] = useState('public');

  useEffect(() => {
    getMyAlumniStatus()
      .then((data) => {
        setProfile(data);
        setLocation(data.location || '');
        setIndustry(data.industry || '');
        setJobTitle(data.current_position || '');
        setCompany(data.current_company || '');
        setBio(data.bio || '');
        setLinkedinUrl(data.linkedin_url || '');
        setPortfolioUrl(data.portfolio_url || '');
        setIsMentor(data.is_mentor_available || false);
        setMentorTopics(Array.isArray(data.mentorship_topics) ? data.mentorship_topics.join(', ') : '');
        setSkills(Array.isArray(data.skills) ? data.skills.join(', ') : '');
        setPrivacyLevel(data.privacy_level || 'public');
      })
      .catch(() => notifyError('Error', 'Failed to load profile'))
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateAlumniProfileFull({
        location: location || undefined,
        industry: industry || undefined,
        job_title: jobTitle || undefined,
        current_company: company || undefined,
        bio: bio || undefined,
        linkedin_url: linkedinUrl || undefined,
        portfolio_url: portfolioUrl || undefined,
        is_mentor_available: isMentor,
        mentorship_topics: mentorTopics || undefined,
        skills: skills || undefined,
        privacy_level: privacyLevel,
      });
      success('Profile Updated', 'Your alumni profile has been saved');
    } catch (err: unknown) {
      const message = (() => {
        if (err instanceof Error) return err.message;
        if (typeof err === 'object' && err !== null) {
          const responseError = (err as { response?: { data?: { error?: unknown } } }).response?.data?.error;
          if (typeof responseError === 'string') return responseError;
          if (responseError != null) return String(responseError);
        }
        return 'Could not update profile';
      })();
      notifyError('Failed', message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <div className="p-12 text-center">
          <Loader2 className="w-6 h-6 animate-spin text-primary-500 mx-auto" />
          <p className="text-sm text-surface-500 mt-2">Loading profile...</p>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-surface-900 dark:text-white">Alumni Profile</h1>
          <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
            Manage your professional information and mentorship settings.
          </p>
        </div>
        <Button leftIcon={<Save className="w-4 h-4" />} isLoading={saving} onClick={handleSave}>
          Save Changes
        </Button>
      </div>

      {profile && (
        <Card className="bg-gradient-to-r from-primary-500 to-primary-600 text-white border-0">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center text-2xl font-bold">
              {(profile.full_name || 'A')[0]}
            </div>
            <div>
              <h2 className="text-xl font-bold">{profile.full_name || 'Alumni'}</h2>
              <p className="text-sm text-white/80">
                Class of {profile.graduation_year} &bull; {profile.email}
              </p>
              <Badge variant="outline" className="mt-1 bg-white/10 border-white/20 text-white">
                {profile.verification_status === 'verified' ? 'Verified Alumni' : 'Pending Verification'}
              </Badge>
            </div>
          </div>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Professional Information</CardTitle>
          </CardHeader>
          <div className="space-y-4 p-4 pt-0">
            <div className="grid grid-cols-2 gap-4">
              <Input label="Industry" placeholder="e.g. Tech, Finance" value={industry} onChange={(e) => setIndustry(e.target.value)} leftIcon={<Briefcase className="w-4 h-4" />} />
              <Input label="Job Title" placeholder="e.g. Software Engineer" value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} />
            </div>
            <Input label="Current Company" placeholder="e.g. Google" value={company} onChange={(e) => setCompany(e.target.value)} />
            <Input label="Location" placeholder="e.g. Lagos, Nigeria" value={location} onChange={(e) => setLocation(e.target.value)} leftIcon={<MapPin className="w-4 h-4" />} />
            <Input label="LinkedIn URL" placeholder="https://linkedin.com/in/..." value={linkedinUrl} onChange={(e) => setLinkedinUrl(e.target.value)} leftIcon={<FaLinkedin className="w-4 h-4" />} />
            <Input label="Portfolio URL" placeholder="https://..." value={portfolioUrl} onChange={(e) => setPortfolioUrl(e.target.value)} leftIcon={<Globe className="w-4 h-4" />} />
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-surface-700 dark:text-surface-300">Bio</label>
              <textarea
                className="w-full h-24 rounded-lg border border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-900 text-sm p-3 focus:outline-none focus:ring-2 focus:ring-primary-500/20 resize-none"
                placeholder="Tell students about your professional journey..."
                value={bio}
                onChange={(e) => setBio(e.target.value)}
              />
            </div>
          </div>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Mentorship Settings</CardTitle>
            </CardHeader>
            <div className="space-y-4 p-4 pt-0">
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="isMentor"
                  checked={isMentor}
                  onChange={(e) => setIsMentor(e.target.checked)}
                  className="w-4 h-4 text-primary-600 bg-white border-surface-300 rounded"
                />
                <label htmlFor="isMentor" className="text-sm font-medium text-surface-700 dark:text-surface-300">
                  Available as Mentor
                </label>
              </div>
              <Input label="Mentorship Topics" placeholder="e.g. Career guidance, Technical skills" value={mentorTopics} onChange={(e) => setMentorTopics(e.target.value)} />
              <Input label="Skills" placeholder="e.g. React, Python, DevOps" value={skills} onChange={(e) => setSkills(e.target.value)} />
            </div>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Privacy & Preferences</CardTitle>
            </CardHeader>
            <div className="space-y-4 p-4 pt-0">
              <div>
                <label className="text-sm font-medium text-surface-700 dark:text-surface-300">Privacy Level</label>
                <select
                  className="w-full mt-1 px-3 py-2 text-sm bg-white dark:bg-surface-900 border border-surface-300 dark:border-surface-600 rounded-lg"
                  value={privacyLevel}
                  onChange={(e) => setPrivacyLevel(e.target.value)}
                >
                  <option value="public">Public - Full profile visible to all</option>
                  <option value="network">Network - Visible to alumni and students</option>
                  <option value="department">Department - Same department only</option>
                  <option value="private">Private - Name and graduation year only</option>
                </select>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default AlumniProfilePage;
