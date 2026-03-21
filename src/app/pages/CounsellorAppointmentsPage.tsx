import { useState, useEffect, useMemo } from 'react';
import { collection, getDocs, doc, updateDoc, query, orderBy } from 'firebase/firestore';
import { db } from '../../firebase';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Input } from '../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '../components/ui/dialog';
import { Calendar, Clock, Users, Loader2, Search } from 'lucide-react';
import { useAuth } from '../AuthContext';
import { CALENDAR_LINKS } from '../config/calendarLinks';

interface AppointmentDoc {
  id: string;
  studentId: string;
  studentName: string;
  programme: string;
  counsellorId: string;
  type: string;
  date: string;
  time: string;
  status: 'pending' | 'scheduled' | 'completed' | 'cancelled';
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

const todayStr = () => new Date().toISOString().split('T')[0];

const getWeekRange = () => {
  const now = new Date();
  const start = new Date(now);
  start.setDate(now.getDate() - now.getDay());
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return {
    start: start.toISOString().split('T')[0],
    end: end.toISOString().split('T')[0],
  };
};

const getMonthRange = () => {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
  return { start, end };
};

export default function CounsellorAppointmentsPage() {
  const { user } = useAuth();
  const [appointments, setAppointments] = useState<AppointmentDoc[]>([]);
  const [studentMap, setStudentMap] = useState<Record<string, { name: string; programme: string }>>({});
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [notesAppt, setNotesAppt] = useState<AppointmentDoc | null>(null);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('all');

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [apptSnap, studentSnap] = await Promise.all([
          getDocs(query(collection(db, 'appointments'), orderBy('date', 'desc'))),
          getDocs(collection(db, 'students')),
        ]);

        const map: Record<string, { name: string; programme: string }> = {};
        studentSnap.forEach((d) => {
          map[d.id] = { name: d.data().name ?? '', programme: d.data().programme ?? '' };
        });
        setStudentMap(map);

        setAppointments(
          apptSnap.docs
            .map((d) => ({
              id: d.id,
              studentId: d.data().studentId ?? '',
              studentName: d.data().studentName ?? map[d.data().studentId]?.name ?? '',
              programme: d.data().programme ?? map[d.data().studentId]?.programme ?? '',
              counsellorId: d.data().counsellorId ?? '',
              type: d.data().type ?? d.data().appointmentType ?? '',
              date: d.data().date ?? '',
              time: d.data().time ?? '',
              status: d.data().status ?? 'pending',
              notes: d.data().notes ?? '',
            }))
            .filter((a) => a.counsellorId === user?.id)
        );
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [user?.id]);

  const updateStatus = async (id: string, status: AppointmentDoc['status']) => {
    setUpdatingId(id);
    try {
      await updateDoc(doc(db, 'appointments', id), { status });
      setAppointments((prev) => prev.map((a) => (a.id === id ? { ...a, status } : a)));
    } finally {
      setUpdatingId(null);
    }
  };

  const today = todayStr();
  const totalCount = appointments.length;
  const upcomingCount = appointments.filter((a) => a.status === 'scheduled' && a.date >= today).length;
  const pendingCount = appointments.filter((a) => a.status === 'pending').length;

  const filtered = useMemo(() => {
    let list = appointments;
    if (statusFilter !== 'all') list = list.filter((a) => a.status === statusFilter);
    if (dateFilter === 'today') {
      list = list.filter((a) => a.date === today);
    } else if (dateFilter === 'week') {
      const { start, end } = getWeekRange();
      list = list.filter((a) => a.date >= start && a.date <= end);
    } else if (dateFilter === 'month') {
      const { start, end } = getMonthRange();
      list = list.filter((a) => a.date >= start && a.date <= end);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (a) =>
          a.studentName.toLowerCase().includes(q) ||
          (studentMap[a.studentId]?.name ?? '').toLowerCase().includes(q)
      );
    }
    return list.sort((a, b) => {
      if (a.date !== b.date) return b.date.localeCompare(a.date);
      return b.time.localeCompare(a.time);
    });
  }, [appointments, statusFilter, dateFilter, search, studentMap, today]);

  const resolvedName = (a: AppointmentDoc) => a.studentName || studentMap[a.studentId]?.name || '—';
  const resolvedProgramme = (a: AppointmentDoc) => a.programme || studentMap[a.studentId]?.programme || '—';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Appointments</h1>
        <p className="text-muted-foreground text-sm mt-1">Manage student appointment requests</p>
      </div>

      <div className="rounded-lg border border-purple-200 bg-purple-50 px-4 py-3 flex items-center gap-3">
        <span className="text-purple-600 text-xl">🧠</span>
        <div className="flex-1">
          <p className="text-sm font-medium text-purple-900">Students book directly via your Google Calendar</p>
          <p className="text-xs text-purple-700 mt-0.5">Both SSA referrals and direct student bookings go through your calendar link. Fully confidential.</p>
        </div>
        <Button size="sm" variant="outline" className="border-purple-300 text-purple-700 hover:bg-purple-100 flex-shrink-0 text-xs"
          onClick={() => window.open(CALENDAR_LINKS.counsellor, '_blank')}>
          View My Calendar →
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-l-4 border-l-blue-500">
          <CardContent className="pt-5 pb-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Appointments</p>
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
                <p className="text-3xl font-bold mt-1 text-green-600">{loading ? '—' : upcomingCount}</p>
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
                <p className="text-3xl font-bold mt-1 text-amber-600">{loading ? '—' : pendingCount}</p>
                <p className="text-xs text-muted-foreground mt-1">Awaiting confirmation</p>
              </div>
              <div className="h-10 w-10 rounded-full bg-amber-50 flex items-center justify-center">
                <Users className="h-5 w-5 text-amber-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by student name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="scheduled">Scheduled</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
        <Select value={dateFilter} onValueChange={setDateFilter}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Date" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Dates</SelectItem>
            <SelectItem value="today">Today</SelectItem>
            <SelectItem value="week">This Week</SelectItem>
            <SelectItem value="month">This Month</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="rounded-lg border bg-white overflow-x-auto">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground gap-2 text-sm">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading appointments...
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-gray-50">
                <th className="text-left font-medium text-muted-foreground px-4 py-3">Date</th>
                <th className="text-left font-medium text-muted-foreground px-4 py-3">Time</th>
                <th className="text-left font-medium text-muted-foreground px-4 py-3">Student Name</th>
                <th className="text-left font-medium text-muted-foreground px-4 py-3">Programme</th>
                <th className="text-left font-medium text-muted-foreground px-4 py-3">Session Type</th>
                <th className="text-left font-medium text-muted-foreground px-4 py-3">Status</th>
                <th className="text-left font-medium text-muted-foreground px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-muted-foreground text-sm">
                    No appointments found.
                  </td>
                </tr>
              ) : (
                filtered.map((a) => (
                  <tr key={a.id} className="border-b last:border-0 hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm whitespace-nowrap">{a.date || '—'}</td>
                    <td className="px-4 py-3 text-sm whitespace-nowrap">{a.time || '—'}</td>
                    <td className="px-4 py-3 font-medium">{resolvedName(a)}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground max-w-[160px]">
                      <span className="truncate block">{resolvedProgramme(a)}</span>
                    </td>
                    <td className="px-4 py-3 text-sm">{a.type || '—'}</td>
                    <td className="px-4 py-3">{getStatusBadge(a.status)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 flex-wrap">
                        {a.status === 'pending' && (
                          <>
                            <Button
                              size="sm"
                              className="bg-green-600 hover:bg-green-700 h-7 text-xs px-3"
                              disabled={updatingId === a.id}
                              onClick={() => updateStatus(a.id, 'scheduled')}
                            >
                              {updatingId === a.id ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Confirm'}
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs px-3 border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
                              disabled={updatingId === a.id}
                              onClick={() => updateStatus(a.id, 'cancelled')}
                            >
                              Decline
                            </Button>
                          </>
                        )}
                        {a.status === 'scheduled' && (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs px-3"
                              disabled={updatingId === a.id}
                              onClick={() => updateStatus(a.id, 'completed')}
                            >
                              {updatingId === a.id ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Mark Complete'}
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs px-3 border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
                              disabled={updatingId === a.id}
                              onClick={() => updateStatus(a.id, 'cancelled')}
                            >
                              Cancel
                            </Button>
                          </>
                        )}
                        {a.status === 'completed' && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs px-3"
                            onClick={() => setNotesAppt(a)}
                          >
                            View Notes
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Notes Modal */}
      <Dialog open={!!notesAppt} onOpenChange={(open) => { if (!open) setNotesAppt(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base">Session Notes</DialogTitle>
          </DialogHeader>
          {notesAppt && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <p className="text-xs text-muted-foreground">Student</p>
                  <p className="font-medium">{resolvedName(notesAppt)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Date</p>
                  <p className="font-medium">{notesAppt.date || '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Session Type</p>
                  <p className="font-medium">{notesAppt.type || '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Time</p>
                  <p className="font-medium">{notesAppt.time || '—'}</p>
                </div>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Notes</p>
                <div className="rounded-lg border bg-gray-50 px-3 py-2 text-sm">
                  {notesAppt.notes || 'No notes recorded for this session.'}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
