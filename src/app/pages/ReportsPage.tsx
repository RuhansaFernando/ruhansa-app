import { useState, useEffect } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebase';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Users, AlertTriangle, Activity, FileText, Loader2, Info } from 'lucide-react';

interface StudentDoc {
  riskLevel: string;
  attendancePercentage: number;
}

export default function ReportsPage() {
  const [students, setStudents] = useState<StudentDoc[]>([]);
  const [interventionCount, setInterventionCount] = useState(0);
  const [loadingStudents, setLoadingStudents] = useState(true);
  const [loadingInterventions, setLoadingInterventions] = useState(true);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'students'), (snap) => {
      setStudents(
        snap.docs.map((d) => ({
          riskLevel: d.data().riskLevel ?? 'low',
          attendancePercentage: d.data().attendancePercentage ?? 100,
        })),
      );
      setLoadingStudents(false);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'interventions'), (snap) => {
      setInterventionCount(snap.size);
      setLoadingInterventions(false);
    });
    return () => unsub();
  }, []);

  const loading = loadingStudents || loadingInterventions;

  const totalStudents = students.length;
  const highRisk = students.filter((s) => s.riskLevel === 'high').length;
  const avgAttendance =
    students.length > 0
      ? (
          students.reduce((sum, s) => sum + s.attendancePercentage, 0) /
          students.length
        ).toFixed(1)
      : '—';

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
        <h1 className="text-3xl font-bold tracking-tight">Reports Overview</h1>
        <p className="text-muted-foreground">System-wide summary for DropGuard IIT</p>
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
            <CardTitle className="text-sm font-medium text-muted-foreground">Average Attendance</CardTitle>
            <div className="h-9 w-9 rounded-full bg-amber-100 flex items-center justify-center">
              <Activity className="h-5 w-5 text-amber-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold text-amber-600">
              {avgAttendance}{avgAttendance !== '—' ? '%' : ''}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Across all students</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-purple-500">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Interventions</CardTitle>
            <div className="h-9 w-9 rounded-full bg-purple-100 flex items-center justify-center">
              <FileText className="h-5 w-5 text-purple-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold text-purple-600">{interventionCount}</div>
            <p className="text-xs text-muted-foreground mt-1">Recorded interventions</p>
          </CardContent>
        </Card>
      </div>

      {/* Info message */}
      <div className="flex items-start gap-3 p-4 border rounded-lg bg-blue-50 border-blue-200">
        <Info className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
        <p className="text-sm text-blue-800">
          Detailed reports are available to Student Support Advisors and Registry from their respective dashboards.
        </p>
      </div>
    </div>
  );
}
