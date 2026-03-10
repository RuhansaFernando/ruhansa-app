import { useEffect, useState } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  AreaChart,
  Area,
} from 'recharts';
import { TrendingUp, TrendingDown, Users, AlertTriangle, UserCog, Heart, Loader2 } from 'lucide-react';

interface Student {
  id: string;
  name: string;
  program: string;
  year: number;
  gpa: number;
  riskLevel: string;
  riskScore: number;
  joinedDate?: string;
  status?: string;
}

interface Advisor {
  id: string;
  status: string;
}

interface Counselor {
  id: string;
  status: string;
}

const RISK_COLORS: Record<string, string> = {
  critical: '#dc2626',
  high: '#ea580c',
  medium: '#eab308',
  low: '#16a34a',
};

export default function AdminAnalyticsPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [advisors, setAdvisors] = useState<Advisor[]>([]);
  const [counselors, setCounselors] = useState<Counselor[]>([]);
  const [loading, setLoading] = useState(true);

  // Real-time listeners for all three collections in parallel
  useEffect(() => {
    let studentsLoaded = false;
    let advisorsLoaded = false;
    let counselorsLoaded = false;

    const checkAllLoaded = () => {
      if (studentsLoaded && advisorsLoaded && counselorsLoaded) setLoading(false);
    };

    const unsubStudents = onSnapshot(collection(db, 'students'), (snap) => {
      setStudents(
        snap.docs.map((d) => ({
          id: d.id,
          name: d.data().name ?? '',
          program: d.data().program ?? 'Unknown',
          year: d.data().year ?? 1,
          gpa: d.data().gpa ?? 0,
          riskLevel: d.data().riskLevel ?? 'low',
          riskScore: d.data().riskScore ?? 0,
          joinedDate: d.data().joinedDate ?? '',
          status: d.data().status ?? 'active',
        }))
      );
      studentsLoaded = true;
      checkAllLoaded();
    });

    const unsubAdvisors = onSnapshot(collection(db, 'advisors'), (snap) => {
      setAdvisors(snap.docs.map((d) => ({ id: d.id, status: d.data().status ?? 'active' })));
      advisorsLoaded = true;
      checkAllLoaded();
    });

    const unsubCounselors = onSnapshot(collection(db, 'counselors'), (snap) => {
      setCounselors(snap.docs.map((d) => ({ id: d.id, status: d.data().status ?? 'active' })));
      counselorsLoaded = true;
      checkAllLoaded();
    });

    return () => {
      unsubStudents();
      unsubAdvisors();
      unsubCounselors();
    };
  }, []);

  // ── Derived metrics ──────────────────────────────────────────────────────────
  const totalStudents = students.length;
  const criticalStudents = students.filter((s) => s.riskLevel === 'critical').length;
  const highRiskStudents = students.filter((s) => s.riskLevel === 'high').length;
  const avgGPA =
    totalStudents > 0
      ? (students.reduce((sum, s) => sum + s.gpa, 0) / totalStudents).toFixed(2)
      : '0.00';
  const activeAdvisors = advisors.filter((a) => a.status === 'active').length;
  const activeCounselors = counselors.filter((c) => c.status === 'active').length;

  // ── Risk Distribution (pie) ──────────────────────────────────────────────────
  const riskDistribution = ['critical', 'high', 'medium', 'low'].map((level) => ({
    name: level.charAt(0).toUpperCase() + level.slice(1),
    value: students.filter((s) => s.riskLevel === level).length,
    color: RISK_COLORS[level],
  }));

  // ── Department Performance (bar) ─────────────────────────────────────────────
  const departmentMap: Record<string, { total: number; gpaSum: number; atRisk: number }> = {};
  students.forEach((s) => {
    const prog = s.program || 'Unknown';
    if (!departmentMap[prog]) departmentMap[prog] = { total: 0, gpaSum: 0, atRisk: 0 };
    departmentMap[prog].total += 1;
    departmentMap[prog].gpaSum += s.gpa;
    if (s.riskLevel === 'critical' || s.riskLevel === 'high') departmentMap[prog].atRisk += 1;
  });
  const departmentData = Object.entries(departmentMap)
    .map(([department, data]) => ({
      department,
      students: data.total,
      atRisk: data.atRisk,
      avgGPA: data.total > 0 ? parseFloat((data.gpaSum / data.total).toFixed(2)) : 0,
    }))
    .sort((a, b) => b.students - a.students)
    .slice(0, 6);

  // ── GPA Distribution (bar) ───────────────────────────────────────────────────
  const gpaBuckets = [
    { range: '0.0 – 1.0', count: students.filter((s) => s.gpa < 1).length },
    { range: '1.0 – 2.0', count: students.filter((s) => s.gpa >= 1 && s.gpa < 2).length },
    { range: '2.0 – 2.5', count: students.filter((s) => s.gpa >= 2 && s.gpa < 2.5).length },
    { range: '2.5 – 3.0', count: students.filter((s) => s.gpa >= 2.5 && s.gpa < 3).length },
    { range: '3.0 – 3.5', count: students.filter((s) => s.gpa >= 3 && s.gpa < 3.5).length },
    { range: '3.5 – 4.0', count: students.filter((s) => s.gpa >= 3.5).length },
  ];

  // ── Enrollment by Month (area) ────────────────────────────────────────────────
  // Group students by month of joinedDate
  const enrollmentMap: Record<string, number> = {};
  students.forEach((s) => {
    if (!s.joinedDate) return;
    const date = new Date(s.joinedDate);
    if (isNaN(date.getTime())) return;
    const key = date.toLocaleString('default', { month: 'short', year: '2-digit' });
    enrollmentMap[key] = (enrollmentMap[key] ?? 0) + 1;
  });
  const enrollmentTrends = Object.entries(enrollmentMap)
    .map(([month, count]) => ({ month, enrollments: count }))
    .sort((a, b) => {
      const parse = (m: string) => new Date(`1 ${m}`).getTime();
      return parse(a.month) - parse(b.month);
    });

  // ── Risk by Year (line) ───────────────────────────────────────────────────────
  const yearMap: Record<number, { total: number; atRisk: number; gpaSum: number }> = {};
  students.forEach((s) => {
    const yr = s.year;
    if (!yearMap[yr]) yearMap[yr] = { total: 0, atRisk: 0, gpaSum: 0 };
    yearMap[yr].total += 1;
    yearMap[yr].gpaSum += s.gpa;
    if (s.riskLevel === 'critical' || s.riskLevel === 'high') yearMap[yr].atRisk += 1;
  });
  const yearData = Object.entries(yearMap)
    .map(([year, data]) => ({
      year: `Year ${year}`,
      students: data.total,
      atRisk: data.atRisk,
      avgGPA: data.total > 0 ? parseFloat((data.gpaSum / data.total).toFixed(2)) : 0,
    }))
    .sort((a, b) => a.year.localeCompare(b.year));

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">System Analytics</h1>
        <p className="text-muted-foreground">
          Comprehensive insights and performance metrics across the institution
        </p>
      </div>

      {/* Key Metrics */}
      <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
        <Card className="lg:col-span-1">
          <CardHeader className="pb-3">
            <CardDescription>Total Students</CardDescription>
            <CardTitle className="text-3xl">{totalStudents}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Users className="h-3 w-3" />
              <span>All enrolled</span>
            </div>
          </CardContent>
        </Card>
        <Card className="lg:col-span-1">
          <CardHeader className="pb-3">
            <CardDescription>Critical Risk</CardDescription>
            <CardTitle className="text-3xl text-red-600">{criticalStudents}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-1 text-xs text-red-600">
              <AlertTriangle className="h-3 w-3" />
              <span>Need immediate attention</span>
            </div>
          </CardContent>
        </Card>
        <Card className="lg:col-span-1">
          <CardHeader className="pb-3">
            <CardDescription>High Risk</CardDescription>
            <CardTitle className="text-3xl text-orange-600">{highRiskStudents}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-1 text-xs text-orange-600">
              <TrendingDown className="h-3 w-3" />
              <span>Requires monitoring</span>
            </div>
          </CardContent>
        </Card>
        <Card className="lg:col-span-1">
          <CardHeader className="pb-3">
            <CardDescription>Average GPA</CardDescription>
            <CardTitle className="text-3xl">{avgGPA}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-1 text-xs text-green-600">
              <TrendingUp className="h-3 w-3" />
              <span>Across all students</span>
            </div>
          </CardContent>
        </Card>
        <Card className="lg:col-span-1">
          <CardHeader className="pb-3">
            <CardDescription>Active Advisors</CardDescription>
            <CardTitle className="text-3xl text-blue-600">{activeAdvisors}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <UserCog className="h-3 w-3" />
              <span>of {advisors.length} total</span>
            </div>
          </CardContent>
        </Card>
        <Card className="lg:col-span-1">
          <CardHeader className="pb-3">
            <CardDescription>Active Counselors</CardDescription>
            <CardTitle className="text-3xl text-purple-600">{activeCounselors}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Heart className="h-3 w-3" />
              <span>of {counselors.length} total</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Risk Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Student Risk Distribution</CardTitle>
            <CardDescription>Current breakdown by risk level</CardDescription>
          </CardHeader>
          <CardContent>
            {totalStudents === 0 ? (
              <div className="flex items-center justify-center h-[300px] text-muted-foreground text-sm">
                No student data available
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={riskDistribution.filter((r) => r.value > 0)}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, value, percent }) =>
                      `${name}: ${value} (${(percent * 100).toFixed(0)}%)`
                    }
                    outerRadius={100}
                    dataKey="value"
                  >
                    {riskDistribution
                      .filter((r) => r.value > 0)
                      .map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* GPA Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>GPA Distribution</CardTitle>
            <CardDescription>Number of students per GPA range</CardDescription>
          </CardHeader>
          <CardContent>
            {totalStudents === 0 ? (
              <div className="flex items-center justify-center h-[300px] text-muted-foreground text-sm">
                No student data available
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={gpaBuckets}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="range" tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#3b82f6" name="Students" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Enrollment by Month */}
        <Card>
          <CardHeader>
            <CardTitle>Enrollment by Month</CardTitle>
            <CardDescription>Students enrolled per month based on join date</CardDescription>
          </CardHeader>
          <CardContent>
            {enrollmentTrends.length === 0 ? (
              <div className="flex items-center justify-center h-[300px] text-muted-foreground text-sm">
                No enrollment date data available
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={enrollmentTrends}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Area
                    type="monotone"
                    dataKey="enrollments"
                    stroke="#3b82f6"
                    fill="#3b82f6"
                    fillOpacity={0.4}
                    name="New Enrollments"
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Risk by Year Level */}
        <Card>
          <CardHeader>
            <CardTitle>Risk by Year Level</CardTitle>
            <CardDescription>At-risk students and avg GPA per academic year</CardDescription>
          </CardHeader>
          <CardContent>
            {yearData.length === 0 ? (
              <div className="flex items-center justify-center h-[300px] text-muted-foreground text-sm">
                No student data available
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={yearData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="year" />
                  <YAxis yAxisId="left" allowDecimals={false} />
                  <YAxis yAxisId="right" orientation="right" domain={[0, 4]} />
                  <Tooltip />
                  <Legend />
                  <Line
                    yAxisId="left"
                    type="monotone"
                    dataKey="atRisk"
                    stroke="#dc2626"
                    strokeWidth={2}
                    name="At Risk"
                  />
                  <Line
                    yAxisId="left"
                    type="monotone"
                    dataKey="students"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    name="Total Students"
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="avgGPA"
                    stroke="#16a34a"
                    strokeWidth={2}
                    name="Avg GPA"
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Department Performance */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Department Performance</CardTitle>
            <CardDescription>Student count, at-risk students and average GPA by program</CardDescription>
          </CardHeader>
          <CardContent>
            {departmentData.length === 0 ? (
              <div className="flex items-center justify-center h-[300px] text-muted-foreground text-sm">
                No student data available
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={departmentData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="department" tick={{ fontSize: 11 }} />
                  <YAxis yAxisId="left" allowDecimals={false} />
                  <YAxis yAxisId="right" orientation="right" domain={[0, 4]} />
                  <Tooltip />
                  <Legend />
                  <Bar yAxisId="left" dataKey="students" fill="#3b82f6" name="Total Students" radius={[4, 4, 0, 0]} />
                  <Bar yAxisId="left" dataKey="atRisk" fill="#dc2626" name="At Risk" radius={[4, 4, 0, 0]} />
                  <Bar yAxisId="right" dataKey="avgGPA" fill="#16a34a" name="Avg GPA" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
