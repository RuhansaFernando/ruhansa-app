import { useState, useEffect, useMemo } from 'react';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../AuthContext';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Input } from '../components/ui/input';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '../components/ui/dialog';
import { Search, Loader2 } from 'lucide-react';

interface StudentSummary {
  studentId: string;
  studentName: string;
  programme: string;
  level: string;
  totalSessions: number;
  lastSession: string;
  appointments: AppointmentDoc[];
}

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

export default function CounsellorStudentsPage() {
  const { user } = useAuth();
  const [students, setStudents] = useState<StudentSummary[]>([]);
  const [studentDetails, setStudentDetails] = useState<Record<string, { level: string; programme: string }>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedStudent, setSelectedStudent] = useState<StudentSummary | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [apptSnap, studentSnap] = await Promise.all([
          getDocs(query(collection(db, 'appointments'), orderBy('date', 'desc'))),
          getDocs(collection(db, 'students')),
        ]);

        // Build a map from studentId → { level, programme }
        const detailsMap: Record<string, { level: string; programme: string }> = {};
        studentSnap.forEach((d) => {
          detailsMap[d.id] = {
            level: d.data().level ?? '',
            programme: d.data().programme ?? '',
          };
        });
        setStudentDetails(detailsMap);

        // Filter appointments for this counsellor
        const myAppts: AppointmentDoc[] = apptSnap.docs
          .map((d) => ({
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
          }))
          .filter((a) => a.counsellorId === user?.id);

        // Group by studentId
        const grouped: Record<string, AppointmentDoc[]> = {};
        for (const a of myAppts) {
          if (!grouped[a.studentId]) grouped[a.studentId] = [];
          grouped[a.studentId].push(a);
        }

        const summaries: StudentSummary[] = Object.entries(grouped).map(([sid, appts]) => {
          const sorted = [...appts].sort((a, b) => b.date.localeCompare(a.date));
          return {
            studentId: sid,
            studentName: sorted[0].studentName || '—',
            programme: sorted[0].programme || detailsMap[sid]?.programme || '—',
            level: detailsMap[sid]?.level || '—',
            totalSessions: appts.length,
            lastSession: sorted[0].date || '—',
            appointments: sorted,
          };
        });

        setStudents(summaries.sort((a, b) => b.lastSession.localeCompare(a.lastSession)));
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [user?.id]);

  const filtered = useMemo(() => {
    if (!search.trim()) return students;
    const q = search.toLowerCase();
    return students.filter(
      (s) =>
        s.studentName.toLowerCase().includes(q) ||
        s.studentId.toLowerCase().includes(q)
    );
  }, [students, search]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">My Students</h1>
        <p className="text-muted-foreground text-sm mt-1">Students you have counselled</p>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by name or student ID..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Table */}
      <div className="rounded-lg border bg-white overflow-x-auto">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground gap-2 text-sm">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading students...
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-gray-50">
                <th className="text-left font-medium text-muted-foreground px-4 py-3">Student ID</th>
                <th className="text-left font-medium text-muted-foreground px-4 py-3">Name</th>
                <th className="text-left font-medium text-muted-foreground px-4 py-3">Programme</th>
                <th className="text-left font-medium text-muted-foreground px-4 py-3">Level</th>
                <th className="text-left font-medium text-muted-foreground px-4 py-3">Total Sessions</th>
                <th className="text-left font-medium text-muted-foreground px-4 py-3">Last Session</th>
                <th className="text-left font-medium text-muted-foreground px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-muted-foreground text-sm">
                    No students found.
                  </td>
                </tr>
              ) : (
                filtered.map((s) => (
                  <tr key={s.studentId} className="border-b last:border-0 hover:bg-gray-50">
                    <td className="px-4 py-3 text-xs text-muted-foreground">{s.studentId}</td>
                    <td className="px-4 py-3 font-medium">{s.studentName}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground max-w-[160px]">
                      <span className="truncate block">{s.programme}</span>
                    </td>
                    <td className="px-4 py-3 text-sm">{s.level}</td>
                    <td className="px-4 py-3 text-sm text-center">{s.totalSessions}</td>
                    <td className="px-4 py-3 text-sm whitespace-nowrap">{s.lastSession}</td>
                    <td className="px-4 py-3">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs px-3"
                        onClick={() => setSelectedStudent(s)}
                      >
                        View History
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* History Modal */}
      <Dialog
        open={!!selectedStudent}
        onOpenChange={(open) => { if (!open) setSelectedStudent(null); }}
      >
        <DialogContent className="max-w-xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base">
              Session History — {selectedStudent?.studentName}
            </DialogTitle>
          </DialogHeader>
          {selectedStudent && (
            <div className="space-y-2">
              {selectedStudent.appointments.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No sessions found.</p>
              ) : (
                selectedStudent.appointments.map((a) => (
                  <div key={a.id} className="rounded-lg border px-4 py-3">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <p className="font-medium text-sm">{a.type || '—'}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {a.date || '—'}{a.time ? ` · ${a.time}` : ''}
                        </p>
                      </div>
                      {getStatusBadge(a.status)}
                    </div>
                    {a.notes && (
                      <p className="text-xs text-muted-foreground mt-2 italic border-t pt-2">
                        {a.notes}
                      </p>
                    )}
                  </div>
                ))
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
