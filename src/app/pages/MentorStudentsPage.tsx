import { useState, useEffect, useMemo } from 'react';
import { collection, getDocs, query, orderBy, addDoc, serverTimestamp } from 'firebase/firestore';
import { CALENDAR_LINKS } from '../config/calendarLinks';
import { db } from '../../firebase';
import { useAuth } from '../AuthContext';
import { Card, CardContent } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '../components/ui/dialog';
import { Search, Loader2, X, AlertTriangle } from 'lucide-react';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';

const LEVEL_TO_YEAR: Record<string, string> = {
  'Level 4': 'Year 1', 'Level 5': 'Year 2', 'Level 6': 'Year 3', 'Level 7': 'Year 4',
  '1st Year': 'Year 1', '2nd Year': 'Year 2', '3rd Year': 'Year 3', '4th Year': 'Year 4',
  'Year 1': 'Year 1', 'Year 2': 'Year 2', 'Year 3': 'Year 3', 'Year 4': 'Year 4',
};

interface StudentDoc {
  id: string;
  studentId: string;
  name: string;
  email: string;
  programme: string;
  level: string;
  faculty: string;
  intake: string;
  gender: string;
  dateOfBirth: string;
  contactNumber: string;
  attendancePercentage: number;
  consecutiveAbsences: number;
  gpa: number;
  riskLevel: string;
  academicMentor: string;
  status: string;
}

interface InterventionDoc {
  id: string;
  studentId: string;
  studentName: string;
  interventionType: string;
  date: string;
  outcome: string;
  recordedBy: string;
  createdAt: any;
}

interface AppointmentDoc {
  id: string;
  studentId: string;
  studentName: string;
  type: string;
  date: string;
  time: string;
  status: string;
}

const getRiskBadge = (riskLevel: string) => {
  if (riskLevel === 'high')
    return <Badge className="bg-red-100 text-red-800 border-red-200 text-xs">High</Badge>;
  if (riskLevel === 'medium')
    return <Badge className="bg-amber-100 text-amber-800 border-amber-200 text-xs">Medium</Badge>;
  return <Badge className="bg-green-100 text-green-800 border-green-200 text-xs">Low</Badge>;
};

const getStatusBadge = (status: string) => {
  switch (status) {
    case 'pending':
      return <Badge className="bg-amber-100 text-amber-800 border-amber-200 text-xs">Pending</Badge>;
    case 'scheduled':
      return <Badge className="bg-blue-100 text-blue-800 border-blue-200 text-xs">Scheduled</Badge>;
    case 'completed':
      return <Badge className="bg-green-100 text-green-800 border-green-200 text-xs">Completed</Badge>;
    case 'cancelled':
      return <Badge className="bg-red-100 text-red-800 border-red-200 text-xs">Cancelled</Badge>;
    default:
      return <Badge className="text-xs">{status}</Badge>;
  }
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

export default function MentorStudentsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [students, setStudents] = useState<StudentDoc[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState('');
  const [riskFilter, setRiskFilter] = useState('all');
  const [programmeFilter, setProgrammeFilter] = useState('all');

  const [selectedStudent, setSelectedStudent] = useState<StudentDoc | null>(null);
  const [studentInterventions, setStudentInterventions] = useState<InterventionDoc[]>([]);
  const [studentAppointments, setStudentAppointments] = useState<AppointmentDoc[]>([]);
  const [modalLoading, setModalLoading] = useState(false);

  const [sessionModalOpen, setSessionModalOpen] = useState(false);
  const [sessionStudent, setSessionStudent] = useState<StudentDoc | null>(null);
  const [sessionType, setSessionType] = useState('Academic Mentoring Session');
  const [sessionNotes, setSessionNotes] = useState('');
  const [sessionOutcome, setSessionOutcome] = useState('');
  const [nextSteps, setNextSteps] = useState('');
  const [sessionSubmitting, setSessionSubmitting] = useState(false);

  useEffect(() => {
    const fetchStudents = async () => {
      setLoading(true);
      try {
        const mentorName = user?.name ?? '';
        const mentorEmail = user?.email ?? '';
        const mentorUid = (user as any)?.uid ?? '';

        const snap = await getDocs(collection(db, 'students'));
        setStudents(snap.docs
          .filter((d) => {
            const data = d.data();
            return (
              (mentorName && data.academicMentor === mentorName) ||
              (mentorEmail && data.academicMentor === mentorEmail) ||
              (mentorUid && data.mentorId === mentorUid)
            );
          })
          .map((d) => ({
          id: d.id,
          studentId: d.data().studentId ?? d.id,
          name: d.data().name ?? '',
          email: d.data().email ?? '',
          programme: d.data().programme ?? '',
          level: d.data().level ?? '',
          faculty: d.data().faculty ?? '',
          intake: d.data().intake ?? '',
          gender: d.data().gender ?? '',
          dateOfBirth: d.data().dateOfBirth ?? '',
          contactNumber: d.data().contactNumber ?? '',
          attendancePercentage: d.data().attendancePercentage ?? 100,
          consecutiveAbsences: d.data().consecutiveAbsences ?? 0,
          gpa: d.data().gpa ?? 0,
          riskLevel: d.data().riskLevel ?? 'low',
          academicMentor: d.data().academicMentor ?? '',
          status: d.data().status ?? 'active',
        })));
      } finally {
        setLoading(false);
      }
    };
    fetchStudents();
  }, [user?.name, user?.email]);

  const programmes = useMemo(() => {
    const set = new Set(students.map((s) => s.programme).filter(Boolean));
    return Array.from(set).sort();
  }, [students]);

  const filtered = useMemo(() => {
    let list = students;
    if (riskFilter !== 'all') list = list.filter((s) => s.riskLevel === riskFilter);
    if (programmeFilter !== 'all') list = list.filter((s) => s.programme === programmeFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (s) => s.name.toLowerCase().includes(q) || s.studentId.toLowerCase().includes(q)
      );
    }
    return list;
  }, [students, riskFilter, programmeFilter, search]);

  const openSessionModal = (student: StudentDoc) => {
    setSessionStudent(student);
    setSessionType('Academic Mentoring Session');
    setSessionNotes('');
    setSessionOutcome('');
    setNextSteps('');
    setSessionModalOpen(true);
  };

  const handleBookAppointment = async (student: StudentDoc) => {
    let calendarLink = (user as any)?.calendarLink;

    if (!calendarLink) {
      try {
        const mentorSnap = await getDocs(query(collection(db, 'academic_mentors'), where('email', '==', user?.email ?? '')));
        if (!mentorSnap.empty) {
          calendarLink = mentorSnap.docs[0].data().calendarLink;
        }
      } catch {}
    }

    if (!calendarLink) {
      calendarLink = CALENDAR_LINKS.mentor;
    }

    window.open(calendarLink, '_blank');

    try {
      await addDoc(collection(db, 'appointments'), {
        studentId: student.id,
        studentName: student.name,
        mentorId: (user as any)?.uid,
        mentorName: user?.name,
        programme: student.programme,
        type: 'Academic Mentoring Session',
        appointmentType: 'Academic Mentoring Session',
        date: new Date().toISOString().split('T')[0],
        time: '',
        status: 'scheduled',
        bookedBy: 'mentor',
        createdAt: serverTimestamp(),
      });
      toast.success(`Appointment scheduled for ${student.name}`);
    } catch {
      toast.error('Failed to save appointment record.');
    }
  };

  const handleSessionSubmit = async () => {
    if (!sessionStudent || !sessionNotes) {
      toast.error('Please add session notes before saving');
      return;
    }
    setSessionSubmitting(true);
    try {
      await addDoc(collection(db, 'interventions'), {
        studentId: sessionStudent.id,
        studentName: sessionStudent.name,
        programme: sessionStudent.programme,
        riskLevel: sessionStudent.riskLevel,
        interventionType: sessionType,
        type: sessionType,
        date: new Date().toISOString().split('T')[0],
        notes: sessionNotes,
        outcome: sessionOutcome,
        nextSteps: nextSteps,
        recordedBy: user?.name ?? 'Academic Mentor',
        recordedByRole: 'Academic Mentor',
        status: sessionOutcome === 'Resolved' ? 'completed' : 'in-progress',
        createdAt: serverTimestamp(),
      });
      toast.success(`Session notes saved for ${sessionStudent.name}`);
      setSessionModalOpen(false);
    } catch {
      toast.error('Failed to save session notes. Please try again.');
    } finally {
      setSessionSubmitting(false);
    }
  };

  const openProfile = async (student: StudentDoc) => {
    setSelectedStudent(student);
    setModalLoading(true);
    try {
      const [intSnap, apptSnap] = await Promise.all([
        getDocs(query(collection(db, 'interventions'), orderBy('createdAt', 'desc'))),
        getDocs(query(collection(db, 'appointments'), orderBy('date', 'desc'))),
      ]);

      setStudentInterventions(
        intSnap.docs
          .filter((d) => d.data().studentId === student.id || d.data().studentName === student.name)
          .slice(0, 5)
          .map((d) => ({
            id: d.id,
            studentId: d.data().studentId ?? '',
            studentName: d.data().studentName ?? '',
            interventionType: d.data().interventionType ?? '',
            date: d.data().date ?? '',
            outcome: d.data().outcome ?? '',
            recordedBy: d.data().recordedBy ?? '',
            createdAt: d.data().createdAt,
          }))
      );

      setStudentAppointments(
        apptSnap.docs
          .filter((d) => d.data().studentId === student.id)
          .slice(0, 5)
          .map((d) => ({
            id: d.id,
            studentId: d.data().studentId ?? '',
            studentName: d.data().studentName ?? '',
            type: d.data().type ?? d.data().appointmentType ?? '',
            date: d.data().date ?? '',
            time: d.data().time ?? '',
            status: d.data().status ?? '',
          }))
      );
    } finally {
      setModalLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">My Students</h1>
        <p className="text-muted-foreground text-sm mt-1">Students assigned to you</p>
      </div>

      {students.filter(s => s.riskLevel === 'high' || s.riskLevel === 'medium').length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 flex items-center gap-3 mb-4">
          <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0" />
          <p className="text-sm text-amber-900 font-medium">
            {students.filter(s => s.riskLevel === 'high' || s.riskLevel === 'medium').length} of your students are at medium or high risk. Please reach out to them.
          </p>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name or student ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={riskFilter} onValueChange={setRiskFilter}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Risk Level" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Risk Levels</SelectItem>
            <SelectItem value="high">High</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="low">Low</SelectItem>
          </SelectContent>
        </Select>
        <Select value={programmeFilter} onValueChange={setProgrammeFilter}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Programme" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Programmes</SelectItem>
            {programmes.map((p) => (
              <SelectItem key={p} value={p}>{p}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="rounded-lg border bg-white overflow-x-auto">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground gap-2 text-sm">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading students...
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-gray-50">
                <th className="text-left font-medium text-muted-foreground px-4 py-3">Student ID</th>
                <th className="text-left font-medium text-muted-foreground px-4 py-3">Name</th>
                <th className="text-left font-medium text-muted-foreground px-4 py-3">Programme</th>
                <th className="text-left font-medium text-muted-foreground px-4 py-3">Level</th>
                <th className="text-left font-medium text-muted-foreground px-4 py-3">Attendance %</th>
                <th className="text-left font-medium text-muted-foreground px-4 py-3">GPA</th>
                <th className="text-left font-medium text-muted-foreground px-4 py-3">Risk Level</th>
                <th className="text-left font-medium text-muted-foreground px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-muted-foreground text-sm">
                    No students found.
                  </td>
                </tr>
              ) : (
                filtered.map((s) => (
                  <tr key={s.id} className="border-b last:border-0 hover:bg-gray-50">
                    <td className="px-4 py-3 text-xs text-muted-foreground">{s.studentId}</td>
                    <td className="px-4 py-3 font-medium">{s.name}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground max-w-[160px]">
                      <span className="truncate block">{s.programme || '—'}</span>
                    </td>
                    <td className="px-4 py-3 text-sm">{(LEVEL_TO_YEAR[s.level] ?? s.level) || '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`font-medium text-sm ${s.attendancePercentage < 80 ? 'text-red-600' : ''}`}>
                        {s.attendancePercentage}%
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm">{s.gpa.toFixed(2)}</td>
                    <td className="px-4 py-3">{getRiskBadge(s.riskLevel)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs px-3"
                          onClick={() => openProfile(s)}
                        >
                          View Profile
                        </Button>
                        <Button
                          size="sm"
                          className="h-7 text-xs px-3 bg-blue-600 hover:bg-blue-700"
                          onClick={() => openSessionModal(s)}
                        >
                          Log Session Notes
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs px-3"
                          onClick={() => handleBookAppointment(s)}
                        >
                          Book Appointment
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Profile Modal */}
      <Dialog open={!!selectedStudent} onOpenChange={(open) => { if (!open) setSelectedStudent(null); }}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base">Student Profile</DialogTitle>
          </DialogHeader>
          {selectedStudent && (
            <div className="space-y-5">
              {/* Details */}
              <div className="grid grid-cols-2 gap-3 text-sm">
                {[
                  ['Student ID', selectedStudent.studentId],
                  ['Name', selectedStudent.name],
                  ['Email', selectedStudent.email],
                  ['Programme', selectedStudent.programme || '—'],
                  ['Level', selectedStudent.level || '—'],
                  ['Faculty', selectedStudent.faculty || '—'],
                  ['Intake', selectedStudent.intake || '—'],
                  ['Gender', selectedStudent.gender || '—'],
                  ['Date of Birth', selectedStudent.dateOfBirth || '—'],
                  ['Contact Number', selectedStudent.contactNumber || '—'],
                  ['Attendance %', `${selectedStudent.attendancePercentage}%`],
                  ['GPA', selectedStudent.gpa.toFixed(2)],
                  ['Status', selectedStudent.status || '—'],
                ].map(([label, value]) => (
                  <div key={label} className="space-y-0.5">
                    <p className="text-xs text-muted-foreground">{label}</p>
                    <p className="font-medium">{value}</p>
                  </div>
                ))}
                <div className="space-y-0.5">
                  <p className="text-xs text-muted-foreground">Risk Level</p>
                  {getRiskBadge(selectedStudent.riskLevel)}
                </div>
              </div>

              {/* Interventions */}
              <div>
                <h3 className="text-sm font-semibold mb-2">Recent Interventions</h3>
                {modalLoading ? (
                  <div className="flex items-center gap-2 text-muted-foreground text-sm py-2">
                    <Loader2 className="h-3 w-3 animate-spin" /> Loading...
                  </div>
                ) : studentInterventions.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No interventions recorded.</p>
                ) : (
                  <div className="space-y-2">
                    {studentInterventions.map((i) => (
                      <div key={i.id} className="rounded-lg border px-3 py-2 text-sm">
                        <div className="flex items-center justify-between">
                          <span className="font-medium">{i.interventionType}</span>
                          <span className="text-xs text-muted-foreground">
                            {i.date || formatDate(i.createdAt)}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Outcome: {i.outcome || '—'} · By: {i.recordedBy || '—'}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Appointments */}
              <div>
                <h3 className="text-sm font-semibold mb-2">Recent Appointments</h3>
                {modalLoading ? (
                  <div className="flex items-center gap-2 text-muted-foreground text-sm py-2">
                    <Loader2 className="h-3 w-3 animate-spin" /> Loading...
                  </div>
                ) : studentAppointments.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No appointments found.</p>
                ) : (
                  <div className="space-y-2">
                    {studentAppointments.map((a) => (
                      <div key={a.id} className="rounded-lg border px-3 py-2 text-sm">
                        <div className="flex items-center justify-between">
                          <span className="font-medium">{a.type || '—'}</span>
                          {getStatusBadge(a.status)}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {a.date || '—'}{a.time ? ` · ${a.time}` : ''}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Session Notes Modal */}
      <Dialog open={sessionModalOpen} onOpenChange={setSessionModalOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Log Session Notes</DialogTitle>
            {sessionStudent && (
              <p className="text-sm text-muted-foreground">
                Recording notes for <strong>{sessionStudent.name}</strong> · {sessionStudent.studentId}
              </p>
            )}
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Session Type</Label>
              <Select value={sessionType} onValueChange={setSessionType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Academic Mentoring Session">Academic Mentoring Session</SelectItem>
                  <SelectItem value="Academic Progress Review">Academic Progress Review</SelectItem>
                  <SelectItem value="Module Support Session">Module Support Session</SelectItem>
                  <SelectItem value="Career Guidance Session">Career Guidance Session</SelectItem>
                  <SelectItem value="Welfare Check">Welfare Check</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="sessionNotes">
                Session Summary <span className="text-red-500">*</span>
              </Label>
              <Textarea
                id="sessionNotes"
                rows={4}
                placeholder="Summarise what was discussed in this session..."
                value={sessionNotes}
                onChange={(e) => setSessionNotes(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Session Outcome</Label>
              <Select value={sessionOutcome} onValueChange={setSessionOutcome}>
                <SelectTrigger>
                  <SelectValue placeholder="Select outcome..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Follow Up Required">Follow Up Required</SelectItem>
                  <SelectItem value="Resolved">Resolved</SelectItem>
                  <SelectItem value="Referred to SSA">Referred to SSA</SelectItem>
                  <SelectItem value="Referred to External Counsellor">Referred to External Counsellor</SelectItem>
                  <SelectItem value="No Action Required">No Action Required</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="nextSteps">Next Steps</Label>
              <Textarea
                id="nextSteps"
                rows={2}
                placeholder="What are the agreed next steps for this student?..."
                value={nextSteps}
                onChange={(e) => setNextSteps(e.target.value)}
              />
            </div>

            {sessionStudent && (
              <div className="bg-gray-50 rounded-lg p-3 text-xs text-gray-600 border">
                <p className="font-medium text-gray-800 mb-1">Student Context</p>
                <p>Attendance: <span className={sessionStudent.attendancePercentage < 75 ? 'text-red-600 font-medium' : 'text-green-600 font-medium'}>{sessionStudent.attendancePercentage}%</span></p>
                <p>GPA: <span className={sessionStudent.gpa < 2.5 ? 'text-amber-600 font-medium' : 'text-green-600 font-medium'}>{sessionStudent.gpa.toFixed(2)}</span></p>
                <p>Risk Level: <span className="font-medium capitalize">{sessionStudent.riskLevel}</span></p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setSessionModalOpen(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              className="bg-blue-600 hover:bg-blue-700 gap-1.5"
              disabled={!sessionNotes || sessionSubmitting}
              onClick={handleSessionSubmit}
            >
              {sessionSubmitting ? (
                <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Saving...</>
              ) : (
                'Save Session Notes'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
