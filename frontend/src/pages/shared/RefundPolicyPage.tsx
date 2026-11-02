import { motion } from 'framer-motion';
import Card, { CardHeader, CardTitle, CardDescription } from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import {
  ArrowLeft,
  CreditCard,
  FileCheck2,
  AlertTriangle,
  RotateCcw,
  Clock,
  HelpCircle,
  ChevronRight,
  ShieldCheck,
} from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';

const RefundPolicyPage = () => {
  const navigate = useNavigate();

  const sections = [
    {
      icon: <CreditCard className="w-5 h-5 text-blue-500" />,
      title: '1. Departmental Dues & Session Levies',
      desc: 'Departmental dues are mandatory annual or semester fees established by the student executive council and academic administration. Once a dues payment is confirmed, processed, and an official clearance receipt is issued, it is generally non-refundable unless a verified duplicate payment occurred.',
    },
    {
      icon: <FileCheck2 className="w-5 h-5 text-emerald-500" />,
      title: '2. Course Form Signing Fees (CRF)',
      desc: 'The official Course Registration Form (CRF) digital signing fee (₦500) covers the cryptographic stamping, HOD & Exam Officer signature placement, and verifiable tamper-proof PDF generation. Once signatures are stamped and the final signed course form is generated, this fee is non-refundable.',
    },
    {
      icon: <Clock className="w-5 h-5 text-purple-500" />,
      title: '3. CRF Catch-Up & Backlog Slots',
      desc: 'Payments made to unlock slots for unsigned course forms from previous semesters (backlog fees + signing fees) allow students to upload and digitally validate older documents. If an unlocked backlog slot is not yet consumed and the student was charged erroneously, a refund or credit may be requested within 14 days.',
    },
    {
      icon: <RotateCcw className="w-5 h-5 text-amber-500" />,
      title: '4. Duplicate or Overpayment Exceptions',
      desc: 'In the event of network timeouts, duplicate Paystack checkout charges, or debit card overbilling for the same fee or transaction reference, the duplicated amount will be refunded in full. Refunds are disbursed back to the original funding source within 5 to 7 business days following payment gateway reconciliation.',
    },
    {
      icon: <AlertTriangle className="w-5 h-5 text-rose-500" />,
      title: '5. Non-Refundable Scenarios',
      desc: 'Refunds cannot be granted where: (a) academic clearance has already been utilized for exams or graduation checks, (b) the student enters inaccurate matric numbers without notifying administration before processing, or (c) voluntary withdrawal takes place after services have been fulfilled.',
    },
    {
      icon: <ShieldCheck className="w-5 h-5 text-cyan-500" />,
      title: '6. How to Request a Refund or Rectification',
      desc: 'To file a refund dispute, submit a ticket via our Support Desk or contact the Departmental Bursar with: your full name, matric number, Paystack reference ID, bank payment receipt, and transaction timestamp. Requests are reviewed within 48 to 72 hours.',
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
            Last Updated: October 2026
          </span>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="space-y-6"
        >
          <div className="text-center space-y-3">
            <h1 className="text-3xl sm:text-4xl font-extrabold text-surface-900 dark:text-white tracking-tight">
              Payment & Refund Policy
            </h1>
            <p className="text-base text-surface-500 dark:text-surface-400 max-w-xl mx-auto">
              Guidelines regarding departmental dues, course form signing fees, and catch-up backlog transactions.
            </p>
          </div>

          <Card className="p-6 sm:p-8 space-y-6">
            <CardHeader className="p-0 border-b border-surface-150 dark:border-surface-800 pb-4">
              <CardTitle className="text-xl">Financial Transparency & Terms</CardTitle>
              <CardDescription>
                Review how payments, slot unlocks, and billing adjustments are handled across our portal.
              </CardDescription>
            </CardHeader>

            <div className="space-y-4 pt-2">
              {sections.map((sec, idx) => (
                <div
                  key={idx}
                  className="flex gap-4 p-4 rounded-xl hover:bg-surface-100/50 dark:hover:bg-surface-800/30 transition-all border border-transparent hover:border-surface-200/50 dark:hover:border-surface-800"
                >
                  <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-surface-100 dark:bg-surface-800 flex items-center justify-center">
                    {sec.icon}
                  </div>
                  <div className="space-y-1">
                    <h3 className="font-semibold text-sm text-surface-900 dark:text-white flex items-center gap-1">
                      {sec.title}
                    </h3>
                    <p className="text-xs text-surface-500 dark:text-surface-400 leading-relaxed">{sec.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            <Link
              to="/support"
              className="bg-primary-500/5 dark:bg-primary-500/10 rounded-xl p-4 flex items-center justify-between mt-6 border border-primary-500/15 hover:border-primary-500/30 transition-all group"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-primary-500/10 text-primary-600 dark:text-primary-400 flex items-center justify-center shrink-0">
                  <HelpCircle className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="font-semibold text-xs text-primary-600 dark:text-primary-400 group-hover:underline">
                    Have a billing inquiry or duplicate charge?
                  </h4>
                  <p className="text-[11px] text-surface-500 dark:text-surface-400">
                    Submit a support ticket with your Paystack payment reference.
                  </p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-primary-500 group-hover:translate-x-0.5 transition-transform" />
            </Link>
          </Card>
        </motion.div>
      </div>
    </div>
  );
};

export default RefundPolicyPage;
