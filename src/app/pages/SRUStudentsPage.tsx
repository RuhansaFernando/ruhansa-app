import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router';
import { collection, onSnapshot, addDoc, serverTimestamp, updateDoc, doc } from 'firebase/firestore';
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
import { Users, AlertTriangle, CheckCircle, Loader2, Search } from 'lucide-react';
import { toast } from 'sonner';


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
  faculty: string;
}

export default function SRUStudentsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [students, setStudents] = useState<StudentDoc[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [facultyFilter, setFacultyFilter] = useState('all');
  const [programmeFilter, setProgrammeFilter] = useState('all');
  const [levelFilter, setLevelFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortBy, setSortBy] = useState('name_asc');

  // Intervention modal
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<StudentDoc | null>(null);
  const [interventionType, setInterventionType] = useState('');
  const [interventionDate, setInterventionDate] = useState(
    () => new Date().toISOString().split('T')[0]
  );
  const [interventionNotes, setInterventionNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [quickIsWarning, setQuickIsWarning] = useState(false);
  const [quickCaseStatus, setQuickCaseStatus] = useState<'open' | 'in_progress' | 'closed'>('open');
  const [quickOutcome, setQuickOutcome] = useState('');
  const [quickFollowUpDate, setQuickFollowUpDate] = useState('');
  const [quickPriority, setQuickPriority] = useState('medium');

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
          faculty: d.data().faculty ?? '',
        }))
      );
      setLoading(false);
    });
    return () => unsub();
  }, []);

  // Dynamic filter lists derived from loaded students
  const faculties = useMemo(() => {
    const set = new Set(students.map(s => s.faculty).filter(Boolean));
    return Array.from(set).sort();
  }, [students]);
  const programmes = useMemo(() => {
    const base = facultyFilter === 'all' ? students : students.filter(s => s.faculty === facultyFilter);
    const set = new Set(base.map(s => s.programme).filter(Boolean));
    return Array.from(set).sort();
  }, [students, facultyFilter]);
  const levels = useMemo(() => [...new Set(students.map(s => s.level).filter(Boolean))].sort(), [students]);

  // Summary counts
  const ML_CONNECTED  = !!(import.meta.env.VITE_ML_API_URL);
  const totalStudents = students.length;
  const highRisk      = ML_CONNECTED
    ? students.filter((s) => s.riskLevel === 'high' || s.riskLevel === 'critical').length
    : 0;
  const mediumRisk    = ML_CONNECTED
    ? students.filter((s) => s.riskLevel === 'medium').length
    : 0;
  const lowRisk       = ML_CONNECTED
    ? students.filter((s) => s.riskLevel === 'low').length
    : 0;

  // Filtered list
  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    const riskOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
    return students.filter((s) => {
      const matchesSearch =
        !q ||
        s.name.toLowerCase().includes(q) ||
        s.studentId.toLowerCase().includes(q) ||
        s.email.toLowerCase().includes(q);
      const matchesFaculty = facultyFilter === 'all' || s.faculty === facultyFilter;
      const matchesProgramme = programmeFilter === 'all' || s.programme === programmeFilter;
      const matchesLevel = levelFilter === 'all' || s.level === levelFilter;
      const matchesStatus = statusFilter === 'all' || s.status === statusFilter;
      return matchesSearch && matchesFaculty && matchesProgramme && matchesLevel && matchesStatus;
    }).sort((a, b) => {
      if (sortBy === 'name_asc') return a.name.localeCompare(b.name);
      if (sortBy === 'name_desc') return b.name.localeCompare(a.name);
      if (sortBy === 'gpa_asc') return a.gpa - b.gpa;
      if (sortBy === 'gpa_desc') return b.gpa - a.gpa;
      if (sortBy === 'risk') return (riskOrder[a.riskLevel] ?? 3) - (riskOrder[b.riskLevel] ?? 3);
      if (sortBy === 'last_contact') return (a.lastContact ?? '').localeCompare(b.lastContact ?? '');
      return a.name.localeCompare(b.name);
    });
  }, [students, search, facultyFilter, programmeFilter, levelFilter, statusFilter, sortBy]);

  const openIntervention = (student: StudentDoc) => {
    setSelectedStudent(student);
    setInterventionType('');
    setInterventionDate(new Date().toISOString().split('T')[0]);
    setInterventionNotes('');
    setQuickIsWarning(false);
    setQuickCaseStatus('open');
    setQuickOutcome('');
    setQuickFollowUpDate('');
    setQuickPriority('medium');
    setModalOpen(true);
  };

  const handleSubmitIntervention = async () => {
    if (!selectedStudent || !interventionType) {
      toast.error('Please select an intervention type');
      return;
    }
    if (!quickOutcome) {
      toast.error('Please select an outcome');
      return;
    }
    setSubmitting(true);
    try {
      await addDoc(collection(db, 'interventions'), {
        studentId: selectedStudent.studentId,
        studentName: selectedStudent.name,
        programme: selectedStudent.programme,
        interventionType,
        type: interventionType,
        date: interventionDate,
        notes: interventionNotes.trim(),
        recordedBy: user?.name ?? 'Student Support Advisor',
        caseStatus: quickCaseStatus,
        isAcademicWarning: quickIsWarning ?? false,
        outcome: quickOutcome,
        followUpDate: quickFollowUpDate || null,
        priority: quickPriority,
        attendanceBefore: selectedStudent?.attendancePercentage ?? 0,
        gpaBefore: selectedStudent?.gpa ?? 0,
        createdAt: serverTimestamp(),
      });
      await updateDoc(doc(db, 'students', selectedStudent.id), {
        lastContact: interventionDate,
      });
      toast.success('Intervention logged successfully');
      setModalOpen(false);
    } catch {
      toast.error('Failed to log intervention. Please try again.');
    } finally {
      setSubmitting(false);
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
            <p className="text-xs text-muted-foreground mt-1">{ML_CONNECTED ? 'From ML model' : 'ML not connected yet'}</p>
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
            <p className="text-xs text-muted-foreground mt-1">{ML_CONNECTED ? 'From ML model' : 'ML not connected yet'}</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-green-500">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Low Risk
            </CardTitle>
            <div className="h-9 w-9 rounded-full bg-green-100 flex items-center justify-center">
              <CheckCircle className="h-5 w-5 text-green-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold text-green-600">{lowRisk}</div>
            <p className="text-xs text-muted-foreground mt-1">{ML_CONNECTED ? 'From ML model' : 'ML not connected yet'}</p>
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
            <Select value={facultyFilter} onValueChange={(v) => { setFacultyFilter(v); setProgrammeFilter('all'); }}>
              <SelectTrigger className="w-full sm:w-[160px]">
                <SelectValue placeholder="All Faculties" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Faculties</SelectItem>
                {faculties.map((f) => (
                  <SelectItem key={f} value={f}>{f}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={programmeFilter} onValueChange={setProgrammeFilter}>
              <SelectTrigger className="w-full sm:w-[220px]">
                <SelectValue placeholder="Programme" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Programmes</SelectItem>
                {programmes.map((p) => (
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
                {levels.map((l) => (
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
              <SelectTrigger className="w-full sm:w-[200px]">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="name_asc">Name A–Z</SelectItem>
                <SelectItem value="name_desc">Name Z–A</SelectItem>
                <SelectItem value="gpa_asc">GPA ↑ (lowest first)</SelectItem>
                <SelectItem value="gpa_desc">GPA ↓ (highest first)</SelectItem>
                <SelectItem value="risk">Risk Level (high first)</SelectItem>
                <SelectItem value="last_contact">Last Contact (oldest first)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Student List */}
      <div className="space-y-3">
        {filtered.length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center text-muted-foreground text-sm">
              <Users className="h-12 w-12 mx-auto mb-3 opacity-40" />
              No students match your filters.
            </CardContent>
          </Card>
        ) : (
          filtered.map((student) => (
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

                  {/* Stats: GPA / Risk Level / Last Contact */}
                  <div className="flex items-center gap-8">
                    <div className="text-center min-w-[60px]">
                      {student.gpa === 0 ? (
                        <p className="text-lg font-semibold text-muted-foreground">—</p>
                      ) : (
                        <p className={`text-lg font-semibold ${
                          student.gpa >= 2.5 ? 'text-green-600'
                          : student.gpa >= 1.5 ? 'text-amber-600'
                          : 'text-red-600'
                        }`}>
                          {student.gpa.toFixed(2)}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground">GPA</p>
                    </div>

                    <div className="text-center min-w-[90px]">
                      {ML_CONNECTED && student.riskLevel ? (
                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          student.riskLevel === 'high' || student.riskLevel === 'critical'
                            ? 'bg-red-100 text-red-700'
                            : student.riskLevel === 'medium'
                            ? 'bg-amber-100 text-amber-700'
                            : 'bg-green-100 text-green-700'
                        }`}>
                          {student.riskLevel.charAt(0).toUpperCase() + student.riskLevel.slice(1)} Risk
                        </span>
                      ) : (
                        <span className="text-sm text-muted-foreground">—</span>
                      )}
                      <p className="text-xs text-muted-foreground mt-0.5">Risk Level</p>
                    </div>

                    <div className="text-center min-w-[80px]">
                      <p className="text-sm text-muted-foreground">{student.lastContact || 'Never'}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">Last Contact</p>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 flex-shrink-0">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        navigate(`/sru/students/${student.studentId}`)
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

      {/* Log Intervention Modal */}
      <Dialog open={modalOpen} onOpenChange={(open) => { setModalOpen(open); if (!open) { setQuickIsWarning(false); setQuickCaseStatus('open'); setQuickOutcome(''); setQuickFollowUpDate(''); setQuickPriority('medium'); } }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Log Intervention</DialogTitle>
            {selectedStudent && (
              <p className="text-sm text-muted-foreground">
                {selectedStudent.name} — {selectedStudent.studentId}
              </p>
            )}
          </DialogHeader>

          <div className="space-y-3">
            {/* Row 1: Type + Case Status */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="intType">
                  Intervention Type <span className="text-red-500">*</span>
                </Label>
                <Select value={interventionType} onValueChange={setInterventionType}>
                  <SelectTrigger id="intType">
                    <SelectValue placeholder="— Select type —" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Phone Call">Phone Call</SelectItem>
                    <SelectItem value="Text Message">Text Message</SelectItem>
                    <SelectItem value="Email">Email</SelectItem>
                    <SelectItem value="Online Meeting">Online Meeting</SelectItem>
                    <SelectItem value="In-Person Meeting">In-Person Meeting</SelectItem>
                    <SelectItem value="Referral">Referral</SelectItem>
                    <SelectItem value="Formal Notice">Formal Notice</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="quickCaseStatus">Case Status</Label>
                <Select value={quickCaseStatus} onValueChange={(v) => setQuickCaseStatus(v as 'open' | 'in_progress' | 'closed')}>
                  <SelectTrigger id="quickCaseStatus">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="open">Open</SelectItem>
                    <SelectItem value="in_progress">In Progress</SelectItem>
                    <SelectItem value="closed">Closed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Row 2: Date + Outcome */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="intDate">Date</Label>
                <Input
                  id="intDate"
                  type="date"
                  value={interventionDate}
                  onChange={(e) => setInterventionDate(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="quickOutcome">
                  Outcome <span className="text-red-500">*</span>
                </Label>
                <Select value={quickOutcome} onValueChange={setQuickOutcome}>
                  <SelectTrigger id="quickOutcome">
                    <SelectValue placeholder="— Select outcome —" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Positive Response">Positive Response</SelectItem>
                    <SelectItem value="No Response">No Response</SelectItem>
                    <SelectItem value="Follow Up Required">Follow Up Required</SelectItem>
                    <SelectItem value="Resolved">Resolved</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Row 2b: Priority */}
            <div className="space-y-1.5">
              <Label>Priority</Label>
              <Select value={quickPriority} onValueChange={setQuickPriority}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="urgent">🔴 Urgent</SelectItem>
                  <SelectItem value="high">🟠 High</SelectItem>
                  <SelectItem value="medium">🟡 Medium</SelectItem>
                  <SelectItem value="low">🟢 Low</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Row 3: Notes (full width) */}
            <div className="space-y-1">
              <Label htmlFor="intNotes">Notes</Label>
              <Textarea
                id="intNotes"
                rows={3}
                placeholder="Optional notes about this intervention..."
                value={interventionNotes}
                onChange={(e) => setInterventionNotes(e.target.value)}
              />
            </div>

            {/* Row 4: Follow-up Date + Academic Warning */}
            <div className="grid grid-cols-2 gap-3 items-end">
              <div className="space-y-1">
                <Label htmlFor="quickFollowUpDate">Follow-up Date (optional)</Label>
                <Input
                  id="quickFollowUpDate"
                  type="date"
                  value={quickFollowUpDate}
                  onChange={(e) => setQuickFollowUpDate(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                />
              </div>
              <div className="flex items-center gap-2 pb-1">
                <input
                  type="checkbox"
                  id="quickWarning"
                  checked={quickIsWarning ?? false}
                  onChange={e => setQuickIsWarning(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300"
                />
                <label htmlFor="quickWarning" className="text-sm text-red-600 font-medium">
                  Mark as Formal Academic Warning
                </label>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button size="sm" variant="outline" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white" disabled={submitting} onClick={handleSubmitIntervention}>
              {submitting ? 'Saving…' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
