import { useState, useEffect } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../firebase';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Users, BookOpen, GraduationCap, Clock, Loader2 } from 'lucide-react';

export default function AdminRegistryManagementPage() {
  const [loading, setLoading] = useState(true);
  const [totalStudents, setTotalStudents] = useState(0);
  const [totalProgrammes, setTotalProgrammes] = useState(0);
  const [totalModules, setTotalModules] = useState(0);
  const [pendingActivations, setPendingActivations] = useState(0);

  useEffect(() => {
    const load = async () => {
      try {
        const [studentsSnap, programmesSnap, modulesSnap] = await Promise.all([
          getDocs(collection(db, 'students')),
          getDocs(collection(db, 'programmes')),
          getDocs(collection(db, 'modules')),
        ]);

        setTotalStudents(studentsSnap.size);
        setTotalProgrammes(programmesSnap.size);
        setTotalModules(modulesSnap.size);

        const pending = studentsSnap.docs.filter((d) => !d.data().accountActivated).length;
        setPendingActivations(pending);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Registry Dashboard</h1>
          <p className="text-muted-foreground text-sm mt-1">Overview of student enrollment and academic programmes</p>
        </div>
        <Badge variant="outline" className="text-sm px-3 py-1.5">Academic Year 2025/2026</Badge>
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

        <Card className="border-l-4 border-l-purple-500">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Programmes</CardTitle>
            <div className="h-9 w-9 rounded-full bg-purple-100 flex items-center justify-center">
              <GraduationCap className="h-5 w-5 text-purple-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold text-purple-600">{totalProgrammes}</div>
            <p className="text-xs text-muted-foreground mt-1">Active programmes</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-green-500">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Modules</CardTitle>
            <div className="h-9 w-9 rounded-full bg-green-100 flex items-center justify-center">
              <BookOpen className="h-5 w-5 text-green-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold text-green-600">{totalModules}</div>
            <p className="text-xs text-muted-foreground mt-1">Registered modules</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-orange-500">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Pending Activations</CardTitle>
            <div className="h-9 w-9 rounded-full bg-orange-100 flex items-center justify-center">
              <Clock className="h-5 w-5 text-orange-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold text-orange-600">{pendingActivations}</div>
            <p className="text-xs text-muted-foreground mt-1">Accounts not yet activated</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
