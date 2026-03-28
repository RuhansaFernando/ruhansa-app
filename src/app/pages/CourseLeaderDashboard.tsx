import { useState, useEffect, useMemo } from 'react';
import { collection, getDocs, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Users, UserCheck, UserX, GraduationCap, Loader2, Search, AlertTriangle } from 'lucide-react';
import { useNavigate } from 'react-router';

const LEVEL_TO_YEAR: Record<string, string> = {
  '1st Year': 'Year 1', '2nd Year': 'Year 2', '3rd Year': 'Year 3', '4th Year': 'Year 4',
  'Year 1': 'Year 1', 'Year 2': 'Year 2', 'Year 3': 'Year 3', 'Year 4': 'Year 4',
  'Level 4': 'Year 1', 'Level 5': 'Year 2', 'Level 6': 'Year 3', 'Level 7': 'Year 4',
};

const YEAR_ORDER = ['Year 1', 'Year 2', 'Year 3', 'Year 4'];

interface StudentRow {
  id: string;
  studentId: string;
  name: string;
  programme: string;
  level: string;
  academicMentor: string;
}

const greeting = () => {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
};

export default function CourseLeaderDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [clProgramme, setClProgramme] = useState('');
  const [clFaculty, setClFaculty] = useState('');
  const [profileLoading, setProfileLoading] = useState(true);

  const [students, setStudents] = useState<StudentRow[]>([]);
  const [mentorCount, setMentorCount] = useState(0);
  const [loadingStudents, setLoadingStudents] = useState(true);
  const [profileNotConfigured, setProfileNotConfigured] = useState(false);
  const [search, setSearch] = useState('');
  const [dashYearFilter, setDashYearFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  // Fetch course leader profile — programme and its faculty
  useEffect(() => {
    if (!user?.email) { setProfileLoading(false); return; }
    const fetch = async () => {
      try {
        const snap = await getDocs(collection(db, 'course_leaders'));
        let prog = '';
        for (const d of snap.docs) {
          const data = d.data();
          if (data.email?.toLowerCase().trim() === user.email?.toLowerCase().trim()) {
            prog = data.programme ?? '';
            setClProgramme(prog);
            break;
          }
        }
        if (prog) {
          const progSnap = await getDocs(query(collection(db, 'programmes'), where('programmeName', '==', prog)));
          setClFaculty(progSnap.empty ? '' : progSnap.docs[0].data().faculty ?? '');
        }
      } catch {} finally {
        setProfileLoading(false);
      }
    };
    fetch();
  }, [user?.email]);

  // Load students once profile is known — scoped to this PL's programme
  useEffect(() => {
    if (profileLoading) return;
    if (!clProgramme) {
      setStudents([]);
      setProfileNotConfigured(true);
      setLoadingStudents(false);
      return;
    }
    setLoadingStudents(true);
    const q = query(collection(db, 'students'), where('programme', '==', clProgramme));
    const unsub = onSnapshot(q, (snap) => {
      setStudents(
        snap.docs.map((d) => ({
          id: d.id,
          studentId: d.data().studentId ?? d.id,
          name: d.data().name ?? '',
          programme: d.data().programme ?? '',
          level: d.data().level ?? '',
          academicMentor: d.data().academicMentor ?? '',
        }))
      );
      setLoadingStudents(false);
    });

    getDocs(collection(db, 'academic_mentors'))
      .then((snap) => {
        const count = snap.docs.filter(d => !clFaculty || d.data().department === clFaculty).length;
        setMentorCount(count);
      })
      .catch(() => {});

    return () => unsub();
  }, [profileLoading, clProgramme]);

  // students are already scoped to clProgramme by the Firestore query
  const myStudents = students;

  const assignedCount = myStudents.filter((s) => s.academicMentor).length;
  const unassignedCount = myStudents.filter((s) => !s.academicMentor).length;

  const filteredStudents = useMemo(() => {
    let list = myStudents;
    if (dashYearFilter !== 'all') list = list.filter(s => (LEVEL_TO_YEAR[s.level] ?? s.level) === dashYearFilter);
    if (statusFilter === 'assigned') list = list.filter(s => !!s.academicMentor);
    if (statusFilter === 'unassigned') list = list.filter(s => !s.academicMentor);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(s => s.name.toLowerCase().includes(q) || s.studentId.toLowerCase().includes(q));
    }
    return list;
  }, [myStudents, dashYearFilter, statusFilter, search]);

  // Group filtered students by year
  const studentsByYear = useMemo(() => {
    const groups: Record<string, StudentRow[]> = {};
    for (const s of filteredStudents) {
      const year = LEVEL_TO_YEAR[s.level] ?? s.level ?? 'Unknown';
      if (!groups[year]) groups[year] = [];
      groups[year].push(s);
    }
    return groups;
  }, [filteredStudents]);

  const orderedYears = useMemo(() => [
    ...YEAR_ORDER.filter((y) => studentsByYear[y]),
    ...Object.keys(studentsByYear).filter((y) => !YEAR_ORDER.includes(y) && studentsByYear[y]),
  ], [studentsByYear]);

  if (profileLoading) {
    return (
      <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">
        <Loader2 className="h-4 w-4 animate-spin mr-2" />Loading...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          {greeting()}, {user?.name}
        </h1>
        {clProgramme && (
          <p className="text-sm text-muted-foreground mt-1">
            Managing: {clProgramme}
          </p>
        )}
      </div>

      {/* Profile not configured warning */}
      {profileNotConfigured && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0" />
          <p className="text-sm text-amber-900 font-medium">
            Your Programme Leader profile is not configured. Please contact Admin.
          </p>
        </div>
      )}

      {/* Quick Action */}
      <div>
        <Button onClick={() => navigate('/course-leader/mentor-assignment')} className="gap-2">
          <GraduationCap className="h-4 w-4" />
          Go to Mentor Assignment
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-l-4 border-l-blue-500">
          <CardContent className="pt-5 pb-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Students</p>
                <p className="text-3xl font-bold mt-1">
                  {loadingStudents ? '—' : myStudents.length}
                </p>
                <p className="text-xs text-muted-foreground mt-1">In your programme</p>
              </div>
              <div className="h-10 w-10 rounded-full bg-blue-50 flex items-center justify-center">
                <Users className="h-5 w-5 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-green-500">
          <CardContent className="pt-5 pb-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Assigned</p>
                <p className="text-3xl font-bold mt-1 text-green-600">
                  {loadingStudents ? '—' : assignedCount}
                </p>
                <p className="text-xs text-muted-foreground mt-1">Have a mentor</p>
              </div>
              <div className="h-10 w-10 rounded-full bg-green-50 flex items-center justify-center">
                <UserCheck className="h-5 w-5 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-amber-500">
          <CardContent className="pt-5 pb-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Unassigned</p>
                <p className="text-3xl font-bold mt-1 text-amber-600">
                  {loadingStudents ? '—' : unassignedCount}
                </p>
                <p className="text-xs text-muted-foreground mt-1">No mentor yet</p>
              </div>
              <div className="h-10 w-10 rounded-full bg-amber-50 flex items-center justify-center">
                <UserX className="h-5 w-5 text-amber-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-purple-500">
          <CardContent className="pt-5 pb-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Available Mentors</p>
                <p className="text-3xl font-bold mt-1 text-purple-600">
                  {loadingStudents ? '—' : mentorCount}
                </p>
                <p className="text-xs text-muted-foreground mt-1">{clFaculty ? `From ${clFaculty}` : 'Academic mentors'}</p>
              </div>
              <div className="h-10 w-10 rounded-full bg-purple-50 flex items-center justify-center">
                <GraduationCap className="h-5 w-5 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Student List grouped by year */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="h-4 w-4" />
            Students
            {!loadingStudents && (
              <span className="text-muted-foreground font-normal text-sm">— {myStudents.length} total</span>
            )}
          </CardTitle>
          {!loadingStudents && myStudents.length > 0 && (
            <div className="flex flex-wrap gap-2 pt-2">
              <div className="relative flex-1 min-w-[180px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name or ID..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9 h-8 text-sm"
                />
              </div>
              <Select value={dashYearFilter} onValueChange={setDashYearFilter}>
                <SelectTrigger className="w-[130px] h-8 text-sm">
                  <SelectValue placeholder="Year" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Years</SelectItem>
                  <SelectItem value="Year 1">Year 1</SelectItem>
                  <SelectItem value="Year 2">Year 2</SelectItem>
                  <SelectItem value="Year 3">Year 3</SelectItem>
                  <SelectItem value="Year 4">Year 4</SelectItem>
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[150px] h-8 text-sm">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="assigned">Assigned</SelectItem>
                  <SelectItem value="unassigned">Unassigned</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </CardHeader>
        <CardContent>
          {loadingStudents ? (
            <div className="flex items-center justify-center h-24">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : myStudents.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground text-sm">
              No students found for your programme.
            </div>
          ) : filteredStudents.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground text-sm">
              No students match your filters.
            </div>
          ) : (
            <div className="space-y-6">
              {orderedYears.map((year) => {
                const yearStudents = studentsByYear[year] ?? [];
                return (
                  <div key={year}>
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="text-sm font-semibold text-foreground">{year}</h3>
                      <span className="text-xs text-muted-foreground">({yearStudents.length} students)</span>
                    </div>
                    <div className="rounded-lg border overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b bg-gray-50">
                            <th className="text-left font-medium text-muted-foreground px-4 py-2">Student ID</th>
                            <th className="text-left font-medium text-muted-foreground px-4 py-2">Name</th>
                            <th className="text-left font-medium text-muted-foreground px-4 py-2">Academic Mentor</th>
                            <th className="text-center font-medium text-muted-foreground px-4 py-2">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {yearStudents.map((s) => (
                            <tr key={s.id} className="border-b last:border-0 hover:bg-gray-50 transition-colors">
                              <td className="px-4 py-2 font-mono text-xs text-muted-foreground">{s.studentId}</td>
                              <td className="px-4 py-2 font-medium">{s.name || '—'}</td>
                              <td className="px-4 py-2 text-muted-foreground">{s.academicMentor || '—'}</td>
                              <td className="px-4 py-2 text-center">
                                {s.academicMentor ? (
                                  <Badge className="bg-green-100 text-green-800 border-green-200 text-xs">Assigned</Badge>
                                ) : (
                                  <Badge className="bg-amber-100 text-amber-800 border-amber-200 text-xs">Unassigned</Badge>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
