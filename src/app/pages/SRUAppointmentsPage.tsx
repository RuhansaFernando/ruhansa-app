import { useState, useEffect, useMemo } from 'react';
import { collection, getDocs, doc, updateDoc, addDoc, serverTimestamp, query, orderBy } from 'firebase/firestore';
import { db } from '../../firebase';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog';
import { Calendar, Clock, Users, Loader2, Search, Plus, FileText } from 'lucide-react';
import { useAuth } from '../AuthContext';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import { createNotification } from '../services/notificationService';

interface AppointmentDoc {
  id: string;
  studentId: string;
  studentName: string;
  programme: string;
  advisorId: string;
  mentorId: string;
  counsellorId: string;
  assignedTo: string;
  whoToMeet: string;
  type: string;
  date: string;
  time: string;
  status: 'pending' | 'scheduled' | 'completed' | 'cancelled';
  notes?: string;
}

interface StudentOption {
  id: string;
  studentId: string;
  uid: string;
  name: string;
  programme: string;
  riskLevel: string;
}

const APPOINTMENT_TYPES = ['Phone Call', 'In-Person Meeting', 'Video Call', 'Other'];

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

const getRiskBadge = (riskLevel: string) => {
  switch (riskLevel) {
    case 'critical':
      return <Badge className="bg-red-100 text-red-800 border-red-200 text-[10px] px-1.5 py-0">Critical</Badge>;
    case 'high':
      return <Badge className="bg-red-100 text-red-700 border-red-200 text-[10px] px-1.5 py-0">High Risk</Badge>;
    case 'medium':
      return <Badge className="bg-amber-100 text-amber-800 border-amber-200 text-[10px] px-1.5 py-0">Medium</Badge>;
    default:
      return null;
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

export default function SRUAppointmentsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [appointments, setAppointments] = useState<AppointmentDoc[]>([]);
  const [studentMap, setStudentMap] = useState<Record<string, { name: string; programme: string; riskLevel: string }>>({});
  const [studentOptions, setStudentOptions] = useState<StudentOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [calendarLink, setCalendarLink] = useState('');

  const [activeTab, setActiveTab] = useState<'upcoming' | 'pending' | 'past'>('upcoming');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('all');

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [formStudentId, setFormStudentId] = useState('');
  const [saving, setSaving] = useState(false);

  // Fetch SSA's calendar link from student_support_advisors
  useEffect(() => {
    if (!user?.email) return;
    const fetchCalendarLink = async () => {
      try {
        const snap = await getDocs(collection(db, 'student_support_advisors'));
        for (const d of snap.docs) {
          if (d.data().email?.toLowerCase().trim() === user.email.toLowerCase().trim()) {
            setCalendarLink(d.data().calendarLink ?? '');
            break;
          }
        }
      } catch {}
    };
    fetchCalendarLink();
  }, [user?.email]);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [apptSnap, studentSnap] = await Promise.all([
          getDocs(query(collection(db, 'appointments'), orderBy('date', 'desc'))),
          getDocs(collection(db, 'students')),
        ]);

        const map: Record<string, { name: string; programme: string; riskLevel: string }> = {};
        const options: StudentOption[] = [];
        studentSnap.forEach((d) => {
          map[d.id] = {
            name: d.data().name ?? '',
            programme: d.data().programme ?? '',
            riskLevel: d.data().riskLevel ?? 'low',
          };
          options.push({
            id:         d.id,
            studentId:  d.data().studentId ?? d.id,
            uid:        d.data().uid ?? '',
            name:       d.data().name ?? '',
            programme:  d.data().programme ?? '',
            riskLevel:  d.data().riskLevel ?? 'low',
          });
        });
        setStudentMap(map);
        setStudentOptions(options.sort((a, b) => a.name.localeCompare(b.name)));

        setAppointments(
          apptSnap.docs
            .map((d) => ({
              id: d.id,
              studentId: d.data().studentId ?? '',
              studentName: d.data().studentName ?? map[d.data().studentId]?.name ?? '',
              programme: d.data().programme ?? map[d.data().studentId]?.programme ?? '',
              advisorId: d.data().advisorId ?? '',
              mentorId: d.data().mentorId ?? '',
              counsellorId: d.data().counsellorId ?? '',
              assignedTo: d.data().assignedTo ?? '',
              whoToMeet: d.data().whoToMeet ?? '',
              type: d.data().type ?? d.data().appointmentType ?? '',
              date: d.data().date ?? '',
              time: d.data().time ?? '',
              status: d.data().status ?? 'pending',
              notes: d.data().notes ?? '',
            }))
            .filter((a) =>
              a.advisorId === user?.id ||
              a.assignedTo === 'SSA Team' ||
              a.whoToMeet === 'Student Support Advisor' ||
              (!a.advisorId && !a.mentorId && !a.counsellorId)
            )
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

  const openModal = () => {
    if (!calendarLink) {
      toast.error('No calendar link set. Please add your Google Calendar link in Settings.');
      return;
    }
    setFormStudentId('');
    setShowModal(true);
  };

  const handleSchedule = async () => {
    if (!formStudentId) {
      toast.error('Please select a student.');
      return;
    }
    setSaving(true);
    try {
      const student = studentOptions.find(s => s.id === formStudentId);
      window.open(calendarLink, '_blank');
      await addDoc(collection(db, 'appointments'), {
        studentId: formStudentId,
        studentName: student?.name ?? '',
        programme: student?.programme ?? '',
        type: 'SSA Session',
        appointmentType: 'SSA Session',
        date: new Date().toISOString().split('T')[0],
        time: '',
        status: 'scheduled',
        scheduledBy: user?.name ?? '',
        bookedBy: 'ssa',
        advisorId: user?.id ?? '',
        createdAt: serverTimestamp(),
      });
      await createNotification({
        studentId: student?.studentId ?? formStudentId,
        uid:       student?.uid ?? '',
        type:      'appointment',
        title:     'New appointment scheduled',
        message:   'A new appointment has been scheduled for you by your Student Support Advisor.',
      });

      setAppointments(prev => [{
        id: Math.random().toString(),
        studentId: formStudentId,
        studentName: student?.name ?? '',
        programme: student?.programme ?? '',
        advisorId: user?.id ?? '',
        type: 'SSA Session',
        date: new Date().toISOString().split('T')[0],
        time: '',
        status: 'scheduled',
      }, ...prev]);

      toast.success('Appointment scheduled successfully');
      setShowModal(false);
    } catch {
      toast.error('Failed to save appointment record.');
    } finally {
      setSaving(false);
    }
  };

  const today = todayStr();

  const totalCount = appointments.length;
  const upcomingCount = appointments.filter(
    (a) => a.status === 'scheduled' && a.date >= today
  ).length;
  const pendingCount = appointments.filter((a) => a.status === 'pending').length;

  const filtered = useMemo(() => {
    let list = appointments;

    if (activeTab === 'upcoming') {
      list = list.filter((a) => a.status === 'scheduled' && a.date >= today);
    } else if (activeTab === 'pending') {
      list = list.filter((a) => a.status === 'pending');
    } else if (activeTab === 'past') {
      list = list.filter((a) => a.date < today || a.status === 'completed' || a.status === 'cancelled');
    }

    if (statusFilter !== 'all') {
      list = list.filter((a) => a.status === statusFilter);
    }

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
  }, [appointments, activeTab, statusFilter, dateFilter, search, studentMap, today]);

  const resolvedName = (a: AppointmentDoc) =>
    a.studentName || studentMap[a.studentId]?.name || '—';
  const resolvedProgramme = (a: AppointmentDoc) =>
    a.programme || studentMap[a.studentId]?.programme || '—';
  const resolvedRiskLevel = (a: AppointmentDoc) =>
    studentMap[a.studentId]?.riskLevel ?? 'low';

  const tabs: { key: typeof activeTab; label: string }[] = [
    { key: 'upcoming', label: 'Upcoming' },
    { key: 'pending',  label: 'Pending' },
    { key: 'past',     label: 'Past' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Appointments</h1>
          <p className="text-muted-foreground text-sm mt-1">Manage student appointment requests</p>
          <p className="text-xs text-blue-600 mt-0.5">Showing your assigned appointments and all unassigned team requests</p>
        </div>
        <Button
          className="bg-blue-600 hover:bg-blue-700 gap-1.5"
          onClick={openModal}
        >
          <Plus className="h-4 w-4" /> Schedule Appointment
        </Button>
      </div>

      <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 flex items-center gap-3">
        <span className="text-blue-600 text-xl">📅</span>
        <div className="flex-1">
          <p className="text-sm font-medium text-blue-900">Schedule appointments via Google Calendar</p>
          <p className="text-xs text-blue-700 mt-0.5">Students can book directly through your calendar link. Google Meet is auto-generated for each session.</p>
        </div>
        <Button size="sm" variant="outline" className="border-blue-300 text-blue-700 hover:bg-blue-100 flex-shrink-0 text-xs"
          onClick={() => {
            if (calendarLink) {
              window.open(calendarLink, '_blank');
            } else {
              toast.error('No calendar link set. Please add your Google Calendar link in Settings.');
            }
          }}>
          Open My Calendar →
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

      {/* Table */}
      <div className="rounded-xl border bg-white">
        <div className="px-4 pt-4 pb-0 border-b">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
            <div className="flex gap-1">
              {tabs.map((t) => (
                <button
                  key={t.key}
                  onClick={() => setActiveTab(t.key)}
                  className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                    activeTab === t.key
                      ? 'bg-gray-900 text-white'
                      : 'text-muted-foreground hover:text-foreground hover:bg-gray-100'
                  }`}
                >
                  {t.label}
                  {t.key === 'pending' && pendingCount > 0 && (
                    <span className="ml-1.5 inline-flex items-center justify-center h-4 min-w-4 px-1 rounded-full bg-amber-500 text-white text-[10px] font-bold">
                      {pendingCount}
                    </span>
                  )}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap gap-2 items-center">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                <Input
                  placeholder="Search student..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-7 h-8 w-44 text-xs"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-36 h-8 text-xs">
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
                <SelectTrigger className="w-32 h-8 text-xs">
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
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground gap-2 text-sm">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading appointments...
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-gray-50">
                <th className="text-left font-medium text-muted-foreground px-4 py-3">Date</th>
                <th className="text-left font-medium text-muted-foreground px-4 py-3">Time</th>
                <th className="text-left font-medium text-muted-foreground px-4 py-3">Student Name</th>
                <th className="text-left font-medium text-muted-foreground px-4 py-3">Programme</th>
                <th className="text-left font-medium text-muted-foreground px-4 py-3">Appointment Type</th>
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
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-medium">{resolvedName(a)}</span>
                        {getRiskBadge(resolvedRiskLevel(a))}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground max-w-[160px]">
                      <span className="truncate block">{resolvedProgramme(a)}</span>
                    </td>
                    <td className="px-4 py-3 text-sm">{a.type || '—'}</td>
                    <td className="px-4 py-3">{getStatusBadge(a.status)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5 flex-wrap">
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
                              className="bg-blue-600 hover:bg-blue-700 h-7 text-xs px-3"
                              disabled={updatingId === a.id}
                              onClick={() => updateStatus(a.id, 'completed')}
                            >
                              {updatingId === a.id ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Start Session'}
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
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs px-2 gap-1"
                          onClick={() => navigate(`/sru/students/${a.studentId}`)}
                        >
                          View Profile
                        </Button>
                        {(a.status === 'scheduled' || a.status === 'pending') && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs px-2 gap-1"
                            onClick={() => updateStatus(a.id, 'pending')}
                            disabled={updatingId === a.id}
                          >
                            Reschedule
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs px-2 gap-1"
                          onClick={() => {
                            const notes = prompt('Add notes for this appointment:');
                            if (notes !== null) {
                              updateDoc(doc(db, 'appointments', a.id), { notes });
                              setAppointments((prev) =>
                                prev.map((ap) => (ap.id === a.id ? { ...ap, notes } : ap))
                              );
                            }
                          }}
                        >
                          <FileText className="h-3 w-3" /> Notes
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Schedule Appointment Modal */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Schedule Appointment</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              Select a student, then your Google Calendar will open to complete the booking.
            </p>
            <div className="space-y-1.5">
              <Label htmlFor="appt-student">Student</Label>
              <Select value={formStudentId} onValueChange={setFormStudentId}>
                <SelectTrigger id="appt-student">
                  <SelectValue placeholder="Select student..." />
                </SelectTrigger>
                <SelectContent className="max-h-56">
                  {studentOptions.map(s => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowModal(false)} disabled={saving}>
              Cancel
            </Button>
            <Button className="bg-blue-600 hover:bg-blue-700" onClick={handleSchedule} disabled={saving || !formStudentId}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {saving ? 'Opening...' : 'Open Calendar & Book'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
