import { useState, useEffect, useMemo } from 'react';
import { collection, onSnapshot, updateDoc, doc, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../AuthContext';
import { runDailyAlertCheck, AlertResult } from '../services/alertService';
import { Card, CardContent, CardHeader } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '../components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '../components/ui/dialog';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { AlertTriangle, Flag, Activity, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router';
import { createNotification } from '../services/notificationService';

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
  riskLevel: string;
  flagged: boolean;
  createdAt: any;
  alertTypes: string[];
  flaggedSince?: string;
}

const formatDate = (val: any) => {
  if (!val) return '';
  try {
    const d = val?.toDate ? val.toDate() : new Date(val);
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return '';
  }
};

export default function SRUAlertsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [allStudents, setAllStudents] = useState<AlertStudent[]>([]);
  const [loading, setLoading] = useState(true);
  const [riskFilter, setRiskFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [bulkResolving, setBulkResolving] = useState(false);
  const [activeTab, setActiveTab] = useState<'all' | 'critical' | 'high' | 'resolved'>('all');
  const [manualCheckRunning, setManualCheckRunning] = useState(false);
  const [manualCheckResult, setManualCheckResult]   = useState<AlertResult | null>(null);

  // Referral dialog state
  const [referStudent, setReferStudent] = useState<AlertStudent | null>(null);
  const [referTo,      setReferTo]      = useState('');
  const [referReason,  setReferReason]  = useState('');
  const [referUrgency, setReferUrgency] = useState('');
  const [referNotes,   setReferNotes]   = useState('');
  const [referSaving,  setReferSaving]  = useState(false);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'students'), (snap) => {
      const docs: AlertStudent[] = snap.docs.map((d) => {
        const data = d.data();
        const attendance = data.attendancePercentage ?? 100;
        const absences = data.consecutiveAbsences ?? 0;
        const risk = data.riskLevel ?? 'low';
        const flaggedVal = data.flagged ?? false;

        const alertTypes: string[] = [];
        if (attendance < 80) alertTypes.push('Low Attendance');
        if (risk === 'high' || risk === 'critical') alertTypes.push('High Risk');
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
          riskLevel: risk,
          flagged: flaggedVal,
          createdAt: data.createdAt,
          alertTypes,
          flaggedSince: formatDate(data.createdAt),
        };
      });

      // Only show students that trigger an alert condition
      setAllStudents(
        docs.filter(
          (s) => s.flagged || s.riskLevel === 'high' || s.riskLevel === 'critical' || s.attendancePercentage < 80 || s.consecutiveAbsences >= 3
        )
      );
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const totalAlerts   = allStudents.filter((s) => s.flagged).length;
  const highRiskCount = allStudents.filter((s) => s.riskLevel === 'high' || s.riskLevel === 'critical').length;
  const lowAttCount   = allStudents.filter((s) => s.attendancePercentage < 80).length;

  const filtered = useMemo(() => {
    return allStudents.filter((s) => {
      // Tab filter
      if (activeTab === 'critical') return s.riskLevel === 'critical';
      if (activeTab === 'high')     return s.riskLevel === 'high';
      if (activeTab === 'resolved') return !s.flagged;

      // "all" tab — apply the dropdown filters
      const matchesRisk = riskFilter === 'all' || s.riskLevel === riskFilter;
      const matchesType = typeFilter === 'all' || s.alertTypes.includes(typeFilter);
      return matchesRisk && matchesType;
    });
  }, [allStudents, riskFilter, typeFilter, activeTab]);

  const handleMarkResolved = async (student: AlertStudent) => {
    setResolvingId(student.id);
    try {
      await updateDoc(doc(db, 'students', student.id), { flagged: false });
      toast.success(`${student.name} marked as resolved.`);
    } catch {
      toast.error('Failed to update student. Please try again.');
    } finally {
      setResolvingId(null);
    }
  };

  const handleBulkAcknowledge = async () => {
    const flaggedInView = filtered.filter((s) => s.flagged);
    if (flaggedInView.length === 0) {
      toast.info('No flagged students in current view.');
      return;
    }
    setBulkResolving(true);
    try {
      await Promise.all(
        flaggedInView.map((s) => updateDoc(doc(db, 'students', s.id), { flagged: false }))
      );
      toast.success(`${flaggedInView.length} student${flaggedInView.length > 1 ? 's' : ''} acknowledged.`);
    } catch {
      toast.error('Some updates failed. Please try again.');
    } finally {
      setBulkResolving(false);
    }
  };

  const handleManualCheck = async () => {
    if (!user?.email) return;
    setManualCheckRunning(true);
    setManualCheckResult(null);
    try {
      const result = await runDailyAlertCheck(
        user.email,
        user.name ?? 'Student Support Advisor'
      );
      setManualCheckResult(result);
    } catch (err) {
      console.error('Manual check failed:', err);
    } finally {
      setManualCheckRunning(false);
    }
  };

  const openIntervention = (student: AlertStudent) => {
    navigate(`/sru/interventions?studentId=${student.studentId}&studentName=${encodeURIComponent(student.name)}`);
  };

  const openReferDialog = (student: AlertStudent) => {
    setReferStudent(student);
    setReferTo('');
    setReferReason('');
    setReferUrgency('');
    setReferNotes('');
  };

  const closeReferDialog = () => setReferStudent(null);

  const handleReferSubmit = async () => {
    if (!referStudent) return;
    if (!referTo)      { toast.error('Please select who to refer to.');   return; }
    if (!referReason.trim()) { toast.error('Please enter a reason.');     return; }
    if (!referUrgency) { toast.error('Please select an urgency level.');  return; }

    setReferSaving(true);
    try {
      await addDoc(collection(db, 'interventions'), {
        type:        'Referral',
        referredTo:  referTo,
        reason:      referReason.trim(),
        urgency:     referUrgency,
        notes:       referNotes.trim(),
        studentId:   referStudent.studentId,
        studentName: referStudent.name,
        createdBy:   user?.name ?? 'SSA',
        createdAt:   serverTimestamp(),
        status:      'open',
      });
      await createNotification({
        studentId: referStudent.studentId,
        uid:       referStudent.uid,
        type:      'intervention',
        title:     'Support referral logged',
        message:   `Your Student Support Advisor has referred you to ${referTo}.`,
      });
      toast.success(`${referStudent.name} referred to ${referTo}.`);
      closeReferDialog();
    } catch {
      toast.error('Failed to save referral. Please try again.');
    } finally {
      setReferSaving(false);
    }
  };

  const tabs: { key: typeof activeTab; label: string }[] = [
    { key: 'all',      label: 'All' },
    { key: 'critical', label: 'Critical' },
    { key: 'high',     label: 'High' },
    { key: 'resolved', label: 'Resolved' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Student Alerts</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Students flagged as high risk — action required within 24 hours
          </p>
        </div>
        <Button
          onClick={handleManualCheck}
          disabled={manualCheckRunning}
          variant="outline"
          className="flex items-center gap-2 flex-shrink-0"
        >
          {manualCheckRunning ? (
            <><span className="animate-spin">⏳</span> Checking...</>
          ) : (
            <><span>🔄</span> Run Risk Check Now</>
          )}
        </Button>
      </div>

      {manualCheckResult && (
        <div className={`rounded-lg p-3 text-sm ${
          manualCheckResult.alertsSent > 0
            ? 'bg-red-50 border border-red-200 text-red-700'
            : 'bg-green-50 border border-green-200 text-green-700'
        }`}>
          {manualCheckResult.alertsSent > 0
            ? `⚠️ ${manualCheckResult.alertsSent} high risk student${manualCheckResult.alertsSent > 1 ? 's' : ''} found — alert email sent`
            : '✅ No new high risk students detected today'}
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-l-4 border-l-red-500">
          <CardContent className="pt-5 pb-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Alerts</p>
                <p className="text-3xl font-bold mt-1">{loading ? '—' : totalAlerts}</p>
                <p className="text-xs text-muted-foreground mt-1">Flagged students</p>
              </div>
              <div className="h-10 w-10 rounded-full bg-red-50 flex items-center justify-center">
                <Flag className="h-5 w-5 text-red-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-red-500">
          <CardContent className="pt-5 pb-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">High Risk</p>
                <p className="text-3xl font-bold mt-1">{loading ? '—' : highRiskCount}</p>
                <p className="text-xs text-muted-foreground mt-1">High risk students</p>
              </div>
              <div className="h-10 w-10 rounded-full bg-red-50 flex items-center justify-center">
                <AlertTriangle className="h-5 w-5 text-red-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-amber-500">
          <CardContent className="pt-5 pb-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Low Attendance</p>
                <p className="text-3xl font-bold mt-1">{loading ? '—' : lowAttCount}</p>
                <p className="text-xs text-muted-foreground mt-1">Below 80%</p>
              </div>
              <div className="h-10 w-10 rounded-full bg-amber-50 flex items-center justify-center">
                <Activity className="h-5 w-5 text-amber-600" />
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
              {tabs.map((t) => (
                <button
                  key={t.key}
                  onClick={() => setActiveTab(t.key)}
                  className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                    activeTab === t.key
                      ? 'bg-gray-900 text-white'
                      : 'text-muted-foreground hover:text-foreground hover:bg-gray-100'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {/* Filters + Bulk Acknowledge */}
            <div className="flex flex-wrap gap-2 items-center">
              {activeTab === 'all' && (
                <>
                  <Select value={riskFilter} onValueChange={setRiskFilter}>
                    <SelectTrigger className="w-40 h-8 text-xs">
                      <SelectValue placeholder="Risk Level" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Risk Levels</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="low">Low</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={typeFilter} onValueChange={setTypeFilter}>
                    <SelectTrigger className="w-48 h-8 text-xs">
                      <SelectValue placeholder="Alert Type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Alert Types</SelectItem>
                      <SelectItem value="Low Attendance">Low Attendance</SelectItem>
                      <SelectItem value="High Risk">High Risk</SelectItem>
                      <SelectItem value="Consecutive Absences">Consecutive Absences</SelectItem>
                    </SelectContent>
                  </Select>
                </>
              )}
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
                  ${student.riskLevel === 'critical' ? 'border-l-4 border-l-red-500' :
                    student.riskLevel === 'high'     ? 'border-l-4 border-l-red-400' :
                    student.riskLevel === 'medium'   ? 'border-l-4 border-l-amber-400' :
                    'border-l-4 border-l-blue-400'}`}
              >
                {/* Alert icon */}
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0
                  ${student.riskLevel === 'critical' || student.riskLevel === 'high' ? 'bg-red-50' : 'bg-amber-50'}`}>
                  <AlertTriangle className={`h-4 w-4 ${
                    student.riskLevel === 'critical' || student.riskLevel === 'high'
                      ? 'text-red-500' : 'text-amber-500'
                  }`} />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <p className="font-medium text-sm">{student.name}</p>
                    <Badge className={
                      student.riskLevel === 'critical' ? 'bg-red-100 text-red-800 border-red-200 text-xs' :
                      student.riskLevel === 'high'     ? 'bg-red-100 text-red-800 border-red-200 text-xs' :
                      'bg-amber-100 text-amber-800 border-amber-200 text-xs'
                    }>
                      {student.riskLevel === 'critical' ? 'Critical' :
                       student.riskLevel === 'high'     ? 'High Risk' : 'Medium Risk'}
                    </Badge>
                    {student.flaggedSince && (
                      <span className="text-xs text-muted-foreground ml-auto">
                        Flagged {student.flaggedSince}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mb-2">
                    {student.attendancePercentage < 75
                      ? `Attendance at ${student.attendancePercentage}% — below 75% threshold.${student.consecutiveAbsences > 0 ? ` ${student.consecutiveAbsences} consecutive absences.` : ''}`
                      : `GPA ${student.gpa.toFixed(2)} — academic performance requires attention.`}
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
                    className="text-xs border-purple-300 text-purple-700 hover:bg-purple-100"
                    onClick={() => openReferDialog(student)}
                  >
                    🧠 Refer
                  </Button>
                  {student.flagged && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs border-green-200 text-green-700 hover:bg-green-50"
                      disabled={resolvingId === student.id}
                      onClick={() => handleMarkResolved(student)}
                    >
                      {resolvingId === student.id ? 'Saving…' : 'Mark Resolved'}
                    </Button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
      {/* Refer to Specialist Dialog */}
      <Dialog open={!!referStudent} onOpenChange={(open) => { if (!open) closeReferDialog(); }}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>Refer to Specialist</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Student — read-only */}
            <div className="space-y-1.5">
              <Label>Student</Label>
              <div className="rounded-md border bg-gray-50 px-3 py-2 text-sm text-muted-foreground">
                {referStudent?.name ?? ''}
              </div>
            </div>

            {/* Refer To */}
            <div className="space-y-1.5">
              <Label>Refer To <span className="text-red-500">*</span></Label>
              <Select value={referTo} onValueChange={setReferTo}>
                <SelectTrigger>
                  <SelectValue placeholder="Select specialist…" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Counsellor">Counsellor</SelectItem>
                  <SelectItem value="Financial Aid">Financial Aid</SelectItem>
                  <SelectItem value="Disability Support">Disability Support</SelectItem>
                  <SelectItem value="Mental Health Services">Mental Health Services</SelectItem>
                  <SelectItem value="Academic Support">Academic Support</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Reason */}
            <div className="space-y-1.5">
              <Label>Reason <span className="text-red-500">*</span></Label>
              <Textarea
                placeholder="Describe the reason for this referral…"
                value={referReason}
                onChange={(e) => setReferReason(e.target.value)}
                rows={3}
              />
            </div>

            {/* Urgency */}
            <div className="space-y-1.5">
              <Label>Urgency <span className="text-red-500">*</span></Label>
              <Select value={referUrgency} onValueChange={setReferUrgency}>
                <SelectTrigger>
                  <SelectValue placeholder="Select urgency…" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Routine">Routine</SelectItem>
                  <SelectItem value="Urgent">Urgent</SelectItem>
                  <SelectItem value="Emergency">Emergency</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Notes — optional */}
            <div className="space-y-1.5">
              <Label>Notes <span className="text-xs text-muted-foreground">(optional)</span></Label>
              <Textarea
                placeholder="Any additional context or instructions…"
                value={referNotes}
                onChange={(e) => setReferNotes(e.target.value)}
                rows={2}
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
