import { useState, useEffect } from 'react';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Calendar, Clock, Users, CheckCircle, Loader2 } from 'lucide-react';

interface AppointmentDoc {
  id: string;
  studentId: string;
  studentName: string;
  programme: string;
  counsellorId: string;
  type: string;
  date: string;
  time: string;
  status: string;
  notes?: string;
}

const getStatusBadge = (status: string) => {
  switch (status) {
    case 'pending':
      return <Badge className="bg-amber-100 text-amber-800 border-amber-200 text-xs">Pending</Badge>;
    case 'scheduled':
      return <Badge className="bg-blue-100 text-blue-800 border-blue-200 text-xs">Scheduled</Badge>;
    case 'completed':
      return <Badge className="bg-green-100 text-green-800 border-green-200 text-xs">Completed</Badge>;
    case 'cancelled':
      return <Badge className="bg-red-100 text-red-800 border-red-200 text-xs">Cancelled</Badge>;
    default:
      return <Badge className="text-xs">{status}</Badge>;
  }
};

export default function CounsellorDashboard() {
  const { user } = useAuth();
  const [appointments, setAppointments] = useState<AppointmentDoc[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const snap = await getDocs(
          query(collection(db, 'appointments'), orderBy('date', 'asc'))
        );
        const all: AppointmentDoc[] = snap.docs.map((d) => ({
          id: d.id,
          studentId: d.data().studentId ?? '',
          studentName: d.data().studentName ?? '',
          programme: d.data().programme ?? '',
          counsellorId: d.data().counsellorId ?? '',
          type: d.data().type ?? d.data().appointmentType ?? '',
          date: d.data().date ?? '',
          time: d.data().time ?? '',
          status: d.data().status ?? 'pending',
          notes: d.data().notes ?? '',
        }));
        setAppointments(all.filter((a) => a.counsellorId === user?.id));
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [user?.id]);

  const today = new Date().toISOString().split('T')[0];

  const totalCount = appointments.length;
  const upcomingList = appointments
    .filter((a) => a.status === 'scheduled' && a.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time))
    .slice(0, 5);
  const pendingCount = appointments.filter((a) => a.status === 'pending').length;
  const completedCount = appointments.filter((a) => a.status === 'completed').length;

  const recentCompleted = appointments
    .filter((a) => a.status === 'completed')
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 5);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground text-sm mt-1">Student Counsellor overview</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-l-4 border-l-blue-500">
          <CardContent className="pt-5 pb-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Sessions</p>
                <p className="text-3xl font-bold mt-1">{loading ? '—' : totalCount}</p>
                <p className="text-xs text-muted-foreground mt-1">All time</p>
              </div>
              <div className="h-10 w-10 rounded-full bg-blue-50 flex items-center justify-center">
                <Calendar className="h-5 w-5 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-green-500">
          <CardContent className="pt-5 pb-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Upcoming</p>
                <p className="text-3xl font-bold mt-1 text-green-600">
                  {loading ? '—' : upcomingList.length}
                </p>
                <p className="text-xs text-muted-foreground mt-1">Scheduled from today</p>
              </div>
              <div className="h-10 w-10 rounded-full bg-green-50 flex items-center justify-center">
                <Clock className="h-5 w-5 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-amber-500">
          <CardContent className="pt-5 pb-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Pending Requests</p>
                <p className="text-3xl font-bold mt-1 text-amber-600">
                  {loading ? '—' : pendingCount}
                </p>
                <p className="text-xs text-muted-foreground mt-1">Awaiting confirmation</p>
              </div>
              <div className="h-10 w-10 rounded-full bg-amber-50 flex items-center justify-center">
                <Users className="h-5 w-5 text-amber-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-purple-500">
          <CardContent className="pt-5 pb-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Completed Sessions</p>
                <p className="text-3xl font-bold mt-1 text-purple-600">
                  {loading ? '—' : completedCount}
                </p>
                <p className="text-xs text-muted-foreground mt-1">Sessions finished</p>
              </div>
              <div className="h-10 w-10 rounded-full bg-purple-50 flex items-center justify-center">
                <CheckCircle className="h-5 w-5 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Two columns */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Upcoming Appointments */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Upcoming Appointments</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-8 gap-2 text-muted-foreground text-sm">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading...
              </div>
            ) : upcomingList.length === 0 ? (
              <p className="text-center py-8 text-muted-foreground text-sm">No upcoming appointments.</p>
            ) : (
              <div className="space-y-3">
                {upcomingList.map((a) => (
                  <div
                    key={a.id}
                    className="flex items-center justify-between gap-3 p-3 rounded-lg border hover:bg-gray-50"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{a.studentName || '—'}</p>
                      <p className="text-xs text-muted-foreground truncate">{a.type || '—'}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {a.date || '—'}{a.time ? ` · ${a.time}` : ''}
                      </p>
                    </div>
                    {getStatusBadge(a.status)}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Right: Recent Sessions */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent Sessions</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-8 gap-2 text-muted-foreground text-sm">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading...
              </div>
            ) : recentCompleted.length === 0 ? (
              <p className="text-center py-8 text-muted-foreground text-sm">No completed sessions.</p>
            ) : (
              <div className="space-y-3">
                {recentCompleted.map((a) => (
                  <div
                    key={a.id}
                    className="p-3 rounded-lg border hover:bg-gray-50"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-medium text-sm truncate">{a.studentName || '—'}</p>
                      <span className="text-xs text-muted-foreground whitespace-nowrap">{a.date || '—'}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{a.type || '—'}</p>
                    {a.notes && (
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2 italic">
                        {a.notes}
                      </p>
                    )}
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
