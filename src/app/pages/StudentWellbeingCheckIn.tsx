import { useState, useEffect } from 'react';
import {
  collection, getDocs, addDoc, query, where,
  serverTimestamp, Timestamp, doc, updateDoc,
} from 'firebase/firestore';
import { db } from '../../firebase';
import { useStudentData } from '../contexts/StudentDataContext';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { toast } from 'sonner';
import { ShieldCheck, CheckCircle2, Loader2, HeartPulse } from 'lucide-react';

// ── semester helpers ────────────────────────────────────────────
function getCurrentPeriod(): { semester: string; academicYear: string } {
  const m = new Date().getMonth() + 1;
  const y = new Date().getFullYear();
  if (m >= 9) return { semester: 'Semester 1', academicYear: `${y}/${y + 1}` };
  if (m <= 4)  return { semester: 'Semester 2', academicYear: `${y - 1}/${y}` };
  return           { semester: 'Semester 3', academicYear: `${y - 1}/${y}` };
}

// ── question definitions ────────────────────────────────────────
interface Question {
  field: string;
  label: string;
  options: { value: string; label: string }[];
}

const QUESTIONS: Question[] = [
  {
    field: 'programmeFit',
    label: 'How are you finding your programme?',
    options: [
      { value: 'very_satisfied',   label: 'Very Satisfied' },
      { value: 'satisfied',        label: 'Satisfied' },
      { value: 'unsatisfied',      label: 'Unsatisfied' },
      { value: 'very_unsatisfied', label: 'Very Unsatisfied' },
    ],
  },
  {
    field: 'lectureComprehension',
    label: 'Are you finding lectures easy to follow?',
    options: [
      { value: 'yes',       label: 'Yes' },
      { value: 'mostly',    label: 'Mostly' },
      { value: 'sometimes', label: 'Sometimes' },
      { value: 'no',        label: 'No' },
    ],
  },
  {
    field: 'overallWellbeing',
    label: 'How would you rate your overall wellbeing this semester?',
    options: [
      { value: 'very_good', label: 'Very Good' },
      { value: 'good',      label: 'Good' },
      { value: 'fair',      label: 'Fair' },
      { value: 'poor',      label: 'Poor' },
      { value: 'very_poor', label: 'Very Poor' },
    ],
  },
  {
    field: 'universityTransition',
    label: 'Do you find university life different from school/college?',
    options: [
      { value: 'not_at_all',         label: 'Not at all' },
      { value: 'somewhat_different', label: 'Somewhat different' },
      { value: 'very_different',     label: 'Very different' },
    ],
  },
  {
    field: 'studySkillsConfidence',
    label: 'How confident are you in your study skills?',
    options: [
      { value: 'very_confident',     label: 'Very confident' },
      { value: 'confident',          label: 'Confident' },
      { value: 'somewhat_confident', label: 'Somewhat confident' },
      { value: 'not_confident',      label: 'Not confident' },
    ],
  },
  {
    field: 'ssaContactRequested',
    label: 'Would you like your SSA to reach out to you?',
    options: [
      { value: 'no',         label: 'No' },
      { value: 'yes_please', label: 'Yes please' },
    ],
  },
];

// ── component ───────────────────────────────────────────────────
export default function StudentWellbeingCheckIn() {
  const { studentData, loading: dataLoading } = useStudentData();

  const { semester, academicYear } = getCurrentPeriod();

  const [checkLoading, setCheckLoading] = useState(true);
  const [existing, setExisting] = useState<Record<string, any> | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [answers, setAnswers] = useState<Record<string, string>>({});

  const allAnswered = QUESTIONS.every((q) => answers[q.field]);

  // Check for a submission in the last 6 months
  useEffect(() => {
    if (!studentData?.studentId) return;
    const check = async () => {
      setCheckLoading(true);
      try {
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

        const snap = await getDocs(
          query(
            collection(db, 'wellbeingCheckIns'),
            where('studentId', '==', studentData.studentId),
            where('submittedAt', '>=', Timestamp.fromDate(sixMonthsAgo))
          )
        );
        if (!snap.empty) {
          // Pick the most recent one
          const sorted = snap.docs.sort((a, b) => {
            const aT = a.data().submittedAt?.toDate?.()?.getTime() ?? 0;
            const bT = b.data().submittedAt?.toDate?.()?.getTime() ?? 0;
            return bT - aT;
          });
          setExisting(sorted[0].data());
        }
      } catch {
        // silently ignore — allow form to show if check fails
      } finally {
        setCheckLoading(false);
      }
    };
    check();
  }, [studentData?.studentId]);

  const handleSubmit = async () => {
    if (!allAnswered || !studentData) return;
    setSubmitting(true);
    try {
      const ssaWantsContact = answers.ssaContactRequested === 'yes_please';

      await addDoc(collection(db, 'wellbeingCheckIns'), {
        studentId:            studentData.studentId,
        uid:                  studentData.uid ?? '',
        studentName:          studentData.name,
        programme:            studentData.programme,
        semester,
        academicYear,
        programmeFit:         answers.programmeFit,
        lectureComprehension: answers.lectureComprehension,
        overallWellbeing:     answers.overallWellbeing,
        universityTransition: answers.universityTransition,
        studySkillsConfidence: answers.studySkillsConfidence,
        ssaContactRequested:  ssaWantsContact,
        submittedAt:          serverTimestamp(),
      });

      // Flag on the student document if SSA contact was requested
      if (ssaWantsContact && studentData.firestoreId) {
        await updateDoc(doc(db, 'students', studentData.firestoreId), {
          ssaContactRequested: true,
        });
      }

      setExisting({
        ...answers,
        ssaContactRequested: ssaWantsContact,
        semester,
        academicYear,
        submittedAt: { toDate: () => new Date() },
      });
      toast.success('Your wellbeing check-in has been submitted. Thank you!');
    } catch {
      toast.error('Failed to submit. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const set = (field: string, value: string) =>
    setAnswers((prev) => ({ ...prev, [field]: value }));

  // ── labels for read-only view ──────────────────────────────
  const DISPLAY: Record<string, Record<string, string>> = {
    programmeFit:          { very_satisfied: 'Very Satisfied', satisfied: 'Satisfied', unsatisfied: 'Unsatisfied', very_unsatisfied: 'Very Unsatisfied' },
    lectureComprehension:  { yes: 'Yes', mostly: 'Mostly', sometimes: 'Sometimes', no: 'No' },
    overallWellbeing:      { very_good: 'Very Good', good: 'Good', fair: 'Fair', poor: 'Poor', very_poor: 'Very Poor' },
    universityTransition:  { not_at_all: 'Not at all', somewhat_different: 'Somewhat different', very_different: 'Very different' },
    studySkillsConfidence: { very_confident: 'Very confident', confident: 'Confident', somewhat_confident: 'Somewhat confident', not_confident: 'Not confident' },
    ssaContactRequested:   { 'true': 'Yes please', 'false': 'No', yes_please: 'Yes please', no: 'No' },
  };

  if (dataLoading || checkLoading) {
    return (
      <div className="flex items-center justify-center h-64 gap-2 text-muted-foreground text-sm">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading...
      </div>
    );
  }

  // ── already submitted ───────────────────────────────────────
  if (existing) {
    const date = existing.submittedAt?.toDate?.()?.toLocaleDateString('en-GB', {
      day: 'numeric', month: 'long', year: 'numeric',
    }) ?? 'this semester';

    return (
      <div className="space-y-6 max-w-2xl">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <HeartPulse className="h-6 w-6 text-pink-500" />
            Wellbeing Check-In
          </h1>
          <p className="text-muted-foreground text-sm mt-1">{existing.semester} · {existing.academicYear}</p>
        </div>

        <div className="flex items-start gap-3 rounded-lg border border-green-200 bg-green-50 px-4 py-3">
          <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-green-800">
              You have already completed your check-in for this semester
            </p>
            <p className="text-xs text-green-700 mt-0.5">Submitted on {date}</p>
          </div>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Your Responses</CardTitle>
          </CardHeader>
          <CardContent className="divide-y">
            {QUESTIONS.map((q) => {
              const rawVal = q.field === 'ssaContactRequested'
                ? String(existing.ssaContactRequested)
                : existing[q.field];
              return (
                <div key={q.field} className="flex items-start justify-between gap-4 py-3 first:pt-0 last:pb-0">
                  <p className="text-sm text-muted-foreground flex-1">{q.label}</p>
                  <span className="text-sm font-medium text-right">
                    {DISPLAY[q.field]?.[rawVal] ?? rawVal ?? '—'}
                  </span>
                </div>
              );
            })}
          </CardContent>
        </Card>

        <p className="text-xs text-muted-foreground">
          You can submit a new check-in at the start of next semester.
        </p>
      </div>
    );
  }

  // ── form ───────────────────────────────────────────────────
  return (
    <div className="space-y-6 max-w-2xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <HeartPulse className="h-6 w-6 text-pink-500" />
          Wellbeing Check-In
        </h1>
        <p className="text-muted-foreground text-sm mt-1">{semester} · {academicYear}</p>
      </div>

      {/* Disclaimer */}
      <div className="flex items-start gap-3 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3">
        <ShieldCheck className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
        <p className="text-sm text-blue-800">
          This survey is <strong>voluntary and confidential</strong>. Responses are shared only with
          your Student Support Advisor for support purposes. If you are in crisis or need immediate
          help, please contact the university counselling service directly.
        </p>
      </div>

      {/* Questions */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Survey Questions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {QUESTIONS.map((q, idx) => (
            <div key={q.field} className="space-y-2">
              <p className="text-sm font-medium">
                <span className="text-muted-foreground mr-1.5">{idx + 1}.</span>
                {q.label}
              </p>
              <div className="flex flex-wrap gap-2">
                {q.options.map((opt) => {
                  const selected = answers[q.field] === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => set(q.field, opt.value)}
                      className={`rounded-full px-4 py-1.5 text-sm border transition-colors ${
                        selected
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'bg-white text-gray-700 border-gray-200 hover:border-blue-400 hover:text-blue-600'
                      }`}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Submit */}
      <div className="flex items-center justify-between gap-4">
        <p className="text-xs text-muted-foreground">
          {QUESTIONS.filter((q) => answers[q.field]).length} of {QUESTIONS.length} questions answered
          {!allAnswered && ' — please answer all questions before submitting'}
        </p>
        <Button
          onClick={handleSubmit}
          disabled={!allAnswered || submitting}
          className="gap-2 shrink-0"
        >
          {submitting
            ? <Loader2 className="h-4 w-4 animate-spin" />
            : <CheckCircle2 className="h-4 w-4" />}
          Submit Check-In
        </Button>
      </div>
    </div>
  );
}
