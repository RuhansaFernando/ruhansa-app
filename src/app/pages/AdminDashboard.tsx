import { useEffect, useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Users, UserCheck, UserX, Shield, AlertTriangle } from 'lucide-react';
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
  courseLeaders: RoleStats;
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
    key: 'courseLeaders',
    label: 'Course Leaders',
    color: '#6366f1',
    bgClass: 'bg-indigo-50',
    textClass: 'text-indigo-700',
    borderClass: 'border-l-indigo-500',
    dotClass: 'bg-indigo-500',
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
  'faculty_administrators',
  'academic_mentors',
  'course_leaders',
];

export default function AdminDashboard() {
  const [stats, setStats] = useState<AllStats>({
    students: emptyStats(),
    sru: emptyStats(),
    registry: emptyStats(),
    faculty: emptyStats(),
    mentors: emptyStats(),
    courseLeaders: emptyStats(),
  });
  const [pendingPasswordChanges, setPendingPasswordChanges] = useState(0);
  const studentPendingRef = useRef(0);
  const staffPendingRef = useRef(0);
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
      studentPendingRef.current = pendingStudents;
      setPendingPasswordChanges(studentPendingRef.current + staffPendingRef.current);
      setStudentsLoaded(true);
    });
    return () => unsub();
  }, []);

  // One-time fetch for all staff collections + staff mustChangePassword count
  useEffect(() => {
    const fetchAll = async () => {
      try {
        const [sru, registry, faculty, mentors, courseLeaders] = await Promise.all([
          fetchCollectionStats('student_support_advisors'),
          fetchCollectionStats('registry'),
          fetchCollectionStats('faculty_administrators'),
          fetchCollectionStats('academic_mentors'),
          fetchCollectionStats('course_leaders'),
        ]);
        setStats((prev) => ({ ...prev, sru, registry, faculty, mentors, courseLeaders }));

        // Count pending password changes across staff collections only (students handled by onSnapshot)
        const snaps = await Promise.all(STAFF_COLLECTIONS.map((c) => getDocs(collection(db, c))));
        let pendingStaff = 0;
        snaps.forEach((snap) => snap.forEach((d) => { if (d.data().mustChangePassword === true) pendingStaff++; }));
        staffPendingRef.current = pendingStaff;
        setPendingPasswordChanges(studentPendingRef.current + staffPendingRef.current);
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
    courseLeaders: stats.courseLeaders,
  };

  const totalStudents = stats.students.total;
  const totalStaff =
    stats.sru.total + stats.registry.total + stats.faculty.total +
    stats.mentors.total + stats.courseLeaders.total;
  const totalActive =
    stats.students.active + stats.sru.active + stats.registry.active +
    stats.faculty.active + stats.mentors.active + stats.courseLeaders.active;
  const totalInactive =
    stats.students.inactive + stats.sru.inactive + stats.registry.inactive +
    stats.faculty.inactive + stats.mentors.inactive + stats.courseLeaders.inactive;

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

    </div>
  );
}
