// ============================================================
// SRUStudentProfilePage.tsx  —  Novelty 2
// Full SSA Student Profile page with XAI risk breakdown +
// what-if simulator. Route: /sru/student/:studentId
// ============================================================

import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router';
import { doc, getDoc, collection, query, where, getDocs, addDoc, serverTimestamp, updateDoc } from 'firebase/firestore';
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
  TrendingUp, Eye, Loader2,
} from 'lucide-react';

interface StudentData {
  id: string;
  name: string;
  email: string;
  programme: string;
  level: string;
  attendancePercentage: number;
  consecutiveAbsences: number;
  gpa: number;
  riskLevel: string;
  engagementScore?: number;
}

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

  // Referral modal state
  const [referralModalOpen, setReferralModalOpen]   = useState(false);
  const [counsellors, setCounsellors]               = useState<any[]>([]);
  const [selectedCounsellor, setSelectedCounsellor] = useState<any>(null);
  const [referralNotes, setReferralNotes]           = useState('');
  const [referralSubmitting, setReferralSubmitting] = useState(false);
  const [linkCopied, setLinkCopied]                 = useState(false);
  const [ssaCalendarLink, setSsaCalendarLink]       = useState('');
  const [ssaFollowUpDate, setSsaFollowUpDate]       = useState('');
  const [ssaInterventionStatus, setSsaInterventionStatus] = useState('open');

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
        const snap = await getDoc(doc(db, 'students', studentId));
        if (snap.exists()) {
          const d = snap.data();
          setStudent({
            id: snap.id,
            name: d.name ?? '',
            email: d.email ?? '',
            programme: d.programme ?? '',
            level: d.level ?? '',
            attendancePercentage: d.attendancePercentage ?? 100,
            consecutiveAbsences: d.consecutiveAbsences ?? 0,
            gpa: d.gpa ?? 0,
            riskLevel: d.riskLevel ?? 'low',
            engagementScore: d.engagementScore ?? 50,
          });
        }

        // Check if student has viewed their own health profile (Novelty 3 cross-portal)
        const viewedSnap = await getDocs(
          query(collection(db, 'studentProfileViews'), where('studentId', '==', studentId))
        );
        if (!viewedSnap.empty) {
          const vd = viewedSnap.docs[0].data();
          setViewedByStudent(vd.viewedAt?.toDate?.()?.toLocaleString() ?? 'Recently');
        }

        // Fetch interventions for this student
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
    if (!referralModalOpen) return;
    const fetchCounsellors = async () => {
      const snap = await getDocs(collection(db, 'student_counsellors'));
      setCounsellors(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    };
    fetchCounsellors();
  }, [referralModalOpen]);

  const copyLink = (link: string) => {
    navigator.clipboard.writeText(link);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  };

  const handleReferral = async () => {
    if (!selectedCounsellor || !student) return;
    setReferralSubmitting(true);
    try {
      await addDoc(collection(db, 'interventions'), {
        studentId: student.id,
        studentName: student.name,
        programme: student.programme,
        riskLevel: riskData?.riskLevel ?? 'medium',
        interventionType: 'Referred to External Counsellor',
        type: 'Referred to External Counsellor',
        date: new Date().toISOString().split('T')[0],
        notes: `Referred to ${selectedCounsellor.name} (${selectedCounsellor.specialisation}). ${referralNotes}`,
        counsellorName: selectedCounsellor.name,
        counsellorSpecialisation: selectedCounsellor.specialisation,
        counsellorCalendarLink: selectedCounsellor.calendarLink ?? '',
        recordedBy: user?.name ?? 'SSA',
        status: 'Active',
        openStatus: ssaInterventionStatus,
        followUpDate: ssaFollowUpDate || null,
        createdAt: serverTimestamp(),
      });
      toast.success(`Student referred to ${selectedCounsellor.name} successfully`);
      setReferralModalOpen(false);
      setSelectedCounsellor(null);
      setReferralNotes('');
      setSsaFollowUpDate('');
      setSsaInterventionStatus('open');
    } catch {
      toast.error('Failed to log referral. Please try again.');
    } finally {
      setReferralSubmitting(false);
    }
  };

  const { data: riskData, loading: riskLoading } = useRiskScore({
    studentId: studentId ?? '',
    attendancePct: student?.attendancePercentage ?? 100,
    gpa: student?.gpa ?? 0,
    engagementPct: student?.engagementScore ?? 50,
    skip: !student,
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
    riskData?.score && riskData.score >= 80 ? 'bg-red-100 text-red-700' :
    riskData?.score && riskData.score >= 60 ? 'bg-amber-100 text-amber-700' :
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
                {student.id} · {student.programme} · {student.level}
              </p>
              <div className="flex flex-wrap gap-2 mt-2">
                {riskData && <RiskLevelBadge level={riskData.riskLevel} />}
                <Badge variant="outline" className="text-xs">{student.email}</Badge>
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
        </CardContent>
      </Card>

      {/* NOVELTY 2: XAI Risk Breakdown + What-If */}
      {riskLoading ? (
        <div className="flex items-center justify-center py-8 gap-2 text-muted-foreground text-xs">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Calculating risk score...
        </div>
      ) : riskData ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* LEFT: XAI Breakdown */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                Explainable Risk Breakdown
                <Badge className="bg-purple-100 text-purple-700 border-purple-200 text-[10px] ml-auto">
                  Novelty 2 · XAI
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {/* Gauge + score */}
              <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl mb-5">
                <div className="flex-shrink-0">
                  <RiskGauge score={riskData.score} size={140} />
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">Dropout risk score</p>
                  <RiskLevelBadge level={riskData.riskLevel} />
                  <p className="text-xs text-gray-500 mt-2 leading-relaxed">
                    Score generated from 3 weighted factor groups. Updated daily.
                  </p>
                </div>
              </div>

              <XAIFactorBreakdown
                factors={riskData.factors}
                attendancePct={student.attendancePercentage}
                gpa={student.gpa}
                engagementPct={student.engagementScore ?? 50}
                explanation={riskData.explanation}
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
                  <Badge className="bg-blue-100 text-blue-700 border-blue-200 text-[10px] ml-auto">
                    Novelty 2
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <WhatIfSimulator
                  baseAttendance={student.attendancePercentage}
                  baseGpa={student.gpa}
                  baseEngagement={student.engagementScore ?? 50}
                  baseScore={riskData.score}
                />
              </CardContent>
            </Card>

            {/* Recommended interventions */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Recommended Interventions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {riskData.recommendedInterventions.map((intervention, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-3 p-3 rounded-lg border bg-gray-50 hover:bg-gray-100 transition-colors"
                  >
                    <div className="w-5 h-5 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-[10px] font-bold text-blue-700">{i + 1}</span>
                    </div>
                    <p className="text-xs text-gray-700 leading-relaxed">{intervention}</p>
                  </div>
                ))}
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full mt-2 text-xs"
                  onClick={() => navigate('/sru/interventions')}
                >
                  Log an Intervention
                </Button>
                {riskData && riskData.score >= 60 && (
                  <div className="mt-3 p-3 bg-purple-50 border border-purple-200 rounded-lg">
                    <p className="text-xs font-medium text-purple-900 mb-1">🧠 Mental Health Concern?</p>
                    <p className="text-xs text-purple-700 leading-relaxed mb-2">
                      If this student shows signs of stress, anxiety or mental health issues, log a counsellor referral intervention.
                    </p>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs border-purple-300 text-purple-700 hover:bg-purple-100 w-full"
                      onClick={() => setReferralModalOpen(true)}
                    >
                      Log Counsellor Referral →
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      ) : null}

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

      {/* Counsellor Referral Modal */}
      <Dialog open={referralModalOpen} onOpenChange={setReferralModalOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Refer to External Counsellor</DialogTitle>
            <p className="text-sm text-muted-foreground">
              Select an external counsellor to refer {student?.name} to. The referral will be logged as an intervention.
            </p>
          </DialogHeader>

          <div className="space-y-4">
            {/* Counsellor list */}
            <div>
              <Label className="text-xs font-medium text-gray-600 uppercase tracking-wide mb-2 block">
                Available Counsellors
              </Label>
              {counsellors.length === 0 ? (
                <div className="text-center py-6 text-muted-foreground text-sm border rounded-lg">
                  No external counsellors found. Ask Admin to add counsellor contacts.
                </div>
              ) : (
                <div className="space-y-2">
                  {counsellors.map((c) => (
                    <div
                      key={c.id}
                      onClick={() => setSelectedCounsellor(c)}
                      className={`p-3 border rounded-xl cursor-pointer transition-colors ${
                        selectedCounsellor?.id === c.id
                          ? 'border-purple-400 bg-purple-50'
                          : 'hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-purple-100 flex items-center justify-center flex-shrink-0">
                            <span className="text-purple-600 text-sm font-medium">
                              {c.name?.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
                            </span>
                          </div>
                          <div>
                            <p className="font-medium text-sm">{c.name}</p>
                            <p className="text-xs text-muted-foreground">{c.specialisation}</p>
                            {c.qualification && (
                              <p className="text-xs text-muted-foreground mt-0.5">{c.qualification}</p>
                            )}
                            <div className="flex items-center gap-2 mt-1">
                              {c.certificationBody && (
                                <span className="inline-flex items-center text-[10px] font-medium px-2 py-0.5 rounded-full bg-green-100 text-green-700 border border-green-200">
                                  ✅ {c.certificationBody}
                                </span>
                              )}
                              {c.registrationNumber && (
                                <span className="text-[10px] text-muted-foreground">
                                  Reg: {c.registrationNumber}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Referral notes */}
            <div className="space-y-2">
              <Label htmlFor="referralNotes">Referral Notes (optional)</Label>
              <Textarea
                id="referralNotes"
                rows={3}
                placeholder="Describe the reason for referral, e.g. student shows signs of anxiety and stress affecting academic performance..."
                value={referralNotes}
                onChange={(e) => setReferralNotes(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="ssaFollowUpDate">Follow-up Date</Label>
              <Input
                id="ssaFollowUpDate"
                type="date"
                value={ssaFollowUpDate}
                onChange={(e) => setSsaFollowUpDate(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
              />
              <p className="text-xs text-muted-foreground">Leave empty if no follow-up needed</p>
            </div>

            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={ssaInterventionStatus} onValueChange={setSsaInterventionStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="open">Open</SelectItem>
                  <SelectItem value="resolved">Resolved</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Selected counsellor summary */}
            {selectedCounsellor && (
              <div className="bg-purple-50 border border-purple-200 rounded-xl p-4 space-y-2">
                <p className="font-medium text-purple-900 text-sm">
                  Referring {student?.name} to {selectedCounsellor.name}
                </p>
                <p className="text-xs text-purple-700">
                  Specialisation: {selectedCounsellor.specialisation}
                </p>
                {selectedCounsellor.contactEmail && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-purple-600">📧 {selectedCounsellor.contactEmail}</span>
                    <button
                      onClick={() => navigator.clipboard.writeText(selectedCounsellor.contactEmail)}
                      className="text-xs text-blue-600 hover:underline"
                    >
                      Copy
                    </button>
                  </div>
                )}
                {selectedCounsellor.contactPhone && (
                  <p className="text-xs text-purple-600">📞 {selectedCounsellor.contactPhone}</p>
                )}
                <p className="text-xs text-purple-500 mt-1">
                  Contact this counsellor directly to arrange a session for the student. Then log the referral below.
                </p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setReferralModalOpen(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              className="bg-purple-600 hover:bg-purple-700"
              disabled={!selectedCounsellor || referralSubmitting}
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
