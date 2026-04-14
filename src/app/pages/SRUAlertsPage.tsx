import { useState, useEffect, useMemo } from 'react';
import { collection, onSnapshot, updateDoc, doc, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../AuthContext';
import { Card, CardContent, CardHeader } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '../components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '../components/ui/dialog';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { AlertTriangle, Flag, Loader2, Brain, CheckCircle, Clock, TrendingDown } from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router';


interface AlertStudent {
  id: string;
  studentId: string;
  uid: string;
  name: string;
  programme: string;
  level: string;
  attendancePercentage: number;
  consecutiveAbsences: number;
  gpa: number;
  flagged: boolean;
  createdAt: any;
  alertTypes: string[];
  flaggedSince?: string;
  flaggedAt: string;
  resolvedAt?: string | null;
  riskLevel: string;
  gpaBySemester: number[];
  attendanceBySemester: number[];
}

interface TrendAlert {
  student: AlertStudent;
  last3Gpa: number[];
  last3Att: number[];
  gpaAllDeclining: boolean;
  attAllDeclining: boolean;
  totalGpaDrop: number;
}

function detectTrendAlert(s: AlertStudent): TrendAlert | null {
  // 1. Only Low or Medium risk
  if (s.riskLevel === 'high') return null;

  // 2. Need at least 3 GPA semester values
  const gpa = s.gpaBySemester;
  if (gpa.length < 3) return null;

  const last3Gpa = gpa.slice(-3);
  const gpaAllDeclining = last3Gpa[0] > last3Gpa[1] && last3Gpa[1] > last3Gpa[2];

  const att = s.attendanceBySemester;
  const last3Att = att.length >= 3 ? att.slice(-3) : [];
  const attAllDeclining = last3Att.length === 3 && last3Att[0] > last3Att[1] && last3Att[1] > last3Att[2];

  // 3. Either GPA or attendance consistently declining over last 3 semesters
  if (!gpaAllDeclining && !attAllDeclining) return null;

  // 4. Overall GPA trend negative AND dropped > 0.5 from first semester
  const totalGpaDrop = gpa[0] - gpa[gpa.length - 1];
  const overallNegative = gpa[gpa.length - 1] < gpa[0];
  if (!overallNegative || totalGpaDrop <= 0.5) return null;

  return { student: s, last3Gpa, last3Att, gpaAllDeclining, attAllDeclining, totalGpaDrop };
}

const getDaysAgo = (dateStr: string) => {
  if (!dateStr) return 'Recently flagged';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return 'Recently flagged';
  const today = new Date();
  const diffTime = Math.abs(today.getTime() - date.getTime());
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  return `${diffDays} days ago`;
};

const formatDate = (val: any) => {
  if (!val) return '';
  try {
    const d = val?.toDate ? val.toDate() : new Date(val);
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return '';
  }
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

export default function SRUAlertsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [allStudents, setAllStudents] = useState<AlertStudent[]>([]);
  const [allStudentsRaw, setAllStudentsRaw] = useState<AlertStudent[]>([]);
  const [loading, setLoading] = useState(true);
  const [alertSearch, setAlertSearch] = useState('');
  const [bulkResolving, setBulkResolving] = useState(false);
  const [activeTab, setActiveTab] = useState<'all' | 'unacknowledged' | 'acknowledged' | 'trend_alerts'>('all');

  // Referral dialog state
  const [referStudent, setReferStudent] = useState<AlertStudent | null>(null);
  const [referTo,      setReferTo]      = useState('');
  const [referUrgency, setReferUrgency] = useState('');
  const [referType,    setReferType]    = useState('');
  const [referNotes,   setReferNotes]   = useState('');
  const [referSaving,  setReferSaving]  = useState(false);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'students'), (snap) => {
      const docs: AlertStudent[] = snap.docs.map((d) => {
        const data = d.data();
        const attendance = data.attendancePercentage ?? 100;
        const absences = data.consecutiveAbsences ?? 0;
        const flaggedVal = data.flagged ?? false;

        const alertTypes: string[] = [];
        if (attendance < 80) alertTypes.push('Low Attendance');
        if (absences >= 3) alertTypes.push('Consecutive Absences');

        return {
          id: d.id,
          studentId: data.studentId ?? d.id,
          uid: data.uid ?? '',
          name: data.name ?? '',
          programme: data.programme ?? '',
          level: data.level ?? '',
          attendancePercentage: attendance,
          consecutiveAbsences: absences,
          gpa: data.gpa ?? 0,
          flagged: flaggedVal,
          createdAt: data.createdAt,
          alertTypes,
          flaggedSince: formatDate(data.createdAt),
          flaggedAt: data.flaggedAt
            ? data.flaggedAt
            : (data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : data.createdAt ?? ''),
          resolvedAt: data.resolvedAt ?? null,
          riskLevel: (data.riskLevel ?? 'low').toLowerCase(),
          gpaBySemester: data.gpa_by_semester ?? data.gpaBySemester ?? [],
          attendanceBySemester: data.attendance_by_semester ?? data.attendanceBySemester ?? [],
        };
      });

      setAllStudentsRaw(docs);
      // Existing alert tabs: only flagged students
      setAllStudents(docs.filter((s) => s.flagged === true));
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const acknowledgedTodayCount = allStudents.filter(s => {
    if (!s.resolvedAt) return false;
    const resolved = new Date(s.resolvedAt);
    const today = new Date();
    return resolved.toDateString() === today.toDateString();
  }).length;

  const avgDaysOpen = (() => {
    const flagged = allStudents.filter(s => s.flagged);
    if (flagged.length === 0) return '—';
    const today = new Date();
    const validDays = flagged
      .map(s => {
        const date = new Date(s.flaggedAt ?? s.createdAt);
        if (isNaN(date.getTime())) return null;
        return Math.floor((today.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
      })
      .filter((d): d is number => d !== null);
    if (validDays.length === 0) return '—';
    return Math.round(validDays.reduce((sum, d) => sum + d, 0) / validDays.length);
  })();

  const filtered = useMemo(() => {
    return allStudents.filter((s) => {
      if (activeTab === 'unacknowledged') return s.flagged === true;
      if (activeTab === 'acknowledged')   return s.flagged === false && !!s.resolvedAt;
      // 'all' tab
      const matchesSearch = !alertSearch ||
        s.name.toLowerCase().includes(alertSearch.toLowerCase()) ||
        s.studentId.toLowerCase().includes(alertSearch.toLowerCase());
      return matchesSearch;
    });
  }, [allStudents, alertSearch, activeTab]);

  const trendAlerts = useMemo<TrendAlert[]>(() => {
    return allStudentsRaw
      .map((s) => detectTrendAlert(s))
      .filter((t): t is TrendAlert => t !== null)
      .sort((a, b) => b.totalGpaDrop - a.totalGpaDrop); // worst drop first
  }, [allStudentsRaw]);

  const handleBulkAcknowledge = async () => {
    const flaggedInView = filtered.filter((s) => s.flagged);
    if (flaggedInView.length === 0) {
      toast.info('No flagged students in current view.');
      return;
    }
    setBulkResolving(true);
    try {
      await Promise.all(
        flaggedInView.map((s) => updateDoc(doc(db, 'students', s.id), { flagged: false, resolvedAt: new Date().toISOString() }))
      );
      toast.success(`${flaggedInView.length} student${flaggedInView.length > 1 ? 's' : ''} acknowledged.`);
    } catch {
      toast.error('Some updates failed. Please try again.');
    } finally {
      setBulkResolving(false);
    }
  };

  const handleAcknowledge = async (studentDocId: string) => {
    try {
      await updateDoc(doc(db, 'students', studentDocId), {
        flagged: false,
        resolvedAt: new Date().toISOString(),
        acknowledgedAt: new Date().toISOString(),
      });
      toast.success('Alert acknowledged');
    } catch {
      toast.error('Failed to acknowledge alert');
    }
  };

  const openIntervention = (student: AlertStudent) => {
    navigate(`/sru/interventions?studentId=${student.studentId}&studentName=${encodeURIComponent(student.name)}`);
  };

  const openReferDialog = (student: AlertStudent) => {
    setReferStudent(student);
    setReferTo('');
    setReferUrgency('');
    setReferType('');
    setReferNotes('');
  };

  const closeReferDialog = () => {
    setReferStudent(null);
    setReferUrgency('');
    setReferType('');
    setReferNotes('');
    setReferTo('');
  };

  const handleReferSubmit = async () => {
    if (!referStudent) return;
    if (!referTo)      { toast.error('Please select a department.');       return; }
    if (!referUrgency) { toast.error('Please select an urgency level.');  return; }

    setReferSaving(true);
    try {
      await addDoc(collection(db, 'interventions'), {
        type:        'Referral',
        referredTo:  referTo,
        urgency:      referUrgency,
        referralType: referType,
        notes:        referNotes.trim(),
        studentId:   referStudent.studentId,
        studentName: referStudent.name,
        createdBy:   user?.name ?? 'SSA',
        createdAt:   serverTimestamp(),
        status:      'open',
      });
      // Notify student about referral
      await addDoc(collection(db, 'notifications'), {
        userId:    referStudent.studentId,
        type:      'referral',
        title:     'You have been referred for support',
        message:   `Your Student Support Advisor has referred you for ${referType.replace('_', ' ')} support. Please expect to be contacted soon.`,
        createdAt: serverTimestamp(),
        read:      false,
      });
      toast.success(`${referStudent.name} referred to ${referTo}.`);
      closeReferDialog();
    } catch {
      toast.error('Failed to save referral. Please try again.');
    } finally {
      setReferSaving(false);
    }
  };

  const tabCounts = {
    all:             allStudents.length,
    unacknowledged:  allStudents.filter(s => s.flagged === true).length,
    acknowledged:    allStudents.filter(s => s.flagged === false && !!s.resolvedAt).length,
    trend_alerts:    trendAlerts.length,
  };

  const tabs: { key: typeof activeTab; label: string }[] = [
    { key: 'all',            label: 'All' },
    { key: 'unacknowledged', label: 'Unacknowledged' },
    { key: 'acknowledged',   label: 'Acknowledged' },
    { key: 'trend_alerts',   label: 'Trend Alerts' },
  ];

  return (
    <div className="space-y-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Student Alerts</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Students flagged for attention — review and take action
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-l-4 border-l-red-500">
          <CardContent className="pt-5 pb-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Alerts</p>
                <p className="text-3xl font-bold mt-1">{loading ? '—' : allStudents.length}</p>
                <p className="text-xs text-muted-foreground mt-1">Students flagged for attention</p>
              </div>
              <div className="h-10 w-10 rounded-full bg-red-50 flex items-center justify-center">
                <Flag className="h-5 w-5 text-red-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-green-500">
          <CardContent className="pt-5 pb-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Acknowledged Today</p>
                <p className="text-3xl font-bold mt-1">{loading ? '—' : acknowledgedTodayCount}</p>
                <p className="text-xs text-muted-foreground mt-1">Resolved today</p>
              </div>
              <div className="h-10 w-10 rounded-full bg-green-50 flex items-center justify-center">
                <CheckCircle className="h-5 w-5 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-amber-500">
          <CardContent className="pt-5 pb-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Avg Days Open</p>
                <p className="text-3xl font-bold mt-1">{loading ? '—' : avgDaysOpen}</p>
                <p className="text-xs text-muted-foreground mt-1">Average days flagged</p>
              </div>
              <div className="h-10 w-10 rounded-full bg-amber-50 flex items-center justify-center">
                <Clock className="h-5 w-5 text-amber-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Alerts list */}
      <div className="rounded-xl border bg-white">
        {/* Header: tabs + filters + bulk action */}
        <div className="px-4 pt-4 pb-0 border-b">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
            {/* Tabs */}
            <div className="flex gap-1">
              {tabs.map((t) => {
                const isTrend = t.key === 'trend_alerts';
                const isActive = activeTab === t.key;
                return (
                  <button
                    key={t.key}
                    onClick={() => setActiveTab(t.key)}
                    className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors flex items-center gap-1.5 ${
                      isActive && isTrend  ? 'bg-orange-600 text-white' :
                      isActive             ? 'bg-gray-900 text-white' :
                      isTrend             ? 'text-orange-600 hover:bg-orange-50' :
                                            'text-muted-foreground hover:text-foreground hover:bg-gray-100'
                    }`}
                  >
                    {isTrend && <TrendingDown className="h-3.5 w-3.5" />}
                    {t.label}
                    {tabCounts[t.key] > 0 && (
                      <span className={`inline-flex items-center justify-center h-4 min-w-4 px-1 rounded-full text-[10px] font-bold ${
                        isActive && isTrend  ? 'bg-white text-orange-700' :
                        isActive             ? 'bg-white text-gray-900' :
                        isTrend             ? 'bg-orange-100 text-orange-700' :
                                              'bg-gray-200 text-gray-700'
                      }`}>
                        {tabCounts[t.key]}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Search + Bulk Acknowledge */}
            <div className="flex flex-wrap gap-2 items-center">
              <Input
                placeholder="Search student..."
                value={alertSearch}
                onChange={e => setAlertSearch(e.target.value)}
                className="w-[200px] h-8 text-xs"
              />
              <Button
                size="sm"
                variant="outline"
                className="h-8 text-xs"
                disabled={bulkResolving}
                onClick={handleBulkAcknowledge}
              >
                {bulkResolving ? (
                  <><Loader2 className="h-3 w-3 animate-spin mr-1" /> Acknowledging…</>
                ) : (
                  'Bulk Acknowledge'
                )}
              </Button>
            </div>
          </div>
        </div>

        {/* Alert cards */}
        <div className="p-4">
          {loading ? (
            <div className="flex items-center justify-center h-40">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : activeTab === 'trend_alerts' ? (
            /* ── Trend Alerts view ─────────────────────────────────── */
            <div className="space-y-3">
              {/* Section note */}
              <div className="flex items-start gap-2.5 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3">
                <TrendingDown className="h-4 w-4 text-blue-600 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-blue-800 leading-relaxed">
                  These alerts are generated for students not yet flagged as High Risk but showing
                  consistent academic decline. Early intervention at this stage is most effective
                  in preventing dropout.
                </p>
              </div>

              {trendAlerts.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
                  <TrendingDown className="h-8 w-8 mb-2 opacity-30" />
                  <p className="text-sm">No declining trend alerts at this time.</p>
                  <p className="text-xs mt-1">All students are on stable or improving trajectories.</p>
                </div>
              ) : trendAlerts.map(({ student, last3Gpa, last3Att, gpaAllDeclining, attAllDeclining }) => {
                const riskColour =
                  student.riskLevel === 'medium' ? 'bg-amber-100 text-amber-800 border-amber-200'
                  : 'bg-green-100 text-green-800 border-green-200';
                const riskLabel = student.riskLevel === 'medium' ? 'Medium Risk' : 'Low Risk';
                return (
                  <div
                    key={student.id}
                    className="border-l-4 border-l-orange-400 border rounded-xl p-4 bg-white"
                  >
                    {/* Header row */}
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-medium text-sm">{student.name}</p>
                          <span className="text-xs text-muted-foreground">{student.studentId}</span>
                          <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${riskColour}`}>
                            {riskLabel}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">{student.programme} · {student.level}</p>
                      </div>
                      <div className="flex items-center gap-1.5 text-orange-600 flex-shrink-0">
                        <TrendingDown className="h-4 w-4" />
                        <span className="text-xs font-semibold whitespace-nowrap">⚠️ Declining Trend Detected</span>
                      </div>
                    </div>

                    {/* Trajectories */}
                    <div className="flex flex-wrap gap-4 mb-2">
                      {gpaAllDeclining && (
                        <div>
                          <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5">GPA Trajectory</p>
                          <p className="text-sm font-mono font-medium text-gray-800">
                            {last3Gpa.map(v => v.toFixed(2)).join(' → ')}
                          </p>
                        </div>
                      )}
                      {attAllDeclining && last3Att.length === 3 && (
                        <div>
                          <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5">Attendance Trajectory</p>
                          <p className="text-sm font-mono font-medium text-gray-800">
                            {last3Att.map(v => `${Math.round(v * (v <= 1 ? 100 : 1))}%`).join(' → ')}
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Message */}
                    <p className="text-xs text-muted-foreground mb-3 leading-relaxed">
                      This student is currently{' '}
                      <span className="font-medium">{riskLabel}</span> but shows a consistently
                      declining academic trend. Early intervention may prevent escalation to High Risk.
                    </p>

                    {/* Actions */}
                    <div className="flex gap-2 flex-wrap">
                      <Button
                        size="sm"
                        className="bg-blue-600 hover:bg-blue-700 text-xs"
                        onClick={() => navigate(`/sru/students/${student.studentId}`)}
                      >
                        View Profile
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-xs"
                        onClick={() => openIntervention(student)}
                      >
                        Log Intervention
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
              <AlertTriangle className="h-8 w-8 mb-2 opacity-30" />
              <p className="text-sm">No alerts found.</p>
            </div>
          ) : (
            filtered.map((student) => (
              <div
                key={student.id}
                className={`border rounded-xl p-4 mb-3 last:mb-0 flex gap-4 items-start bg-white
                  ${student.attendancePercentage < 80 ? 'border-l-4 border-l-red-500' :
                    student.consecutiveAbsences >= 3  ? 'border-l-4 border-l-amber-400' :
                    'border-l-4 border-l-blue-400'}`}
              >
                {/* Alert icon */}
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0
                  ${student.attendancePercentage < 80 ? 'bg-red-50' : 'bg-amber-50'}`}>
                  <AlertTriangle className={`h-4 w-4 ${
                    student.attendancePercentage < 80 ? 'text-red-500' : 'text-amber-500'
                  }`} />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <p className="font-medium text-sm">{student.name}</p>
                    {student.flaggedAt && (
                      <span className="text-xs text-muted-foreground ml-auto">
                        Flagged {getDaysAgo(student.flaggedAt)}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mb-2">
                    {student.attendancePercentage < 80
                      ? `Attendance at ${student.attendancePercentage}% — below 80% threshold.${student.consecutiveAbsences > 0 ? ` ${student.consecutiveAbsences} consecutive absences.` : ''}`
                      : student.consecutiveAbsences >= 3
                      ? `${student.consecutiveAbsences} consecutive absences recorded.`
                      : `Student flagged for review.`}
                  </p>
                  <div className="flex gap-2 flex-wrap">
                    <Badge variant="outline" className="text-xs">{student.programme || 'Unknown programme'}</Badge>
                    <Badge variant="outline" className="text-xs">Attendance: {student.attendancePercentage}%</Badge>
                    <Badge variant="outline" className="text-xs">GPA: {student.gpa.toFixed(2)}</Badge>
                    {student.alertTypes.map((t) => (
                      <Badge key={t} variant="outline" className="text-xs text-red-600 border-red-200">{t}</Badge>
                    ))}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex flex-col gap-2 flex-shrink-0">
                  <Button
                    size="sm"
                    className="bg-blue-600 hover:bg-blue-700 text-xs"
                    onClick={() => navigate(`/sru/students/${student.studentId}`)}
                  >
                    View Profile
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-xs"
                    onClick={() => openIntervention(student)}
                  >
                    Intervene
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full text-xs border-green-200 text-green-700 hover:bg-green-50"
                    onClick={() => handleAcknowledge(student.id)}
                  >
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Acknowledge
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-xs border-purple-300 text-purple-700 hover:bg-purple-100"
                    onClick={() => openReferDialog(student)}
                  >
                    <Brain className="h-3 w-3 mr-1" /> Refer
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
      {/* Refer to Specialist Dialog */}
      <Dialog open={!!referStudent} onOpenChange={(open) => { if (!open) closeReferDialog(); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Refer {referStudent?.name} to Specialist</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Row 1 — Refer To (full width) */}
            <div className="space-y-1.5">
              <Label>Refer To <span className="text-red-500">*</span></Label>
              <Select value={referTo} onValueChange={setReferTo}>
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
                <Select value={referType} onValueChange={setReferType}>
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
                <Select value={referUrgency} onValueChange={setReferUrgency}>
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
                placeholder="Describe the reason for this referral and any additional context…"
                value={referNotes}
                onChange={(e) => setReferNotes(e.target.value)}
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeReferDialog} disabled={referSaving}>
              Cancel
            </Button>
            <Button
              className="bg-purple-600 hover:bg-purple-700"
              onClick={handleReferSubmit}
              disabled={referSaving}
            >
              {referSaving ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Saving…</> : 'Submit Referral'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
