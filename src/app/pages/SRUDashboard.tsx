import { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy, limit, where, getDocs } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Users, AlertTriangle, TrendingUp, Loader2, Flag, Calendar, Clock } from 'lucide-react';
import { useNavigate } from 'react-router';

interface StudentDoc {
  id: string;
  name: string;
  programme: string;
  riskLevel: string;
  riskScore: number;
  attendancePercentage: number;
  flagged: boolean;
}

interface InterventionDoc {
  id: string;
  studentName: string;
  interventionType: string;
  createdAt: any;
  recordedBy: string;
}

interface AppointmentDoc {
  id: string;
  studentName: string;
  type: string;
  time: string;
  status: string;
}

const getRiskBadge = (riskLevel: string) => {
  if (riskLevel === 'critical')
    return <Badge className="bg-red-100 text-red-800 border-red-200 text-xs">Critical</Badge>;
  if (riskLevel === 'high')
    return <Badge className="bg-red-100 text-red-800 border-red-200 text-xs">High Risk</Badge>;
  if (riskLevel === 'medium')
    return <Badge className="bg-amber-100 text-amber-800 border-amber-200 text-xs">Medium Risk</Badge>;
  return <Badge className="bg-green-100 text-green-800 border-green-200 text-xs">Low Risk</Badge>;
};

const formatDate = (val: any) => {
  if (!val) return '—';
  try {
    const d = val?.toDate ? val.toDate() : new Date(val);
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return '—';
  }
};

export default function SRUDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [students, setStudents] = useState<StudentDoc[]>([]);
  const [interventions, setInterventions] = useState<InterventionDoc[]>([]);
  const [todayAppts, setTodayAppts] = useState<AppointmentDoc[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(true);
  const [loadingInterventions, setLoadingInterventions] = useState(true);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'students'), (snap) => {
      setStudents(
        snap.docs.map((d) => ({
          id: d.id,
          name: d.data().name ?? '',
          programme: d.data().programme ?? '',
          riskLevel: d.data().riskLevel ?? 'low',
          riskScore: d.data().riskScore ?? 0,
          attendancePercentage: d.data().attendancePercentage ?? 100,
          flagged: d.data().flagged ?? false,
        }))
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
          studentName: d.data().studentName ?? '',
          interventionType: d.data().interventionType ?? d.data().type ?? '',
          createdAt: d.data().createdAt,
          recordedBy: d.data().recordedBy ?? '',
        }))
      );
      setLoadingInterventions(false);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];
    const fetchTodayAppts = async () => {
      const snap = await getDocs(
        query(
          collection(db, 'appointments'),
          where('date', '==', today),
          where('status', '==', 'scheduled')
        )
      );
      setTodayAppts(
        snap.docs.slice(0, 3).map((d) => ({
          id: d.id,
          studentName: d.data().studentName ?? '—',
          type: d.data().type ?? d.data().appointmentType ?? '—',
          time: d.data().time ?? '—',
          status: d.data().status ?? 'scheduled',
        }))
      );
    };
    fetchTodayAppts();
  }, []);

  const totalStudents  = students.length;
  const highRisk       = students.filter((s) => s.riskLevel === 'high' || s.riskLevel === 'critical').length;
  const mediumRisk     = students.filter((s) => s.riskLevel === 'medium').length;
  const flagged        = students.filter((s) => s.flagged).length;

  const criticalCount  = students.filter((s) => s.riskLevel === 'critical').length;
  const highCount      = students.filter((s) => s.riskLevel === 'high').length;
  const mediumCount    = students.filter((s) => s.riskLevel === 'medium').length;
  const lowCount       = students.filter((s) => s.riskLevel === 'low').length;

  const highRiskStudents = [...students]
    .filter((s) => s.riskLevel === 'high' || s.riskLevel === 'critical')
    .sort((a, b) => b.riskScore - a.riskScore)
    .slice(0, 5);

  if (loadingStudents) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const riskRows = [
    { label: 'Critical', count: criticalCount, colour: 'bg-red-500',   text: 'text-red-700'   },
    { label: 'High',     count: highCount,     colour: 'bg-orange-500', text: 'text-orange-700' },
    { label: 'Medium',   count: mediumCount,   colour: 'bg-amber-500',  text: 'text-amber-700'  },
    { label: 'Low',      count: lowCount,      colour: 'bg-green-500',  text: 'text-green-700'  },
  ];

  return (
    <div className="space-y-6">
      {/* Greeting */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          Good morning, {user?.name} 👋
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} · {totalStudents} students assigned
        </p>
      </div>

      {/* Critical alert banner */}
      {highRisk > 0 && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 text-red-600 flex-shrink-0" />
          <p className="text-sm text-red-900 font-medium flex-1">
            {highRisk} high risk student{highRisk > 1 ? 's' : ''} require immediate attention.
          </p>
          <Button size="sm" className="bg-red-600 hover:bg-red-700 text-xs" onClick={() => navigate('/sru/alerts')}>
            View Alerts →
          </Button>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
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

        <Card className="border-l-4 border-l-red-500">
          <CardContent className="pt-5 pb-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">High Risk</p>
                <p className="text-3xl font-bold mt-1">{highRisk}</p>
                <p className="text-xs text-muted-foreground mt-1">Immediate attention</p>
              </div>
              <div className="h-10 w-10 rounded-full bg-red-50 flex items-center justify-center">
                <AlertTriangle className="h-5 w-5 text-red-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-amber-500">
          <CardContent className="pt-5 pb-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Medium Risk</p>
                <p className="text-3xl font-bold mt-1">{mediumRisk}</p>
                <p className="text-xs text-muted-foreground mt-1">Active monitoring</p>
              </div>
              <div className="h-10 w-10 rounded-full bg-amber-50 flex items-center justify-center">
                <TrendingUp className="h-5 w-5 text-amber-600" />
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

      {/* Two column: High Risk + Today's Appointments */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* High Risk Students */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">High Risk Students</CardTitle>
            <p className="text-sm text-muted-foreground">Top 5 by risk score</p>
          </CardHeader>
          <CardContent>
            {highRiskStudents.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
                <AlertTriangle className="h-8 w-8 mb-2 opacity-30" />
                <p className="text-sm">No high risk students</p>
              </div>
            ) : (
              <div className="space-y-2">
                {highRiskStudents.map((student) => (
                  <div
                    key={student.id}
                    className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50"
                  >
                    <div className="flex-1 min-w-0 mr-3">
                      <p className="font-medium text-sm truncate">{student.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{student.programme || '—'}</p>
                      <div className="flex items-center gap-3 mt-1">
                        <span className={`text-xs font-medium ${student.attendancePercentage < 80 ? 'text-red-600' : 'text-gray-600'}`}>
                          Att: {student.attendancePercentage}%
                        </span>
                        <span className="text-xs text-muted-foreground">Score: {student.riskScore}</span>
                        {getRiskBadge(student.riskLevel)}
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs flex-shrink-0 border-blue-200 text-blue-700 hover:bg-blue-50"
                      onClick={() => navigate('/sru/interventions')}
                    >
                      Log Intervention
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Today's Appointments */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Today's Appointments</CardTitle>
            <p className="text-sm text-muted-foreground">Scheduled for today</p>
          </CardHeader>
          <CardContent>
            {todayAppts.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
                <Calendar className="h-8 w-8 mb-2 opacity-30" />
                <p className="text-sm">No appointments scheduled for today</p>
              </div>
            ) : (
              <div className="space-y-2">
                {todayAppts.map((appt) => (
                  <div key={appt.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50">
                    <div className="flex-1 min-w-0 mr-3">
                      <p className="font-medium text-sm truncate">{appt.studentName}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{appt.type}</p>
                      <div className="flex items-center gap-1 mt-1">
                        <Clock className="h-3 w-3 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">{appt.time}</span>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs flex-shrink-0"
                      onClick={() => navigate('/sru/appointments')}
                    >
                      Notes
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Two column: Quick Actions + Risk Distribution */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-2">
              <Button className="w-full bg-blue-600 hover:bg-blue-700" onClick={() => window.open('https://calendar.app.google/Qe1kXJxE1i1oifoX6', '_blank')}>
                + Schedule Appointment
              </Button>
              <Button variant="outline" className="w-full" onClick={() => navigate('/sru/interventions')}>
                + Log Intervention
              </Button>
              <Button variant="outline" className="w-full" onClick={() => navigate('/sru/alerts')}>
                Review Pending Alerts
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Risk Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Risk Distribution</CardTitle>
            <p className="text-sm text-muted-foreground">Breakdown across all students</p>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {riskRows.map((row) => (
                <div key={row.label}>
                  <div className="flex items-center justify-between mb-1">
                    <span className={`text-sm font-medium ${row.text}`}>{row.label}</span>
                    <span className="text-sm font-semibold text-gray-700">{row.count}</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${row.colour}`}
                      style={{ width: totalStudents > 0 ? `${(row.count / totalStudents) * 100}%` : '0%' }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Interventions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent Interventions</CardTitle>
          <p className="text-sm text-muted-foreground">5 most recent records</p>
        </CardHeader>
        <CardContent>
          {loadingInterventions ? (
            <div className="flex items-center justify-center h-24">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : interventions.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-24 text-muted-foreground">
              <Calendar className="h-8 w-8 mb-2 opacity-30" />
              <p className="text-sm">No interventions recorded yet</p>
            </div>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {interventions.map((item) => (
                <div key={item.id} className="p-3 border rounded-lg hover:bg-gray-50">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{item.studentName}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{item.interventionType}</p>
                      <p className="text-xs text-muted-foreground">By: {item.recordedBy}</p>
                    </div>
                    <span className="text-xs text-muted-foreground flex-shrink-0 ml-3">
                      {formatDate(item.createdAt)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
