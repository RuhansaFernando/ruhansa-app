import { useState, useEffect, useMemo } from 'react';
import { collection, getDocs, query, orderBy, where, addDoc, serverTimestamp } from 'firebase/firestore';
import { CALENDAR_LINKS } from '../config/calendarLinks';
import { db } from '../../firebase';
import { useAuth } from '../AuthContext';
import { Card, CardContent } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '../components/ui/dialog';
import { Search, Loader2, AlertTriangle } from 'lucide-react';
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
  riskScore: number;
  academicMentor: string;
  status: string;
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

const getRiskBadge = (riskLevel: string, riskScore: number) => {
  if (!riskScore) return <Badge className="bg-gray-100 text-gray-500 border-gray-200 text-xs">Pending</Badge>;
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

export default function MentorStudentsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [students, setStudents] = useState<StudentDoc[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState('');
  const [riskFilter, setRiskFilter] = useState('all');
  const [programmeFilter, setProgrammeFilter] = useState('all');

  const [selectedStudent, setSelectedStudent] = useState<StudentDoc | null>(null);
  const [studentAppointments, setStudentAppointments] = useState<AppointmentDoc[]>([]);
  const [modalLoading, setModalLoading] = useState(false);
  const [calendarLink, setCalendarLink] = useState('');

  useEffect(() => {
    const fetchStudents = async () => {
      setLoading(true);
      const mentorName = user?.name ?? '';
      if (!mentorName) { setStudents([]); setLoading(false); return; }

      const mapStudentFields = (d: any): Omit<StudentDoc, 'id'> => {
        const data = d.data();
        return {
          studentId: data.studentId ?? d.id,
          name: data.name ?? '',
          email: data.email ?? '',
          programme: data.programme ?? '',
          level: data.level ?? '',
          faculty: data.faculty ?? '',
          intake: data.intake ?? '',
          gender: data.gender ?? '',
          dateOfBirth: data.dateOfBirth ?? '',
          contactNumber: data.contactNumber ?? '',
          attendancePercentage: data.attendancePercentage ?? 100,
          consecutiveAbsences: data.consecutiveAbsences ?? 0,
          gpa: data.gpa ?? 0,
          riskLevel: data.riskLevel ?? 'low',
          riskScore: data.riskScore ?? 0,
          academicMentor: data.academicMentor ?? '',
          status: data.status ?? 'active',
        };
      };

      try {
        const snap = await getDocs(collection(db, 'students'));
        const allStudents = snap.docs.map(d => ({ id: d.id, ...mapStudentFields(d) }));
        const mentorStudents = allStudents.filter(s =>
          s.academicMentor?.trim().toLowerCase() === mentorName.trim().toLowerCase()
        );
        setStudents(mentorStudents);

        try {
          const mentorSnap = await getDocs(query(collection(db, 'academic_mentors'), where('email', '==', user?.email ?? '')));
          if (!mentorSnap.empty) setCalendarLink(mentorSnap.docs[0].data().calendarLink ?? '');
        } catch {}
      } finally {
        setLoading(false);
      }
    };
    fetchStudents();
  }, [user?.name]);

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

  const handleBookAppointment = async (student: StudentDoc) => {
    const link = calendarLink || CALENDAR_LINKS.mentor;
    window.open(link, '_blank');

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

  const openProfile = async (student: StudentDoc) => {
    setSelectedStudent(student);
    setModalLoading(true);
    try {
      const apptSnap = await getDocs(query(collection(db, 'appointments'), orderBy('date', 'desc')));

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
                    <td className="px-4 py-3">{getRiskBadge(s.riskLevel, s.riskScore)}</td>
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
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base">Student Profile</DialogTitle>
          </DialogHeader>
          {selectedStudent && (
            <div className="space-y-5">
              {/* Details */}
              <div className="grid grid-cols-2 gap-3 text-sm">
                {/* Full-width email row */}
                <div className="col-span-2 space-y-0.5 min-w-0">
                  <p className="text-xs text-muted-foreground">Email</p>
                  <p className="font-medium break-all">{selectedStudent.email}</p>
                </div>
                {[
                  ['Student ID', selectedStudent.studentId],
                  ['Name', selectedStudent.name],
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
                  <div key={label} className="space-y-0.5 min-w-0">
                    <p className="text-xs text-muted-foreground">{label}</p>
                    <p className="font-medium truncate">{value}</p>
                  </div>
                ))}
                <div className="space-y-0.5">
                  <p className="text-xs text-muted-foreground">Consecutive Absences</p>
                  <Badge className={
                    selectedStudent.consecutiveAbsences > 2
                      ? 'bg-red-100 text-red-800 border-red-200 text-xs'
                      : selectedStudent.consecutiveAbsences > 0
                      ? 'bg-amber-100 text-amber-800 border-amber-200 text-xs'
                      : 'bg-green-100 text-green-800 border-green-200 text-xs'
                  }>
                    {selectedStudent.consecutiveAbsences}
                  </Badge>
                </div>
                <div className="space-y-0.5">
                  <p className="text-xs text-muted-foreground">Risk Level</p>
                  {getRiskBadge(selectedStudent.riskLevel, selectedStudent.riskScore)}
                </div>
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

    </div>
  );
}
