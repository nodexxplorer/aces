import { motion } from 'framer-motion';
import Card, { CardHeader, CardTitle, CardDescription } from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import { ArrowLeft, Shield, Lock, Eye, FileText, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const PrivacyPolicyPage = () => {
  const navigate = useNavigate();

  const sections = [
    {
      icon: <Shield className="w-5 h-5 text-primary-500" />,
      title: '1. Information We Collect',
      desc: 'We collect personal information such as name, matriculation number, department staff identifier, email address, grades registry, and payment transaction references to guarantee smooth academic portal operations.',
    },
    {
      icon: <Lock className="w-5 h-5 text-accent-500" />,
      title: '2. Security & Credentials Protection',
      desc: 'All credential passwords and tokens are hashed securely. Session authentications utilize cryptographically signed JSON Web Tokens (JWT) stored in HTTP-only cookies or secure local storage.',
    },
    {
      icon: <Eye className="w-5 h-5 text-success-500" />,
      title: '3. Cookie Usage Disclosure',
      desc: 'We utilize session cookies for login integrity and persistent preferences (like dark mode). No third-party marketing or tracking trackers are embedded on the portal.',
    },
    {
      icon: <FileText className="w-5 h-5 text-warning-500" />,
      title: '4. Student Rights & Data Access',
      desc: 'Under university academic guidelines, students hold rights to inspect official academic transcripts and results records. System administrators cannot modify historical grades without HOD signature clearance.',
    },
  ];

  return (
    <div className="min-h-screen bg-surface-50 dark:bg-surface-950 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto space-y-8">
        <div className="flex justify-between items-center">
          <Button variant="outline" size="sm" leftIcon={<ArrowLeft className="w-4 h-4" />} onClick={() => navigate(-1)}>
            Go Back
          </Button>
          <span className="text-xs font-semibold uppercase tracking-wider text-surface-400">
            Last Updated: June 2026
          </span>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="space-y-6"
        >
          <div className="text-center space-y-3">
            <h1 className="text-4xl font-extrabold text-surface-900 dark:text-white tracking-tight">
              Privacy & Cookie Policy
            </h1>
            <p className="text-base text-surface-500 dark:text-surface-400 max-w-xl mx-auto">
              How the ACES Zone academic portal secures your records and identity.
            </p>
          </div>

          <Card className="p-6 sm:p-8 space-y-6">
            <CardHeader className="p-0 border-b border-surface-150 dark:border-surface-800 pb-4">
              <CardTitle className="text-xl">Agreement of Data Processing</CardTitle>
              <CardDescription>
                By using this platform, you consent to our security framework and policies.
              </CardDescription>
            </CardHeader>

            <div className="space-y-6 pt-4">
              {sections.map((sec, idx) => (
                <div key={idx} className="flex gap-4 p-4 rounded-xl hover:bg-surface-100/50 dark:hover:bg-surface-800/30 transition-all border border-transparent hover:border-surface-200/50 dark:hover:border-surface-800">
                  <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-surface-100 dark:bg-surface-800 flex items-center justify-center">
                    {sec.icon}
                  </div>
                  <div className="space-y-1">
                    <h3 className="font-semibold text-sm text-surface-900 dark:text-white flex items-center gap-1">
                      {sec.title}
                    </h3>
                    <p className="text-xs text-surface-500 dark:text-surface-400 leading-relaxed">
                      {sec.desc}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <div className="bg-primary-500/5 dark:bg-primary-500/10 rounded-xl p-4 flex items-center justify-between mt-6 border border-primary-500/10">
              <div className="space-y-0.5">
                <h4 className="font-semibold text-xs text-primary-500">Need administrative clearance?</h4>
                <p className="text-[11px] text-surface-500 dark:text-surface-400">
                  Contact department support for records queries or deletion.
                </p>
              </div>
              <ChevronRight className="w-4 h-4 text-primary-500" />
            </div>
          </Card>
        </motion.div>
      </div>
    </div>
  );
};

export default PrivacyPolicyPage;
