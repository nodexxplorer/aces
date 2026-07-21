import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Card, { CardHeader, CardTitle, CardDescription } from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import {
  ArrowLeft, Brain, Database, MessageSquare, Shield, Calendar,
  Layers, AlertTriangle, FileText, ChevronDown, ChevronRight,
  Cpu, BarChart3, Eye, Lock, Users, Zap, Target, GitBranch,
  BookOpen, Briefcase, GraduationCap, CreditCard, Settings,
  TrendingUp, ClipboardList, Sparkles, CheckCircle, XCircle,
  AlertCircle, Info, Bot, Search, ShieldAlert, Clock
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cn } from '../../utils/cn';

const sections = [
  { key: 'architecture', label: 'AI Architecture', icon: <Cpu className="w-4 h-4" /> },
  { key: 'features', label: 'AI Features', icon: <Sparkles className="w-4 h-4" /> },
  { key: 'chatbot', label: 'ACES Assistant', icon: <Bot className="w-4 h-4" /> },
  { key: 'ethics', label: 'Ethics & Safeguards', icon: <Shield className="w-4 h-4" /> },
  { key: 'roadmap', label: 'Implementation Roadmap', icon: <Calendar className="w-4 h-4" /> },
  { key: 'integration', label: 'Module Integration', icon: <Layers className="w-4 h-4" /> },
  { key: 'edge-cases', label: 'Edge Cases', icon: <AlertTriangle className="w-4 h-4" /> },
  { key: 'data-model', label: 'Data Model', icon: <Database className="w-4 h-4" /> },
];

const aiModules = [
  {
    title: 'Student Dashboard',
    subtitle: 'AI Study Assistant',
    icon: <BookOpen className="w-5 h-5 text-primary-500" />,
    color: 'primary',
    features: [
      { name: 'Smart Study Planner', capability: 'Analyzes timetable, deadlines, and performance to suggest optimal study schedule', example: '"Based on your CSC 301 weak areas and upcoming exam, I recommend 2 hours of review on Tuesday and Thursday."' },
      { name: 'GPA Predictor', capability: 'Predicts final GPA based on current performance trajectory', example: '"If you maintain current effort in CSC 302, projected grade is B (4.0)."' },
      { name: 'At-Risk Alert', capability: 'Flags students likely to fail based on attendance + assignment patterns', example: '"Your CSC 302 attendance is trending low. Consider attending extra classes."' },
      { name: 'Course Recommendation', capability: 'Suggests electives based on interests, career goals, and peer success', example: '"Students who took CSC 401 and did well in your position often succeed in AI/ML electives."' },
      { name: 'Question Answering', capability: 'Answers questions about courses, deadlines, policies via chatbot', example: '"Assignment 3 is due July 25, 2026 at 11:59 PM."' },
    ],
  },
  {
    title: 'Course Registration',
    subtitle: 'AI Advisor',
    icon: <ClipboardList className="w-5 h-5 text-accent-500" />,
    color: 'accent',
    features: [
      { name: 'Prerequisite Checker', capability: 'Validates prerequisite chains and suggests missing requirements', example: '"You need CSC 201 before CSC 301. You passed CSC 201 in 2024/2025."' },
      { name: 'Timetable Optimizer', capability: 'Suggests course combinations that minimize conflicts', example: '"This combination has no clashes and gives you Wednesdays free for projects."' },
      { name: 'Workload Balancer', capability: 'Analyzes credit load against historical performance', example: '"18 credits with 3 carryovers may be too heavy. Consider dropping one elective."' },
      { name: 'Career Path Mapper', capability: 'Maps course selections to career outcomes', example: '"With these electives, you\'re well-positioned for backend engineering roles."' },
    ],
  },
  {
    title: 'Attendance',
    subtitle: 'AI Enhancement',
    icon: <Eye className="w-5 h-5 text-success-500" />,
    color: 'success',
    features: [
      { name: 'Face Recognition', capability: 'Matches student face to ID photo for automatic check-in', example: 'Student walks into class, camera recognizes face, marks present.' },
      { name: 'Pattern Analysis', capability: 'Detects unusual patterns (chronic lateness, sudden drops)', example: '"5 students have dropped attendance in CSC 302 over 2 weeks."' },
      { name: 'Predictive Absence', capability: 'Predicts likely absences based on historical patterns', example: '"Tuesday 8 AM classes have 15% higher absence."' },
      { name: 'Geofence Optimization', capability: 'Suggests optimal geofence radius based on venue size', example: '"LT 1 geofence should be 30 meters for accurate detection."' },
    ],
  },
  {
    title: 'Results & Transcript',
    subtitle: 'AI Analysis',
    icon: <BarChart3 className="w-5 h-5 text-warning-500" />,
    color: 'warning',
    features: [
      { name: 'Grade Distribution', capability: 'Analyzes class performance and flags anomalies', example: '"CSC 301 has a bimodal distribution — consider offering remedial sessions."' },
      { name: 'Plagiarism Detection', capability: 'Compares assignment submissions for similarity', example: '"2 submissions in CSC 301 show 85% similarity. Flag for lecturer review."' },
      { name: 'Result Validation', capability: 'Cross-checks entered grades against attendance and assignment scores', example: '"Student X has 90% attendance but exam grade is 35%. Possible data entry error?"' },
      { name: 'Transcript Summarization', capability: 'Generates plain-language summary of academic performance', example: '"Strong in programming courses, needs improvement in theoretical subjects."' },
    ],
  },
  {
    title: 'Campus Connect',
    subtitle: 'AI Social Features',
    icon: <MessageSquare className="w-5 h-5 text-blue-500" />,
    color: 'blue',
    features: [
      { name: 'Smart Connections', capability: 'Embeddings-based matching of students with similar interests', example: '"You and Victor both list AI and Python — connect?"' },
      { name: 'Content Moderation', capability: 'Auto-flags toxic, spam, or inappropriate content', example: 'Post hidden, HOD notified: "Potential violation detected. Review?"' },
      { name: 'Feed Personalization', capability: 'Ranks posts by relevance using engagement prediction', example: 'Prioritizes posts from close connections and relevant topics.' },
      { name: 'Language Translation', capability: 'Translates messages and posts between languages', example: 'Student posts in Igbo, AI translates to English for non-Igbo classmates.' },
      { name: 'Voice-to-Text', capability: 'Transcribes voice notes in messages', example: 'Voice note auto-transcribed with text preview.' },
    ],
  },
  {
    title: 'Job Board',
    subtitle: 'AI Matching',
    icon: <Briefcase className="w-5 h-5 text-violet-500" />,
    color: 'violet',
    features: [
      { name: 'Job-Student Matching', capability: 'Matches student skills, CGPA, and level to job requirements', example: '"This Google internship matches your Python skills and 300L status."' },
      { name: 'Resume Parser', capability: 'Extracts skills and experience from uploaded resumes', example: 'Auto-fills student profile skills from resume upload.' },
      { name: 'Interview Prep', capability: 'Generates mock interview questions based on job description', example: '"Based on this backend role, here are 5 likely technical questions."' },
      { name: 'Salary Benchmarking', capability: 'Compares offered salary to market rates for role/location', example: '"₦150,000 for junior backend in Lagos is below market average (₦200,000)."' },
    ],
  },
  {
    title: 'Mentorship',
    subtitle: 'AI Facilitation',
    icon: <Users className="w-5 h-5 text-pink-500" />,
    color: 'pink',
    features: [
      { name: 'Mentor-Mentee Matching', capability: 'Matches based on career goals, skills, personality compatibility', example: '"Dr. John Akpan\'s expertise in AI aligns with your career goal. 92% match."' },
      { name: 'Session Summarization', capability: 'Summarizes mentorship session notes', example: 'Auto-generated summary of discussion points and action items.' },
      { name: 'Progress Tracking', capability: 'Analyzes mentorship effectiveness over time', example: '"Mentee\'s confidence in technical interviews improved 40% over 5 sessions."' },
      { name: 'Resource Recommendation', capability: 'Suggests articles, courses, or contacts based on mentorship topics', example: '"For career in product management, read \'Inspired\' by Marty Cagan."' },
    ],
  },
  {
    title: 'Bursar & Finance',
    subtitle: 'AI Insights',
    icon: <CreditCard className="w-5 h-5 text-emerald-500" />,
    color: 'emerald',
    features: [
      { name: 'Fraud Detection', capability: 'Flags suspicious payment patterns', example: '"3 manual payments from same bank account for different students. Verify?"' },
      { name: 'Revenue Forecasting', capability: 'Predicts session revenue based on historical trends', example: '"Projected revenue: ₦4.8M (85% confidence). Risk: 15% default rate."' },
      { name: 'Defaulter Risk Scoring', capability: 'Predicts which students are likely to default on dues', example: '"Peter Essien (400L) has 78% default probability based on history."' },
      { name: 'Expense Categorization', capability: 'Auto-categorizes expenses from receipt uploads', example: 'Upload receipt → AI extracts amount, vendor, category → auto-logged.' },
    ],
  },
  {
    title: 'HOD Dashboard',
    subtitle: 'AI Decision Support',
    icon: <Target className="w-5 h-5 text-red-500" />,
    color: 'red',
    features: [
      { name: 'Early Warning System', capability: 'Predicts students at risk of probation, carryover, or dropout', example: '"12 students in 300L show early warning signs. Intervention recommended."' },
      { name: 'Course Performance Prediction', capability: 'Predicts pass/fail rates before exams', example: '"CSC 302 projected pass rate: 65%. Consider extra classes."' },
      { name: 'Lecturer Performance Insights', capability: 'Analyzes student evaluations, attendance, and result trends', example: '"Dr. Okon\'s classes show 20% higher engagement but 10% lower pass rates."' },
      { name: 'Resource Allocation', capability: 'Suggests optimal course scheduling and lecturer assignment', example: '"Assign Prof. Etim to CSC 301 — her specialization matches."' },
      { name: 'Sentiment Analysis', capability: 'Analyzes student feedback and announcements engagement', example: '"Student sentiment on fee increase is 72% negative. Consider town hall."' },
      { name: 'Anomaly Detection', capability: 'Flags unusual patterns in data', example: '"CSC 301 results show 5 students with identical scores. Possible collusion?"' },
    ],
  },
  {
    title: 'System Admin',
    subtitle: 'AI Operations',
    icon: <Settings className="w-5 h-5 text-cyan-500" />,
    color: 'cyan',
    features: [
      { name: 'Predictive Maintenance', capability: 'Predicts server issues before they occur', example: '"Database CPU trending toward 90% in 48 hours. Scale up recommended."' },
      { name: 'Log Analysis', capability: 'Parses error logs to identify root causes', example: '"42% of 500 errors stem from Paystack timeout. Increase retry logic."' },
      { name: 'User Behavior Anomaly', capability: 'Detects bot accounts or abuse patterns', example: '"Account \'student_123\' sent 200 messages in 1 minute. Likely bot."' },
      { name: 'Auto-Scaling', capability: 'Suggests infrastructure scaling based on usage patterns', example: '"Registration week traffic up 300%. Scale API servers to 6 instances."' },
      { name: 'Security Threat Detection', capability: 'Identifies potential security breaches', example: '"Unusual data export pattern from admin account. Possible compromise?"' },
    ],
  },
];

const techStack = [
  { layer: 'LLM Engine', tech: 'OpenAI GPT-4 / Claude / Local LLM', purpose: 'Natural language processing, chatbot, content generation', icon: <Brain className="w-5 h-5 text-primary-500" /> },
  { layer: 'ML Platform', tech: 'TensorFlow / PyTorch / Scikit-learn', purpose: 'Predictive models, classification, clustering', icon: <TrendingUp className="w-5 h-5 text-accent-500" /> },
  { layer: 'Vector Database', tech: 'Pinecone / Weaviate / pgvector', purpose: 'Semantic search, recommendation embeddings', icon: <Database className="w-5 h-5 text-success-500" /> },
  { layer: 'NLP Pipeline', tech: 'spaCy / Hugging Face Transformers', purpose: 'Text analysis, sentiment, entity extraction', icon: <MessageSquare className="w-5 h-5 text-warning-500" /> },
  { layer: 'Computer Vision', tech: 'OpenCV / TensorFlow Lite', purpose: 'Face detection, document OCR, image analysis', icon: <Eye className="w-5 h-5 text-blue-500" /> },
  { layer: 'Speech Processing', tech: 'Whisper (OpenAI)', purpose: 'Voice note transcription, accessibility', icon: <Zap className="w-5 h-5 text-violet-500" /> },
];

const chatbotDomains = [
  { domain: 'Academic', examples: ['When is the CSC 301 exam?', 'What are my carryover courses?', 'How do I calculate my GPA?'], icon: <BookOpen className="w-4 h-4" /> },
  { domain: 'Administrative', examples: ['How do I pay my dues?', 'Where is the HOD office?', 'What documents do I need for transcript?'], icon: <FileText className="w-4 h-4" /> },
  { domain: 'Registration', examples: ['Can I register for CSC 401 without CSC 301?', 'What electives are available for 400L?'], icon: <ClipboardList className="w-4 h-4" /> },
  { domain: 'Campus Life', examples: ['What events are happening this week?', 'How do I join a study group?'], icon: <Users className="w-4 h-4" /> },
  { domain: 'Technical Support', examples: ['I can\'t log in.', 'How do I reset my password?', 'The app is crashing.'], icon: <Settings className="w-4 h-4" /> },
  { domain: 'Career', examples: ['What jobs match my skills?', 'How do I prepare for a tech interview?'], icon: <Briefcase className="w-4 h-4" /> },
];

const ethicsTable = [
  { type: 'Grade predictions', required: false, reviewer: '—' },
  { type: 'Attendance auto-marking', required: true, reviewer: 'Class Rep / Lecturer' },
  { type: 'Plagiarism flags', required: true, reviewer: 'Lecturer' },
  { type: 'Content moderation removals', required: true, reviewer: 'HOD' },
  { type: 'Defaulter risk scores', required: true, reviewer: 'Bursar + HOD' },
  { type: 'Job-student matching', required: false, reviewer: '—' },
  { type: 'Fraud alerts', required: true, reviewer: 'Bursar + HOD' },
  { type: 'Security threat alerts', required: true, reviewer: 'System Admin' },
  { type: 'Mentor-mentee matching', required: false, reviewer: '(suggestive only)' },
  { type: 'Resource recommendations', required: false, reviewer: '—' },
];

const biasMeasures = [
  { measure: 'Diverse Training Data', implementation: 'Ensure training data represents all student demographics' },
  { measure: 'Fairness Audits', implementation: 'Quarterly audit of AI decisions for demographic bias' },
  { measure: 'Explainability', implementation: 'All AI recommendations include reasoning: "Recommended because..."' },
  { measure: 'Opt-Out', implementation: 'Users can opt out of AI personalization in settings' },
  { measure: 'Override', implementation: 'HOD can override any AI recommendation with reason' },
  { measure: 'Transparency', implementation: 'AI-generated content labeled: "AI-generated suggestion"' },
];

const privacyRules = [
  { rule: 'No PII in model training', implementation: 'Anonymize all data before using for model training' },
  { rule: 'Local processing', implementation: 'Face recognition, OCR run on-device to minimize data transfer' },
  { rule: 'Consent', implementation: 'Students opt-in to AI features during onboarding' },
  { rule: 'Data retention', implementation: 'AI interaction logs retained for 90 days, then anonymized' },
  { rule: 'Third-party AI', implementation: 'No student PII sent to external APIs without explicit consent' },
  { rule: 'Fallback', implementation: 'All AI features have non-AI fallback for users who opt out' },
];

const roadmapPhases = [
  { phase: 'Phase 1: Foundation', features: 'Chatbot (Q&A), smart search, content moderation, plagiarism detection', timeline: 'Months 1–2', color: 'primary' },
  { phase: 'Phase 2: Personalization', features: 'Study planner, GPA predictor, job matching, connection suggestions', timeline: 'Months 3–4', color: 'accent' },
  { phase: 'Phase 3: Prediction', features: 'At-risk alerts, revenue forecasting, attendance prediction, result validation', timeline: 'Months 5–6', color: 'success' },
  { phase: 'Phase 4: Automation', features: 'Face recognition attendance, expense auto-categorization, auto-scaling', timeline: 'Months 7–8', color: 'warning' },
  { phase: 'Phase 5: Advanced', features: 'Career path mapping, sentiment analysis, predictive maintenance, anomaly detection', timeline: 'Months 9–12', color: 'violet' },
];

const edgeCases = [
  { scenario: 'AI chatbot gives wrong answer', handling: '"I may have made a mistake. Please verify with the HOD office." + feedback button' },
  { scenario: 'Face recognition fails (poor lighting)', handling: 'Fallback to QR scan or manual check-in. Log failure for model improvement.' },
  { scenario: 'Plagiarism flag is false positive', handling: 'Lecturer can dismiss flag. System learns from dismissal.' },
  { scenario: 'AI predicts student will fail but they pass', handling: 'Prediction is probabilistic, not deterministic. Log accuracy for model improvement.' },
  { scenario: 'Student opts out of AI', handling: 'All AI features disabled. Non-AI fallbacks active. No data used for training.' },
  { scenario: 'AI service is down', handling: 'Graceful degradation: non-AI features continue, AI features show "Temporarily unavailable."' },
  { scenario: 'Biased recommendation detected', handling: 'Fairness audit triggered. Model retrained. Affected users notified.' },
  { scenario: 'AI-generated content is inappropriate', handling: 'Content removed. Incident logged. Model fine-tuned.' },
  { scenario: 'Student disputes AI decision', handling: 'Human review mandatory. HOD investigates. AI decision overridden if wrong.' },
  { scenario: 'AI suggests course not in catalog', handling: 'Validation layer blocks suggestion. "This course is not available this session."' },
  { scenario: 'Face recognition misidentifies student', handling: 'Student can report error. Manual correction. System improves with feedback.' },
  { scenario: 'AI chatbot accessed by unverified student', handling: 'Limited responses: only general info, no personal data.' },
  { scenario: 'AI model needs retraining', handling: 'Scheduled during low-traffic period. Old model kept as hot standby.' },
  { scenario: 'Third-party AI API rate limit hit', handling: 'Queue requests. Fall back to local model for critical features.' },
  { scenario: 'AI recommends unavailable mentor', handling: 'System checks availability in real-time. Suggests next best match.' },
  { scenario: 'Study plan conflicts with timetable', handling: 'Validation against timetable module. Conflict flagged, plan adjusted.' },
  { scenario: 'AI detects possible data breach', handling: 'Immediate alert to System Admin + HOD. Affected accounts temporarily locked.' },
  { scenario: 'Privacy concerns with face recognition', handling: 'Clear consent during onboarding. Opt-out available. Data processed on-device.' },
  { scenario: 'Content moderation removes legitimate post', handling: 'Appeal process. HOD reviews. Post restored if error.' },
  { scenario: 'Salary benchmark is outdated', handling: 'Benchmarks refreshed monthly from external data sources. Date stamp shown.' },
  { scenario: 'AI predicts low pass rate, lecturer disagrees', handling: 'Lecturer can override with reason. Both predictions logged.' },
];

const dataModel = [
  {
    name: 'AIInteraction',
    fields: [
      { name: 'interaction_id', type: 'PK', desc: 'Unique identifier' },
      { name: 'user_id', type: 'FK', desc: 'References User table' },
      { name: 'feature', type: 'enum', desc: 'chatbot / recommendation / prediction / moderation' },
      { name: 'input', type: 'text', desc: 'text / image / audio' },
      { name: 'output', type: 'text', desc: 'text / action / recommendation' },
      { name: 'confidence_score', type: 'float', desc: '0–1 confidence level' },
      { name: 'was_accurate', type: 'boolean?', desc: 'Nullable, filled after verification' },
      { name: 'user_feedback', type: 'enum?', desc: 'positive / negative / neutral' },
      { name: 'reviewed_by', type: 'FK?', desc: 'References User, nullable' },
      { name: 'timestamps', type: 'auto', desc: 'created_at, updated_at' },
    ],
  },
  {
    name: 'AIPrediction',
    fields: [
      { name: 'prediction_id', type: 'PK', desc: 'Unique identifier' },
      { name: 'prediction_type', type: 'enum', desc: 'at_risk / pass_rate / revenue / defaulter' },
      { name: 'target_id', type: 'uuid', desc: 'student_id / course_id / session_id' },
      { name: 'predicted_value', type: 'json', desc: 'The predicted outcome' },
      { name: 'actual_value', type: 'json?', desc: 'Nullable, filled later' },
      { name: 'confidence_interval', type: 'json', desc: 'Upper and lower bounds' },
      { name: 'model_version', type: 'string', desc: 'Which model made this prediction' },
      { name: 'features_used', type: 'json', desc: 'Input features for explainability' },
      { name: 'timestamps', type: 'auto', desc: 'created_at, updated_at' },
    ],
  },
  {
    name: 'AIModel',
    fields: [
      { name: 'model_id', type: 'PK', desc: 'Unique identifier' },
      { name: 'model_name', type: 'string', desc: 'Human-readable name' },
      { name: 'model_version', type: 'string', desc: 'Semantic version' },
      { name: 'model_type', type: 'enum', desc: 'llm / ml / nlp / vision / speech' },
      { name: 'training_data_summary', type: 'json', desc: 'Dataset metadata' },
      { name: 'accuracy_metrics', type: 'json', desc: 'Performance benchmarks' },
      { name: 'bias_audit_results', type: 'json?', desc: 'Nullable, updated quarterly' },
      { name: 'deployment_status', type: 'enum', desc: 'active / deprecated / retraining' },
      { name: 'timestamps', type: 'auto', desc: 'created_at, updated_at' },
    ],
  },
  {
    name: 'ContentModerationLog',
    fields: [
      { name: 'log_id', type: 'PK', desc: 'Unique identifier' },
      { name: 'content_id', type: 'FK', desc: 'References content table' },
      { name: 'content_type', type: 'enum', desc: 'post / message / comment' },
      { name: 'ai_flagged', type: 'boolean', desc: 'Whether AI flagged content' },
      { name: 'ai_confidence', type: 'float', desc: 'AI confidence score' },
      { name: 'ai_reason', type: 'text', desc: 'Explanation for flagging' },
      { name: 'human_reviewed', type: 'boolean', desc: 'Whether human has reviewed' },
      { name: 'human_decision', type: 'enum?', desc: 'allow / remove / escalate' },
      { name: 'reviewed_by', type: 'FK?', desc: 'References User, nullable' },
      { name: 'timestamps', type: 'auto', desc: 'created_at, updated_at' },
    ],
  },
];

const colorMap: Record<string, string> = {
  primary: 'bg-primary-500/10 text-primary-600 dark:text-primary-400 border-primary-500/20',
  accent: 'bg-accent-500/10 text-accent-600 dark:text-accent-400 border-accent-500/20',
  success: 'bg-success-500/10 text-success-600 dark:text-success-400 border-success-500/20',
  warning: 'bg-warning-500/10 text-warning-600 dark:text-warning-400 border-warning-500/20',
  blue: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
  violet: 'bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/20',
  pink: 'bg-pink-500/10 text-pink-600 dark:text-pink-400 border-pink-500/20',
  emerald: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
  red: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20',
  cyan: 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/20',
};

const ModuleFeatureTable = ({ features }: { features: { name: string; capability: string; example: string }[] }) => (
  <div className="overflow-x-auto">
    <table className="w-full text-xs">
      <thead>
        <tr className="border-b border-surface-200 dark:border-surface-700">
          <th className="text-left py-2 px-3 font-semibold text-surface-700 dark:text-surface-300">Feature</th>
          <th className="text-left py-2 px-3 font-semibold text-surface-700 dark:text-surface-300">AI Capability</th>
          <th className="text-left py-2 px-3 font-semibold text-surface-700 dark:text-surface-300">Example Output</th>
        </tr>
      </thead>
      <tbody>
        {features.map((f, i) => (
          <tr key={i} className="border-b border-surface-100 dark:border-surface-800 last:border-0 hover:bg-surface-50 dark:hover:bg-surface-800/50 transition-colors">
            <td className="py-2.5 px-3 font-medium text-surface-900 dark:text-white whitespace-nowrap">{f.name}</td>
            <td className="py-2.5 px-3 text-surface-600 dark:text-surface-400">{f.capability}</td>
            <td className="py-2.5 px-3 text-surface-500 dark:text-surface-500 italic max-w-xs">{f.example}</td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

const AIBlueprintPage = () => {
  const navigate = useNavigate();
  const [activeSection, setActiveSection] = useState('architecture');
  const [expandedModule, setExpandedModule] = useState<number | null>(0);
  const [expandedEdgeCase, setExpandedEdgeCase] = useState<number | null>(null);

  return (
    <div className="min-h-screen bg-surface-50 dark:bg-surface-950 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <Button variant="outline" size="sm" leftIcon={<ArrowLeft className="w-4 h-4" />} onClick={() => navigate(-1)}>
            Go Back
          </Button>
          <span className="text-xs font-semibold uppercase tracking-wider text-surface-400">
            Blueprint v2.0 — July 2026
          </span>
        </div>

        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="space-y-6">
          {/* Title */}
          <div className="text-center space-y-3">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary-500/10 border border-primary-500/20 text-primary-600 dark:text-primary-400 text-xs font-semibold">
              <Brain className="w-3.5 h-3.5" />
              AI Integration
            </div>
            <h1 className="text-3xl sm:text-4xl font-extrabold text-surface-900 dark:text-white tracking-tight">
              AI Integration Blueprint
            </h1>
            <p className="text-sm text-surface-500 dark:text-surface-400 max-w-2xl mx-auto">
              How artificial intelligence capabilities are integrated into ACES Zone to enhance user experience,
              automate administrative tasks, provide insights, and support decision-making across all modules.
            </p>
            <p className="text-xs text-surface-400 dark:text-surface-500 max-w-xl mx-auto">
              AI features are designed to augment human judgment — not replace it — with HOD and System Admin retaining
              final authority over all AI-influenced decisions.
            </p>
          </div>

          {/* Section Tabs */}
          <div className="flex gap-1 overflow-x-auto pb-2 scrollbar-thin -mx-4 px-4 sm:mx-0 sm:px-0">
            {sections.map((s) => (
              <button
                key={s.key}
                onClick={() => setActiveSection(s.key)}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-all',
                  activeSection === s.key
                    ? 'bg-primary-500 text-white shadow-md shadow-primary-500/25'
                    : 'text-surface-600 dark:text-surface-400 hover:bg-surface-100 dark:hover:bg-surface-800'
                )}
              >
                {s.icon}
                {s.label}
              </button>
            ))}
          </div>

          {/* ── Architecture Section ── */}
          {activeSection === 'architecture' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
              {/* Tech Stack */}
              <Card className="p-6">
                <CardHeader className="p-0 border-b border-surface-150 dark:border-surface-800 pb-4 mb-4">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Cpu className="w-5 h-5 text-primary-500" />
                    AI Services Stack
                  </CardTitle>
                  <CardDescription>Core technologies powering AI features in ACES Zone</CardDescription>
                </CardHeader>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {techStack.map((t, i) => (
                    <div key={i} className="flex items-start gap-3 p-4 rounded-xl border border-surface-200 dark:border-surface-700 hover:border-primary-300 dark:hover:border-primary-700 transition-colors bg-surface-50/50 dark:bg-surface-800/30">
                      <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-surface-100 dark:bg-surface-800 flex items-center justify-center">
                        {t.icon}
                      </div>
                      <div className="min-w-0 space-y-1">
                        <h4 className="font-semibold text-sm text-surface-900 dark:text-white">{t.layer}</h4>
                        <p className="text-xs font-medium text-primary-500">{t.tech}</p>
                        <p className="text-xs text-surface-500 dark:text-surface-400">{t.purpose}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>

              {/* Data Flow */}
              <Card className="p-6">
                <CardHeader className="p-0 border-b border-surface-150 dark:border-surface-800 pb-4 mb-4">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <GitBranch className="w-5 h-5 text-accent-500" />
                    Data Flow
                  </CardTitle>
                </CardHeader>
                <div className="bg-surface-900 dark:bg-surface-950 rounded-xl p-6 font-mono text-xs sm:text-sm text-surface-300 overflow-x-auto">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="px-2 py-1 rounded bg-primary-500/20 text-primary-400">User Input</span>
                      <span className="text-surface-500">→</span>
                      <span className="px-2 py-1 rounded bg-accent-500/20 text-accent-400">API Gateway</span>
                      <span className="text-surface-500">→</span>
                      <span className="px-2 py-1 rounded bg-success-500/20 text-success-400">AI Service Router</span>
                      <span className="text-surface-500">→</span>
                      <span className="px-2 py-1 rounded bg-warning-500/20 text-warning-400">Specific AI Model</span>
                    </div>
                    <div className="pl-8 text-surface-500">↓</div>
                    <div className="flex items-center gap-2 flex-wrap pl-4">
                      <span className="px-2 py-1 rounded bg-blue-500/20 text-blue-400">Response</span>
                      <span className="text-surface-500">→</span>
                      <span className="px-2 py-1 rounded bg-violet-500/20 text-violet-400">Human Review Gate (if required)</span>
                      <span className="text-surface-500">→</span>
                      <span className="px-2 py-1 rounded bg-emerald-500/20 text-emerald-400">Action / Display / Notification</span>
                    </div>
                  </div>
                </div>
                <div className="mt-4 p-3 rounded-lg bg-primary-500/5 dark:bg-primary-500/10 border border-primary-500/10">
                  <div className="flex items-start gap-2">
                    <Info className="w-4 h-4 text-primary-500 mt-0.5 shrink-0" />
                    <p className="text-xs text-surface-600 dark:text-surface-400">
                      <span className="font-semibold text-primary-600 dark:text-primary-400">Rule:</span> All AI outputs that affect student records,
                      grades, or administrative decisions must pass through a human review gate before execution.
                    </p>
                  </div>
                </div>
              </Card>
            </motion.div>
          )}

          {/* ── Features Section ── */}
          {activeSection === 'features' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
              {aiModules.map((mod, idx) => (
                <Card key={idx} className="overflow-hidden">
                  <button
                    onClick={() => setExpandedModule(expandedModule === idx ? null : idx)}
                    className="w-full flex items-center justify-between p-5 hover:bg-surface-50 dark:hover:bg-surface-800/50 transition-colors text-left"
                  >
                    <div className="flex items-center gap-3">
                      <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center border', colorMap[mod.color])}>
                        {mod.icon}
                      </div>
                      <div>
                        <h3 className="font-semibold text-sm text-surface-900 dark:text-white">{mod.title}</h3>
                        <p className="text-xs text-surface-500 dark:text-surface-400">{mod.subtitle} — {mod.features.length} features</p>
                      </div>
                    </div>
                    <ChevronDown className={cn('w-4 h-4 text-surface-400 transition-transform', expandedModule === idx && 'rotate-180')} />
                  </button>
                  <AnimatePresence>
                    {expandedModule === idx && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                      >
                        <div className="px-5 pb-5 border-t border-surface-100 dark:border-surface-800 pt-4">
                          <ModuleFeatureTable features={mod.features} />
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </Card>
              ))}
            </motion.div>
          )}

          {/* ── Chatbot Section ── */}
          {activeSection === 'chatbot' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
              {/* Chatbot Capabilities */}
              <Card className="p-6">
                <CardHeader className="p-0 border-b border-surface-150 dark:border-surface-800 pb-4 mb-4">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Bot className="w-5 h-5 text-primary-500" />
                    Chatbot Capabilities
                  </CardTitle>
                  <CardDescription>The ACES Assistant can help with these domains</CardDescription>
                </CardHeader>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {chatbotDomains.map((d, i) => (
                    <div key={i} className="p-4 rounded-xl border border-surface-200 dark:border-surface-700 space-y-3 hover:border-primary-300 dark:hover:border-primary-700 transition-colors">
                      <div className="flex items-center gap-2">
                        <div className="text-primary-500">{d.icon}</div>
                        <h4 className="font-semibold text-sm text-surface-900 dark:text-white">{d.domain}</h4>
                      </div>
                      <ul className="space-y-1.5">
                        {d.examples.map((ex, j) => (
                          <li key={j} className="text-xs text-surface-500 dark:text-surface-400 pl-3 border-l-2 border-surface-200 dark:border-surface-700">
                            "{ex}"
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </Card>

              {/* Chat Interface Mockup */}
              <Card className="p-6">
                <CardHeader className="p-0 border-b border-surface-150 dark:border-surface-800 pb-4 mb-4">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <MessageSquare className="w-5 h-5 text-accent-500" />
                    Chatbot Interface
                  </CardTitle>
                </CardHeader>
                <div className="bg-surface-100 dark:bg-surface-800 rounded-2xl p-4 max-w-md mx-auto space-y-4">
                  <div className="text-center text-xs font-semibold text-surface-500 dark:text-surface-400">ACES Assistant</div>
                  <div className="bg-white dark:bg-surface-900 rounded-xl p-3 shadow-sm space-y-3">
                    <p className="text-xs text-surface-600 dark:text-surface-300">How can I help you today?</p>
                    <div className="flex flex-wrap gap-1.5">
                      {['My Schedule', 'Pay Dues', 'My Grades', 'Find Mentor', 'Study Resources', 'Help'].map((a) => (
                        <span key={a} className="px-2 py-1 rounded-full bg-primary-50 dark:bg-primary-950/30 text-primary-600 dark:text-primary-400 text-[10px] font-medium border border-primary-200 dark:border-primary-800">
                          {a}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="bg-primary-500 text-white rounded-xl p-3 ml-8 text-xs shadow-md">
                    When is my next exam?
                  </div>
                  <div className="bg-white dark:bg-surface-900 rounded-xl p-3 mr-8 text-xs shadow-sm space-y-2">
                    <p className="text-surface-700 dark:text-surface-300">Your next exam is CSC 301 on July 25, 2026 at 10:00 AM in LT 1. You have 5 days to prepare.</p>
                    <div className="flex gap-1.5">
                      <span className="px-2 py-1 rounded bg-surface-100 dark:bg-surface-800 text-[10px] text-surface-600 dark:text-surface-400">View Exam Timetable</span>
                      <span className="px-2 py-1 rounded bg-surface-100 dark:bg-surface-800 text-[10px] text-surface-600 dark:text-surface-400">Study Resources</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 bg-white dark:bg-surface-900 rounded-full px-3 py-2 shadow-sm border border-surface-200 dark:border-surface-700">
                    <span className="text-xs text-surface-400 flex-1">Type a message...</span>
                    <span className="text-xs">🎙️</span>
                    <span className="text-xs">📎</span>
                  </div>
                </div>
              </Card>

              {/* Escalation */}
              <Card className="p-6">
                <CardHeader className="p-0 border-b border-surface-150 dark:border-surface-800 pb-4 mb-4">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <ShieldAlert className="w-5 h-5 text-warning-500" />
                    Chatbot Escalation
                  </CardTitle>
                </CardHeader>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-surface-200 dark:border-surface-700">
                        <th className="text-left py-2 px-3 font-semibold text-surface-700 dark:text-surface-300">Scenario</th>
                        <th className="text-left py-2 px-3 font-semibold text-surface-700 dark:text-surface-300">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        { scenario: 'Complex query', action: '"Let me connect you with the HOD office." → Creates ticket' },
                        { scenario: 'Sensitive issue', action: '"This requires human support." → Routes to HOD or counselor' },
                        { scenario: 'Unknown query', action: '"I don\'t know the answer. Let me find out." → Logs for training' },
                        { scenario: 'Emergency', action: '"This sounds urgent. Contact security immediately: [number]"' },
                        { scenario: 'Repeated failure', action: 'After 3 failed attempts, auto-offers human support' },
                      ].map((e, i) => (
                        <tr key={i} className="border-b border-surface-100 dark:border-surface-800 last:border-0">
                          <td className="py-2.5 px-3 font-medium text-surface-900 dark:text-white">{e.scenario}</td>
                          <td className="py-2.5 px-3 text-surface-600 dark:text-surface-400">{e.action}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            </motion.div>
          )}

          {/* ── Ethics Section ── */}
          {activeSection === 'ethics' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
              {/* Human-in-the-Loop */}
              <Card className="p-6">
                <CardHeader className="p-0 border-b border-surface-150 dark:border-surface-800 pb-4 mb-4">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Users className="w-5 h-5 text-primary-500" />
                    Human-in-the-Loop Requirements
                  </CardTitle>
                </CardHeader>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-surface-200 dark:border-surface-700">
                        <th className="text-left py-2 px-3 font-semibold text-surface-700 dark:text-surface-300">AI Output Type</th>
                        <th className="text-left py-2 px-3 font-semibold text-surface-700 dark:text-surface-300">Human Review?</th>
                        <th className="text-left py-2 px-3 font-semibold text-surface-700 dark:text-surface-300">Reviewer</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ethicsTable.map((e, i) => (
                        <tr key={i} className="border-b border-surface-100 dark:border-surface-800 last:border-0">
                          <td className="py-2.5 px-3 font-medium text-surface-900 dark:text-white">{e.type}</td>
                          <td className="py-2.5 px-3">
                            {e.required ? (
                              <span className="inline-flex items-center gap-1 text-success-600 dark:text-success-400 font-medium">
                                <CheckCircle className="w-3.5 h-3.5" /> Yes
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-surface-400">
                                <XCircle className="w-3.5 h-3.5" /> No
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-surface-600 dark:text-surface-400">{e.reviewer}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>

              {/* Bias Mitigation */}
              <Card className="p-6">
                <CardHeader className="p-0 border-b border-surface-150 dark:border-surface-800 pb-4 mb-4">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Shield className="w-5 h-5 text-accent-500" />
                    Bias Mitigation
                  </CardTitle>
                </CardHeader>
                <div className="space-y-3">
                  {biasMeasures.map((b, i) => (
                    <div key={i} className="flex items-start gap-3 p-3 rounded-lg hover:bg-surface-50 dark:hover:bg-surface-800/50 transition-colors">
                      <CheckCircle className="w-4 h-4 text-success-500 mt-0.5 shrink-0" />
                      <div>
                        <p className="text-xs font-semibold text-surface-900 dark:text-white">{b.measure}</p>
                        <p className="text-xs text-surface-500 dark:text-surface-400">{b.implementation}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>

              {/* Data Privacy */}
              <Card className="p-6">
                <CardHeader className="p-0 border-b border-surface-150 dark:border-surface-800 pb-4 mb-4">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Lock className="w-5 h-5 text-success-500" />
                    Data Privacy
                  </CardTitle>
                </CardHeader>
                <div className="space-y-3">
                  {privacyRules.map((p, i) => (
                    <div key={i} className="flex items-start gap-3 p-3 rounded-lg hover:bg-surface-50 dark:hover:bg-surface-800/50 transition-colors">
                      <Lock className="w-4 h-4 text-primary-500 mt-0.5 shrink-0" />
                      <div>
                        <p className="text-xs font-semibold text-surface-900 dark:text-white">{p.rule}</p>
                        <p className="text-xs text-surface-500 dark:text-surface-400">{p.implementation}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            </motion.div>
          )}

          {/* ── Roadmap Section ── */}
          {activeSection === 'roadmap' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
              <Card className="p-6">
                <CardHeader className="p-0 border-b border-surface-150 dark:border-surface-800 pb-4 mb-6">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Calendar className="w-5 h-5 text-primary-500" />
                    Implementation Roadmap
                  </CardTitle>
                  <CardDescription>5-phase rollout over 12 months</CardDescription>
                </CardHeader>
                <div className="relative">
                  <div className="absolute left-5 top-0 bottom-0 w-0.5 bg-surface-200 dark:bg-surface-700" />
                  <div className="space-y-6">
                    {roadmapPhases.map((p, i) => (
                      <div key={i} className="relative flex items-start gap-4 pl-4">
                        <div className={cn('relative z-10 w-3 h-3 rounded-full mt-1.5 shrink-0 ring-4 ring-surface-50 dark:ring-surface-950', {
                          'bg-primary-500': p.color === 'primary',
                          'bg-accent-500': p.color === 'accent',
                          'bg-success-500': p.color === 'success',
                          'bg-warning-500': p.color === 'warning',
                          'bg-violet-500': p.color === 'violet',
                        })} />
                        <div className="flex-1 p-4 rounded-xl border border-surface-200 dark:border-surface-700 hover:border-primary-300 dark:hover:border-primary-700 transition-colors bg-surface-50/50 dark:bg-surface-800/30">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                            <h4 className="font-semibold text-sm text-surface-900 dark:text-white">{p.phase}</h4>
                            <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border', colorMap[p.color])}>
                              <Clock className="w-3 h-3" />
                              {p.timeline}
                            </span>
                          </div>
                          <p className="text-xs text-surface-600 dark:text-surface-400">{p.features}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </Card>
            </motion.div>
          )}

          {/* ── Integration Section ── */}
          {activeSection === 'integration' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <Card className="p-6">
                <CardHeader className="p-0 border-b border-surface-150 dark:border-surface-800 pb-4 mb-4">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Layers className="w-5 h-5 text-primary-500" />
                    Module Integration Map
                  </CardTitle>
                  <CardDescription>How AI connects with every module in ACES Zone</CardDescription>
                </CardHeader>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-surface-200 dark:border-surface-700">
                        <th className="text-left py-2 px-3 font-semibold text-surface-700 dark:text-surface-300">Module</th>
                        <th className="text-left py-2 px-3 font-semibold text-surface-700 dark:text-surface-300">AI Integrations</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        { module: 'Student Dashboard', integrations: 'Study assistant, GPA predictor, at-risk alerts, course recommendations' },
                        { module: 'Course Registration', integrations: 'Prerequisite checker, timetable optimizer, workload balancer, career mapper' },
                        { module: 'Attendance', integrations: 'Face recognition, pattern analysis, predictive absence, geofence optimization' },
                        { module: 'Results & Transcript', integrations: 'Grade distribution, plagiarism detection, result validation, summarization' },
                        { module: 'Campus Connect', integrations: 'Smart connections, content moderation, feed personalization, translation, voice-to-text' },
                        { module: 'Job Board', integrations: 'Job-student matching, resume parser, interview prep, salary benchmarking' },
                        { module: 'Mentorship', integrations: 'Mentor-mentee matching, session summarization, progress tracking, resource recommendations' },
                        { module: 'Dues & Payment', integrations: 'Fraud detection, revenue forecasting, defaulter scoring, expense categorization' },
                        { module: 'HOD Dashboard', integrations: 'Early warning, course performance prediction, lecturer insights, resource allocation, sentiment analysis, anomaly detection' },
                        { module: 'System Admin', integrations: 'Predictive maintenance, log analysis, behavior anomaly, auto-scaling, security threat detection' },
                        { module: 'Announcements', integrations: 'Smart targeting, engagement prediction, auto-summarization' },
                        { module: 'Transcript', integrations: 'Auto-validation, discrepancy detection, plain-language summary' },
                      ].map((row, i) => (
                        <tr key={i} className="border-b border-surface-100 dark:border-surface-800 last:border-0 hover:bg-surface-50 dark:hover:bg-surface-800/50 transition-colors">
                          <td className="py-2.5 px-3 font-medium text-surface-900 dark:text-white whitespace-nowrap">{row.module}</td>
                          <td className="py-2.5 px-3 text-surface-600 dark:text-surface-400">{row.integrations}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            </motion.div>
          )}

          {/* ── Edge Cases Section ── */}
          {activeSection === 'edge-cases' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <Card className="p-6">
                <CardHeader className="p-0 border-b border-surface-150 dark:border-surface-800 pb-4 mb-4">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <AlertTriangle className="w-5 h-5 text-warning-500" />
                    Edge Cases & Business Rules
                  </CardTitle>
                  <CardDescription>How the system handles exceptional scenarios ({edgeCases.length} rules)</CardDescription>
                </CardHeader>
                <div className="space-y-2">
                  {edgeCases.map((e, i) => (
                    <button
                      key={i}
                      onClick={() => setExpandedEdgeCase(expandedEdgeCase === i ? null : i)}
                      className="w-full text-left"
                    >
                      <div className={cn(
                        'flex items-center justify-between p-3 rounded-lg transition-colors',
                        expandedEdgeCase === i
                          ? 'bg-warning-50 dark:bg-warning-950/20 border border-warning-200 dark:border-warning-800'
                          : 'hover:bg-surface-50 dark:hover:bg-surface-800/50 border border-transparent'
                      )}>
                        <div className="flex items-center gap-2">
                          <AlertCircle className={cn('w-3.5 h-3.5 shrink-0', expandedEdgeCase === i ? 'text-warning-500' : 'text-surface-400')} />
                          <span className="text-xs font-medium text-surface-900 dark:text-white">{e.scenario}</span>
                        </div>
                        <ChevronDown className={cn('w-3.5 h-3.5 text-surface-400 transition-transform', expandedEdgeCase === i && 'rotate-180')} />
                      </div>
                      <AnimatePresence>
                        {expandedEdgeCase === i && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.15 }}
                            className="overflow-hidden"
                          >
                            <p className="text-xs text-surface-600 dark:text-surface-400 pl-6 pr-3 pb-3 pt-1">{e.handling}</p>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </button>
                  ))}
                </div>
              </Card>
            </motion.div>
          )}

          {/* ── Data Model Section ── */}
          {activeSection === 'data-model' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
              {dataModel.map((table, tIdx) => (
                <Card key={tIdx} className="p-6">
                  <CardHeader className="p-0 border-b border-surface-150 dark:border-surface-800 pb-4 mb-4">
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <Database className="w-5 h-5 text-primary-500" />
                      {table.name}
                    </CardTitle>
                  </CardHeader>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-surface-200 dark:border-surface-700">
                          <th className="text-left py-2 px-3 font-semibold text-surface-700 dark:text-surface-300">Field</th>
                          <th className="text-left py-2 px-3 font-semibold text-surface-700 dark:text-surface-300">Type</th>
                          <th className="text-left py-2 px-3 font-semibold text-surface-700 dark:text-surface-300">Description</th>
                        </tr>
                      </thead>
                      <tbody>
                        {table.fields.map((f, fIdx) => (
                          <tr key={fIdx} className="border-b border-surface-100 dark:border-surface-800 last:border-0">
                            <td className="py-2 px-3 font-mono font-medium text-primary-600 dark:text-primary-400">{f.name}</td>
                            <td className="py-2 px-3">
                              <span className={cn('px-1.5 py-0.5 rounded text-[10px] font-semibold', {
                                'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300': f.type === 'PK',
                                'bg-accent-100 dark:bg-accent-900/30 text-accent-700 dark:text-accent-300': f.type === 'FK' || f.type === 'FK?',
                                'bg-surface-100 dark:bg-surface-800 text-surface-600 dark:text-surface-400': !['PK', 'FK', 'FK?'].includes(f.type),
                              })}>
                                {f.type}
                              </span>
                            </td>
                            <td className="py-2 px-3 text-surface-600 dark:text-surface-400">{f.desc}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Card>
              ))}
            </motion.div>
          )}
        </motion.div>
      </div>
    </div>
  );
};

export default AIBlueprintPage;
