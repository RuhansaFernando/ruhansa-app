import { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy, limit } from 'firebase/firestore';
import { db } from '../../firebase';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Users, AlertTriangle, TrendingUp, Loader2, GraduationCap, BookOpen, Activity, Calendar } from 'lucide-react';
import { useNavigate } from 'react-router';
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

const RISK_TREND = [
  { month: 'Oct', high: 12, medium: 18, low: 35 },
  { month: 'Nov', high: 15, medium: 20, low: 38 },
  { month: 'Dec', high: 10, medium: 22, low: 40 },
  { month: 'Jan', high: 18, medium: 25, low: 42 },
  { month: 'Feb', high: 20, medium: 23, low: 45 },
  { month: 'Mar', high: 16, medium: 21, low: 48 },
];

interface StudentDoc {
  id: string;
  name: string;
  programme: string;
  riskLevel: string;
  riskScore: number;
  attendancePercentage: number;
  consecutiveAbsences: number;
  enrollmentDate: string;
  createdAt: string;
}

interface InterventionDoc {
  id: string;
  studentName: string;
  type: string;
  createdAt: string;
  recordedBy: string;
}

export default function SRUDashboard() {
  const navigate = useNavigate();
  const [students, setStudents] = useState<StudentDoc[]>([]);
  const [interventions, setInterventions] = useState<InterventionDoc[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(true);
  const [loadingInterventions, setLoadingInterventions] = useState(true);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'students'), (snap) => {
      setStudents(
        snap.docs.map((d) => ({
          id: d.id,
          name: d.data().name ?? '',
          programme: d.data().programme ?? d.data().program ?? 'Unknown',
          riskLevel: d.data().riskLevel ?? 'low',
          riskScore: d.data().riskScore ?? 0,
          attendancePercentage: d.data().attendancePercentage ?? 100,
          consecutiveAbsences: d.data().consecutiveAbsences ?? 0,
          enrollmentDate: d.data().enrollmentDate ?? '',
          createdAt: d.data().createdAt ?? '',
        })),
      );
      setLoadingStudents(false);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    const q = query(collection(db, 'interventions'), orderBy('createdAt', 'desc'), limit(5));
    const unsub = onSnapshot(q, (snap) => {
      setInterventions(
        snap.docs.map((d) => ({
          id: d.id,
          studentName: d.data().studentName ?? d.data().student ?? 'Unknown Student',
          type: d.data().type ?? d.data().interventionType ?? 'General',
          createdAt: d.data().createdAt?.toDate?.().toISOString() ?? d.data().createdAt ?? '',
          recordedBy: d.data().recordedBy ?? d.data().advisorName ?? 'Staff',
        })),
      );
      setLoadingInterventions(false);
    });
    return () => unsub();
  }, []);

  // Summary counts
  const totalStudents = students.length;
  const highRisk = students.filter((s) => s.riskLevel === 'high').length;
  const mediumRisk = students.filter((s) => s.riskLevel === 'medium').length;
  const lowAttendance = students.filter((s) => s.attendancePercentage < 80).length;

  // Top 5 students needing immediate attention: high risk OR low attendance, sorted by riskScore desc
  const needsAttention = [...students]
    .filter((s) => s.riskLevel === 'high' || s.attendancePercentage < 80)
    .sort((a, b) => b.riskScore - a.riskScore)
    .slice(0, 5);

  // Attendance overview by programme
  const programmeRows = IIT_PROGRAMMES.map((prog) => {
    const group = students.filter((s) => s.programme === prog);
    const avgAttendance =
      group.length > 0
        ? Math.round(group.reduce((sum, s) => sum + s.attendancePercentage, 0) / group.length)
        : null;
    return {
      programme: prog,
      avgAttendance,
      below75: group.filter((s) => s.attendancePercentage < 80).length,
      consecutiveAbsenceRisk: group.filter((s) => s.consecutiveAbsences >= 3).length,
    };
  });

  const getRiskBadge = (riskLevel: string) => {
    if (riskLevel === 'high')
      return <Badge className="bg-red-100 text-red-800 border-red-200 text-xs">High Risk</Badge>;
    if (riskLevel === 'medium')
      return <Badge className="bg-amber-100 text-amber-800 border-amber-200 text-xs">Medium Risk</Badge>;
    return <Badge className="bg-green-100 text-green-800 border-green-200 text-xs">Low Risk</Badge>;
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '—';
    try {
      return new Date(dateStr).toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  if (loadingStudents) {
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
        <h1 className="text-3xl font-bold tracking-tight">SRU Dashboard</h1>
        <p className="text-muted-foreground">Student Records Unit — overview of student risk and attendance.</p>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
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

        <Card className="border-l-4 border-l-orange-500">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Low Attendance</CardTitle>
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

      {/* Middle Section */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Risk Trend Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Risk Trend Over Time</CardTitle>
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
                <Line type="monotone" dataKey="high" stroke="#dc2626" strokeWidth={2} dot={{ r: 4 }} name="High" />
                <Line type="monotone" dataKey="medium" stroke="#d97706" strokeWidth={2} dot={{ r: 4 }} name="Medium" />
                <Line type="monotone" dataKey="low" stroke="#16a34a" strokeWidth={2} dot={{ r: 4 }} name="Low" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Students Needing Immediate Attention */}
        <Card>
          <CardHeader>
            <CardTitle>Students Needing Immediate Attention</CardTitle>
            <p className="text-sm text-muted-foreground">High risk or low attendance, sorted by risk score</p>
          </CardHeader>
          <CardContent>
            {needsAttention.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-[280px] text-muted-foreground">
                <GraduationCap className="h-10 w-10 mb-3 opacity-30" />
                <p className="text-sm">No students flagged at this time</p>
              </div>
            ) : (
              <div className="space-y-3">
                {needsAttention.map((student) => (
                  <div
                    key={student.id}
                    className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex-1 min-w-0 mr-3">
                      <p className="font-medium text-sm truncate">{student.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{student.programme}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span
                          className={`text-xs font-medium ${
                            student.attendancePercentage < 80 ? 'text-red-600' : 'text-green-600'
                          }`}
                        >
                          {student.attendancePercentage}% attendance
                        </span>
                        {getRiskBadge(student.riskLevel)}
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs flex-shrink-0"
                      onClick={() => navigate(`/sru/student/${student.id}`)}
                    >
                      View Student
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Bottom Section */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Attendance Overview by Programme */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-muted-foreground" />
              <CardTitle>Attendance Overview by Programme</CardTitle>
            </div>
            <p className="text-sm text-muted-foreground">
              Average attendance and absence risk per programme
            </p>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-gray-50">
                    <th className="text-left font-medium text-muted-foreground px-3 py-2">Programme</th>
                    <th className="text-center font-medium text-muted-foreground px-3 py-2">Avg Att %</th>
                    <th className="text-center font-medium text-muted-foreground px-3 py-2">
                      <span className="text-orange-600">Below 80%</span>
                    </th>
                    <th className="text-center font-medium text-muted-foreground px-3 py-2">
                      <span className="text-red-600">Consec. Risk</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {programmeRows.map((row) => (
                    <tr
                      key={row.programme}
                      className="border-b last:border-0 hover:bg-gray-50 transition-colors"
                    >
                      <td className="px-3 py-2 font-medium max-w-[180px]">
                        <span className="truncate block text-xs">{row.programme}</span>
                      </td>
                      <td className="px-3 py-2 text-center">
                        {row.avgAttendance !== null ? (
                          <span
                            className={`font-semibold text-sm ${
                              row.avgAttendance < 80 ? 'text-red-600' : 'text-green-600'
                            }`}
                          >
                            {row.avgAttendance}%
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-center">
                        {row.below75 > 0 ? (
                          <Badge className="bg-orange-100 text-orange-800 border-orange-200">
                            {row.below75}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-center">
                        {row.consecutiveAbsenceRisk > 0 ? (
                          <Badge className="bg-red-100 text-red-800 border-red-200">
                            {row.consecutiveAbsenceRisk}
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
          </CardContent>
        </Card>

        {/* Recent Interventions */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-muted-foreground" />
              <CardTitle>Recent Interventions</CardTitle>
            </div>
            <p className="text-sm text-muted-foreground">5 most recent intervention records</p>
          </CardHeader>
          <CardContent>
            {loadingInterventions ? (
              <div className="flex items-center justify-center h-48">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : interventions.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 text-muted-foreground">
                <Calendar className="h-10 w-10 mb-3 opacity-30" />
                <p className="text-sm">No interventions recorded yet</p>
              </div>
            ) : (
              <div className="space-y-3">
                {interventions.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-start justify-between p-3 border rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{item.studentName}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{item.type}</p>
                      <p className="text-xs text-muted-foreground">By: {item.recordedBy}</p>
                    </div>
                    <span className="text-xs text-muted-foreground flex-shrink-0 ml-3 mt-0.5">
                      {formatDate(item.createdAt)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
