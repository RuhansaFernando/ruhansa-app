import { useState, useEffect } from 'react';
import { collection, onSnapshot, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Users, Loader2, Flag, Calendar, Clock } from 'lucide-react';
import { useNavigate } from 'react-router';

interface StudentDoc {
  id: string;
  studentId: string;
  name: string;
  programme: string;
  attendancePercentage: number;
  flagged: boolean;
}

interface AppointmentDoc {
  id: string;
  studentName: string;
  type: string;
  time: string;
  status: string;
}

export default function SRUDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [students, setStudents] = useState<StudentDoc[]>([]);
  const [todayAppts, setTodayAppts] = useState<AppointmentDoc[]>([]);
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
        }))
      );
      setLoadingStudents(false);
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

  const totalStudents = students.length;
  const flagged       = students.filter((s) => s.flagged).length;

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

      {/* Two column: Risk Pending notice + Today's Appointments */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Risk Scores Pending */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Student Risk Scores</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg border border-blue-100 bg-blue-50 p-4 text-sm text-blue-700">
              <p className="font-medium">Risk Scores Pending</p>
              <p className="mt-1 text-blue-600">
                Student dropout risk scores will appear here once the ML model is connected.
                Attendance and academic data is being collected.
              </p>
            </div>
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

    </div>
  );
}
