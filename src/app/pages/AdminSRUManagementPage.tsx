import { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy, limit, where } from 'firebase/firestore';
import { db } from '../../firebase';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Users, AlertTriangle, Activity, Loader2 } from 'lucide-react';

interface StudentDoc {
  riskLevel: string;
  attendancePercentage: number;
}

interface InterventionDoc {
  id: string;
  studentName: string;
  type: string;
  createdAt: string;
  recordedBy: string;
}

interface SRUStaff {
  id: string;
  name: string;
  email: string;
  status: string;
}

const formatDate = (dateStr: string) => {
  if (!dateStr) return '—';
  try {
    return new Date(dateStr).toLocaleDateString('en-GB', {
      day: 'numeric', month: 'short', year: 'numeric',
    });
  } catch {
    return dateStr;
  }
};

export default function AdminSRUManagementPage() {
  const [students, setStudents] = useState<StudentDoc[]>([]);
  const [interventions, setInterventions] = useState<InterventionDoc[]>([]);
  const [sruStaff, setSruStaff] = useState<SRUStaff[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(true);
  const [loadingInterventions, setLoadingInterventions] = useState(true);
  const [loadingStaff, setLoadingStaff] = useState(true);

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
    const q = query(collection(db, 'interventions'), orderBy('createdAt', 'desc'), limit(10));
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

  useEffect(() => {
    const q = query(collection(db, 'users'), where('role', '==', 'sru'));
    const unsub = onSnapshot(q, (snap) => {
      setSruStaff(
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

  const totalInterventions = interventions.length; // shown count; we use onSnapshot size
  const monitored = students.filter((s) => s.riskLevel === 'high' || s.riskLevel === 'medium').length;
  const lowAttendance = students.filter((s) => s.attendancePercentage < 75).length;

  // For total interventions we need all docs, so listen without limit for count
  const [totalInterventionCount, setTotalInterventionCount] = useState(0);
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'interventions'), (snap) => {
      setTotalInterventionCount(snap.size);
    });
    return () => unsub();
  }, []);

  const loading = loadingStudents || loadingInterventions || loadingStaff;

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
        <h1 className="text-3xl font-bold tracking-tight">SRU Management</h1>
        <p className="text-muted-foreground">Monitor Student Support Advisor activity and interventions</p>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-l-4 border-l-teal-500">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Interventions</CardTitle>
            <div className="h-9 w-9 rounded-full bg-teal-100 flex items-center justify-center">
              <Activity className="h-5 w-5 text-teal-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold text-teal-600">{totalInterventionCount}</div>
            <p className="text-xs text-muted-foreground mt-1">Recorded interventions</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-amber-500">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Students Being Monitored</CardTitle>
            <div className="h-9 w-9 rounded-full bg-amber-100 flex items-center justify-center">
              <Users className="h-5 w-5 text-amber-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold text-amber-600">{monitored}</div>
            <p className="text-xs text-muted-foreground mt-1">High or medium risk</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-red-500">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Low Attendance Students</CardTitle>
            <div className="h-9 w-9 rounded-full bg-red-100 flex items-center justify-center">
              <AlertTriangle className="h-5 w-5 text-red-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold text-red-600">{lowAttendance}</div>
            <p className="text-xs text-muted-foreground mt-1">Below 75% attendance</p>
          </CardContent>
        </Card>
      </div>

      {/* Two Columns */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Recent Interventions Table */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Interventions</CardTitle>
            <p className="text-sm text-muted-foreground">10 most recent intervention records</p>
          </CardHeader>
          <CardContent>
            {interventions.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground text-sm">
                No interventions recorded yet
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-gray-50">
                      <th className="text-left font-medium text-muted-foreground px-3 py-2">Date</th>
                      <th className="text-left font-medium text-muted-foreground px-3 py-2">Student</th>
                      <th className="text-left font-medium text-muted-foreground px-3 py-2">Type</th>
                      <th className="text-left font-medium text-muted-foreground px-3 py-2">Recorded By</th>
                    </tr>
                  </thead>
                  <tbody>
                    {interventions.map((item) => (
                      <tr key={item.id} className="border-b last:border-0 hover:bg-gray-50 transition-colors">
                        <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">
                          {formatDate(item.createdAt)}
                        </td>
                        <td className="px-3 py-2 font-medium">{item.studentName}</td>
                        <td className="px-3 py-2 text-muted-foreground">{item.type}</td>
                        <td className="px-3 py-2 text-muted-foreground">{item.recordedBy}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* SRU Staff Table */}
        <Card>
          <CardHeader>
            <CardTitle>Student Support Advisors</CardTitle>
            <p className="text-sm text-muted-foreground">Staff assigned to the Student Records Unit</p>
          </CardHeader>
          <CardContent>
            {sruStaff.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground text-sm">
                No Student Support Advisor accounts found
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
                    {sruStaff.map((staff) => (
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
