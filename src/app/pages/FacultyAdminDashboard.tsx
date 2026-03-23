import { useState, useEffect, useMemo } from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { BookOpen, Users, ClipboardList, Activity, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router';

interface ModuleRow {
  id: string;
  moduleCode: string;
  moduleName: string;
  yearOfStudy: string;
  lastDate: string;
  sessions: number;
}

const YEAR_DISPLAY: Record<string, string> = {
  'Year 1': '1st Year', 'Year 2': '2nd Year', 'Year 3': '3rd Year', 'Year 4': '4th Year',
};

const formatDate = (d: string) => {
  if (!d) return '—';
  try {
    return new Date(d + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch { return d; }
};

const greeting = () => {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
};

export default function FacultyAdminDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [adminFaculty, setAdminFaculty] = useState('');
  const [adminName, setAdminName] = useState('');
  const [loadingAdmin, setLoadingAdmin] = useState(true);

  const [modules, setModules] = useState<{ id: string; moduleCode: string; moduleName: string; yearOfStudy: string }[]>([]);
  const [enrolledCount, setEnrolledCount] = useState(0);
  const [attendanceSessions, setAttendanceSessions] = useState<{ moduleId: string; date: string }[]>([]);
  const [loadingData, setLoadingData] = useState(false);

  // Load faculty admin profile
  useEffect(() => {
    if (!user?.email) { setLoadingAdmin(false); return; }
    getDocs(query(collection(db, 'faculty_administrators'), where('email', '==', user.email)))
      .then((snap) => {
        if (!snap.empty) {
          const d = snap.docs[0].data();
          setAdminFaculty(d.faculty ?? d.department ?? '');
          setAdminName(d.name ?? user.name ?? '');
        } else {
          setAdminName(user.name ?? '');
        }
      })
      .catch(() => {})
      .finally(() => setLoadingAdmin(false));
  }, [user?.email]);

  // Load modules, enrollments and attendance once faculty is known
  useEffect(() => {
    if (!adminFaculty) return;
    setLoadingData(true);

    const load = async () => {
      try {
        const modSnap = await getDocs(
          query(collection(db, 'modules'), where('faculty', '==', adminFaculty))
        );
        const mods = modSnap.docs.map((d) => ({
          id: d.id,
          moduleCode: d.data().moduleCode ?? '',
          moduleName: d.data().moduleName ?? '',
          yearOfStudy: d.data().yearOfStudy ?? '',
        }));
        setModules(mods);

        const moduleIds = new Set(mods.map((m) => m.id));

        const [enrollSnap, attSnap] = await Promise.all([
          getDocs(collection(db, 'moduleEnrollments')),
          getDocs(collection(db, 'attendance')),
        ]);

        const uniqueStudents = new Set(
          enrollSnap.docs
            .filter((d) => moduleIds.has(d.data().moduleId))
            .map((d) => d.data().studentId)
        );
        setEnrolledCount(uniqueStudents.size);

        setAttendanceSessions(
          attSnap.docs
            .filter((d) => moduleIds.has(d.data().moduleId))
            .map((d) => ({ moduleId: d.data().moduleId ?? '', date: d.data().date ?? '' }))
        );
      } catch (e) {
        console.error(e);
      } finally {
        setLoadingData(false);
      }
    };

    load();
  }, [adminFaculty]);

  const uniqueSessionCount = useMemo(() => {
    const seen = new Set<string>();
    attendanceSessions.forEach((a) => seen.add(`${a.date}|${a.moduleId}`));
    return seen.size;
  }, [attendanceSessions]);

  const weekCutoff = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().split('T')[0];
  }, []);

  const activeThisWeek = useMemo(() => {
    const ids = new Set(attendanceSessions.filter((a) => a.date >= weekCutoff).map((a) => a.moduleId));
    return ids.size;
  }, [attendanceSessions, weekCutoff]);

  const moduleOverview = useMemo((): ModuleRow[] => {
    const map = new Map<string, { lastDate: string; sessions: number }>();
    attendanceSessions.forEach((a) => {
      const cur = map.get(a.moduleId);
      if (!cur) {
        map.set(a.moduleId, { lastDate: a.date, sessions: 1 });
      } else {
        cur.sessions++;
        if (a.date > cur.lastDate) cur.lastDate = a.date;
      }
    });
    return modules
      .map((m) => ({
        ...m,
        lastDate: map.get(m.id)?.lastDate ?? '',
        sessions: map.get(m.id)?.sessions ?? 0,
      }))
      .sort((a, b) => a.moduleCode.localeCompare(b.moduleCode));
  }, [modules, attendanceSessions]);

  if (loadingAdmin) {
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
          {greeting()}, {adminName || user?.name}
        </h1>
        {adminFaculty && (
          <p className="text-sm text-muted-foreground mt-1">Managing: {adminFaculty}</p>
        )}
      </div>

      {/* Quick Actions */}
      <div className="flex flex-wrap gap-3">
        <Button onClick={() => navigate('/academic/upload')} className="gap-2">
          <ClipboardList className="h-4 w-4" />
          Upload Attendance
        </Button>
        <Button variant="outline" onClick={() => navigate('/academic/modules')} className="gap-2">
          <BookOpen className="h-4 w-4" />
          Manage Modules
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-l-4 border-l-blue-500">
          <CardContent className="pt-5 pb-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Modules</p>
                <p className="text-3xl font-bold mt-1">{loadingData ? '—' : modules.length}</p>
                <p className="text-xs text-muted-foreground mt-1">In your faculty</p>
              </div>
              <div className="h-10 w-10 rounded-full bg-blue-50 flex items-center justify-center">
                <BookOpen className="h-5 w-5 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-green-500">
          <CardContent className="pt-5 pb-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Enrolled Students</p>
                <p className="text-3xl font-bold mt-1 text-green-600">{loadingData ? '—' : enrolledCount}</p>
                <p className="text-xs text-muted-foreground mt-1">Across all modules</p>
              </div>
              <div className="h-10 w-10 rounded-full bg-green-50 flex items-center justify-center">
                <Users className="h-5 w-5 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-purple-500">
          <CardContent className="pt-5 pb-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Attendance Sessions</p>
                <p className="text-3xl font-bold mt-1 text-purple-600">{loadingData ? '—' : uniqueSessionCount}</p>
                <p className="text-xs text-muted-foreground mt-1">Total recorded</p>
              </div>
              <div className="h-10 w-10 rounded-full bg-purple-50 flex items-center justify-center">
                <ClipboardList className="h-5 w-5 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-amber-500">
          <CardContent className="pt-5 pb-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Active This Week</p>
                <p className="text-3xl font-bold mt-1 text-amber-600">{loadingData ? '—' : activeThisWeek}</p>
                <p className="text-xs text-muted-foreground mt-1">Modules with sessions</p>
              </div>
              <div className="h-10 w-10 rounded-full bg-amber-50 flex items-center justify-center">
                <Activity className="h-5 w-5 text-amber-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Modules Overview Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <BookOpen className="h-4 w-4" />
            Modules Overview
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loadingData ? (
            <div className="flex items-center justify-center h-24">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : moduleOverview.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground text-sm">
              No modules found for your faculty.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-gray-50">
                    <th className="text-left font-medium text-muted-foreground px-4 py-3">Module Code</th>
                    <th className="text-left font-medium text-muted-foreground px-4 py-3">Module Name</th>
                    <th className="text-left font-medium text-muted-foreground px-4 py-3">Year</th>
                    <th className="text-left font-medium text-muted-foreground px-4 py-3">Last Attendance</th>
                    <th className="text-center font-medium text-muted-foreground px-4 py-3">Sessions</th>
                  </tr>
                </thead>
                <tbody>
                  {moduleOverview.map((m) => (
                    <tr key={m.id} className="border-b last:border-0 hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 font-mono font-medium text-blue-700">{m.moduleCode}</td>
                      <td className="px-4 py-3 font-medium">{m.moduleName}</td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {m.yearOfStudy ? (YEAR_DISPLAY[m.yearOfStudy] ?? m.yearOfStudy) : '—'}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {m.lastDate ? formatDate(m.lastDate) : '—'}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {m.sessions > 0 ? (
                          <span className="font-semibold text-blue-600">{m.sessions}</span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
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
    </div>
  );
}
