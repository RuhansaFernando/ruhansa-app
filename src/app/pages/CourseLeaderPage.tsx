import { useState, useEffect, useMemo } from 'react';
import {
  collection, doc, addDoc, serverTimestamp,
  onSnapshot, query, orderBy, limit, where, writeBatch, getDocs, updateDoc,
} from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../AuthContext';
import { sendMentorAssignmentEmail } from '../services/emailService';
import { CALENDAR_LINKS } from '../config/calendarLinks';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog';
import { Users, CheckCircle, Loader2, GraduationCap, AlertTriangle, History, Shuffle, UserPlus, UserX } from 'lucide-react';
import { toast } from 'sonner';

const LEVEL_TO_YEAR: Record<string, string> = {
  '1st Year': 'Year 1', '2nd Year': 'Year 2', '3rd Year': 'Year 3', '4th Year': 'Year 4',
  'Year 1': 'Year 1', 'Year 2': 'Year 2', 'Year 3': 'Year 3', 'Year 4': 'Year 4',
  'Level 4': 'Year 1', 'Level 5': 'Year 2', 'Level 6': 'Year 3', 'Level 7': 'Year 4',
};

interface Student {
  id: string;
  name: string;
  email: string;
  studentId: string;
  programme: string;
  level: string;
  academicMentor: string;
  riskLevel: string;
}

interface Mentor {
  id: string;
  name: string;
  email: string;
  department: string;
}

interface GeneratedGroup {
  mentor: Mentor;
  students: Student[];
  confirmed: boolean;
}

interface AssignmentHistory {
  id: string;
  programme: string;
  level: string;
  mentorName: string;
  studentCount: number;
  assignedBy: string;
  createdAt: any;
}

export default function CourseLeaderPage() {
  const { user } = useAuth();

  // Programme Leader profile
  const [clProgramme, setClProgramme] = useState('');
  const [clFaculty, setClFaculty] = useState('');
  const [clProfileLoading, setClProfileLoading] = useState(true);

  // Year filter for assignment view
  const [yearFilter, setYearFilter] = useState('all');

  // Data
  const [students, setStudents] = useState<Student[]>([]);
  const [mentors, setMentors] = useState<Mentor[]>([]);
  const [history, setHistory] = useState<AssignmentHistory[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(true);
  const [loadingMentors, setLoadingMentors] = useState(true);

  // Auto-group state
  const [generatedGroups, setGeneratedGroups] = useState<GeneratedGroup[]>([]);
  const [confirmingGroup, setConfirmingGroup] = useState<Record<number, boolean>>({});
  const [confirmingAll, setConfirmingAll] = useState(false);

  // Manual assignment state
  const [manualStudentId, setManualStudentId] = useState('');
  const [manualMentorId, setManualMentorId] = useState('');
  const [assigningManual, setAssigningManual] = useState(false);

  // Reassign/Unassign state
  const [reassignModal, setReassignModal] = useState<{ student: Student; newMentorId: string } | null>(null);
  const [reassigning, setReassigning] = useState(false);
  const [unassigningId, setUnassigningId] = useState<string | null>(null);

  // Fetch Programme Leader's own programme and its faculty
  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const snap = await getDocs(collection(db, 'course_leaders'));
        for (const d of snap.docs) {
          const data = d.data();
          if (data.email?.toLowerCase().trim() === user?.email?.toLowerCase().trim()) {
            const prog = data.programme ?? '';
            setClProgramme(prog);
            if (prog) {
              const progSnap = await getDocs(query(collection(db, 'programmes'), where('programmeName', '==', prog)));
              setClFaculty(progSnap.empty ? '' : progSnap.docs[0].data().faculty ?? '');
            }
            break;
          }
        }
      } catch (e) {
        console.error('Profile fetch error:', e);
      } finally {
        setClProfileLoading(false);
      }
    };
    if (user?.email) fetchProfile();
  }, [user?.email]);

  // Real-time students listener — scoped to this PL's programme once profile loads
  useEffect(() => {
    if (clProfileLoading) return;
    setLoadingStudents(true);
    const q = clProgramme
      ? query(collection(db, 'students'), where('programme', '==', clProgramme))
      : collection(db, 'students');
    const unsub = onSnapshot(q, (snap) => {
      setStudents(snap.docs.map(d => ({
        id: d.id,
        name: d.data().name ?? '',
        email: d.data().email ?? '',
        studentId: d.data().studentId ?? d.id,
        programme: d.data().programme ?? '',
        level: d.data().level ?? '',
        academicMentor: d.data().academicMentor ?? '',
        riskLevel: d.data().riskLevel ?? 'low',
      })));
      setLoadingStudents(false);
    });
    return () => unsub();
  }, [clProfileLoading, clProgramme]);

  // Real-time mentors listener — filtered by faculty once profile is loaded
  useEffect(() => {
    if (clProfileLoading) return;
    setLoadingMentors(true);
    const toMentor = (d: any): Mentor => ({
      id: d.id,
      name: d.data().name ?? '',
      email: d.data().email ?? '',
      department: d.data().department ?? '',
    });
    const byFaculty = (list: Mentor[]) =>
      clFaculty ? list.filter(m => m.department === clFaculty) : list;

    const unsub = onSnapshot(
      query(collection(db, 'academic_mentors'), where('status', '==', 'active')),
      (snap) => {
        setMentors(byFaculty(snap.docs.map(toMentor)));
        setLoadingMentors(false);
      },
      () => {
        onSnapshot(collection(db, 'academic_mentors'), (snap) => {
          setMentors(byFaculty(snap.docs.map(toMentor)));
          setLoadingMentors(false);
        });
      }
    );
    return () => unsub();
  }, [clProfileLoading, clFaculty]);

  // Real-time assignment history
  useEffect(() => {
    const unsub = onSnapshot(
      query(collection(db, 'mentorAssignmentHistory'), orderBy('createdAt', 'desc'), limit(10)),
      (snap) => {
        setHistory(snap.docs.map(d => ({
          id: d.id,
          programme: d.data().programme ?? '',
          level: d.data().level ?? '',
          mentorName: d.data().mentorName ?? '',
          studentCount: d.data().studentCount ?? 0,
          assignedBy: d.data().assignedBy ?? '',
          createdAt: d.data().createdAt ?? null,
        })));
      }
    );
    return () => unsub();
  }, []);

  // students are already scoped to clProgramme by the Firestore query
  const myStudents = clProgramme ? students : [];

  // Students further filtered by year selection
  const filteredStudents = useMemo(() => {
    if (yearFilter === 'all') return myStudents;
    return myStudents.filter(s => (LEVEL_TO_YEAR[s.level] ?? s.level) === yearFilter);
  }, [myStudents, yearFilter]);

  const assignedCount = myStudents.filter(s => s.academicMentor).length;
  const unassignedCount = myStudents.length - assignedCount;

  const autoGenerateLabel = yearFilter === 'all'
    ? 'Auto-Assign Mentors for All Years'
    : `Auto-Assign Mentors for ${yearFilter}`;

  const handleAutoGenerate = () => {
    if (mentors.length === 0) {
      toast.error('No mentors available.');
      return;
    }
    if (filteredStudents.length === 0) {
      toast.error('No students to assign.');
      return;
    }

    const shuffled = [...filteredStudents].sort(() => Math.random() - 0.5);
    const groups: GeneratedGroup[] = mentors.map((mentor) => ({
      mentor,
      students: [],
      confirmed: false,
    }));
    shuffled.forEach((student, i) => {
      groups[i % mentors.length].students.push(student);
    });
    setGeneratedGroups(groups.filter(g => g.students.length > 0));
    setConfirmingGroup({});
  };

  const handleChangeMentor = (groupIndex: number, mentorName: string) => {
    const mentor = mentors.find(m => m.name === mentorName);
    if (!mentor) return;
    setGeneratedGroups(prev => prev.map((g, i) =>
      i === groupIndex ? { ...g, mentor } : g
    ));
  };

  const confirmGroup = async (groupIndex: number) => {
    const group = generatedGroups[groupIndex];
    if (!group || group.students.length === 0) return;

    setConfirmingGroup(prev => ({ ...prev, [groupIndex]: true }));
    try {
      const batch = writeBatch(db);
      group.students.forEach(s => {
        batch.update(doc(db, 'students', s.id), { academicMentor: group.mentor.name });
      });
      await batch.commit();

      await addDoc(collection(db, 'mentorAssignmentHistory'), {
        programme: clProgramme,
        level: yearFilter === 'all' ? 'All Years' : yearFilter,
        mentorName: group.mentor.name,
        studentCount: group.students.length,
        studentNames: group.students.map(s => s.name),
        assignedBy: user?.name ?? 'Programme Leader',
        createdAt: serverTimestamp(),
      });

      let mentorCalLink = CALENDAR_LINKS.mentor;
      try {
        const mentorCalSnap = await getDocs(query(collection(db, 'academic_mentors'), where('name', '==', group.mentor.name)));
        if (!mentorCalSnap.empty) mentorCalLink = mentorCalSnap.docs[0].data().calendarLink ?? CALENDAR_LINKS.mentor;
      } catch {}

      for (const student of group.students) {
        await sendMentorAssignmentEmail({
          student_name: student.name,
          student_email: student.email,
          mentor_name: group.mentor.name,
          mentor_department: group.mentor.department ?? 'Academic Department',
          mentor_calendar_link: mentorCalLink,
        });
      }

      setGeneratedGroups(prev => prev.map((g, i) =>
        i === groupIndex ? { ...g, confirmed: true } : g
      ));
      toast.success(`${group.students.length} students assigned to ${group.mentor.name}`);
    } catch {
      toast.error('Failed to assign group. Please try again.');
    } finally {
      setConfirmingGroup(prev => ({ ...prev, [groupIndex]: false }));
    }
  };

  const confirmAllGroups = async () => {
    setConfirmingAll(true);
    try {
      const batch = writeBatch(db);
      for (const group of generatedGroups) {
        group.students.forEach(s => {
          batch.update(doc(db, 'students', s.id), { academicMentor: group.mentor.name });
        });
      }
      await batch.commit();

      for (const group of generatedGroups) {
        await addDoc(collection(db, 'mentorAssignmentHistory'), {
          programme: clProgramme,
          level: yearFilter === 'all' ? 'All Years' : yearFilter,
          mentorName: group.mentor.name,
          studentCount: group.students.length,
          studentNames: group.students.map(s => s.name),
          assignedBy: user?.name ?? 'Programme Leader',
          createdAt: serverTimestamp(),
        });
        let mentorCalLink = CALENDAR_LINKS.mentor;
        try {
          const mentorCalSnap = await getDocs(query(collection(db, 'academic_mentors'), where('name', '==', group.mentor.name)));
          if (!mentorCalSnap.empty) mentorCalLink = mentorCalSnap.docs[0].data().calendarLink ?? CALENDAR_LINKS.mentor;
        } catch {}

        for (const student of group.students) {
          await sendMentorAssignmentEmail({
            student_name: student.name,
            student_email: student.email,
            mentor_name: group.mentor.name,
            mentor_department: group.mentor.department ?? 'Academic Department',
            mentor_calendar_link: mentorCalLink,
          });
        }
      }

      setGeneratedGroups(prev => prev.map(g => ({ ...g, confirmed: true })));
      toast.success(`All ${filteredStudents.length} students have been assigned to mentors`);
    } catch {
      toast.error('Failed to confirm all groups. Please try again.');
    } finally {
      setConfirmingAll(false);
    }
  };

  const handleManualAssign = async () => {
    if (!manualStudentId || !manualMentorId) {
      toast.error('Please select both a student and a mentor.');
      return;
    }
    const student = students.find(s => s.id === manualStudentId);
    const mentor = mentors.find(m => m.id === manualMentorId);
    if (!student || !mentor) return;
    setAssigningManual(true);
    try {
      await updateDoc(doc(db, 'students', student.id), { academicMentor: mentor.name });
      await addDoc(collection(db, 'mentorAssignmentHistory'), {
        programme: clProgramme,
        level: student.level,
        mentorName: mentor.name,
        studentCount: 1,
        studentNames: [student.name],
        assignedBy: user?.name ?? 'Programme Leader',
        createdAt: serverTimestamp(),
      });
      toast.success(`${student.name} assigned to ${mentor.name}`);
      setManualStudentId('');
      setManualMentorId('');
    } catch {
      toast.error('Failed to assign. Please try again.');
    } finally {
      setAssigningManual(false);
    }
  };

  const handleReassign = async () => {
    if (!reassignModal || !reassignModal.newMentorId) return;
    const mentor = mentors.find(m => m.id === reassignModal.newMentorId);
    if (!mentor) return;
    setReassigning(true);
    try {
      await updateDoc(doc(db, 'students', reassignModal.student.id), { academicMentor: mentor.name });
      await addDoc(collection(db, 'mentorAssignmentHistory'), {
        programme: clProgramme,
        level: reassignModal.student.level,
        mentorName: mentor.name,
        studentCount: 1,
        studentNames: [reassignModal.student.name],
        assignedBy: user?.name ?? 'Programme Leader',
        createdAt: serverTimestamp(),
      });
      toast.success(`${reassignModal.student.name} reassigned to ${mentor.name}`);
      setReassignModal(null);
    } catch {
      toast.error('Failed to reassign. Please try again.');
    } finally {
      setReassigning(false);
    }
  };

  const handleUnassign = async (student: Student) => {
    setUnassigningId(student.id);
    try {
      await updateDoc(doc(db, 'students', student.id), { academicMentor: '' });
      toast.success(`${student.name} unassigned from mentor`);
    } catch {
      toast.error('Failed to unassign. Please try again.');
    } finally {
      setUnassigningId(null);
    }
  };

  const formatDate = (createdAt: any) => {
    if (!createdAt) return '—';
    const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' };
    if (createdAt.toDate) return createdAt.toDate().toLocaleDateString('en-GB', opts);
    if (createdAt.seconds) return new Date(createdAt.seconds * 1000).toLocaleDateString('en-GB', opts);
    const d = new Date(createdAt);
    return isNaN(d.getTime()) ? '—' : d.toLocaleDateString('en-GB', opts);
  };

  const loading = loadingStudents || loadingMentors || clProfileLoading;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 gap-2 text-muted-foreground text-sm">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Mentor Assignment</h1>
        {clProgramme ? (
          <div>
            <p className="text-muted-foreground text-sm mt-1">
              Managing: <span className="font-medium text-foreground">{clProgramme}</span>
            </p>
            {clFaculty && (
              <p className="text-xs text-muted-foreground mt-0.5">
                Faculty: {clFaculty} &nbsp;|&nbsp; {loadingMentors ? '…' : mentors.length} mentor{mentors.length !== 1 ? 's' : ''} available
              </p>
            )}
          </div>
        ) : (
          <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-amber-800">
              Your profile does not have a programme assigned. Please contact the administrator.
            </p>
          </div>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-4">
        <Card className="border-l-4 border-l-blue-500">
          <CardContent className="pt-5 pb-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Students</p>
                <p className="text-3xl font-bold text-blue-600">{myStudents.length}</p>
              </div>
              <Users className="h-8 w-8 text-blue-200" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-purple-500">
          <CardContent className="pt-5 pb-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Available Mentors</p>
                <p className="text-3xl font-bold text-purple-600">{mentors.length}</p>
              </div>
              <GraduationCap className="h-8 w-8 text-purple-200" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-green-500">
          <CardContent className="pt-5 pb-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Assigned Students</p>
                <p className="text-3xl font-bold text-green-600">{assignedCount}</p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-200" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-red-500">
          <CardContent className="pt-5 pb-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Unassigned Students</p>
                <p className="text-3xl font-bold text-red-600">{unassignedCount}</p>
              </div>
              <AlertTriangle className="h-8 w-8 text-red-200" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Year Filter */}
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium text-muted-foreground">Filter by year:</span>
        <Select value={yearFilter} onValueChange={(v) => { setYearFilter(v); setGeneratedGroups([]); }}>
          <SelectTrigger className="w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Years</SelectItem>
            <SelectItem value="Year 1">Year 1</SelectItem>
            <SelectItem value="Year 2">Year 2</SelectItem>
            <SelectItem value="Year 3">Year 3</SelectItem>
            <SelectItem value="Year 4">Year 4</SelectItem>
          </SelectContent>
        </Select>
        {yearFilter !== 'all' && (
          <span className="text-sm text-muted-foreground">
            {filteredStudents.length} student{filteredStudents.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* Auto-Group Section */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Shuffle className="h-4 w-4 text-blue-600" />
            Auto-Generate Groups
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {mentors.length === 0 || filteredStudents.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {filteredStudents.length === 0
                ? 'No students found for the selected filter.'
                : 'No active mentors available.'}
            </p>
          ) : (
            <>
              <div className="rounded-lg bg-blue-50 border border-blue-200 px-4 py-3 text-sm text-blue-900 space-y-1">
                <p>
                  <span className="font-semibold">{filteredStudents.length}</span> students will be divided equally among{' '}
                  <span className="font-semibold">{mentors.length}</span> available mentors.
                </p>
                <p className="text-blue-700 text-xs">
                  ≈ {Math.ceil(filteredStudents.length / mentors.length)} students per mentor
                </p>
              </div>
              <Button className="bg-blue-600 hover:bg-blue-700 gap-2" onClick={handleAutoGenerate}>
                <Shuffle className="h-4 w-4" />
                {autoGenerateLabel}
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      {/* Generated Groups Preview */}
      {generatedGroups.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base">
                <GraduationCap className="h-4 w-4 text-blue-600" />
                Group Preview
              </CardTitle>
              <Button
                className="bg-green-600 hover:bg-green-700 gap-2"
                disabled={confirmingAll || generatedGroups.every(g => g.confirmed)}
                onClick={confirmAllGroups}
              >
                {confirmingAll && <Loader2 className="h-4 w-4 animate-spin" />}
                Confirm All Groups
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-gray-50">
                    <th className="text-left font-medium text-muted-foreground px-4 py-3">Group</th>
                    <th className="text-left font-medium text-muted-foreground px-4 py-3">Mentor</th>
                    <th className="text-left font-medium text-muted-foreground px-4 py-3">Students</th>
                    <th className="text-left font-medium text-muted-foreground px-4 py-3">Count</th>
                    <th className="text-left font-medium text-muted-foreground px-4 py-3">Status</th>
                    <th className="text-left font-medium text-muted-foreground px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {generatedGroups.map((group, i) => (
                    <tr key={i} className="border-b last:border-0 hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium">Group {i + 1}</td>
                      <td className="px-4 py-3">
                        <Select
                          value={group.mentor.name}
                          onValueChange={val => handleChangeMentor(i, val)}
                          disabled={group.confirmed || confirmingGroup[i]}
                        >
                          <SelectTrigger className="w-44 h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {mentors.map(m => (
                              <SelectItem key={m.id} value={m.name} className="text-xs">{m.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground max-w-[260px]">
                        <span className="truncate block">{group.students.map(s => s.name).join(', ')}</span>
                      </td>
                      <td className="px-4 py-3 font-semibold">{group.students.length}</td>
                      <td className="px-4 py-3">
                        {group.confirmed ? (
                          <Badge className="bg-green-100 text-green-800 border-green-200 text-xs">Confirmed</Badge>
                        ) : (
                          <Badge className="bg-amber-100 text-amber-800 border-amber-200 text-xs">Pending</Badge>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <Button
                          size="sm"
                          className="bg-blue-600 hover:bg-blue-700 h-8 text-xs px-3"
                          disabled={group.confirmed || confirmingGroup[i] || confirmingAll}
                          onClick={() => confirmGroup(i)}
                        >
                          {confirmingGroup[i] ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : group.confirmed ? (
                            'Assigned'
                          ) : (
                            'Confirm & Assign'
                          )}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Manual Assignment */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <UserPlus className="h-4 w-4 text-blue-600" />
            Manual Assignment
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">Assign an individual unassigned student to a specific mentor.</p>
          <div className="flex flex-wrap gap-3 items-end">
            <div className="flex-1 min-w-[200px]">
              <p className="text-xs text-muted-foreground mb-1">Student (unassigned)</p>
              <Select value={manualStudentId} onValueChange={setManualStudentId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select student..." />
                </SelectTrigger>
                <SelectContent>
                  {myStudents.filter(s => !s.academicMentor).map(s => (
                    <SelectItem key={s.id} value={s.id}>{s.name} ({s.studentId})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1 min-w-[200px]">
              <p className="text-xs text-muted-foreground mb-1">Mentor</p>
              <Select value={manualMentorId} onValueChange={setManualMentorId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select mentor..." />
                </SelectTrigger>
                <SelectContent>
                  {mentors.map(m => (
                    <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              className="bg-blue-600 hover:bg-blue-700 gap-2"
              disabled={!manualStudentId || !manualMentorId || assigningManual}
              onClick={handleManualAssign}
            >
              {assigningManual ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
              Assign
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Current Assignments */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="h-4 w-4 text-blue-600" />
            Current Assignments
            {yearFilter !== 'all' && (
              <span className="text-muted-foreground font-normal text-sm">— {yearFilter}</span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {filteredStudents.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No students found for the selected filter.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-gray-50">
                    <th className="text-left font-medium text-muted-foreground px-4 py-3">Student</th>
                    <th className="text-left font-medium text-muted-foreground px-4 py-3">Student ID</th>
                    <th className="text-left font-medium text-muted-foreground px-4 py-3">Year</th>
                    <th className="text-left font-medium text-muted-foreground px-4 py-3">Assigned Mentor</th>
                    <th className="text-left font-medium text-muted-foreground px-4 py-3">Status</th>
                    <th className="text-left font-medium text-muted-foreground px-4 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredStudents.map(s => (
                    <tr key={s.id} className="border-b last:border-0 hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium">{s.name}</td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">{s.studentId}</td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">
                        {(LEVEL_TO_YEAR[s.level] ?? s.level) || '—'}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{s.academicMentor || '—'}</td>
                      <td className="px-4 py-3">
                        {s.academicMentor ? (
                          <Badge className="bg-green-100 text-green-800 border-green-200 text-xs">Assigned</Badge>
                        ) : (
                          <Badge className="bg-red-100 text-red-800 border-red-200 text-xs">Unassigned</Badge>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs px-2 gap-1"
                            onClick={() => setReassignModal({ student: s, newMentorId: '' })}
                          >
                            <UserPlus className="h-3 w-3" />
                            Reassign
                          </Button>
                          {s.academicMentor && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs px-2 gap-1 text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
                              disabled={unassigningId === s.id}
                              onClick={() => handleUnassign(s)}
                            >
                              {unassigningId === s.id ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <UserX className="h-3 w-3" />
                              )}
                              Unassign
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Reassign Modal */}
      <Dialog open={!!reassignModal} onOpenChange={(open) => { if (!open) setReassignModal(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Reassign Mentor</DialogTitle>
          </DialogHeader>
          {reassignModal && (
            <div className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground">Student</p>
                <p className="font-medium text-sm">{reassignModal.student.name}</p>
                {reassignModal.student.academicMentor && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Current mentor: {reassignModal.student.academicMentor}
                  </p>
                )}
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">New Mentor</p>
                <Select
                  value={reassignModal.newMentorId}
                  onValueChange={(v) => setReassignModal(prev => prev ? { ...prev, newMentorId: v } : null)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select mentor..." />
                  </SelectTrigger>
                  <SelectContent>
                    {mentors.map(m => (
                      <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setReassignModal(null)}>Cancel</Button>
            <Button
              size="sm"
              className="bg-blue-600 hover:bg-blue-700"
              disabled={!reassignModal?.newMentorId || reassigning}
              onClick={handleReassign}
            >
              {reassigning ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Confirm Reassign'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assignment History */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <History className="h-4 w-4 text-blue-600" />
            Assignment History
          </CardTitle>
        </CardHeader>
        <CardContent>
          {history.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">No assignment history yet.</p>
          ) : (
            <div className="rounded-lg border overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-gray-50">
                    <th className="text-left font-medium text-muted-foreground px-4 py-2">Programme</th>
                    <th className="text-left font-medium text-muted-foreground px-4 py-2">Year</th>
                    <th className="text-left font-medium text-muted-foreground px-4 py-2">Mentor Assigned</th>
                    <th className="text-left font-medium text-muted-foreground px-4 py-2">Students</th>
                    <th className="text-left font-medium text-muted-foreground px-4 py-2">Assigned By</th>
                    <th className="text-left font-medium text-muted-foreground px-4 py-2">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map(h => (
                    <tr key={h.id} className="border-b last:border-0 hover:bg-gray-50">
                      <td className="px-4 py-2 font-medium">{h.programme}</td>
                      <td className="px-4 py-2 text-muted-foreground">{h.level}</td>
                      <td className="px-4 py-2">{h.mentorName}</td>
                      <td className="px-4 py-2 text-muted-foreground">{h.studentCount}</td>
                      <td className="px-4 py-2 text-muted-foreground">{h.assignedBy}</td>
                      <td className="px-4 py-2 text-muted-foreground text-xs">{formatDate(h.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
