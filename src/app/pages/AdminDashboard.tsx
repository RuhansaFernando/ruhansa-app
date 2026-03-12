import { useState, useEffect } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebase';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Users, AlertTriangle, TrendingUp, Loader2, GraduationCap, BookOpen } from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

const IIT_PROGRAMMES = [
  'BSc (Hons) Business Computing',
  'BSc (Hons) Business Data Analytics',
  'BA (Hons) Business Management',
  'BEng (Hons) Software Engineering',
  'BSc (Hons) Computer Science',
  'BSc (Hons) Artificial Intelligence And Data Science',
];

// Dummy trend data for last 6 months
const RISK_TREND = [
  { month: 'Oct',  high: 12, medium: 18, low: 35 },
  { month: 'Nov',  high: 15, medium: 20, low: 38 },
  { month: 'Dec',  high: 10, medium: 22, low: 40 },
  { month: 'Jan',  high: 18, medium: 25, low: 42 },
  { month: 'Feb',  high: 20, medium: 23, low: 45 },
  { month: 'Mar',  high: 16, medium: 21, low: 48 },
];

interface StudentDoc {
  id: string;
  name: string;
  programme: string;
  riskLevel: string;
  attendancePercentage: number;
  enrollmentDate: string;
  createdAt: string;
}

export default function AdminDashboard() {
  const [students, setStudents] = useState<StudentDoc[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'students'), (snap) => {
      setStudents(
        snap.docs.map((d) => ({
          id: d.id,
          name: d.data().name ?? '',
          programme: d.data().programme ?? d.data().program ?? 'Unknown',
          riskLevel: d.data().riskLevel ?? 'low',
          attendancePercentage: d.data().attendancePercentage ?? 100,
          enrollmentDate: d.data().enrollmentDate ?? '',
          createdAt: d.data().createdAt ?? '',
        })),
      );
      setLoading(false);
    });
    return () => unsub();
  }, []);

  // ── Summary counts ────────────────────────────────────────────────────────────
  const totalStudents  = students.length;
  const highRisk       = students.filter((s) => s.riskLevel === 'high').length;
  const mediumRisk     = students.filter((s) => s.riskLevel === 'medium').length;
  const lowRisk        = students.filter((s) => s.riskLevel === 'low').length;

  // ── Recent high-risk alerts (5 most recent by createdAt) ──────────────────────
  const recentHighRisk = [...students]
    .filter((s) => s.riskLevel === 'high')
    .sort((a, b) => {
      if (!a.createdAt && !b.createdAt) return 0;
      if (!a.createdAt) return 1;
      if (!b.createdAt) return -1;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    })
    .slice(0, 5);

  // ── By-programme table ────────────────────────────────────────────────────────
  const programmeRows = IIT_PROGRAMMES.map((prog) => {
    const group = students.filter((s) => s.programme === prog);
    return {
      programme: prog,
      total: group.length,
      highRisk: group.filter((s) => s.riskLevel === 'high').length,
      mediumRisk: group.filter((s) => s.riskLevel === 'medium').length,
      lowAttendance: group.filter((s) => s.attendancePercentage < 75).length,
    };
  });

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
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">Welcome back. Here's your student risk overview.</p>
      </div>

      {/* ── Summary Cards ── */}
      <div className="grid gap-4 md:grid-cols-4">
        {/* Total Students */}
        <Card className="border-l-4 border-l-blue-500">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Students</CardTitle>
            <div className="h-9 w-9 rounded-full bg-blue-100 flex items-center justify-center">
              <Users className="h-5 w-5 text-blue-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold text-blue-600">{totalStudents}</div>
            <p className="text-xs text-muted-foreground mt-1">Enrolled students</p>
          </CardContent>
        </Card>

        {/* High Risk */}
        <Card className="border-l-4 border-l-red-500">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">High Risk Students</CardTitle>
            <div className="h-9 w-9 rounded-full bg-red-100 flex items-center justify-center">
              <AlertTriangle className="h-5 w-5 text-red-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold text-red-600">{highRisk}</div>
            <p className="text-xs text-muted-foreground mt-1">Require immediate attention</p>
          </CardContent>
        </Card>

        {/* Medium Risk */}
        <Card className="border-l-4 border-l-amber-500">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Medium Risk Students</CardTitle>
            <div className="h-9 w-9 rounded-full bg-amber-100 flex items-center justify-center">
              <TrendingUp className="h-5 w-5 text-amber-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold text-amber-600">{mediumRisk}</div>
            <p className="text-xs text-muted-foreground mt-1">Under active monitoring</p>
          </CardContent>
        </Card>

        {/* Low Risk */}
        <Card className="border-l-4 border-l-green-500">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Low Risk Students</CardTitle>
            <div className="h-9 w-9 rounded-full bg-green-100 flex items-center justify-center">
              <GraduationCap className="h-5 w-5 text-green-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold text-green-600">{lowRisk}</div>
            <p className="text-xs text-muted-foreground mt-1">Performing well</p>
          </CardContent>
        </Card>
      </div>

      {/* ── Middle: Chart + Alerts ── */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Dropout Risk Trend */}
        <Card>
          <CardHeader>
            <CardTitle>Dropout Risk Trend</CardTitle>
            <p className="text-sm text-muted-foreground">Risk level counts over the past 6 months</p>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={RISK_TREND}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="high"   stroke="#dc2626" strokeWidth={2} dot={{ r: 4 }} name="High" />
                <Line type="monotone" dataKey="medium" stroke="#d97706" strokeWidth={2} dot={{ r: 4 }} name="Medium" />
                <Line type="monotone" dataKey="low"    stroke="#16a34a" strokeWidth={2} dot={{ r: 4 }} name="Low" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Recent High Risk Alerts */}
        <Card>
          <CardHeader>
            <CardTitle>Recent High Risk Alerts</CardTitle>
            <p className="text-sm text-muted-foreground">5 most recently added high-risk students</p>
          </CardHeader>
          <CardContent>
            {recentHighRisk.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-[280px] text-muted-foreground">
                <AlertTriangle className="h-10 w-10 mb-3 opacity-30" />
                <p className="text-sm">No high-risk students found</p>
              </div>
            ) : (
              <div className="space-y-3">
                {recentHighRisk.map((student) => (
                  <div
                    key={student.id}
                    className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                        <GraduationCap className="h-4 w-4 text-red-600" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-sm truncate">{student.name}</p>
                        <p className="text-xs text-muted-foreground truncate max-w-[180px]">
                          {student.programme}
                        </p>
                        {student.enrollmentDate && (
                          <p className="text-xs text-muted-foreground">
                            Enrolled {new Date(student.enrollmentDate).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                    </div>
                    <Badge className="bg-red-100 text-red-800 border-red-200 text-xs flex-shrink-0">
                      High Risk
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── At-Risk Students by Programme ── */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-muted-foreground" />
            <CardTitle>At-Risk Students by Programme</CardTitle>
          </div>
          <p className="text-sm text-muted-foreground">
            Breakdown of risk levels and low attendance (&lt;75%) per programme
          </p>
        </CardHeader>
        <CardContent>
          {totalStudents === 0 ? (
            <div className="text-center py-10 text-muted-foreground text-sm">
              No student data available yet
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-gray-50">
                    <th className="text-left font-medium text-muted-foreground px-4 py-3">Programme</th>
                    <th className="text-center font-medium text-muted-foreground px-4 py-3">Total Students</th>
                    <th className="text-center font-medium text-muted-foreground px-4 py-3">
                      <span className="text-red-600">High Risk</span>
                    </th>
                    <th className="text-center font-medium text-muted-foreground px-4 py-3">
                      <span className="text-amber-600">Medium Risk</span>
                    </th>
                    <th className="text-center font-medium text-muted-foreground px-4 py-3">
                      <span className="text-orange-600">Low Attendance</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {programmeRows.map((row) => (
                    <tr
                      key={row.programme}
                      className="border-b last:border-0 hover:bg-gray-50 transition-colors"
                    >
                      <td className="px-4 py-3 font-medium max-w-[260px]">
                        <span className="truncate block">{row.programme}</span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="font-semibold text-blue-600">{row.total}</span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {row.highRisk > 0 ? (
                          <Badge className="bg-red-100 text-red-800 border-red-200">
                            {row.highRisk}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {row.mediumRisk > 0 ? (
                          <Badge className="bg-amber-100 text-amber-800 border-amber-200">
                            {row.mediumRisk}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {row.lowAttendance > 0 ? (
                          <Badge className="bg-orange-100 text-orange-800 border-orange-200">
                            {row.lowAttendance}
                          </Badge>
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
