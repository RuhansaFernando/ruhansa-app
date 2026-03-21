import { useState, useEffect, useMemo } from 'react';
import {
  collection, doc, addDoc, serverTimestamp,
  onSnapshot, query, orderBy, limit, where, writeBatch, getDocs,
} from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../AuthContext';
import { sendMentorAssignmentEmail } from '../services/emailService';
import { CALENDAR_LINKS } from '../config/calendarLinks';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Users, CheckCircle, Loader2, GraduationCap, AlertTriangle, History, Shuffle } from 'lucide-react';
import { toast } from 'sonner';

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

  // Course Leader profile
  const [clProgramme, setClProgramme] = useState('');
  const [clLevel, setClLevel] = useState('');
  const [clProfileLoading, setClProfileLoading] = useState(true);

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

  // Fetch Course Leader's own programme and level
  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const snap = await getDocs(collection(db, 'course_leaders'));
        for (const d of snap.docs) {
          const data = d.data();
          if (data.email?.toLowerCase().trim() === user?.email?.toLowerCase().trim()) {
            setClProgramme(data.programme ?? '');
            setClLevel(data.level ?? '');
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

  // Real-time students listener
  useEffect(() => {
    setLoadingStudents(true);
    const unsub = onSnapshot(collection(db, 'students'), (snap) => {
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
  }, []);

  // Real-time mentors listener
  useEffect(() => {
    setLoadingMentors(true);
    const unsub = onSnapshot(
      query(collection(db, 'academic_mentors'), where('status', '==', 'active')),
      (snap) => {
        setMentors(snap.docs.map(d => ({
          id: d.id,
          name: d.data().name ?? '',
          email: d.data().email ?? '',
          department: d.data().department ?? '',
        })));
        setLoadingMentors(false);
      },
      () => {
        // Fallback without status filter if index/field missing
        onSnapshot(collection(db, 'academic_mentors'), (snap) => {
          setMentors(snap.docs.map(d => ({
            id: d.id,
            name: d.data().name ?? '',
            email: d.data().email ?? '',
            department: d.data().department ?? '',
          })));
          setLoadingMentors(false);
        });
      }
    );
    return () => unsub();
  }, []);

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

  // Students filtered to this Course Leader's programme + level
  const myStudents = useMemo(() =>
    students.filter(s => s.programme === clProgramme && s.level === clLevel),
  [students, clProgramme, clLevel]);

  const assignedCount = myStudents.filter(s => s.academicMentor).length;
  const unassignedCount = myStudents.length - assignedCount;

  const handleAutoGenerate = () => {
    if (mentors.length === 0) {
      toast.error('No mentors available.');
      return;
    }
    if (myStudents.length === 0) {
      toast.error('No students to assign.');
      return;
    }

    // Shuffle students
    const shuffled = [...myStudents].sort(() => Math.random() - 0.5);

    // Split into chunks, one per mentor
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
        level: clLevel,
        mentorName: group.mentor.name,
        studentCount: group.students.length,
        studentNames: group.students.map(s => s.name),
        assignedBy: user?.name ?? 'Course Leader',
        createdAt: serverTimestamp(),
      });

      for (const student of group.students) {
        await sendMentorAssignmentEmail({
          student_name: student.name,
          student_email: student.email,
          mentor_name: group.mentor.name,
          mentor_department: group.mentor.department ?? 'Academic Department',
          mentor_calendar_link: CALENDAR_LINKS.mentor,
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
          level: clLevel,
          mentorName: group.mentor.name,
          studentCount: group.students.length,
          studentNames: group.students.map(s => s.name),
          assignedBy: user?.name ?? 'Course Leader',
          createdAt: serverTimestamp(),
        });
        for (const student of group.students) {
          await sendMentorAssignmentEmail({
            student_name: student.name,
            student_email: student.email,
            mentor_name: group.mentor.name,
            mentor_department: group.mentor.department ?? 'Academic Department',
            mentor_calendar_link: CALENDAR_LINKS.mentor,
          });
        }
      }

      setGeneratedGroups(prev => prev.map(g => ({ ...g, confirmed: true })));
      toast.success(`All ${myStudents.length} students have been assigned to mentors`);
    } catch {
      toast.error('Failed to confirm all groups. Please try again.');
    } finally {
      setConfirmingAll(false);
    }
  };

  const formatDate = (createdAt: any) => {
    if (!createdAt) return '—';
    const d = createdAt.toDate ? createdAt.toDate() : new Date(createdAt);
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
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
        {clProgramme && clLevel ? (
          <p className="text-muted-foreground text-sm mt-1">
            Managing: <span className="font-medium text-foreground">{clProgramme}</span> — <span className="font-medium text-foreground">{clLevel}</span>
          </p>
        ) : (
          <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-amber-800">
              Your profile does not have a programme and level assigned. Please contact the administrator.
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

      {/* Auto-Group Section */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Shuffle className="h-4 w-4 text-blue-600" />
            Auto-Generate Groups
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {mentors.length === 0 || myStudents.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {myStudents.length === 0
                ? 'No students found for your programme and level.'
                : 'No active mentors available.'}
            </p>
          ) : (
            <>
              <div className="rounded-lg bg-blue-50 border border-blue-200 px-4 py-3 text-sm text-blue-900 space-y-1">
                <p>
                  <span className="font-semibold">{myStudents.length}</span> students will be divided equally among{' '}
                  <span className="font-semibold">{mentors.length}</span> available mentors.
                </p>
                <p className="text-blue-700 text-xs">
                  ≈ {Math.ceil(myStudents.length / mentors.length)} students per mentor
                </p>
              </div>
              <Button className="bg-blue-600 hover:bg-blue-700 gap-2" onClick={handleAutoGenerate}>
                <Shuffle className="h-4 w-4" />
                Auto-Generate Groups
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

      {/* Current Assignments */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="h-4 w-4 text-blue-600" />
            Current Assignments
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {myStudents.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No students found for your programme and level.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-gray-50">
                    <th className="text-left font-medium text-muted-foreground px-4 py-3">Student</th>
                    <th className="text-left font-medium text-muted-foreground px-4 py-3">Student ID</th>
                    <th className="text-left font-medium text-muted-foreground px-4 py-3">Assigned Mentor</th>
                    <th className="text-left font-medium text-muted-foreground px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {myStudents.map(s => (
                    <tr key={s.id} className="border-b last:border-0 hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium">{s.name}</td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">{s.studentId}</td>
                      <td className="px-4 py-3 text-muted-foreground">{s.academicMentor || '—'}</td>
                      <td className="px-4 py-3">
                        {s.academicMentor ? (
                          <Badge className="bg-green-100 text-green-800 border-green-200 text-xs">Assigned</Badge>
                        ) : (
                          <Badge className="bg-red-100 text-red-800 border-red-200 text-xs">Unassigned</Badge>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

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
                    <th className="text-left font-medium text-muted-foreground px-4 py-2">Level</th>
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
