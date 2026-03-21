import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router';
import { collection, onSnapshot, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
import { Textarea } from '../components/ui/textarea';
import { Users, AlertTriangle, Activity, Loader2, Search, ChevronLeft, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';

const IIT_PROGRAMMES = [
  'BSc (Hons) Business Computing',
  'BSc (Hons) Business Data Analytics',
  'BA (Hons) Business Management',
  'BEng (Hons) Software Engineering',
  'BSc (Hons) Computer Science',
  'BSc (Hons) Artificial Intelligence And Data Science',
];

const STUDY_LEVELS = ['Level 4', 'Level 5', 'Industrial Placement', 'Level 6'];

interface StudentDoc {
  id: string;
  name: string;
  studentId: string;
  email: string;
  programme: string;
  level: string;
  gpa: number;
  riskLevel: string;
  attendancePercentage: number;
  consecutiveAbsences: number;
  status: string;
  lastContact?: string;
}

const PAGE_SIZE = 10;

export default function SRUStudentsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [students, setStudents] = useState<StudentDoc[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [riskFilter, setRiskFilter] = useState('all');
  const [programmeFilter, setProgrammeFilter] = useState('all');
  const [levelFilter, setLevelFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortBy, setSortBy] = useState('risk');

  // Pagination
  const [page, setPage] = useState(1);

  // Intervention modal
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<StudentDoc | null>(null);
  const [interventionType, setInterventionType] = useState('');
  const [interventionDate, setInterventionDate] = useState(
    () => new Date().toISOString().split('T')[0]
  );
  const [interventionNotes, setInterventionNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'students'), (snap) => {
      setStudents(
        snap.docs.map((d) => ({
          id: d.id,
          name: d.data().name ?? '',
          studentId: d.data().studentId ?? d.id,
          email: d.data().email ?? '',
          programme: d.data().programme ?? d.data().program ?? 'Unknown',
          level: d.data().level ?? '',
          gpa: d.data().gpa ?? 0,
          riskLevel: d.data().riskLevel ?? 'low',
          attendancePercentage: d.data().attendancePercentage ?? 100,
          consecutiveAbsences: d.data().consecutiveAbsences ?? 0,
          status: d.data().status ?? 'active',
          lastContact: d.data().lastContact ?? '',
        }))
      );
      setLoading(false);
    });
    return () => unsub();
  }, []);

  // Summary counts
  const totalStudents = students.length;
  const highRisk = students.filter((s) => s.riskLevel === 'high').length;
  const mediumRisk = students.filter((s) => s.riskLevel === 'medium').length;
  const lowAttendance = students.filter((s) => s.attendancePercentage < 80).length;

  // Filtered list
  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return students.filter((s) => {
      const matchesSearch =
        !q ||
        s.name.toLowerCase().includes(q) ||
        s.studentId.toLowerCase().includes(q) ||
        s.email.toLowerCase().includes(q);
      const matchesRisk = riskFilter === 'all' || s.riskLevel === riskFilter;
      const matchesProgramme =
        programmeFilter === 'all' || s.programme === programmeFilter;
      const matchesLevel = levelFilter === 'all' || s.level === levelFilter;
      const matchesStatus = statusFilter === 'all' || s.status === statusFilter;
      return matchesSearch && matchesRisk && matchesProgramme && matchesLevel && matchesStatus;
    }).sort((a, b) => {
      if (sortBy === 'name') return a.name.localeCompare(b.name);
      if (sortBy === 'attendance') return a.attendancePercentage - b.attendancePercentage;
      if (sortBy === 'gpa') return a.gpa - b.gpa;
      // Default: sort by risk (high first)
      const order = { high: 0, medium: 1, low: 2 };
      return (order[a.riskLevel as keyof typeof order] ?? 2) - (order[b.riskLevel as keyof typeof order] ?? 2);
    });
  }, [students, search, riskFilter, programmeFilter, levelFilter, statusFilter, sortBy]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // Reset to page 1 on filter change
  useEffect(() => {
    setPage(1);
  }, [search, riskFilter, programmeFilter, levelFilter, statusFilter, sortBy]);

  const openIntervention = (student: StudentDoc) => {
    setSelectedStudent(student);
    setInterventionType('');
    setInterventionDate(new Date().toISOString().split('T')[0]);
    setInterventionNotes('');
    setModalOpen(true);
  };

  const handleSubmitIntervention = async () => {
    if (!selectedStudent || !interventionType) {
      toast.error('Please select an intervention type');
      return;
    }
    setSubmitting(true);
    try {
      await addDoc(collection(db, 'interventions'), {
        studentId: selectedStudent.id,
        studentName: selectedStudent.name,
        programme: selectedStudent.programme,
        riskLevel: selectedStudent.riskLevel,
        interventionType,
        type: interventionType,
        date: interventionDate,
        notes: interventionNotes.trim(),
        recordedBy: user?.name ?? 'Student Support Advisor',
        createdAt: serverTimestamp(),
      });
      toast.success('Intervention logged successfully');
      setModalOpen(false);
    } catch {
      toast.error('Failed to log intervention. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const getRiskBadge = (level: string) => {
    switch (level) {
      case 'high':
        return (
          <Badge className="bg-red-100 text-red-800 border-red-200 text-xs">
            High
          </Badge>
        );
      case 'medium':
        return (
          <Badge className="bg-amber-100 text-amber-800 border-amber-200 text-xs">
            Medium
          </Badge>
        );
      default:
        return (
          <Badge className="bg-green-100 text-green-800 border-green-200 text-xs">
            Low
          </Badge>
        );
    }
  };

  const getAttendanceColor = (pct: number) => {
    if (pct < 80) return 'text-red-600 font-semibold';
    if (pct <= 85) return 'text-amber-600 font-semibold';
    return 'text-green-600 font-semibold';
  };

  const getGpaColor = (gpa: number) => {
    if (gpa < 2.0) return 'text-red-600 font-semibold';
    if (gpa <= 2.5) return 'text-amber-600 font-semibold';
    return 'text-green-600 font-semibold';
  };

  const getInitials = (name: string) =>
    name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Students</h1>
        <p className="text-muted-foreground">Monitor and manage at-risk students</p>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="border-l-4 border-l-blue-500">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Students
            </CardTitle>
            <div className="h-9 w-9 rounded-full bg-blue-100 flex items-center justify-center">
              <Users className="h-5 w-5 text-blue-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold text-blue-600">{totalStudents}</div>
            <p className="text-xs text-muted-foreground mt-1">Enrolled students</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-red-500">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              High Risk
            </CardTitle>
            <div className="h-9 w-9 rounded-full bg-red-100 flex items-center justify-center">
              <AlertTriangle className="h-5 w-5 text-red-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold text-red-600">{highRisk}</div>
            <p className="text-xs text-muted-foreground mt-1">Require immediate attention</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-amber-500">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Medium Risk
            </CardTitle>
            <div className="h-9 w-9 rounded-full bg-amber-100 flex items-center justify-center">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold text-amber-600">{mediumRisk}</div>
            <p className="text-xs text-muted-foreground mt-1">Under monitoring</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-orange-500">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Low Attendance
            </CardTitle>
            <div className="h-9 w-9 rounded-full bg-orange-100 flex items-center justify-center">
              <Activity className="h-5 w-5 text-orange-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold text-orange-600">{lowAttendance}</div>
            <p className="text-xs text-muted-foreground mt-1">Below 80% attendance</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-col sm:flex-row gap-3 flex-wrap">
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
              <SelectTrigger className="w-full sm:w-[150px]">
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
              <SelectTrigger className="w-full sm:w-[220px]">
                <SelectValue placeholder="Programme" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Programmes</SelectItem>
                {IIT_PROGRAMMES.map((p) => (
                  <SelectItem key={p} value={p}>
                    {p}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={levelFilter} onValueChange={setLevelFilter}>
              <SelectTrigger className="w-full sm:w-[200px]">
                <SelectValue placeholder="Level" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Levels</SelectItem>
                {STUDY_LEVELS.map((l) => (
                  <SelectItem key={l} value={l}>
                    {l}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-[130px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="risk">Sort: Risk ↓</SelectItem>
                <SelectItem value="name">Sort: Name A–Z</SelectItem>
                <SelectItem value="attendance">Sort: Attendance ↑</SelectItem>
                <SelectItem value="gpa">Sort: GPA ↑</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Student List */}
      <div className="space-y-3">
        {paginated.length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center text-muted-foreground text-sm">
              <Users className="h-12 w-12 mx-auto mb-3 opacity-40" />
              No students match your filters.
            </CardContent>
          </Card>
        ) : (
          paginated.map((student) => (
            <Card key={student.id} className="hover:shadow-sm transition-shadow">
              <CardContent className="py-4 px-5">
                <div className="flex items-center gap-4 flex-wrap">
                  {/* Avatar */}
                  <div className="h-10 w-10 rounded-full bg-blue-600 flex items-center justify-center flex-shrink-0">
                    <span className="text-white text-sm font-semibold">
                      {getInitials(student.name)}
                    </span>
                  </div>

                  {/* Name + ID + Email */}
                  <div className="flex-1 min-w-[160px]">
                    <p className="font-semibold text-sm">{student.name}</p>
                    <p className="text-xs text-muted-foreground">{student.studentId}</p>
                    <p className="text-xs text-muted-foreground">{student.email}</p>
                  </div>

                  {/* Programme + Level */}
                  <div className="flex-1 min-w-[160px]">
                    <p className="text-xs font-medium truncate max-w-[200px]">
                      {student.programme}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {student.level || '—'}
                    </p>
                  </div>

                  {/* Attendance */}
                  <div className="text-center min-w-[80px]">
                    <p className={`text-lg font-bold ${getAttendanceColor(student.attendancePercentage)}`}>
                      {student.attendancePercentage}%
                    </p>
                    <p className="text-xs text-muted-foreground">Attendance</p>
                  </div>

                  {/* GPA */}
                  <div className="text-center min-w-[60px]">
                    <p className={`text-lg font-bold ${getGpaColor(student.gpa)}`}>
                      {student.gpa.toFixed(2)}
                    </p>
                    <p className="text-xs text-muted-foreground">GPA</p>
                  </div>

                  {/* Consecutive absences */}
                  <div className="text-center min-w-[70px]">
                    <p
                      className={`text-lg font-bold ${
                        student.consecutiveAbsences >= 3
                          ? 'text-red-600'
                          : 'text-foreground'
                      }`}
                    >
                      {student.consecutiveAbsences}
                    </p>
                    <p className="text-xs text-muted-foreground">Absences</p>
                  </div>

                  {/* Risk score + badge */}
                  <div className="text-center min-w-[70px]">
                    <p className={`text-lg font-bold ${
                      student.riskLevel === 'high' ? 'text-red-600' :
                      student.riskLevel === 'medium' ? 'text-amber-600' : 'text-green-600'
                    }`}>
                      {student.riskLevel === 'high' ? '75+' : student.riskLevel === 'medium' ? '40-74' : '<40'}
                    </p>
                    {getRiskBadge(student.riskLevel)}
                    <p className="text-xs text-muted-foreground mt-1">Risk</p>
                  </div>

                  {/* Last Contact */}
                  <div className="text-center min-w-[90px]">
                    <p className="text-sm text-muted-foreground">
                      {student.lastContact || 'Never'}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">Last Contact</p>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 flex-shrink-0">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        navigate(`/sru/students/${student.id}`)
                      }
                    >
                      View Profile
                    </Button>
                    <Button
                      size="sm"
                      className="bg-teal-600 hover:bg-teal-700 text-white"
                      onClick={() => openIntervention(student)}
                    >
                      Log Intervention
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {(page - 1) * PAGE_SIZE + 1}–
            {Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length}{' '}
            students
          </p>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={page === 1}
              onClick={() => setPage((p) => p - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="flex items-center text-sm px-2">
              Page {page} of {totalPages}
            </span>
            <Button
              size="sm"
              variant="outline"
              disabled={page === totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Log Intervention Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Log Intervention</DialogTitle>
            {selectedStudent && (
              <p className="text-sm text-muted-foreground">
                {selectedStudent.name} — {selectedStudent.studentId}
              </p>
            )}
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="intType">
                Intervention Type <span className="text-red-500">*</span>
              </Label>
              <Select value={interventionType} onValueChange={setInterventionType}>
                <SelectTrigger id="intType">
                  <SelectValue placeholder="— Select type —" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Phone Call">Phone Call</SelectItem>
                  <SelectItem value="Email">Email</SelectItem>
                  <SelectItem value="In-Person Meeting">In-Person Meeting</SelectItem>
                  <SelectItem value="Referred to Registry">Referred to Registry</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="intDate">Date</Label>
              <Input
                id="intDate"
                type="date"
                value={interventionDate}
                onChange={(e) => setInterventionDate(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="intNotes">Notes</Label>
              <Textarea
                id="intNotes"
                rows={3}
                placeholder="Optional notes about this intervention..."
                value={interventionNotes}
                onChange={(e) => setInterventionNotes(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button size="sm" variant="outline" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" disabled={submitting} onClick={handleSubmitIntervention}>
              {submitting ? 'Saving…' : 'Submit'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
