import { useEffect, useRef } from 'react';
import { useAuth } from '../../hooks/useAuth';
import Card, { CardHeader, CardTitle, CardDescription } from '../../components/ui/Card';
import Input from '../../components/ui/Input';
import PushNotificationToggle from '../../components/ui/PushNotificationToggle';
import { User, Phone, MapPin, Image, Mail, BookOpen } from 'lucide-react';
import QRCode from 'qrcode';

const ProfilePage = () => {
  const user = useAuth().user as any;
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const qrDataStr = JSON.stringify({
    userId: user?.id || 'stud-123',
    firstName: user?.firstName || 'Aces',
    lastName: user?.lastName || 'Student',
    matricNumber: user?.matricNumber || 'ENG/2026/001',
  });

  useEffect(() => {
    if (canvasRef.current) {
      QRCode.toCanvas(canvasRef.current, qrDataStr, {
        width: 176,
        margin: 2,
        color: { dark: '#2563eb', light: '#ffffff' },
      });
    }
  }, [qrDataStr]);

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
              <Input label="Email Address" value={user?.email} leftIcon={<Mail className="w-4 h-4" />} disabled />
              <Input label="Matriculation / Staff ID" value={user?.matricNumber || user?.staffId || 'Not Applicable'} disabled />
              <Input label="Gender" value={user?.gender ? (user.gender.charAt(0).toUpperCase() + user.gender.slice(1)) : 'Not set'} disabled />
              <Input label="Phone" value={user?.phone || 'Not set'} leftIcon={<Phone className="w-4 h-4" />} disabled />
              <div className="sm:col-span-2">
                <Input label="Address" value={user?.address || 'Not set'} leftIcon={<MapPin className="w-4 h-4" />} disabled />
              </div>
            </div>
            {user?.bio && (
              <div className="px-4 pb-4">
                <Input label="Bio" value={user.bio} leftIcon={<BookOpen className="w-4 h-4" />} disabled />
              </div>
            )}
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
                label="Relation"
                value={user?.emergencyContact?.relation || 'Not configured'}
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
          {user?.avatar && (
            <Card className="text-center p-6 flex flex-col items-center">
              <h4 className="text-sm font-semibold text-surface-500 dark:text-surface-400 uppercase tracking-wider mb-4">
                Profile Image
              </h4>
              <img
                src={user.avatar}
                alt="Profile"
                className="w-32 h-32 rounded-full object-cover border-4 border-surface-200 dark:border-surface-700"
                onError={(e) => { (e.target as HTMLImageElement).src = ''; }}
              />
            </Card>
          )}
          <Card className="text-center p-6 flex flex-col items-center">
            <h4 className="text-sm font-semibold text-surface-500 dark:text-surface-400 uppercase tracking-wider mb-4">
              Academic ID QR Code
            </h4>
            <canvas ref={canvasRef} className="rounded-2xl" />
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
