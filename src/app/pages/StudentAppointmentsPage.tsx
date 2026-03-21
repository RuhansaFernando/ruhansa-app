import { useState, useEffect, useMemo } from 'react';
import {
  collection, getDocs, doc, updateDoc, addDoc, serverTimestamp, query, orderBy, where,
} from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../AuthContext';
import { Card, CardContent } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Calendar, Clock, Users, Plus, Loader2 } from 'lucide-react';
import { CALENDAR_LINKS } from '../config/calendarLinks';

interface AppointmentDoc {
  id: string;
  studentId: string;
  advisorId?: string;
  mentorId?: string;
  counsellorId?: string;
  advisorName?: string;
  mentorName?: string;
  counsellorName?: string;
  whoToMeet?: string;
  type: string;
  date: string;
  time: string;
  reason?: string;
  status: 'pending' | 'scheduled' | 'completed' | 'cancelled';
}

interface StaffMember {
  id: string;
  name: string;
}

const APPOINTMENT_TYPES = [
  'Academic Support',
  'Personal Guidance',
  'Career Advice',
  'Mental Health Support',
  'General Enquiry',
];

const WHO_OPTIONS = [
  { value: 'sru', label: 'Student Support Advisor', collection: 'student_support_advisors', field: 'advisorId', nameField: 'advisorName' },
  { value: 'mentor', label: 'Academic Mentor', collection: 'academic_mentors', field: 'mentorId', nameField: 'mentorName' },
  { value: 'counsellor', label: 'Student Counsellor', collection: 'student_counsellors', field: 'counsellorId', nameField: 'counsellorName' },
];

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

const getWithName = (a: AppointmentDoc) =>
  a.advisorName || a.mentorName || a.counsellorName || a.whoToMeet || '—';

export default function StudentAppointmentsPage() {
  const { user } = useAuth();

  const [appointments, setAppointments] = useState<AppointmentDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'upcoming' | 'pending' | 'past'>('upcoming');
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    appointmentType: '',
    whoToMeet: '',
    selectedPersonId: '',
    selectedPersonName: '',
    preferredDate: '',
    preferredTime: '',
    reason: '',
  });
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [loadingStaff, setLoadingStaff] = useState(false);
  const [formError, setFormError] = useState('');

  // Student info for booking
  const [studentInfo, setStudentInfo] = useState<{ name: string; programme: string } | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [apptSnap, studentSnap] = await Promise.all([
          getDocs(query(collection(db, 'appointments'), orderBy('date', 'desc'))),
          getDocs(query(collection(db, 'students'), where('uid', '==', user?.id))),
        ]);

        setAppointments(
          apptSnap.docs
            .map((d) => ({
              id: d.id,
              studentId: d.data().studentId ?? '',
              advisorId: d.data().advisorId ?? '',
              mentorId: d.data().mentorId ?? '',
              counsellorId: d.data().counsellorId ?? '',
              advisorName: d.data().advisorName ?? '',
              mentorName: d.data().mentorName ?? '',
              counsellorName: d.data().counsellorName ?? '',
              whoToMeet: d.data().whoToMeet ?? '',
              type: d.data().type ?? d.data().appointmentType ?? '',
              date: d.data().date ?? d.data().preferredDate ?? '',
              time: d.data().time ?? d.data().preferredTime ?? '',
              reason: d.data().reason ?? d.data().notes ?? '',
              status: d.data().status ?? 'pending',
            }))
            .filter((a) => a.studentId === user?.id)
        );

        if (!studentSnap.empty) {
          const d = studentSnap.docs[0].data();
          setStudentInfo({ name: d.name ?? '', programme: d.programme ?? '' });
        }
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [user?.id]);

  // Fetch staff when "who to meet" changes
  useEffect(() => {
    if (!form.whoToMeet) { setStaffList([]); return; }
    const who = WHO_OPTIONS.find((o) => o.value === form.whoToMeet);
    if (!who) return;
    setLoadingStaff(true);
    setForm((prev) => ({ ...prev, selectedPersonId: '', selectedPersonName: '' }));
    getDocs(query(collection(db, who.collection), where('status', '==', 'active')))
      .then((snap) => {
        setStaffList(snap.docs.map((d) => ({ id: d.id, name: d.data().name ?? '' })));
      })
      .finally(() => setLoadingStaff(false));
  }, [form.whoToMeet]);

  const cancelAppointment = async (id: string) => {
    setCancellingId(id);
    try {
      await updateDoc(doc(db, 'appointments', id), { status: 'cancelled' });
      setAppointments((prev) => prev.map((a) => (a.id === id ? { ...a, status: 'cancelled' } : a)));
    } finally {
      setCancellingId(null);
    }
  };

  const handleBook = async () => {
    setFormError('');
    const { appointmentType, whoToMeet, selectedPersonId, selectedPersonName, preferredDate, preferredTime, reason } = form;
    if (!appointmentType || !whoToMeet || !selectedPersonId || !preferredDate || !preferredTime || !reason) {
      setFormError('Please fill in all required fields.');
      return;
    }

    setSaving(true);
    try {
      const who = WHO_OPTIONS.find((o) => o.value === whoToMeet)!;
      const docData: Record<string, any> = {
        studentId: user?.id ?? '',
        studentName: studentInfo?.name ?? user?.name ?? '',
        programme: studentInfo?.programme ?? '',
        appointmentType,
        type: appointmentType,
        whoToMeet: who.label,
        [who.field]: selectedPersonId,
        [who.nameField]: selectedPersonName,
        date: preferredDate,
        preferredDate,
        time: preferredTime,
        preferredTime,
        reason,
        status: 'pending',
        createdAt: serverTimestamp(),
      };

      const ref = await addDoc(collection(db, 'appointments'), docData);
      setAppointments((prev) => [
        {
          id: ref.id,
          studentId: user?.id ?? '',
          advisorId: who.field === 'advisorId' ? selectedPersonId : '',
          mentorId: who.field === 'mentorId' ? selectedPersonId : '',
          counsellorId: who.field === 'counsellorId' ? selectedPersonId : '',
          advisorName: who.nameField === 'advisorName' ? selectedPersonName : '',
          mentorName: who.nameField === 'mentorName' ? selectedPersonName : '',
          counsellorName: who.nameField === 'counsellorName' ? selectedPersonName : '',
          whoToMeet: who.label,
          type: appointmentType,
          date: preferredDate,
          time: preferredTime,
          reason,
          status: 'pending',
        },
        ...prev,
      ]);

      setModalOpen(false);
      setForm({ appointmentType: '', whoToMeet: '', selectedPersonId: '', selectedPersonName: '', preferredDate: '', preferredTime: '', reason: '' });
      setActiveTab('pending');
    } finally {
      setSaving(false);
    }
  };

  const today = new Date().toISOString().split('T')[0];

  const tabData = useMemo(() => ({
    upcoming: appointments.filter((a) => a.status === 'scheduled' && a.date >= today),
    pending: appointments.filter((a) => a.status === 'pending'),
    past: appointments.filter((a) => a.status === 'completed' || a.status === 'cancelled'),
  }), [appointments, today]);

  const totalCount = appointments.length;
  const upcomingCount = tabData.upcoming.length;
  const pendingCount = tabData.pending.length;

  const minDate = today;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Appointments</h1>
        <p className="text-muted-foreground text-sm mt-1">Book and manage your appointments</p>
      </div>

      {/* Google Calendar booking buttons */}
      <div className="space-y-3">
        <p className="text-sm font-medium text-gray-700 mb-3">Choose who you want to book with:</p>

        <button
          onClick={() => window.open(CALENDAR_LINKS.ssa, '_blank')}
          className="w-full flex items-center gap-3 p-4 border rounded-xl hover:bg-blue-50 hover:border-blue-300 transition-colors text-left"
        >
          <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
            <span className="text-blue-600 text-lg">👩‍💼</span>
          </div>
          <div className="flex-1">
            <p className="font-medium text-sm text-gray-900">Student Support Advisor</p>
            <p className="text-xs text-gray-500 mt-0.5">Academic concerns, attendance issues, general welfare · 30 min</p>
          </div>
          <span className="text-xs text-blue-600 font-medium">Book →</span>
        </button>

        <button
          onClick={() => window.open(CALENDAR_LINKS.mentor, '_blank')}
          className="w-full flex items-center gap-3 p-4 border rounded-xl hover:bg-green-50 hover:border-green-300 transition-colors text-left"
        >
          <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
            <span className="text-green-600 text-lg">👨‍🏫</span>
          </div>
          <div className="flex-1">
            <p className="font-medium text-sm text-gray-900">Academic Mentor</p>
            <p className="text-xs text-gray-500 mt-0.5">Module difficulties, study strategies, academic progress · 45 min</p>
          </div>
          <span className="text-xs text-green-600 font-medium">Book →</span>
        </button>

        <p className="text-xs text-gray-400 text-center mt-2">
          You will be redirected to Google Calendar. A Google Meet link will be automatically generated.
        </p>

        <div className="mt-4 bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
          <p className="font-medium mb-1">🧠 Need mental health support?</p>
          <p className="text-xs leading-relaxed">If you are experiencing stress, anxiety or any mental health concerns, please speak to your Student Support Advisor first. They will provide support and refer you to a counsellor if needed.</p>
        </div>
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
                <p className="text-xs text-muted-foreground mt-1">Confirmed sessions</p>
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

      {/* Tabs */}
      <div className="flex gap-1 border-b">
        {(['upcoming', 'pending', 'past'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
            {tabData[tab].length > 0 && (
              <span className="ml-2 text-xs bg-gray-100 rounded-full px-1.5 py-0.5">
                {tabData[tab].length}
              </span>
            )}
          </button>
        ))}
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
                <th className="text-left font-medium text-muted-foreground px-4 py-3">With</th>
                <th className="text-left font-medium text-muted-foreground px-4 py-3">Type</th>
                <th className="text-left font-medium text-muted-foreground px-4 py-3">Reason</th>
                <th className="text-left font-medium text-muted-foreground px-4 py-3">Status</th>
                <th className="text-left font-medium text-muted-foreground px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {tabData[activeTab].length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-muted-foreground text-sm">
                    No {activeTab} appointments.
                  </td>
                </tr>
              ) : (
                tabData[activeTab].map((a) => (
                  <tr key={a.id} className="border-b last:border-0 hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm whitespace-nowrap">{a.date || '—'}</td>
                    <td className="px-4 py-3 text-sm whitespace-nowrap">{a.time || '—'}</td>
                    <td className="px-4 py-3 text-sm">{getWithName(a)}</td>
                    <td className="px-4 py-3 text-sm">{a.type || '—'}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground max-w-[180px]">
                      <span className="truncate block">{a.reason || '—'}</span>
                    </td>
                    <td className="px-4 py-3">{getStatusBadge(a.status)}</td>
                    <td className="px-4 py-3">
                      {(a.status === 'pending' || a.status === 'scheduled') && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs px-3 border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
                          disabled={cancellingId === a.id}
                          onClick={() => cancelAppointment(a.id)}
                        >
                          {cancellingId === a.id ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Cancel'}
                        </Button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Book Appointment Modal */}
      <Dialog open={modalOpen} onOpenChange={(open) => { if (!open) { setModalOpen(false); setFormError(''); } }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base">Book Appointment</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Appointment Type *</Label>
              <Select value={form.appointmentType} onValueChange={(v) => setForm((p) => ({ ...p, appointmentType: v }))}>
                <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                <SelectContent>
                  {APPOINTMENT_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Who to Meet *</Label>
              <Select value={form.whoToMeet} onValueChange={(v) => setForm((p) => ({ ...p, whoToMeet: v }))}>
                <SelectTrigger><SelectValue placeholder="Select who to meet" /></SelectTrigger>
                <SelectContent>
                  {WHO_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {form.whoToMeet && (
              <div className="space-y-1.5">
                <Label>Select Person *</Label>
                {loadingStaff ? (
                  <div className="flex items-center gap-2 text-muted-foreground text-sm py-2">
                    <Loader2 className="h-3 w-3 animate-spin" /> Loading...
                  </div>
                ) : (
                  <Select
                    value={form.selectedPersonId}
                    onValueChange={(v) => {
                      const person = staffList.find((s) => s.id === v);
                      setForm((p) => ({ ...p, selectedPersonId: v, selectedPersonName: person?.name ?? '' }));
                    }}
                  >
                    <SelectTrigger><SelectValue placeholder="Select a person" /></SelectTrigger>
                    <SelectContent>
                      {staffList.length === 0 ? (
                        <SelectItem value="_none" disabled>No staff available</SelectItem>
                      ) : (
                        staffList.map((s) => (
                          <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                )}
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Preferred Date *</Label>
                <Input
                  type="date"
                  min={minDate}
                  value={form.preferredDate}
                  onChange={(e) => setForm((p) => ({ ...p, preferredDate: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Preferred Time *</Label>
                <Input
                  type="time"
                  value={form.preferredTime}
                  onChange={(e) => setForm((p) => ({ ...p, preferredTime: e.target.value }))}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Reason *</Label>
              <Textarea
                placeholder="Briefly describe the purpose of your appointment..."
                rows={3}
                value={form.reason}
                onChange={(e) => setForm((p) => ({ ...p, reason: e.target.value }))}
              />
            </div>

            {formError && (
              <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-800">
                {formError}
              </div>
            )}

            <div className="flex gap-2 justify-end pt-1">
              <Button variant="outline" onClick={() => { setModalOpen(false); setFormError(''); }}>
                Cancel
              </Button>
              <Button className="bg-blue-600 hover:bg-blue-700" onClick={handleBook} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Submit Request
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
