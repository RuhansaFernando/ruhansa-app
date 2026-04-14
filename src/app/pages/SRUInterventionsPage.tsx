import { useState, useEffect, useMemo } from 'react';
import {
  collection, onSnapshot, query, orderBy, where, addDoc, serverTimestamp, getDocs, doc, updateDoc,
} from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '../components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '../components/ui/dialog';
import { ClipboardList, Plus, Loader2, Search, Clock, FolderOpen, Download } from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate, useSearchParams } from 'react-router';

const INTERVENTION_TYPES = [
  'Phone Call',
  'Text Message',
  'Email',
  'Online Meeting',
  'In-Person Meeting',
  'Referral',
  'Formal Notice',
  'Other',
];

const OUTCOME_OPTIONS = [
  'Positive Response',
  'No Response',
  'Follow Up Required',
  'Resolved',
];

interface InterventionDoc {
  id: string;
  studentId: string;
  studentName: string;
  programme: string;
  riskLevel: string;
  interventionType: string;
  date: string;
  outcome: string;
  notes: string;
  recordedBy: string;
  createdAt: any;
  status: 'active' | 'pending' | 'completed';
  openStatus: 'open' | 'resolved' | '';
  followUpDate: string | null;
  caseStatus: 'open' | 'in_progress' | 'closed';
  isAcademicWarning?: boolean;
  priority: string;
  // Effectiveness tracking snapshot
  gpaAtIntervention?: number;
  attendanceAtIntervention?: number;
  gpaSemesterCountAtIntervention?: number;
}

interface StudentOption {
  id: string;
  studentId: string;
  name: string;
  programme: string;
  attendancePercentage: number;
  gpa: number;
  riskLevel: string;
  gpaBySemesterCount: number;
}

// ── Intervention Outcome Calculation ──────────────────────────────────────
type OutcomeResult = 'unknown' | 'awaiting' | 'improved' | 'no_change' | 'declined';

function calculateOutcome(
  intervention: InterventionDoc,
  currentStudent: StudentOption | undefined,
): OutcomeResult {
  // No snapshot saved — old intervention logged before this feature
  if (intervention.gpaAtIntervention == null || intervention.gpaSemesterCountAtIntervention == null) {
    return 'unknown';
  }
  if (!currentStudent) return 'unknown';

  // No new semester data available yet
  if (currentStudent.gpaBySemesterCount <= intervention.gpaSemesterCountAtIntervention) {
    return 'awaiting';
  }

  // New semester data available — compare
  const gpaDiff = currentStudent.gpa - intervention.gpaAtIntervention;
  const attDiff = currentStudent.attendancePercentage - (intervention.attendanceAtIntervention ?? 0);

  if (gpaDiff >= 0.2 || attDiff >= 10)  return 'improved';
  if (gpaDiff <= -0.2 || attDiff <= -10) return 'declined';
  return 'no_change';
}

const OUTCOME_BADGE: Record<OutcomeResult, JSX.Element> = {
  unknown:  <span className="inline-flex items-center rounded-full border border-gray-100 bg-white px-2 py-0.5 text-[10px] font-medium text-gray-400">—</span>,
  awaiting: <span className="inline-flex items-center rounded-full border border-gray-200 bg-gray-100 px-2 py-0.5 text-[10px] font-semibold text-gray-600">Awaiting semester data</span>,
  improved: <span className="inline-flex items-center rounded-full border border-green-200 bg-green-100 px-2 py-0.5 text-[10px] font-semibold text-green-700">✅ Improved</span>,
  no_change:<span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">No Change</span>,
  declined: <span className="inline-flex items-center rounded-full border border-red-200 bg-red-100 px-2 py-0.5 text-[10px] font-semibold text-red-700">⚠️ Declined</span>,
};

const getOutcomeBadge = (outcome: string) => {
  switch (outcome) {
    case 'Positive Response':
      return <Badge className="bg-green-100 text-green-800 border-green-200 text-xs">{outcome}</Badge>;
    case 'Resolved':
      return <Badge className="bg-blue-100 text-blue-800 border-blue-200 text-xs">{outcome}</Badge>;
    case 'No Response':
      return <Badge className="bg-gray-100 text-gray-700 border-gray-200 text-xs">{outcome}</Badge>;
    default:
      return <Badge className="bg-amber-100 text-amber-800 border-amber-200 text-xs">{outcome || '—'}</Badge>;
  }
};

const deriveStatus = (outcome: string): InterventionDoc['status'] => {
  if (!outcome) return 'pending';
  if (outcome === 'Resolved') return 'completed';
  return 'active';
};

const formatDate = (val: any) => {
  if (!val) return '—';
  try {
    const d = val?.toDate ? val.toDate() : new Date(val);
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return '—';
  }
};

const todayStr = () => new Date().toISOString().split('T')[0];

export default function SRUInterventionsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [interventions, setInterventions] = useState<InterventionDoc[]>([]);
  const [students, setStudents] = useState<StudentOption[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [outcomeFilter, setOutcomeFilter] = useState('all');
  const [openStatusFilter, setOpenStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');

  // Modal
  const [isOpen, setIsOpen] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<StudentOption | null>(null);
  const [studentSearch, setStudentSearch] = useState('');
  const [showStudentResults, setShowStudentResults] = useState(false);
  const [formType, setFormType] = useState('');
  const [formDate, setFormDate] = useState(todayStr());
  const [formOutcome, setFormOutcome] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [formFollowUpDate, setFormFollowUpDate] = useState('');
  const [formStatus, setFormStatus] = useState<'open' | 'in_progress' | 'closed'>('open');
  const [formIsAcademicWarning, setFormIsAcademicWarning] = useState(false);
  const [formPriority, setFormPriority] = useState('medium');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const q = query(collection(db, 'interventions'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      setInterventions(
        snap.docs.map((d) => {
          const outcome = d.data().outcome ?? '';
          return {
            id: d.id,
            studentId: d.data().studentId ?? '',
            studentName: d.data().studentName ?? '',
            programme: d.data().programme ?? '',
            riskLevel: d.data().riskLevel ?? 'low',
            interventionType: d.data().interventionType ?? '',
            date: d.data().date ?? '',
            outcome,
            notes: d.data().notes ?? '',
            recordedBy: d.data().recordedBy ?? '',
            createdAt: d.data().createdAt,
            status: d.data().status ?? deriveStatus(outcome),
            openStatus: d.data().openStatus ?? '',
            followUpDate: d.data().followUpDate ?? null,
            caseStatus: d.data().caseStatus ?? 'open',
            isAcademicWarning: d.data().isAcademicWarning ?? false,
            priority: d.data().priority ?? '',
            // Effectiveness snapshot
            gpaAtIntervention:             d.data().gpaAtIntervention             ?? d.data().gpaBefore ?? null,
            attendanceAtIntervention:      d.data().attendanceAtIntervention      ?? d.data().attendanceBefore ?? null,
            gpaSemesterCountAtIntervention: d.data().gpaSemesterCountAtIntervention ?? null,
          };
        })
      );
      setLoading(false);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    getDocs(collection(db, 'students')).then((snap) => {
      const list = snap.docs.map((d) => ({
        id: d.id,
        studentId: d.data().studentId ?? d.id,
        name: d.data().name ?? '',
        programme: d.data().programme ?? '',
        attendancePercentage: d.data().attendancePercentage ?? 0,
        gpa: d.data().gpa ?? 0,
        riskLevel: (d.data().riskLevel ?? 'low').toLowerCase(),
        gpaBySemesterCount: (d.data().gpa_by_semester ?? d.data().gpaBySemester ?? []).length,
      })).sort((a, b) => a.name.localeCompare(b.name));
      setStudents(list);

      const paramStudentId = searchParams.get('studentId');
      const paramStudentName = searchParams.get('studentName');
      if (paramStudentId) {
        const match = list.find((s) => s.studentId === paramStudentId);
        if (match) {
          setSelectedStudent(match);
          setIsOpen(true);
        } else if (paramStudentName) {
          const byName = list.find((s) => s.name === decodeURIComponent(paramStudentName));
          if (byName) { setSelectedStudent(byName); setIsOpen(true); }
        }
      }
    });
  }, []);

  useEffect(() => {
    const handleClickOutside = () => setShowStudentResults(false);
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  const studentResults = useMemo(() => {
    if (!studentSearch || studentSearch.length < 2) return [];
    return students.filter(s =>
      s.name.toLowerCase().includes(studentSearch.toLowerCase()) ||
      s.studentId.toLowerCase().includes(studentSearch.toLowerCase())
    ).slice(0, 8);
  }, [studentSearch, students]);

  // KPI counts
  const openCaseCount = interventions.filter((i) => i.caseStatus === 'open').length;

  const followUpsDueCount = interventions.filter((i) => {
    if (!i.followUpDate) return false;
    const followUp = new Date(i.followUpDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return followUp <= today && i.caseStatus !== 'closed';
  }).length;

  const filtered = useMemo(() => {
    return interventions.filter((i) => {
      const matchesSearch     = !search || i.studentName.toLowerCase().includes(search.toLowerCase());
      const matchesType       = typeFilter === 'all' || i.interventionType === typeFilter;
      const matchesOutcome    = outcomeFilter === 'all' || i.outcome === outcomeFilter;
      const matchesOpenStatus = openStatusFilter === 'all' || i.caseStatus === openStatusFilter;
      const matchesPriority   = priorityFilter === 'all' || i.priority === priorityFilter;
      return matchesSearch && matchesType && matchesOutcome && matchesOpenStatus && matchesPriority;
    });
  }, [interventions, search, typeFilter, outcomeFilter, openStatusFilter, priorityFilter]);

  const studentMap = useMemo(
    () => new Map(students.map((s) => [s.studentId, s])),
    [students],
  );

  const effectivenessStats = useMemo(() => {
    const counts: Record<OutcomeResult, number> = { unknown: 0, awaiting: 0, improved: 0, no_change: 0, declined: 0 };
    interventions.forEach((i) => {
      counts[calculateOutcome(i, studentMap.get(i.studentId))]++;
    });
    // Only count non-unknown outcomes in percentages
    const assessed = counts.improved + counts.no_change + counts.declined;
    return { ...counts, total: interventions.length, assessed };
  }, [interventions, studentMap]);

  const exportCSV = () => {
    const headers = ['Student Name', 'Student ID', 'Type', 'Case Status', 'Priority', 'Date', 'Outcome', 'Notes', 'Follow-up Date', 'Academic Warning'];
    const rows = filtered.map(i => [
      i.studentName,
      i.studentId,
      i.interventionType,
      i.caseStatus,
      i.priority,
      i.date,
      i.outcome,
      i.notes?.replace(/,/g, '') ?? '',
      i.followUpDate ?? '',
      i.isAcademicWarning ? 'Yes' : 'No',
    ]);
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'interventions.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const resetForm = () => {
    setSelectedStudent(null);
    setStudentSearch('');
    setShowStudentResults(false);
    setFormType('');
    setFormDate(todayStr());
    setFormOutcome('');
    setFormNotes('');
    setFormFollowUpDate('');
    setFormStatus('open');
    setFormIsAcademicWarning(false);
    setFormPriority('medium');
  };

  const handleToggleStatus = async (intervention: InterventionDoc) => {
    const newOpenStatus = intervention.openStatus === 'resolved' ? 'open' : 'resolved';
    const newCaseStatus = newOpenStatus === 'resolved' ? 'closed' : 'open';
    try {
      await updateDoc(doc(db, 'interventions', intervention.id), {
        openStatus: newOpenStatus,
        caseStatus: newCaseStatus,
      });
      toast.success(newOpenStatus === 'resolved' ? 'Marked as resolved' : 'Reopened');
    } catch {
      toast.error('Failed to update status.');
    }
  };

  const handleSave = async () => {
    if (!selectedStudent || !formType || !formDate) {
      toast.error('Please fill in all required fields.');
      return;
    }
    if (!formOutcome) {
      toast.error('Please select an outcome.');
      return;
    }

    setSaving(true);
    try {
      await addDoc(collection(db, 'interventions'), {
        studentId: selectedStudent.studentId,
        studentName: selectedStudent.name,
        programme: selectedStudent.programme,
        interventionType: formType,
        date: formDate,
        outcome: formOutcome,
        notes: formNotes.trim(),
        recordedBy: user?.name ?? 'Staff',
        status: deriveStatus(formOutcome),
        caseStatus: formStatus,
        followUpDate: formFollowUpDate || null,
        isAcademicWarning: formIsAcademicWarning,
        priority: formPriority,
        gpaAtIntervention:              selectedStudent.gpa ?? 0,
        attendanceAtIntervention:       selectedStudent.attendancePercentage ?? 0,
        gpaSemesterCountAtIntervention: selectedStudent.gpaBySemesterCount ?? 0,
        createdAt: serverTimestamp(),
      });

      const [warningSnap, meetingSnap] = await Promise.all([
        getDocs(query(
          collection(db, 'interventions'),
          where('studentId', '==', selectedStudent.studentId),
          where('isAcademicWarning', '==', true)
        )),
        getDocs(query(
          collection(db, 'interventions'),
          where('studentId', '==', selectedStudent.studentId),
          where('interventionType', '==', 'Meeting')
        )),
      ]);
      await updateDoc(doc(db, 'students', selectedStudent.id), {
        academic_warning_count: warningSnap.size,
        advisor_meeting_count: meetingSnap.size,
      });

      toast.success('Intervention logged successfully.');
      setIsOpen(false);
      resetForm();
    } catch {
      toast.error('Failed to save intervention. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Interventions</h1>
          <p className="text-muted-foreground text-sm mt-1">Log and track student interventions</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportCSV}>
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
          <Button
            className="bg-blue-600 hover:bg-blue-700"
            onClick={() => { resetForm(); setIsOpen(true); }}
          >
            <Plus className="mr-2 h-4 w-4" />
            Log Intervention
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-l-4 border-l-blue-500">
          <CardContent className="pt-5 pb-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Interventions</p>
                <p className="text-3xl font-bold mt-1">{loading ? '—' : interventions.length}</p>
                <p className="text-xs text-muted-foreground mt-1">All records</p>
              </div>
              <div className="h-10 w-10 rounded-full bg-blue-50 flex items-center justify-center">
                <ClipboardList className="h-5 w-5 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-amber-500">
          <CardContent className="pt-5 pb-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Follow-ups Due</p>
                <p className="text-3xl font-bold mt-1">{loading ? '—' : followUpsDueCount}</p>
                <p className="text-xs text-muted-foreground mt-1">Overdue or due today</p>
              </div>
              <div className="h-10 w-10 rounded-full bg-amber-50 flex items-center justify-center">
                <Clock className="h-5 w-5 text-amber-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-amber-500">
          <CardContent className="pt-5 pb-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Open Cases</p>
                <p className="text-3xl font-bold mt-1">{loading ? '—' : openCaseCount}</p>
                <p className="text-xs text-muted-foreground mt-1">Awaiting resolution</p>
              </div>
              <div className="h-10 w-10 rounded-full bg-amber-50 flex items-center justify-center">
                <FolderOpen className="h-5 w-5 text-amber-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Intervention Effectiveness Summary */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Intervention Effectiveness</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <div className="text-center rounded-lg border bg-gray-50 px-3 py-2">
              <p className="text-xl font-bold">{loading ? '—' : effectivenessStats.total}</p>
              <p className="text-xs text-muted-foreground mt-0.5">Total Interventions</p>
            </div>
            <div className="text-center rounded-lg border border-green-200 bg-green-50 px-3 py-2">
              <p className="text-xl font-bold text-green-700">{loading ? '—' : effectivenessStats.improved}</p>
              <p className="text-xs text-green-600 mt-0.5">
                Improved
                {effectivenessStats.assessed > 0 && (
                  <span className="ml-1 text-green-500">
                    ({Math.round((effectivenessStats.improved / effectivenessStats.assessed) * 100)}%)
                  </span>
                )}
              </p>
            </div>
            <div className="text-center rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
              <p className="text-xl font-bold text-amber-700">{loading ? '—' : effectivenessStats.no_change}</p>
              <p className="text-xs text-amber-600 mt-0.5">
                No Change
                {effectivenessStats.assessed > 0 && (
                  <span className="ml-1 text-amber-500">
                    ({Math.round((effectivenessStats.no_change / effectivenessStats.assessed) * 100)}%)
                  </span>
                )}
              </p>
            </div>
            <div className="text-center rounded-lg border border-red-200 bg-red-50 px-3 py-2">
              <p className="text-xl font-bold text-red-700">{loading ? '—' : effectivenessStats.declined}</p>
              <p className="text-xs text-red-600 mt-0.5">
                Declined
                {effectivenessStats.assessed > 0 && (
                  <span className="ml-1 text-red-400">
                    ({Math.round((effectivenessStats.declined / effectivenessStats.assessed) * 100)}%)
                  </span>
                )}
              </p>
            </div>
            <div className="text-center rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
              <p className="text-xl font-bold text-gray-500">{loading ? '—' : effectivenessStats.awaiting}</p>
              <p className="text-xs text-muted-foreground mt-0.5">Awaiting semester data</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Intervention list */}
      <div className="rounded-xl border bg-white">
        <div className="px-4 pt-4 pb-3 border-b">
          <div className="flex flex-wrap gap-2 items-center">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Search student..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 h-8 text-xs w-36"
                autoComplete="off"
              />
            </div>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-40 h-8 text-xs">
                <SelectValue placeholder="All Types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {INTERVENTION_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={outcomeFilter} onValueChange={setOutcomeFilter}>
              <SelectTrigger className="w-44 h-8 text-xs">
                <SelectValue placeholder="All Outcomes" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Outcomes</SelectItem>
                {OUTCOME_OPTIONS.map((o) => (
                  <SelectItem key={o} value={o}>{o}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={openStatusFilter} onValueChange={setOpenStatusFilter}>
              <SelectTrigger className="w-36 h-8 text-xs">
                <SelectValue placeholder="All Case Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Case Status</SelectItem>
                <SelectItem value="open">Open</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="closed">Closed</SelectItem>
              </SelectContent>
            </Select>
            <Select value={priorityFilter} onValueChange={setPriorityFilter}>
              <SelectTrigger className="w-[140px] h-8 text-xs">
                <SelectValue placeholder="All Priorities" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Priorities</SelectItem>
                <SelectItem value="urgent">Urgent</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="low">Low</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Intervention cards */}
        <div className="p-4">
          {loading ? (
            <div className="flex items-center justify-center h-40">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
              <ClipboardList className="h-8 w-8 mb-2 opacity-30" />
              <p className="text-sm">No interventions found.</p>
            </div>
          ) : (
            filtered.map((intervention) => {
              const today = new Date().toISOString().split('T')[0];
              const isOverdue = intervention.openStatus === 'open' && intervention.followUpDate && intervention.followUpDate < today;
              return (
                <div key={intervention.id} className="border rounded-xl p-4 mb-3 last:mb-0 bg-white">
                  {/* Header */}
                  <div className="flex items-start justify-between mb-3 gap-3">
                    <div className="min-w-0">
                      <p className="font-medium text-sm">
                        {intervention.studentName} — {intervention.interventionType || '—'}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Started {intervention.date || formatDate(intervention.createdAt)} · Recorded by {intervention.recordedBy || '—'}
                      </p>
                      {intervention.followUpDate && (
                        <p className={`text-xs mt-0.5 ${isOverdue ? 'text-red-600 font-semibold' : 'text-muted-foreground'}`}>
                          Follow-up: {intervention.followUpDate}{isOverdue ? ' — Overdue' : ''}
                        </p>
                      )}
                    </div>
                    <div className="flex gap-2 flex-shrink-0 flex-wrap justify-end items-center">
                      {intervention.openStatus && (
                        <Badge className={intervention.openStatus === 'resolved'
                          ? 'bg-green-100 text-green-800 border-green-200 text-xs capitalize'
                          : 'bg-amber-100 text-amber-800 border-amber-200 text-xs capitalize'
                        }>
                          {intervention.openStatus}
                        </Badge>
                      )}
                      {intervention.outcome && getOutcomeBadge(intervention.outcome)}
                      {OUTCOME_BADGE[calculateOutcome(intervention, studentMap.get(intervention.studentId))]}
                    </div>
                  </div>

                  {/* Notes */}
                  {intervention.notes && (
                    <div className="bg-gray-50 rounded-lg px-3 py-2 mb-3 text-xs text-gray-700 border border-gray-100">
                      <span className="font-semibold text-gray-500">Notes: </span>
                      {intervention.notes}
                    </div>
                  )}

                  {/* Footer */}
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div className="flex gap-2 flex-wrap items-center">
                      <Badge variant="outline" className="text-xs">{intervention.interventionType || '—'}</Badge>
                      <Badge variant="outline" className="text-xs">{intervention.programme || 'Unknown programme'}</Badge>
                      {(() => {
                        const priorityConfig = {
                          urgent: { label: 'Urgent',  className: 'bg-red-100 text-red-700' },
                          high:   { label: 'High',    className: 'bg-orange-100 text-orange-700' },
                          medium: { label: 'Medium',  className: 'bg-yellow-100 text-yellow-700' },
                          low:    { label: 'Low',     className: 'bg-green-100 text-green-700' },
                        };
                        const p = priorityConfig[intervention.priority as keyof typeof priorityConfig];
                        return p ? (
                          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${p.className}`}>
                            {p.label}
                          </span>
                        ) : null;
                      })()}
                    </div>
                    <div className="flex gap-2 flex-shrink-0 flex-wrap items-center">
                      <Select
                        value={intervention.caseStatus ?? 'open'}
                        onValueChange={async (newStatus) => {
                          await updateDoc(doc(db, 'interventions', intervention.id), { caseStatus: newStatus });
                        }}
                      >
                        <SelectTrigger className="w-32 h-7 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="open">Open</SelectItem>
                          <SelectItem value="in_progress">In Progress</SelectItem>
                          <SelectItem value="closed">Closed</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button
                        size="sm"
                        variant="outline"
                        className={`text-xs ${intervention.openStatus === 'resolved' ? 'border-amber-300 text-amber-700 hover:bg-amber-50' : 'border-green-300 text-green-700 hover:bg-green-50'}`}
                        onClick={() => handleToggleStatus(intervention)}
                      >
                        {intervention.openStatus === 'resolved' ? 'Reopen' : 'Mark Resolved'}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-xs"
                        onClick={() => navigate(`/sru/students/${intervention.studentId}`)}
                      >
                        View Profile
                      </Button>
                      <Button
                        size="sm"
                        className="bg-blue-600 hover:bg-blue-700 text-xs"
                        onClick={() => {
                          resetForm();
                          const match = students.find(s => s.studentId === intervention.studentId);
                          if (match) setSelectedStudent(match);
                          setIsOpen(true);
                        }}
                      >
                        Update Progress
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })
          )}

          {/* Effectiveness methodology note */}
          {!loading && interventions.length > 0 && (
            <p className="text-xs text-muted-foreground mt-4 pt-4 border-t leading-relaxed">
              Outcome is assessed by comparing student GPA and attendance at time of intervention vs current
              values. A new semester of data must be available for assessment. Correlation does not imply
              causation — improvement may be due to multiple factors. This feature is intended to support
              reflective practice and service improvement, not to evaluate individual SSA performance.
            </p>
          )}
        </div>
      </div>

      {/* Log Intervention Modal */}
      <Dialog open={isOpen} onOpenChange={(o) => { if (!o) resetForm(); setIsOpen(o); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Log Intervention</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 pt-2">
            {/* Row 1 — Student (searchable) */}
            <div className="space-y-1.5">
              <Label>Student <span className="text-red-500">*</span></Label>
              {selectedStudent ? (
                <div className="flex items-center justify-between p-2 border rounded-md bg-gray-50">
                  <div>
                    <span className="text-sm font-medium">{selectedStudent.name}</span>
                    <span className="text-xs text-muted-foreground ml-2">{selectedStudent.studentId}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => { setSelectedStudent(null); setStudentSearch(''); }}
                    className="text-xs text-gray-400 hover:text-gray-600"
                  >
                    Change
                  </button>
                </div>
              ) : (
                <div className="relative" onClick={e => e.stopPropagation()}>
                  <Input
                    placeholder="Search by name or student ID..."
                    value={studentSearch}
                    onChange={e => { setStudentSearch(e.target.value); setShowStudentResults(true); }}
                    onFocus={() => setShowStudentResults(true)}
                    autoComplete="off"
                  />
                  {showStudentResults && studentResults.length > 0 && (
                    <div className="absolute z-50 w-full mt-1 bg-white border rounded-md shadow-lg max-h-48 overflow-y-auto">
                      {studentResults.map(s => (
                        <button
                          key={s.id}
                          type="button"
                          className="w-full text-left px-3 py-2 hover:bg-gray-50 border-b last:border-0"
                          onClick={() => {
                            setSelectedStudent(s);
                            setStudentSearch('');
                            setShowStudentResults(false);
                          }}
                        >
                          <span className="text-sm font-medium">{s.name}</span>
                          <span className="text-xs text-muted-foreground ml-2">{s.studentId}</span>
                          <span className="text-xs text-muted-foreground ml-2">{s.programme}</span>
                        </button>
                      ))}
                    </div>
                  )}
                  {showStudentResults && studentSearch.length >= 2 && studentResults.length === 0 && (
                    <div className="absolute z-50 w-full mt-1 bg-white border rounded-md shadow-lg p-3">
                      <p className="text-sm text-muted-foreground">No students found</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Row 2 — Intervention Type + Case Status */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Intervention Type <span className="text-red-500">*</span></Label>
                <Select value={formType} onValueChange={setFormType}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select type..." />
                  </SelectTrigger>
                  <SelectContent>
                    {INTERVENTION_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Case Status</Label>
                <Select value={formStatus} onValueChange={(v: any) => setFormStatus(v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="open">Open</SelectItem>
                    <SelectItem value="in_progress">In Progress</SelectItem>
                    <SelectItem value="closed">Closed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Row 3 — Date + Outcome */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Date <span className="text-red-500">*</span></Label>
                <Input
                  type="date"
                  value={formDate}
                  onChange={(e) => setFormDate(e.target.value)}
                  autoComplete="off"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Outcome <span className="text-red-500">*</span></Label>
                <Select value={formOutcome} onValueChange={setFormOutcome}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select outcome..." />
                  </SelectTrigger>
                  <SelectContent>
                    {OUTCOME_OPTIONS.map((o) => (
                      <SelectItem key={o} value={o}>{o}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Row 3b — Priority */}
            <div className="space-y-1.5">
              <Label>Priority</Label>
              <Select value={formPriority} onValueChange={setFormPriority}>
                <SelectTrigger>
                  <SelectValue placeholder="Select priority..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="urgent">🔴 Urgent</SelectItem>
                  <SelectItem value="high">🟠 High</SelectItem>
                  <SelectItem value="medium">🟡 Medium</SelectItem>
                  <SelectItem value="low">🟢 Low</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Row 4 — Notes (full width) */}
            <div className="space-y-1.5">
              <Label>Notes</Label>
              <textarea
                value={formNotes}
                onChange={(e) => setFormNotes(e.target.value)}
                placeholder="Add any additional notes..."
                rows={3}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-none"
                autoComplete="off"
              />
            </div>

            {/* Row 5 — Follow-up Date + Academic Warning */}
            <div className="grid grid-cols-2 gap-4 items-start">
              <div className="space-y-1.5">
                <Label>Follow-up Date</Label>
                <Input
                  type="date"
                  value={formFollowUpDate}
                  onChange={(e) => setFormFollowUpDate(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                  autoComplete="off"
                />
                <p className="text-xs text-muted-foreground">Leave empty if no follow-up needed</p>
              </div>
              <div className="flex items-center gap-3 pt-6">
                <input
                  type="checkbox"
                  id="isAcademicWarning"
                  checked={formIsAcademicWarning}
                  onChange={(e) => setFormIsAcademicWarning(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-red-600 focus:ring-red-500"
                />
                <label htmlFor="isAcademicWarning" className="text-sm font-medium text-red-700 cursor-pointer select-none">
                  Mark as Formal Academic Warning
                </label>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => { setIsOpen(false); resetForm(); }}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={saving} className="bg-blue-600 hover:bg-blue-700">
                {saving ? 'Saving...' : 'Save'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
