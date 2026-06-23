import { useAuth } from '../../hooks/useAuth';
import Card, { CardHeader, CardTitle, CardDescription } from '../../components/ui/Card';
import Input from '../../components/ui/Input';
import PushNotificationToggle from '../../components/ui/PushNotificationToggle';
import { User, Phone } from 'lucide-react';

const ProfilePage = () => {
  const user = useAuth().user as any;

  // Create a payload to represent student for scanner allocation
  const qrDataStr = JSON.stringify({
    userId: user?.id || 'stud-123',
    firstName: user?.firstName || 'Aces',
    lastName: user?.lastName || 'Student',
    matricNumber: user?.matricNumber || 'ENG/2026/001',
  });

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold text-surface-900 dark:text-white">Profile Settings</h1>
        <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
          Manage your account profile, emergency info, and device security integrations.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Personal Information</CardTitle>
              <CardDescription>Primary profile identifier metrics</CardDescription>
            </CardHeader>
            <div className="p-4 pt-0 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input label="First Name" value={user?.firstName} disabled />
              <Input label="Last Name" value={user?.lastName} disabled />
              <Input label="Email Address" value={user?.email} disabled />
              <Input label="Matriculation / Staff ID" value={user?.matricNumber || user?.staffId || 'Not Applicable'} disabled />
            </div>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Emergency Contact</CardTitle>
              <CardDescription>Guardian context metrics for urgent outreach</CardDescription>
            </CardHeader>
            <div className="p-4 pt-0 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Guardian Name"
                value={user?.emergencyContact?.name || 'Not configured'}
                leftIcon={<User className="w-4 h-4" />}
                disabled
              />
              <Input
                label="Contact Phone"
                value={user?.emergencyContact?.phone || 'Not configured'}
                leftIcon={<Phone className="w-4 h-4" />}
                disabled
              />
            </div>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>System Preferences</CardTitle>
              <CardDescription>Modify platform behavior configurations</CardDescription>
            </CardHeader>
            <div className="p-4 pt-0 space-y-4">
              <PushNotificationToggle />
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="text-center p-6 flex flex-col items-center">
            <h4 className="text-sm font-semibold text-surface-500 dark:text-surface-400 uppercase tracking-wider mb-4">
              Academic ID QR Code
            </h4>
            <div className="w-44 h-44 rounded-2xl border-4 border-primary-500/10 dark:border-primary-500/20 bg-surface-50 dark:bg-surface-800 flex flex-col items-center justify-center p-3">
              {/* Represent QR as visual block representation */}
              <div className="grid grid-cols-5 gap-1.5 w-full h-full opacity-80">
                {Array.from({ length: 25 }).map((_, i) => (
                  <div
                    key={i}
                    className={`rounded-sm ${(i % 3 === 0 || i % 4 === 1 || i === 0 || i === 4 || i === 20 || i === 24) ? 'bg-primary-500' : 'bg-surface-200 dark:bg-surface-700'}`}
                  />
                ))}
              </div>
            </div>
            <p className="text-[10px] text-surface-400 mt-4 leading-relaxed max-w-xs">
              Present this QR to class representatives or course manual sellers for instant dues verification or manual purchase assignment.
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default ProfilePage;
