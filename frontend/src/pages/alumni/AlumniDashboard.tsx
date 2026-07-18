import { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import Card, { CardHeader, CardTitle } from '../../components/ui/Card';
import KpiCard from '../../components/data-display/KpiCard';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import { Briefcase, Users, DollarSign, Calendar, GraduationCap, ArrowRight, TrendingUp } from 'lucide-react';
import { Link } from 'react-router-dom';
import { getMyAlumniStatus, getAlumniMyStats } from '../../api/alumni';
import type { AlumniFullProfile, AlumniMyStats } from '../../types';

const AlumniDashboard = () => {
  const { user } = useAuth();
  const [profile, setProfile] = useState<AlumniFullProfile | null>(null);
  const [stats, setStats] = useState<AlumniMyStats | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [profileData, statsData] = await Promise.allSettled([
          getMyAlumniStatus(),
          getAlumniMyStats(),
        ]);
        if (profileData.status === 'fulfilled') setProfile(profileData.value);
        if (statsData.status === 'fulfilled') setStats(statsData.value);
      } catch {
        // silent
      }
    };
    fetchData();
  }, []);

  const graduationYear = profile?.graduation_year || new Date().getFullYear();
  const fullName = profile?.full_name || user?.firstName || 'Alumni';

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-surface-900 dark:text-white">Alumni Portal</h1>
          <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
            Welcome back, {fullName}. Stay connected with the department.
          </p>
        </div>
        <div className="flex gap-2">
          <Link to="/alumni/profile">
            <Button variant="outline" size="sm">Edit Profile</Button>
          </Link>
          <Link to="/alumni/network">
            <Button size="sm" rightIcon={<ArrowRight className="w-4 h-4" />}>Browse Network</Button>
          </Link>
        </div>
      </div>

      {profile && (
        <Card className="bg-gradient-to-r from-primary-500 to-primary-600 text-white border-0">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-white/20 flex items-center justify-center">
              <GraduationCap className="w-7 h-7" />
            </div>
            <div>
              <h2 className="text-xl font-bold">{fullName}</h2>
              <p className="text-sm text-white/80">
                {profile.graduation_class || 'B.Eng'} &bull; Class of {graduationYear}
                {profile.current_company && ` &bull; ${profile.current_position || ''} @ ${profile.current_company}`}
              </p>
            </div>
          </div>
        </Card>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <KpiCard
          title="Connections"
          value={stats?.connection_count ?? 0}
          icon={<Users className="w-5 h-5" />}
        />
        <KpiCard
          title="Active Mentees"
          value={stats?.active_mentees ?? 0}
          icon={<GraduationCap className="w-5 h-5" />}
        />
        <KpiCard
          title="Jobs Posted"
          value={stats?.jobs_posted ?? 0}
          icon={<Briefcase className="w-5 h-5" />}
        />
        <KpiCard
          title="Events Attended"
          value={stats?.events_attended ?? 0}
          icon={<Calendar className="w-5 h-5" />}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-4 pt-0">
              <Link to="/alumni/jobs">
                <Button variant="outline" className="w-full justify-start" leftIcon={<Briefcase className="w-4 h-4" />}>
                  Post a Job
                </Button>
              </Link>
              <Link to="/alumni/mentorship">
                <Button variant="outline" className="w-full justify-start" leftIcon={<GraduationCap className="w-4 h-4" />}>
                  Offer Mentorship
                </Button>
              </Link>
              <Link to="/alumni/events">
                <Button variant="outline" className="w-full justify-start" leftIcon={<Calendar className="w-4 h-4" />}>
                  Create Event
                </Button>
              </Link>
              <Link to="/alumni/network">
                <Button variant="outline" className="w-full justify-start" leftIcon={<Users className="w-4 h-4" />}>
                  Network
                </Button>
              </Link>
              <Link to="/alumni/give-back">
                <Button variant="outline" className="w-full justify-start" leftIcon={<DollarSign className="w-4 h-4" />}>
                  Donate
                </Button>
              </Link>
              <Link to="/alumni/my-jobs">
                <Button variant="outline" className="w-full justify-start" leftIcon={<Briefcase className="w-4 h-4" />}>
                  My Posts
                </Button>
              </Link>
            </div>
          </Card>

          {profile?.is_mentor_available && (
            <Card>
              <CardHeader>
                <CardTitle>Mentorship Status</CardTitle>
                <Badge variant="success" dot>Available</Badge>
              </CardHeader>
              <div className="p-4 pt-0">
                <p className="text-sm text-surface-500 mb-2">
                  You are currently available for mentorship. Students can request guidance from you.
                </p>
                <div className="flex items-center gap-4 text-sm">
                  <span className="text-surface-600 dark:text-surface-400">
                    Active mentees: <strong>{stats?.active_mentees ?? 0}</strong>
                  </span>
                  <span className="text-surface-600 dark:text-surface-400">
                    Sessions completed: <strong>{stats?.completed_sessions ?? 0}</strong>
                  </span>
                </div>
              </div>
            </Card>
          )}
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Profile Summary</CardTitle>
            </CardHeader>
            <div className="p-4 pt-0 space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-surface-500">Industry</span>
                <span className="font-medium">{profile?.industry || 'Not set'}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-surface-500">Location</span>
                <span className="font-medium">{profile?.location || 'Not set'}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-surface-500">Privacy</span>
                <Badge variant="outline">{profile?.privacy_level || 'public'}</Badge>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-surface-500">Speaking</span>
                <Badge variant={profile?.willing_to_speak ? 'success' : 'secondary'}>
                  {profile?.willing_to_speak ? 'Available' : 'Not Available'}
                </Badge>
              </div>
              <Link to="/alumni/profile" className="block pt-2">
                <Button variant="ghost" size="sm" className="w-full" rightIcon={<TrendingUp className="w-4 h-4" />}>
                  Update Profile
                </Button>
              </Link>
            </div>
          </Card>

          <Card className="bg-gradient-to-br from-surface-50 to-surface-100 dark:from-surface-800 dark:to-surface-700">
            <div className="p-4 text-center">
              <DollarSign className="w-8 h-8 mx-auto text-primary-500 mb-2" />
              <h4 className="font-semibold text-surface-900 dark:text-white mb-1">Give Back</h4>
              <p className="text-xs text-surface-500 mb-3">Support the department through donations</p>
              <Link to="/alumni/give-back">
                <Button size="sm" className="w-full">Donate Now</Button>
              </Link>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default AlumniDashboard;
