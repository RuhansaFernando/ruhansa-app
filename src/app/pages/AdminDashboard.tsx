import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Users, UserCheck, UserX, Shield, AlertTriangle, UserPlus, BarChart2, BookOpen } from 'lucide-react';
import { db } from '../../firebase';
import { collection, getDocs, onSnapshot } from 'firebase/firestore';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';

interface RoleStats {
  total: number;
  active: number;
  inactive: number;
}

interface AllStats {
  students: RoleStats;
  sru: RoleStats;
  registry: RoleStats;
  faculty: RoleStats;
  mentors: RoleStats;
  counsellors: RoleStats;
  courseLeaders: RoleStats;
  advisors: RoleStats;
}

const ROLE_CONFIG = [
  {
    key: 'students',
    label: 'Students',
    color: '#3b82f6',
    bgClass: 'bg-blue-50',
    textClass: 'text-blue-700',
    borderClass: 'border-l-blue-500',
    dotClass: 'bg-blue-500',
  },
  {
    key: 'sru',
    label: 'Student Support Advisors',
    color: '#22c55e',
    bgClass: 'bg-green-50',
    textClass: 'text-green-700',
    borderClass: 'border-l-green-500',
    dotClass: 'bg-green-500',
  },
  {
    key: 'registry',
    label: 'Registry Staff',
    color: '#a855f7',
    bgClass: 'bg-purple-50',
    textClass: 'text-purple-700',
    borderClass: 'border-l-purple-500',
    dotClass: 'bg-purple-500',
  },
  {
    key: 'faculty',
    label: 'Faculty Administrators',
    color: '#f97316',
    bgClass: 'bg-orange-50',
    textClass: 'text-orange-700',
    borderClass: 'border-l-orange-500',
    dotClass: 'bg-orange-500',
  },
  {
    key: 'mentors',
    label: 'Academic Mentors',
    color: '#14b8a6',
    bgClass: 'bg-teal-50',
    textClass: 'text-teal-700',
    borderClass: 'border-l-teal-500',
    dotClass: 'bg-teal-500',
  },
  {
    key: 'counsellors',
    label: 'Student Counsellors',
    color: '#ec4899',
    bgClass: 'bg-pink-50',
    textClass: 'text-pink-700',
    borderClass: 'border-l-pink-500',
    dotClass: 'bg-pink-500',
  },
  {
    key: 'courseLeaders',
    label: 'Course Leaders',
    color: '#6366f1',
    bgClass: 'bg-indigo-50',
    textClass: 'text-indigo-700',
    borderClass: 'border-l-indigo-500',
    dotClass: 'bg-indigo-500',
  },
  {
    key: 'advisors',
    label: 'Academic Advisors',
    color: '#f59e0b',
    bgClass: 'bg-amber-50',
    textClass: 'text-amber-700',
    borderClass: 'border-l-amber-500',
    dotClass: 'bg-amber-500',
  },
] as const;

const emptyStats = (): RoleStats => ({ total: 0, active: 0, inactive: 0 });

async function fetchCollectionStats(collectionName: string): Promise<RoleStats> {
  const snap = await getDocs(collection(db, collectionName));
  let active = 0;
  let inactive = 0;
  snap.forEach((d) => {
    const status = d.data().status;
    if (status === 'active') active++;
    else if (status === 'inactive') inactive++;
  });
  return { total: snap.size, active, inactive };
}

const STAFF_COLLECTIONS = [
  'student_support_advisors',
  'registry',
  'faculty',
  'academic_mentors',
  'student_counsellors',
  'course_leaders',
  'advisors',
];

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<AllStats>({
    students: emptyStats(),
    sru: emptyStats(),
    registry: emptyStats(),
    faculty: emptyStats(),
    mentors: emptyStats(),
    counsellors: emptyStats(),
    courseLeaders: emptyStats(),
    advisors: emptyStats(),
  });
  const [pendingPasswordChanges, setPendingPasswordChanges] = useState(0);
  const [staffLoading, setStaffLoading] = useState(true);
  const [studentsLoaded, setStudentsLoaded] = useState(false);

  // Real-time listener for students — also counts student mustChangePassword
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'students'), (snap) => {
      let active = 0;
      let inactive = 0;
      let pendingStudents = 0;
      snap.forEach((d) => {
        const data = d.data();
        const status = data.status;
        if (status === 'active') active++;
        else if (status === 'inactive') inactive++;
        if (data.mustChangePassword === true) pendingStudents++;
      });
      setStats((prev) => ({ ...prev, students: { total: snap.size, active, inactive } }));
      setPendingPasswordChanges((prev) => prev + pendingStudents);
      setStudentsLoaded(true);
    });
    return () => unsub();
  }, []);

  // One-time fetch for all staff collections + staff mustChangePassword count
  useEffect(() => {
    const fetchAll = async () => {
      try {
        const [sru, registry, faculty, mentors, counsellors, courseLeaders, advisors] = await Promise.all([
          fetchCollectionStats('student_support_advisors'),
          fetchCollectionStats('registry'),
          fetchCollectionStats('faculty'),
          fetchCollectionStats('academic_mentors'),
          fetchCollectionStats('student_counsellors'),
          fetchCollectionStats('course_leaders'),
          fetchCollectionStats('advisors'),
        ]);
        setStats((prev) => ({ ...prev, sru, registry, faculty, mentors, counsellors, courseLeaders, advisors }));

        // Count pending password changes across staff collections only (students handled by onSnapshot)
        const snaps = await Promise.all(STAFF_COLLECTIONS.map((c) => getDocs(collection(db, c))));
        let pendingStaff = 0;
        snaps.forEach((snap) => snap.forEach((d) => { if (d.data().mustChangePassword === true) pendingStaff++; }));
        setPendingPasswordChanges((prev) => prev + pendingStaff);
      } finally {
        setStaffLoading(false);
      }
    };
    fetchAll();
  }, []);

  const statsByKey: Record<string, RoleStats> = {
    students: stats.students,
    sru: stats.sru,
    registry: stats.registry,
    faculty: stats.faculty,
    mentors: stats.mentors,
    counsellors: stats.counsellors,
    courseLeaders: stats.courseLeaders,
    advisors: stats.advisors,
  };

  const totalStudents = stats.students.total;
  const totalStaff =
    stats.sru.total + stats.registry.total + stats.faculty.total +
    stats.mentors.total + stats.counsellors.total + stats.courseLeaders.total + stats.advisors.total;
  const totalActive =
    stats.students.active + stats.sru.active + stats.registry.active +
    stats.faculty.active + stats.mentors.active + stats.counsellors.active +
    stats.courseLeaders.active + stats.advisors.active;
  const totalInactive =
    stats.students.inactive + stats.sru.inactive + stats.registry.inactive +
    stats.faculty.inactive + stats.mentors.inactive + stats.counsellors.inactive +
    stats.courseLeaders.inactive + stats.advisors.inactive;

  const donutData = ROLE_CONFIG.map((r) => ({
    name: r.label,
    value: statsByKey[r.key].total,
    color: r.color,
  })).filter((d) => d.value > 0);

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white border border-gray-200 rounded-lg shadow-sm px-3 py-2 text-sm">
          <p className="font-medium">{payload[0].name}</p>
          <p className="text-muted-foreground">{payload[0].value} accounts</p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">System Overview</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Monitor system accounts and activity
        </p>
      </div>

      {/* Pending password warning */}
      {pendingPasswordChanges > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0" />
          <p className="text-sm text-amber-900 font-medium">
            {pendingPasswordChanges} users have not changed their temporary password yet.
          </p>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-l-4 border-l-blue-500">
          <CardContent className="pt-5 pb-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Students</p>
                <p className="text-3xl font-bold mt-1">
                  {studentsLoaded ? totalStudents : '—'}
                </p>
                <p className="text-xs text-muted-foreground mt-1">Registered accounts</p>
              </div>
              <div className="h-10 w-10 rounded-full bg-blue-50 flex items-center justify-center">
                <Users className="h-5 w-5 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-purple-500">
          <CardContent className="pt-5 pb-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Staff</p>
                <p className="text-3xl font-bold mt-1">
                  {staffLoading ? '—' :totalStaff}
                </p>
                <p className="text-xs text-muted-foreground mt-1">Registered accounts</p>
              </div>
              <div className="h-10 w-10 rounded-full bg-purple-50 flex items-center justify-center">
                <Shield className="h-5 w-5 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-green-500">
          <CardContent className="pt-5 pb-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Active</p>
                <p className="text-3xl font-bold mt-1">
                  {staffLoading ? '—' :totalActive}
                </p>
                <p className="text-xs text-muted-foreground mt-1">Active accounts</p>
              </div>
              <div className="h-10 w-10 rounded-full bg-green-50 flex items-center justify-center">
                <UserCheck className="h-5 w-5 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-red-500">
          <CardContent className="pt-5 pb-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Inactive</p>
                <p className="text-3xl font-bold mt-1">
                  {staffLoading ? '—' :totalInactive}
                </p>
                <p className="text-xs text-muted-foreground mt-1">Inactive accounts</p>
              </div>
              <div className="h-10 w-10 rounded-full bg-red-50 flex items-center justify-center">
                <UserX className="h-5 w-5 text-red-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Chart + Role Summary row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Donut Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">User Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            {staffLoading ? (
              <div className="h-64 flex items-center justify-center text-muted-foreground text-sm">
                Loading...
              </div>
            ) : donutData.length === 0 ? (
              <div className="h-64 flex items-center justify-center text-muted-foreground text-sm">
                No data available
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={donutData}
                    cx="50%"
                    cy="45%"
                    innerRadius={60}
                    outerRadius={100}
                    startAngle={90}
                    endAngle={450}
                    strokeWidth={0}
                    dataKey="value"
                  >
                    {donutData.map((entry, index) => (
                      <Cell key={index} fill={entry.color} stroke="none" />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                  <Legend
                    formatter={(value, entry: any) => (
                      <span className="text-xs text-gray-700">
                        {value} ({entry.payload.value})
                      </span>
                    )}
                    iconSize={10}
                    iconType="circle"
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Role breakdown cards */}
        <div className="flex flex-col gap-3">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide pt-1 px-1">
            By Role
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {ROLE_CONFIG.map((role) => {
              const s = statsByKey[role.key];
              return (
                <Card key={role.key} className={`border-l-4 ${role.borderClass}`}>
                  <CardContent className="pt-4 pb-4 px-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <p className={`text-xs font-medium truncate ${role.textClass}`}>
                          {role.label}
                        </p>
                        <p className="text-2xl font-bold mt-0.5">
                          {staffLoading ? '—' :s.total}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Active: {staffLoading ? '—' :s.active}
                        </p>
                      </div>
                      <div className={`h-2 w-2 rounded-full mt-1 ${role.dotClass} flex-shrink-0`} />
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            <Button variant="outline" className="gap-2" onClick={() => navigate('/admin/students')}>
              <UserPlus className="h-4 w-4" />
              Add Student
            </Button>
            <Button variant="outline" className="gap-2" onClick={() => navigate('/admin/registry')}>
              <Shield className="h-4 w-4" />
              Add Staff
            </Button>
            <Button variant="outline" className="gap-2" onClick={() => navigate('/admin/analytics')}>
              <BarChart2 className="h-4 w-4" />
              View Reports
            </Button>
            <Button variant="outline" className="gap-2" onClick={() => navigate('/admin/modules')}>
              <BookOpen className="h-4 w-4" />
              Manage Modules
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
