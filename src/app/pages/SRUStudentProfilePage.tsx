// ============================================================
// SRUStudentProfilePage.tsx  —  Novelty 2
// Full SSA Student Profile page with XAI risk breakdown +
// what-if simulator. Route: /sru/student/:studentId
// ============================================================

import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router';
import { collection, query, where, getDocs, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../AuthContext';
import { useRiskScore } from '../hooks/useRiskScore';
import { RiskGauge } from '../components/RiskGauge';
import { XAIFactorBreakdown } from '../components/XAIFactorBreakdown';
import { WhatIfSimulator } from '../components/WhatIfSimulator';
import { RiskLevelBadge } from '../components/RiskScoreBadge';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog';
import { toast } from 'sonner';
import {
  ArrowLeft, Calendar, AlertTriangle,
  TrendingUp, Eye, Loader2, Phone, Building2, ClipboardList, HeartPulse,
  GraduationCap, Heart, BookOpen, ArrowUpCircle,
} from 'lucide-react';

interface StudentData {
  id: string;
  studentId: string;
  name: string;
  email: string;
  programme: string;
  level: string;
  attendancePercentage: number;
  consecutiveAbsences: number;
  gpa: number;
  riskLevel: string;
  engagementScore?: number;
  enrollmentDate?: string;
  nationality?: string;
  ethnicity?: string;
  gender?: string;
  flagged?: boolean;
  academic_warning_count?: number;
  financial_aid?: boolean;
  credits_completed?: number;
  deferral_months?: number;
  attendanceBySemester?: number[];
  phone?: string;
  faculty?: string;
}

// ── Academic Challenge Classification ──────────────────────────────────────
interface AcademicChallenge {
  id: string;
  name: string;
  iconName: 'GraduationCap' | 'Heart' | 'BookOpen' | 'ArrowUpCircle';
  reason: string;
  confidence: 'High' | 'Medium';
  secondary?: boolean;
  secondaryNote?: string;
}

interface ClassifyResult {
  challenges: AcademicChallenge[];
  insufficientData: boolean;
}

function classifyAcademicChallenges(params: {
  attendancePercentage: number;
  gpa: number;
  level: string;
  consecutiveAbsences: number;
  attendanceBySemester: number[];
  failedModules: number;
  passedModules: number;
  gpaHistory: number[];
  wellbeing: Record<string, any> | null;
}): ClassifyResult {
  const {
    attendancePercentage, gpa, level, consecutiveAbsences,
    attendanceBySemester, failedModules, passedModules, gpaHistory, wellbeing,
  } = params;

  const insufficientData = gpaHistory.length < 2;
  const challenges: AcademicChallenge[] = [];
  const totalModules = failedModules + passedModules;

  // Numeric GPA trend delta: last value minus first value (overall trajectory, not just last step)
  // e.g. [3.10, 2.90, 2.78] → 2.78 - 3.10 = -0.32 (declining)
  const gpaTrendDelta: number | null = gpaHistory.length >= 2
    ? gpaHistory[gpaHistory.length - 1] - gpaHistory[0]
    : null;

  // Sudden drops across semesters
  const hasGpaSemesterDrop = gpaHistory.length >= 2 &&
    gpaHistory.some((v, i) => i > 0 && (gpaHistory[i - 1] - v) > 0.8);
  const hasAttSemesterDrop = attendanceBySemester.length >= 2 &&
    attendanceBySemester.some((v, i) => i > 0 && (attendanceBySemester[i - 1] - v) > 0.25);

  // Label maps
  const PROG_FIT: Record<string, string> = {
    very_satisfied: 'Very Satisfied', satisfied: 'Satisfied',
    unsatisfied: 'Unsatisfied', very_unsatisfied: 'Very Unsatisfied',
  };
  const WELLBEING_L: Record<string, string> = {
    very_good: 'Very Good', good: 'Good', fair: 'Fair', poor: 'Poor', very_poor: 'Very Poor',
  };
  const LECTURE_L: Record<string, string> = {
    yes: 'Yes', mostly: 'Mostly', sometimes: 'Sometimes', no: 'No',
  };
  const STUDY_L: Record<string, string> = {
    very_confident: 'Very confident', confident: 'Confident',
    somewhat_confident: 'Somewhat confident', not_confident: 'Not confident',
  };
  const TRANSITION_L: Record<string, string> = {
    not_at_all: 'Not at all', somewhat_different: 'Somewhat different', very_different: 'Very different',
  };

  // 1. Wrong Programme Choice — only from 2nd semester onwards
  let wrongProgrammeDetected = false;
  if (
    !insufficientData &&
    attendancePercentage >= 60 &&
    totalModules > 0 &&
    failedModules > totalModules * 0.5 &&
    gpa < 2.0 &&
    (level !== '1st Year' || gpaHistory.length >= 3)
  ) {
    wrongProgrammeDetected = true;
    const hasBoost = wellbeing?.programmeFit === 'unsatisfied' || wellbeing?.programmeFit === 'very_unsatisfied';
    const pct = Math.round((failedModules / totalModules) * 100);
    const fitNote = wellbeing?.programmeFit
      ? ` Programme fit self-reported as "${PROG_FIT[wellbeing.programmeFit] ?? wellbeing.programmeFit}".`
      : '';
    challenges.push({
      id: 'wrong_programme',
      name: 'Wrong Programme Choice',
      iconName: 'GraduationCap',
      reason: `Attending ${attendancePercentage}% of sessions but failing ${failedModules} of ${totalModules} modules (${pct}%) with GPA ${gpa.toFixed(1)} suggests possible programme misalignment.${fitNote}`,
      confidence: hasBoost ? 'High' : 'Medium',
    });
  }

  // 2. Psychological Challenge
  const psychTriggers: string[] = [];
  if (!insufficientData && hasGpaSemesterDrop) psychTriggers.push('sudden GPA collapse across semesters');
  if (!insufficientData && hasAttSemesterDrop) psychTriggers.push('sudden attendance drop across semesters');
  if (consecutiveAbsences >= 5) psychTriggers.push(`${consecutiveAbsences} consecutive absences recorded`);
  if (psychTriggers.length > 0) {
    const hasBoost = wellbeing?.overallWellbeing === 'poor' || wellbeing?.overallWellbeing === 'very_poor';
    const wbNote = wellbeing?.overallWellbeing
      ? ` Overall wellbeing self-reported as "${WELLBEING_L[wellbeing.overallWellbeing] ?? wellbeing.overallWellbeing}".`
      : '';
    challenges.push({
      id: 'psychological',
      name: 'Psychological Challenge',
      iconName: 'Heart',
      reason: `Indicators present: ${psychTriggers.join('; ')}.${wbNote}`,
      confidence: hasBoost ? 'High' : 'Medium',
    });
  }

  // 3. Poor Learning Skills — only from 2nd semester onwards
  if (
    !insufficientData &&
    attendancePercentage >= 70 &&
    gpa < 2.0 &&
    gpaTrendDelta !== null && gpaTrendDelta <= 0 &&
    (level !== '1st Year' || gpaHistory.length >= 3)
  ) {
    const hasBoost =
      (wellbeing?.lectureComprehension === 'sometimes' || wellbeing?.lectureComprehension === 'no') &&
      wellbeing?.studySkillsConfidence === 'not_confident';
    const trendText = gpaTrendDelta < 0 ? 'declining' : 'flat';
    const wbNote = wellbeing
      ? ` Lecture comprehension: "${LECTURE_L[wellbeing.lectureComprehension] ?? wellbeing.lectureComprehension ?? '—'}"; study skills confidence: "${STUDY_L[wellbeing.studySkillsConfidence] ?? wellbeing.studySkillsConfidence ?? '—'}".`
      : '';
    challenges.push({
      id: 'poor_learning',
      name: 'Poor Learning Skills',
      iconName: 'BookOpen',
      reason: `Attending ${attendancePercentage}% of sessions regularly but GPA is ${gpa.toFixed(1)} with a ${trendText} trend, suggesting difficulty translating attendance into results.${wbNote}`,
      confidence: hasBoost ? 'High' : 'Medium',
    });
  }

  // 4. Academic Transition Difficulty — requires declining trend (needs >= 2 semesters)
  // Threshold raised to 3.0: early-year students haven't had time to drop significantly
  if (
    (level === '1st Year' || level === '2nd Year') &&
    gpa < 3.0 &&
    gpaTrendDelta !== null && gpaTrendDelta < 0
  ) {
    const hasBoost = wellbeing?.universityTransition === 'very_different';
    const wbNote = wellbeing?.universityTransition
      ? ` University transition self-reported as "${TRANSITION_L[wellbeing.universityTransition] ?? wellbeing.universityTransition}".`
      : '';
    challenges.push({
      id: 'transition',
      name: 'Academic Transition Difficulty',
      iconName: 'ArrowUpCircle',
      reason: `${level} student with GPA ${gpa.toFixed(1)} on a declining trend, suggesting difficulty adapting to university-level academic demands.${wbNote}`,
      confidence: hasBoost ? 'High' : 'Medium',
    });
  }

  // Priority rule: if 1st Year has BOTH Transition and Wrong Programme detected,
  // Transition becomes primary; Wrong Programme becomes secondary with a monitoring note.
  if (level === '1st Year' && wrongProgrammeDetected) {
    const transIdx = challenges.findIndex((c) => c.id === 'transition');
    const wpIdx    = challenges.findIndex((c) => c.id === 'wrong_programme');
    if (transIdx !== -1 && wpIdx !== -1) {
      // Pull transition out and put it first
      const [trans] = challenges.splice(transIdx, 1);
      const newWpIdx = challenges.findIndex((c) => c.id === 'wrong_programme');
      challenges[newWpIdx] = {
        ...challenges[newWpIdx],
        secondary: true,
        secondaryNote: 'Monitor — may become more apparent in later semesters',
      };
      challenges.unshift(trans);
    }
  }

  return { challenges, insufficientData };
}

const CHALLENGE_ICONS: Record<string, React.ReactNode> = {
  GraduationCap:  <GraduationCap  className="h-5 w-5" />,
  Heart:          <Heart          className="h-5 w-5" />,
  BookOpen:       <BookOpen       className="h-5 w-5" />,
  ArrowUpCircle:  <ArrowUpCircle  className="h-5 w-5" />,
};

const CHALLENGE_ICONS_SM: Record<string, React.ReactNode> = {
  GraduationCap:  <GraduationCap  className="h-3.5 w-3.5" />,
  Heart:          <Heart          className="h-3.5 w-3.5" />,
  BookOpen:       <BookOpen       className="h-3.5 w-3.5" />,
  ArrowUpCircle:  <ArrowUpCircle  className="h-3.5 w-3.5" />,
};

const SUGGESTED_ACTIONS: Record<string, string[]> = {
  psychological: [
    'Schedule a welfare check meeting with the student',
    'Refer to university counselling service',
    'Guide student through extenuating circumstances process',
    'Consider temporary reduced workload arrangement',
    'Increase check-in frequency with academic mentor',
  ],
  transition: [
    'Enroll student in first year transition support programme',
    'Increase academic mentor contact frequency',
    'Connect student with a peer study group',
    'Review study habits and time management skills with student',
    'Encourage attendance at academic skills workshops',
  ],
  wrong_programme: [
    'Schedule programme suitability discussion with student',
    'Refer to career guidance and counselling service',
    'Review module exemption or substitution options',
    'Consult Programme Leader regarding transfer options',
    'Document student academic concerns formally',
  ],
  poor_learning: [
    'Refer student to study skills workshop',
    'Arrange peer tutoring support',
    'Recommend academic writing support service',
    'Review learning style and study approach with student',
    'Schedule regular academic mentor sessions',
  ],
};

const REFERRAL_DEPARTMENTS = [
  'Counselling Services',
  'Academic Support Centre',
  'Financial Aid Office',
  'Career Services',
  'Disability Support Services',
  'Health Services',
  'Student Welfare Office',
  'External Support Services',
];

export default function SRUStudentProfilePage() {
  const { studentId } = useParams<{ studentId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [student, setStudent]                 = useState<StudentData | null>(null);
  const [loading, setLoading]                 = useState(true);
  const [viewedByStudent, setViewedByStudent] = useState<string | null>(null);
  const [interventions, setInterventions]     = useState<{
    id: string;
    interventionType: string;
    date: string;
    outcome: string;
    recordedBy: string;
    openStatus?: string;
    followUpDate?: string | null;
    createdAt: any;
  }[]>([]);

  // Academic feature states
  const [failedModules, setFailedModules]       = useState(0);
  const [creditsCompleted, setCreditsCompleted] = useState(0);
  const [gpaHistory, setGpaHistory]             = useState<number[]>([]);
  const [academicWarnings, setAcademicWarnings] = useState(0);

  // Referral modal state
  const [referralModalOpen, setReferralModalOpen]   = useState(false);
  const [referralDept, setReferralDept]             = useState('');
  const [referralNotes, setReferralNotes]           = useState('');
  const [referralSubmitting, setReferralSubmitting] = useState(false);
  const [referralUrgency, setReferralUrgency]       = useState('');
  const [referralType, setReferralType]             = useState('');
  const [linkCopied, setLinkCopied]                 = useState(false);
  const [ssaCalendarLink, setSsaCalendarLink]       = useState('');

  // Wellbeing check-in
  const [wellbeing, setWellbeing] = useState<Record<string, any> | null>(null);
  const [loadingWellbeing, setLoadingWellbeing] = useState(false);

  // Module attendance breakdown
  const [moduleAttendance, setModuleAttendance] = useState<{
    moduleId: string;
    moduleCode: string;
    moduleName: string;
    total: number;
    present: number;
    absent: number;
    percentage: number;
  }[]>([]);
  const [loadingModuleAtt, setLoadingModuleAtt] = useState(false);

  // Fetch SSA's calendar link
  useEffect(() => {
    if (!user?.email) return;
    const fetchCalendarLink = async () => {
      try {
        const snap = await getDocs(collection(db, 'student_support_advisors'));
        for (const d of snap.docs) {
          if (d.data().email?.toLowerCase().trim() === user.email.toLowerCase().trim()) {
            setSsaCalendarLink(d.data().calendarLink ?? '');
            break;
          }
        }
      } catch {}
    };
    fetchCalendarLink();
  }, [user?.email]);

  useEffect(() => {
    if (!studentId) return;
    const fetchData = async () => {
      setLoading(true);
      try {
        // Look up student by studentId field (not Firestore doc ID)
        const studentSnap = await getDocs(
          query(collection(db, 'students'), where('studentId', '==', studentId))
        );
        let firestoreDocId = '';
        if (!studentSnap.empty) {
          const snap = studentSnap.docs[0];
          firestoreDocId = snap.id;
          const d = snap.data();
          setStudent({
            id: firestoreDocId,
            studentId: d.studentId ?? '',
            name: d.name ?? '',
            email: d.email ?? '',
            programme: d.programme ?? '',
            level: d.level ?? '',
            attendancePercentage: d.attendancePercentage ?? 100,
            consecutiveAbsences: d.consecutiveAbsences ?? 0,
            gpa: d.gpa ?? 0,
            riskLevel: d.riskLevel ?? 'low',
            engagementScore: d.engagementScore ?? 50,
            enrollmentDate: d.enrollmentDate ?? '',
            nationality: d.nationality ?? '',
            ethnicity: d.ethnicity ?? '',
            gender: d.gender ?? '',
            flagged: d.flagged ?? false,
            academic_warning_count: d.academic_warning_count ?? 0,
            financial_aid: d.financial_aid ?? false,
            credits_completed: d.credits_completed ?? 0,
            deferral_months: d.deferral_months ?? 0,
            attendanceBySemester: d.attendance_by_semester ?? d.attendanceBySemester ?? [],
            phone: d.phone ?? '',
            faculty: d.faculty ?? '',
          });
        }

        // studentProfileViews stores the Firestore doc ID (set by StudentDashboard)
        if (firestoreDocId) {
          const viewedSnap = await getDocs(
            query(collection(db, 'studentProfileViews'), where('studentId', '==', firestoreDocId))
          );
          if (!viewedSnap.empty) {
            const vd = viewedSnap.docs[0].data();
            setViewedByStudent(vd.viewedAt?.toDate?.()?.toLocaleString() ?? 'Recently');
          }
        }

        // Fetch interventions for this student (interventions store the actual studentId)
        const intSnap = await getDocs(
          query(collection(db, 'interventions'), where('studentId', '==', studentId))
        );
        setInterventions(intSnap.docs.map((d) => ({
          id: d.id,
          interventionType: d.data().interventionType ?? '',
          date: d.data().date ?? '',
          outcome: d.data().outcome ?? '',
          recordedBy: d.data().recordedBy ?? '',
          openStatus: d.data().openStatus ?? '',
          followUpDate: d.data().followUpDate ?? null,
          createdAt: d.data().createdAt ?? null,
        })));
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [studentId]);

  useEffect(() => {
    if (!student?.studentId) return;
    const fetchAcademicFeatures = async () => {
      try {
        const resultsSnap = await getDocs(
          query(collection(db, 'results'), where('studentId', '==', student.studentId))
        );
        const results = resultsSnap.docs.map((d) => d.data());

        const failed = results.filter((r) => (r.finalMark ?? r.mark ?? 0) < 40).length;
        const passed  = results.filter((r) => (r.finalMark ?? r.mark ?? 0) >= 40).length;
        setFailedModules(failed);
        setCreditsCompleted(passed);

        const bySemester: Record<string, number[]> = {};
        results.forEach((r) => {
          const key = `${r.academicYear ?? 'Unknown'}-${r.semester ?? 'Unknown'}`;
          if (!bySemester[key]) bySemester[key] = [];
          bySemester[key].push(r.finalMark ?? r.mark ?? 0);
        });
        const history = Object.values(bySemester).map((marks) => {
          const avg = marks.reduce((a, b) => a + b, 0) / marks.length;
          return Math.round(avg * 10) / 10;
        });
        setGpaHistory(history);

        const intSnap = await getDocs(
          query(collection(db, 'interventions'), where('studentId', '==', student.studentId))
        );
        setAcademicWarnings(intSnap.docs.filter((d) => d.data().isAcademicWarning === true).length);
      } catch (err) {
        console.error('Failed to fetch academic features:', err);
      }
    };
    fetchAcademicFeatures();
  }, [student?.studentId]);

  useEffect(() => {
    if (!student?.studentId) return;
    setLoadingModuleAtt(true);
    const fetchModuleAttendance = async () => {
      try {
        const attSnap = await getDocs(
          query(collection(db, 'attendance'), where('studentId', '==', student.studentId))
        );
        const byModule: Record<string, { present: number; total: number; moduleCode: string; moduleName: string }> = {};
        attSnap.forEach((d) => {
          const data = d.data();
          const mid = data.moduleId ?? '';
          if (!mid) return;
          if (!byModule[mid]) byModule[mid] = { present: 0, total: 0, moduleCode: data.moduleCode ?? '', moduleName: data.moduleName ?? '' };
          byModule[mid].total++;
          if (data.status === 'present') byModule[mid].present++;
        });

        // Backfill module names if missing from attendance records
        const needsBackfill = Object.values(byModule).some((v) => !v.moduleCode || !v.moduleName);
        if (needsBackfill) {
          const modSnap = await getDocs(collection(db, 'modules'));
          modSnap.forEach((d) => {
            if (byModule[d.id]) {
              byModule[d.id].moduleCode = byModule[d.id].moduleCode || (d.data().moduleCode ?? '');
              byModule[d.id].moduleName = byModule[d.id].moduleName || (d.data().moduleName ?? d.data().name ?? '');
            }
          });
        }

        setModuleAttendance(
          Object.entries(byModule)
            .map(([moduleId, s]) => ({
              moduleId,
              moduleCode: s.moduleCode || moduleId,
              moduleName: s.moduleName || 'Unknown Module',
              total: s.total,
              present: s.present,
              absent: s.total - s.present,
              percentage: s.total > 0 ? Math.round((s.present / s.total) * 100) : 0,
            }))
            .sort((a, b) => a.moduleCode.localeCompare(b.moduleCode))
        );
      } catch (err) {
        console.error('Failed to fetch module attendance:', err);
      } finally {
        setLoadingModuleAtt(false);
      }
    };
    fetchModuleAttendance();
  }, [student?.studentId]);

  // Fetch latest wellbeing check-in
  useEffect(() => {
    if (!student?.studentId) return;
    setLoadingWellbeing(true);
    getDocs(query(collection(db, 'wellbeingCheckIns'), where('studentId', '==', student.studentId)))
      .then((snap) => {
        if (!snap.empty) {
          // Take the most recent submission
          const sorted = snap.docs.sort((a, b) => {
            const aT = a.data().submittedAt?.toDate?.()?.getTime() ?? 0;
            const bT = b.data().submittedAt?.toDate?.()?.getTime() ?? 0;
            return bT - aT;
          });
          setWellbeing(sorted[0].data());
        }
      })
      .catch(() => {})
      .finally(() => setLoadingWellbeing(false));
  }, [student?.studentId]);

  const copyLink = (link: string) => {
    navigator.clipboard.writeText(link);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  };

  const handleReferral = async () => {
    if (!referralDept || !student) return;
    if (!referralUrgency) { toast.error('Please select an urgency level.'); return; }
    setReferralSubmitting(true);
    try {
      await addDoc(collection(db, 'interventions'), {
        studentId:        student.studentId,
        studentName:      student.name,
        programme:        student.programme,
        riskLevel:        riskData.level ?? 'medium',
        interventionType: 'Referral',
        type:             'Referral',
        referredTo:       referralDept,
        date:             new Date().toISOString().split('T')[0],
        notes:            referralNotes.trim(),
        urgency:          referralUrgency,
        referralType:     referralType,
        recordedBy:                user?.name ?? 'SSA',
        status:                    'open',
        gpaAtIntervention:              student.gpa,
        attendanceAtIntervention:       student.attendancePercentage,
        gpaSemesterCountAtIntervention: gpaHistory.length,
        createdAt:                      serverTimestamp(),
      });
      // Notify student about referral
      await addDoc(collection(db, 'notifications'), {
        userId:    student.studentId,
        type:      'referral',
        title:     'You have been referred for support',
        message:   `Your Student Support Advisor has referred you for ${referralType.replace('_', ' ')} support. Please expect to be contacted soon.`,
        createdAt: serverTimestamp(),
        read:      false,
      });
      toast.success(`${student.name} referred to ${referralDept} successfully`);
      setReferralModalOpen(false);
      setReferralDept('');
      setReferralNotes('');
      setReferralUrgency('');
      setReferralType('');
    } catch {
      toast.error('Failed to log referral. Please try again.');
    } finally {
      setReferralSubmitting(false);
    }
  };

  const riskData = useRiskScore({
    attendancePercentage:    student?.attendancePercentage,
    gpa:                     student?.gpa,
    studentId:               student?.studentId,
    consecutiveAbsences:     student?.consecutiveAbsences,
    enrollmentDate:          student?.enrollmentDate,
    nationality:             student?.nationality,
    gender:                  student?.gender,
    programme:               student?.programme,
    flagged:                 student?.flagged,
    academic_warning_count:  student?.academic_warning_count,
    attendanceBySemester:    student?.attendanceBySemester,
    ethnicity:               student?.ethnicity,
    financial_aid:           student?.financial_aid,
    credits_completed:       student?.credits_completed,
    deferral_months:         student?.deferral_months,
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 gap-2 text-muted-foreground text-sm">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading student profile...
      </div>
    );
  }

  if (!student) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        <p>Student not found.</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate(-1)}>Go Back</Button>
      </div>
    );
  }

  const initials = student.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase();
  const avatarColour =
    riskData.score >= 80 ? 'bg-red-100 text-red-700' :
    riskData.score >= 60 ? 'bg-amber-100 text-amber-700' :
    'bg-blue-100 text-blue-700';

  return (
    <div className="space-y-6">
      {/* Back button */}
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" /> Back to Students
      </button>

      {/* N3 cross-portal indicator */}
      {viewedByStudent && (
        <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-lg px-4 py-3 text-sm text-green-800">
          <Eye className="h-4 w-4 flex-shrink-0 text-green-600" />
          <div>
            <span className="font-medium">Student has viewed their Academic Health profile</span>
            <span className="text-green-600 ml-2">— last viewed {viewedByStudent}.</span>
            <span className="ml-2 text-green-700">Self-awareness initiated. Monitor for help-seeking behaviour.</span>
          </div>
        </div>
      )}

      {/* Profile header */}
      <Card>
        <CardContent className="pt-5 pb-5">
          <div className="flex items-start gap-4">
            <div className={`w-14 h-14 rounded-full flex items-center justify-center text-lg font-semibold flex-shrink-0 ${avatarColour}`}>
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-xl font-semibold">{student.name}</h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                {student.studentId} · {student.programme} · {student.level}
              </p>
              <div className="flex flex-wrap gap-2 mt-2">
                {riskData.pending ? (
                  <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600">
                    Risk Pending
                  </span>
                ) : (
                  <RiskLevelBadge level={riskData.level} />
                )}
                <Badge variant="outline" className="text-xs">{student.email}</Badge>
              </div>
              <div className="flex flex-wrap gap-3 mt-2">
                {student.phone && (
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Phone className="h-3 w-3" />{student.phone}
                  </span>
                )}
                {student.faculty && (
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Building2 className="h-3 w-3" />{student.faculty}
                  </span>
                )}
              </div>
            </div>
            <div className="flex gap-2 flex-shrink-0">
              <Button
                size="sm"
                className="gap-1.5 bg-blue-600 hover:bg-blue-700"
                onClick={async () => {
                  if (!ssaCalendarLink) {
                    toast.error('No calendar link set. Please add your Google Calendar link in Settings.');
                    return;
                  }
                  const params = new URLSearchParams();
                  if (student?.email) params.set('email', student.email);
                  if (student?.name) params.set('name', student.name);
                  window.open(`${ssaCalendarLink}?${params.toString()}`, '_blank');
                  try {
                    await addDoc(collection(db, 'appointments'), {
                      studentId: student?.id ?? '',
                      studentName: student?.name ?? '',
                      programme: student?.programme ?? '',
                      type: 'SSA Session',
                      appointmentType: 'SSA Session',
                      date: new Date().toISOString().split('T')[0],
                      time: '',
                      status: 'scheduled',
                      scheduledBy: user?.name ?? '',
                      bookedBy: 'ssa',
                      advisorId: user?.id ?? '',
                      createdAt: serverTimestamp(),
                    });
                    toast.success(`Appointment scheduled for ${student?.name}`);
                  } catch {
                    toast.error('Failed to save appointment record.');
                  }
                }}
              >
                <Calendar className="h-3.5 w-3.5" /> Schedule
              </Button>
            </div>
          </div>

          {/* Quick stats row */}
          <div className="grid grid-cols-4 gap-3 mt-5 pt-5 border-t">
            <div className="text-center">
              <p className={`text-2xl font-bold ${student.attendancePercentage < 75 ? 'text-red-600' : 'text-green-600'}`}>
                {student.attendancePercentage}%
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">Attendance</p>
            </div>
            <div className="text-center">
              <p className={`text-2xl font-bold ${student.gpa < 2.0 ? 'text-red-600' : student.gpa < 2.5 ? 'text-amber-600' : 'text-green-600'}`}>
                {student.gpa.toFixed(1)}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">GPA</p>
            </div>
            <div className="text-center">
              <p className={`text-2xl font-bold ${student.consecutiveAbsences >= 3 ? 'text-red-600' : 'text-gray-800'}`}>
                {student.consecutiveAbsences}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">Consec. Absences</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-blue-600">{interventions.length}</p>
              <p className="text-xs text-muted-foreground mt-0.5">Interventions</p>
            </div>
          </div>

          {/* Academic Indicators */}
          <div className="mt-4">
            <h3 className="text-sm font-medium text-muted-foreground mb-3">Academic Indicators</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="bg-background border rounded-lg p-3 text-center">
                <p className={`text-2xl font-bold ${failedModules > 0 ? 'text-red-500' : 'text-green-500'}`}>
                  {failedModules}
                </p>
                <p className="text-xs text-muted-foreground mt-1">Failed Modules</p>
              </div>
              <div className="bg-background border rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-blue-500">{creditsCompleted}</p>
                <p className="text-xs text-muted-foreground mt-1">Modules Passed</p>
              </div>
              <div className="bg-background border rounded-lg p-3 text-center">
                <p className={`text-2xl font-bold ${
                  gpaHistory.length < 2 ? 'text-gray-400' :
                  gpaHistory[gpaHistory.length - 1] >= gpaHistory[gpaHistory.length - 2]
                    ? 'text-green-500' : 'text-red-500'
                }`}>
                  {gpaHistory.length < 2 ? '—' :
                    gpaHistory[gpaHistory.length - 1] >= gpaHistory[gpaHistory.length - 2]
                      ? '↑ Improving' : '↓ Declining'}
                </p>
                <p className="text-xs text-muted-foreground mt-1">GPA Trend</p>
              </div>
              <div className="bg-background border rounded-lg p-3 text-center">
                <p className={`text-2xl font-bold ${
                  academicWarnings === 0 ? 'text-green-500' :
                  academicWarnings <= 2  ? 'text-amber-500' : 'text-red-500'
                }`}>
                  {academicWarnings}
                </p>
                <p className="text-xs text-muted-foreground mt-1">Academic Warnings</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Attendance by Module */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Calendar className="h-4 w-4 text-blue-500" />
            Attendance by Module
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loadingModuleAtt ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading attendance breakdown…
            </div>
          ) : moduleAttendance.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">No attendance records found</p>
          ) : (
            <div className="overflow-x-auto rounded-md border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b">
                    <th className="text-left font-medium text-muted-foreground px-4 py-2">Module Code</th>
                    <th className="text-left font-medium text-muted-foreground px-4 py-2">Module Name</th>
                    <th className="text-center font-medium text-muted-foreground px-4 py-2">Sessions</th>
                    <th className="text-center font-medium text-muted-foreground px-4 py-2">Present</th>
                    <th className="text-center font-medium text-muted-foreground px-4 py-2">Absent</th>
                    <th className="text-center font-medium text-muted-foreground px-4 py-2">Attendance %</th>
                  </tr>
                </thead>
                <tbody>
                  {moduleAttendance.map((m) => (
                    <tr key={m.moduleId} className="border-b last:border-0 hover:bg-gray-50">
                      <td className="px-4 py-2 font-mono text-xs font-medium">{m.moduleCode}</td>
                      <td className="px-4 py-2">{m.moduleName}</td>
                      <td className="px-4 py-2 text-center text-muted-foreground">{m.total}</td>
                      <td className="px-4 py-2 text-center text-green-600 font-medium">{m.present}</td>
                      <td className="px-4 py-2 text-center text-red-500">{m.absent}</td>
                      <td className="px-4 py-2 text-center">
                        <span className={`font-semibold ${
                          m.percentage >= 80 ? 'text-green-600'
                          : m.percentage >= 60 ? 'text-amber-600'
                          : 'text-red-600'
                        }`}>
                          {m.percentage}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* NOVELTY 2: XAI Risk Breakdown + What-If */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* LEFT: XAI Breakdown */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                Explainable Risk Breakdown
              </CardTitle>
            </CardHeader>
            <CardContent>
              {/* Gauge + score */}
              <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl mb-5">
                <div className="flex-shrink-0">
                  <RiskGauge score={riskData.pending ? 0 : riskData.score} size={140} />
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">Dropout risk score</p>
                  {riskData.pending ? (
                    <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600">
                      Risk Pending
                    </span>
                  ) : (
                    <RiskLevelBadge level={riskData.level} />
                  )}
                  <p className="text-xs text-gray-500 mt-2 leading-relaxed">
                    {riskData.pending ? 'Connect ML model to generate score' : 'Score generated from 3 weighted factor groups. Updated daily.'}
                  </p>
                </div>
              </div>

              <XAIFactorBreakdown
                factors={riskData.factors}
              />
            </CardContent>
          </Card>

          {/* RIGHT: What-If Simulator + Recommended Interventions */}
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-blue-500" />
                  What-If Intervention Simulator
                </CardTitle>
              </CardHeader>
              <CardContent>
                <WhatIfSimulator
                  studentData={{
                    attendance_rate: student.attendancePercentage / 100,
                    gpa_current: student.gpa,
                    advisor_meeting_count: interventions.filter(i => i.interventionType === 'Meeting').length,
                    academic_warning_count: academicWarnings,
                  }}
                  currentScore={riskData.score}
                  pending={riskData.pending}
                />
              </CardContent>
            </Card>

            {/* Recommended interventions */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <ClipboardList className="h-4 w-4 text-muted-foreground" />
                  Intervention Actions
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0 space-y-3">
                <p className="text-sm text-muted-foreground">
                  Review the student's risk profile and academic indicators
                  above to determine the most appropriate intervention.
                  Use your professional judgment to decide the best course of action.
                </p>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => navigate(`/sru/interventions?studentId=${student.studentId}&studentName=${encodeURIComponent(student.name)}`)}
                >
                  <ClipboardList className="h-4 w-4 mr-2" />
                  Log an Intervention
                </Button>
              </CardContent>
            </Card>
          </div>
      </div>

      {/* Intervention History */}
      {interventions.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Intervention History</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {interventions.slice(0, 5).map((i) => {
                const today = new Date().toISOString().split('T')[0];
                const isOverdue = i.openStatus === 'open' && i.followUpDate && i.followUpDate < today;
                return (
                  <div key={i.id} className="rounded-lg border px-3 py-2 text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium">{i.interventionType || '—'}</span>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        {i.openStatus && (
                          <Badge className={i.openStatus === 'resolved' ? 'bg-green-100 text-green-800 border-green-200 text-xs capitalize' : 'bg-amber-100 text-amber-800 border-amber-200 text-xs capitalize'}>
                            {i.openStatus}
                          </Badge>
                        )}
                        <span className="text-xs text-muted-foreground">{i.date || '—'}</span>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Outcome: {i.outcome || '—'} · By: {i.recordedBy || '—'}
                    </p>
                    {i.followUpDate && (
                      <p className={`text-xs mt-0.5 ${isOverdue ? 'text-red-600 font-medium' : 'text-muted-foreground'}`}>
                        Follow-up: {i.followUpDate}{isOverdue ? ' — Overdue' : ''}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Student Wellbeing Check-In Section */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <HeartPulse className="h-4 w-4 text-pink-500" />
            <CardTitle className="text-base">Student Wellbeing Check-In</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          {loadingWellbeing ? (
            <div className="flex items-center gap-2 text-muted-foreground text-sm py-2">
              <Loader2 className="h-3 w-3 animate-spin" /> Loading...
            </div>
          ) : !wellbeing ? (
            <p className="text-sm text-muted-foreground">No check-in submitted this semester.</p>
          ) : (
            <div className="space-y-4">
              {/* SSA contact banner */}
              {wellbeing.ssaContactRequested === true && (
                <div className="flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2">
                  <AlertTriangle className="h-4 w-4 text-red-600 flex-shrink-0" />
                  <p className="text-sm font-semibold text-red-800">This student has requested SSA contact</p>
                </div>
              )}

              {/* Submission meta */}
              <p className="text-xs text-muted-foreground">
                Submitted:{' '}
                {wellbeing.submittedAt?.toDate?.()?.toLocaleDateString('en-GB', {
                  day: 'numeric', month: 'long', year: 'numeric',
                }) ?? 'Unknown'}{' '}
                · {wellbeing.semester} {wellbeing.academicYear}
              </p>

              {/* Response rows */}
              {(() => {
                const AMBER: Record<string, string[]> = {
                  programmeFit:          ['unsatisfied', 'very_unsatisfied'],
                  lectureComprehension:  ['sometimes', 'no'],
                  universityTransition:  ['very_different'],
                  studySkillsConfidence: ['not_confident'],
                };
                const RED: Record<string, string[]> = {
                  overallWellbeing: ['poor', 'very_poor'],
                };
                const LABELS: Record<string, Record<string, string>> = {
                  programmeFit:          { very_satisfied: 'Very Satisfied', satisfied: 'Satisfied', unsatisfied: 'Unsatisfied', very_unsatisfied: 'Very Unsatisfied' },
                  lectureComprehension:  { yes: 'Yes', mostly: 'Mostly', sometimes: 'Sometimes', no: 'No' },
                  overallWellbeing:      { very_good: 'Very Good', good: 'Good', fair: 'Fair', poor: 'Poor', very_poor: 'Very Poor' },
                  universityTransition:  { not_at_all: 'Not at all', somewhat_different: 'Somewhat different', very_different: 'Very different' },
                  studySkillsConfidence: { very_confident: 'Very confident', confident: 'Confident', somewhat_confident: 'Somewhat confident', not_confident: 'Not confident' },
                };
                const rows = [
                  { field: 'programmeFit',          label: 'Programme Fit' },
                  { field: 'lectureComprehension',  label: 'Lecture Comprehension' },
                  { field: 'overallWellbeing',      label: 'Overall Wellbeing' },
                  { field: 'universityTransition',  label: 'University Transition' },
                  { field: 'studySkillsConfidence', label: 'Study Skills Confidence' },
                  { field: 'ssaContactRequested',   label: 'Requested SSA Contact' },
                ];
                return (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {rows.map(({ field, label }) => {
                      const rawVal = field === 'ssaContactRequested'
                        ? (wellbeing.ssaContactRequested ? 'yes' : 'no')
                        : (wellbeing[field] ?? '');
                      const displayVal = field === 'ssaContactRequested'
                        ? (wellbeing.ssaContactRequested ? 'Yes please' : 'No')
                        : (LABELS[field]?.[rawVal] ?? rawVal);
                      const isRed = RED[field]?.includes(rawVal) ||
                        (field === 'ssaContactRequested' && wellbeing.ssaContactRequested);
                      const isAmber = !isRed && AMBER[field]?.includes(rawVal);
                      const bgClass = isRed
                        ? 'border-red-200 bg-red-50'
                        : isAmber
                          ? 'border-amber-200 bg-amber-50'
                          : '';
                      const textClass = isRed ? 'text-red-800' : isAmber ? 'text-amber-800' : '';
                      return (
                        <div key={field} className={`rounded-lg border px-3 py-2 space-y-0.5 ${bgClass}`}>
                          <p className="text-xs text-muted-foreground">{label}</p>
                          <p className={`text-sm font-medium flex items-center gap-1 ${textClass}`}>
                            {(isRed || isAmber) && <span>⚠️</span>}
                            {displayVal || '—'}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Academic Challenge Assessment — Medium/High risk only */}
      {(riskData.level === 'medium' || riskData.level === 'high') && (() => {
        const { challenges, insufficientData } = classifyAcademicChallenges({
          attendancePercentage: student.attendancePercentage,
          gpa:                  student.gpa,
          level:                student.level,
          consecutiveAbsences:  student.consecutiveAbsences,
          attendanceBySemester: student.attendanceBySemester ?? [],
          failedModules,
          passedModules:        creditsCompleted,
          gpaHistory,
          wellbeing,
        });
        return (
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-orange-500" />
                <CardTitle className="text-base">Academic Challenge Assessment</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">

              {/* Insufficient semester history warning */}
              {insufficientData && (
                <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-800">
                  Insufficient semester history for full challenge analysis. Assessment will improve as more semester data is collected.
                </div>
              )}

              {/* No wellbeing note */}
              {!wellbeing && !loadingWellbeing && (
                <div className="rounded-lg border border-amber-100 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  ⚠️ Wellbeing check-in not yet submitted. Confidence levels may be lower without student self-report data.
                </div>
              )}

              {challenges.length === 0 ? (
                <p className="text-sm text-muted-foreground py-2">
                  No specific academic challenges identified from current data. Continue monitoring student progress.
                </p>
              ) : (
                <div className="space-y-3">
                  {challenges.map((ch) => {
                    const isHigh = ch.confidence === 'High';
                    const isSecondary = ch.secondary === true;
                    return (
                      <div
                        key={ch.id}
                        className={`rounded-lg border px-4 py-3 space-y-2 ${
                          isSecondary
                            ? 'border-gray-200 bg-gray-50'
                            : isHigh
                              ? 'border-red-200 bg-red-50'
                              : 'border-amber-200 bg-amber-50'
                        }`}
                      >
                        {/* Header row */}
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2">
                            <span className={
                              isSecondary ? 'text-gray-500'
                              : isHigh     ? 'text-red-600'
                              :              'text-amber-600'
                            }>
                              {CHALLENGE_ICONS[ch.iconName]}
                            </span>
                            <span className={`text-sm font-semibold ${
                              isSecondary ? 'text-gray-700'
                              : isHigh     ? 'text-red-900'
                              :              'text-amber-900'
                            }`}>
                              {ch.name}
                            </span>
                          </div>
                          <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                            isSecondary
                              ? 'bg-gray-100 text-gray-600 border border-gray-200'
                              : isHigh
                                ? 'bg-red-100 text-red-800 border border-red-200'
                                : 'bg-amber-100 text-amber-800 border border-amber-200'
                          }`}>
                            {ch.confidence} Confidence
                          </span>
                        </div>

                        {/* Reason */}
                        <p className={`text-xs leading-relaxed ${
                          isSecondary ? 'text-gray-600'
                          : isHigh     ? 'text-red-800'
                          :              'text-amber-800'
                        }`}>
                          {ch.reason}
                        </p>

                        {/* Secondary monitor note */}
                        {isSecondary && ch.secondaryNote && (
                          <p className="text-xs text-gray-500 italic">{ch.secondaryNote}</p>
                        )}

                        {/* Confirm note */}
                        <p className="text-xs text-muted-foreground italic">
                          Discuss with student to confirm.
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Disclaimer */}
              <p className="text-xs text-muted-foreground border-t pt-3 leading-relaxed">
                This assessment is generated automatically from academic data and student self-reports.
                It is intended as decision support only. SSA professional judgment is required to confirm
                and act upon these indicators.
              </p>
            </CardContent>
          </Card>
        );
      })()}

      {/* Suggested Actions — only when challenges detected, Medium/High risk only */}
      {(riskData.level === 'medium' || riskData.level === 'high') && (() => {
        const { challenges } = classifyAcademicChallenges({
          attendancePercentage: student.attendancePercentage,
          gpa:                  student.gpa,
          level:                student.level,
          consecutiveAbsences:  student.consecutiveAbsences,
          attendanceBySemester: student.attendanceBySemester ?? [],
          failedModules,
          passedModules:        creditsCompleted,
          gpaHistory,
          wellbeing,
        });

        if (challenges.length === 0) return null;

        // Build grouped action lists with cross-group deduplication
        const seenActions = new Set<string>();
        const groups = challenges
          .map((ch) => {
            const actions = (SUGGESTED_ACTIONS[ch.id] ?? []).filter((a) => {
              if (seenActions.has(a)) return false;
              seenActions.add(a);
              return true;
            });
            return { ...ch, actions };
          })
          .filter((g) => g.actions.length > 0);

        if (groups.length === 0) return null;

        return (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Suggested Actions</CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                Based on identified academic challenge indicators. Review and apply professional judgment before acting.
              </p>
            </CardHeader>
            <CardContent className="space-y-5">
              {groups.map((group) => (
                <div key={group.id} className="space-y-2">
                  {/* Challenge subheading */}
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    <span>{CHALLENGE_ICONS_SM[group.iconName]}</span>
                    {group.name}
                  </div>
                  {/* Action list */}
                  <ul className="space-y-2">
                    {group.actions.map((action) => (
                      <li key={action} className="flex items-start gap-2 text-sm">
                        <span className="flex-shrink-0 text-muted-foreground mt-px">→</span>
                        {action}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}

              <p className="text-xs text-muted-foreground border-t pt-3 leading-relaxed">
                These are suggested starting points based on identified indicators. Discuss with student
                before taking any action. Log all interventions using the button below.
              </p>
            </CardContent>
          </Card>
        );
      })()}

      {/* Referral Modal */}
      <Dialog open={referralModalOpen} onOpenChange={setReferralModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Refer {student?.name} to Specialist</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Row 1 — Refer To (full width) */}
            <div className="space-y-1.5">
              <Label>Refer To <span className="text-red-500">*</span></Label>
              <Select value={referralDept} onValueChange={setReferralDept}>
                <SelectTrigger>
                  <SelectValue placeholder="Select department..." />
                </SelectTrigger>
                <SelectContent>
                  {REFERRAL_DEPARTMENTS.map(dept => (
                    <SelectItem key={dept} value={dept}>{dept}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Row 2 — Referral Type | Urgency (2 columns) */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Referral Type</Label>
                <Select value={referralType} onValueChange={setReferralType}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select type..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mental_health">Mental Health & Personal Support</SelectItem>
                    <SelectItem value="academic">Academic Support</SelectItem>
                    <SelectItem value="financial">Financial Support</SelectItem>
                    <SelectItem value="career">Career Guidance</SelectItem>
                    <SelectItem value="disability">Disability Support</SelectItem>
                    <SelectItem value="health">Health & Wellbeing</SelectItem>
                    <SelectItem value="welfare">Welfare Support</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Urgency <span className="text-red-500">*</span></Label>
                <Select value={referralUrgency} onValueChange={setReferralUrgency}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select urgency..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low — routine referral</SelectItem>
                    <SelectItem value="medium">Medium — needs attention soon</SelectItem>
                    <SelectItem value="high">High — needs attention this week</SelectItem>
                    <SelectItem value="urgent">Urgent — immediate attention needed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Row 3 — Notes (full width) */}
            <div className="space-y-1.5">
              <Label>Notes <span className="text-xs text-muted-foreground">(optional)</span></Label>
              <Textarea
                rows={3}
                placeholder="Describe the reason for referral and any additional context…"
                value={referralNotes}
                onChange={(e) => setReferralNotes(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setReferralModalOpen(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              className="bg-purple-600 hover:bg-purple-700"
              disabled={!referralDept || referralSubmitting}
              onClick={handleReferral}
            >
              {referralSubmitting ? 'Logging Referral...' : 'Log Referral'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
