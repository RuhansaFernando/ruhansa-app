import { useState, useEffect } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../../firebase';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Users, AlertTriangle, TrendingUp, Loader2 } from 'lucide-react';

const IIT_PROGRAMMES = [
  'BSc (Hons) Business Computing',
  'BSc (Hons) Business Data Analytics',
  'BA (Hons) Business Management',
  'BEng (Hons) Software Engineering',
  'BSc (Hons) Computer Science',
  'BSc (Hons) Artificial Intelligence And Data Science',
];

interface StudentDoc {
  programme: string;
  gpa: number;
}

interface RegistryStaff {
  id: string;
  name: string;
  email: string;
  status: string;
}

export default function AdminRegistryManagementPage() {
  const [students, setStudents] = useState<StudentDoc[]>([]);
  const [registryStaff, setRegistryStaff] = useState<RegistryStaff[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(true);
  const [loadingStaff, setLoadingStaff] = useState(true);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'students'), (snap) => {
      setStudents(
        snap.docs.map((d) => ({
          programme: d.data().programme ?? d.data().program ?? 'Unknown',
          gpa: d.data().gpa ?? 0,
        })),
      );
      setLoadingStudents(false);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    const q = query(collection(db, 'users'), where('role', '==', 'registry'));
    const unsub = onSnapshot(q, (snap) => {
      setRegistryStaff(
        snap.docs.map((d) => ({
          id: d.id,
          name: d.data().name ?? '',
          email: d.data().email ?? '',
          status: d.data().status ?? 'active',
        })),
      );
      setLoadingStaff(false);
    });
    return () => unsub();
  }, []);

  const totalStudents = students.length;
  const belowTwoGpa = students.filter((s) => s.gpa < 2.0).length;
  const avgGpa =
    students.length > 0
      ? (students.reduce((sum, s) => sum + s.gpa, 0) / students.length).toFixed(2)
      : '—';

  const programmeRows = IIT_PROGRAMMES.map((prog) => {
    const group = students.filter((s) => s.programme === prog);
    const avg =
      group.length > 0
        ? (group.reduce((sum, s) => sum + s.gpa, 0) / group.length).toFixed(2)
        : null;
    return {
      programme: prog,
      total: group.length,
      avgGpa: avg,
      belowTwo: group.filter((s) => s.gpa < 2.0).length,
    };
  });

  if (loadingStudents || loadingStaff) {
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
        <h1 className="text-3xl font-bold tracking-tight">Registry Management</h1>
        <p className="text-muted-foreground">Monitor academic performance and Registry activity</p>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
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
            <CardTitle className="text-sm font-medium text-muted-foreground">Below 2.0 GPA</CardTitle>
            <div className="h-9 w-9 rounded-full bg-red-100 flex items-center justify-center">
              <AlertTriangle className="h-5 w-5 text-red-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold text-red-600">{belowTwoGpa}</div>
            <p className="text-xs text-muted-foreground mt-1">Academic risk threshold</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-purple-500">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Average GPA</CardTitle>
            <div className="h-9 w-9 rounded-full bg-purple-100 flex items-center justify-center">
              <TrendingUp className="h-5 w-5 text-purple-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold text-purple-600">{avgGpa}</div>
            <p className="text-xs text-muted-foreground mt-1">Institution-wide</p>
          </CardContent>
        </Card>
      </div>

      {/* Two Columns */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Programme Performance Table */}
        <Card>
          <CardHeader>
            <CardTitle>Programme Performance</CardTitle>
            <p className="text-sm text-muted-foreground">GPA breakdown by programme</p>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-gray-50">
                    <th className="text-left font-medium text-muted-foreground px-3 py-2">Programme</th>
                    <th className="text-center font-medium text-muted-foreground px-3 py-2">Total</th>
                    <th className="text-center font-medium text-muted-foreground px-3 py-2">Avg GPA</th>
                    <th className="text-center font-medium text-muted-foreground px-3 py-2">
                      <span className="text-red-600">Below 2.0</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {programmeRows.map((row) => (
                    <tr key={row.programme} className="border-b last:border-0 hover:bg-gray-50 transition-colors">
                      <td className="px-3 py-2 font-medium max-w-[180px]">
                        <span className="truncate block text-xs">{row.programme}</span>
                      </td>
                      <td className="px-3 py-2 text-center">
                        <span className="font-semibold text-blue-600">{row.total}</span>
                      </td>
                      <td className="px-3 py-2 text-center">
                        {row.avgGpa !== null ? (
                          <span
                            className={`font-semibold ${
                              parseFloat(row.avgGpa) < 2.0 ? 'text-red-600' : 'text-green-600'
                            }`}
                          >
                            {row.avgGpa}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-center">
                        {row.belowTwo > 0 ? (
                          <Badge className="bg-red-100 text-red-800 border-red-200">{row.belowTwo}</Badge>
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

        {/* Registry Staff Table */}
        <Card>
          <CardHeader>
            <CardTitle>Registry Staff</CardTitle>
            <p className="text-sm text-muted-foreground">Staff assigned to the Registry department</p>
          </CardHeader>
          <CardContent>
            {registryStaff.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground text-sm">
                No Registry staff accounts found
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-gray-50">
                      <th className="text-left font-medium text-muted-foreground px-3 py-2">Name</th>
                      <th className="text-left font-medium text-muted-foreground px-3 py-2">Email</th>
                      <th className="text-left font-medium text-muted-foreground px-3 py-2">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {registryStaff.map((staff) => (
                      <tr key={staff.id} className="border-b last:border-0 hover:bg-gray-50 transition-colors">
                        <td className="px-3 py-2 font-medium">{staff.name}</td>
                        <td className="px-3 py-2 text-muted-foreground">{staff.email}</td>
                        <td className="px-3 py-2">
                          <Badge
                            className={
                              staff.status === 'active'
                                ? 'bg-green-100 text-green-800 border-green-200 text-xs'
                                : 'bg-gray-100 text-gray-600 border-gray-200 text-xs'
                            }
                          >
                            {staff.status}
                          </Badge>
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
    </div>
  );
}
