import { useState, useEffect } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Users, Loader2, Flag } from 'lucide-react';

interface StudentDoc {
  id: string;
  studentId: string;
  name: string;
  programme: string;
  attendancePercentage: number;
  flagged: boolean;
  riskLevel: string;
}


export default function SRUDashboard() {
  const { user } = useAuth();
  const [students, setStudents] = useState<StudentDoc[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(true);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'students'), (snap) => {
      setStudents(
        snap.docs.map((d) => ({
          id: d.id,
          studentId: d.data().studentId ?? d.id,
          name: d.data().name ?? '',
          programme: d.data().programme ?? '',
          attendancePercentage: d.data().attendancePercentage ?? 100,
          flagged: d.data().flagged ?? false,
          riskLevel: (d.data().riskLevel ?? 'low').toLowerCase(),
        }))
      );
      setLoadingStudents(false);
    });
    return () => unsub();
  }, []);

  const totalStudents = students.length;
  const flagged       = students.filter((s) => s.flagged).length;
  const highRisk      = students.filter((s) => s.riskLevel === 'high').length;
  const mediumRisk    = students.filter((s) => s.riskLevel === 'medium').length;
  const lowRisk       = students.filter((s) => s.riskLevel === 'low').length;

  if (loadingStudents) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  return (
    <div className="space-y-6">
      {/* Greeting */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          {greeting}, {user?.name} 👋
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} · {totalStudents} students assigned
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="border-l-4 border-l-blue-500">
          <CardContent className="pt-5 pb-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Students</p>
                <p className="text-3xl font-bold mt-1">{totalStudents}</p>
                <p className="text-xs text-muted-foreground mt-1">Enrolled students</p>
              </div>
              <div className="h-10 w-10 rounded-full bg-blue-50 flex items-center justify-center">
                <Users className="h-5 w-5 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-orange-500">
          <CardContent className="pt-5 pb-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Flagged Students</p>
                <p className="text-3xl font-bold mt-1">{flagged}</p>
                <p className="text-xs text-muted-foreground mt-1">Flagged for attention</p>
              </div>
              <div className="h-10 w-10 rounded-full bg-orange-50 flex items-center justify-center">
                <Flag className="h-5 w-5 text-orange-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Risk Distribution */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Student Risk Distribution</CardTitle>
          <p className="text-sm text-muted-foreground">Based on ML dropout risk scores</p>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between p-3 rounded-lg bg-red-50 border border-red-100">
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-full bg-red-500" />
              <span className="text-sm font-medium text-red-700">High Risk</span>
            </div>
            <span className="text-2xl font-bold text-red-700">{highRisk}</span>
          </div>
          <div className="flex items-center justify-between p-3 rounded-lg bg-yellow-50 border border-yellow-100">
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-full bg-yellow-500" />
              <span className="text-sm font-medium text-yellow-700">Medium Risk</span>
            </div>
            <span className="text-2xl font-bold text-yellow-700">{mediumRisk}</span>
          </div>
          <div className="flex items-center justify-between p-3 rounded-lg bg-green-50 border border-green-100">
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-full bg-green-500" />
              <span className="text-sm font-medium text-green-700">Low Risk</span>
            </div>
            <span className="text-2xl font-bold text-green-700">{lowRisk}</span>
          </div>
        </CardContent>
      </Card>

    </div>
  );
}
