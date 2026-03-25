import { useState, useEffect } from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Users, AlertTriangle, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';

interface StudentDoc {
  id: string;
  studentId: string;
  name: string;
  email: string;
  programme: string;
  level: string;
  attendancePercentage: number;
  gpa: number;
  riskLevel: string;
  academicMentor: string;
  createdAt?: any;
}

const getRiskBadge = (riskLevel: string) => {
  if (riskLevel === 'high')
    return <Badge className="bg-red-100 text-red-800 border-red-200 text-xs">High</Badge>;
  if (riskLevel === 'medium')
    return <Badge className="bg-amber-100 text-amber-800 border-amber-200 text-xs">Medium</Badge>;
  return <Badge className="bg-green-100 text-green-800 border-green-200 text-xs">Low</Badge>;
};

export default function MentorDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [students, setStudents] = useState<StudentDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [calendarLink, setCalendarLink] = useState('');

  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true);
      const mentorName = user?.name ?? '';
      if (!mentorName) {
        setStudents([]);
        setLoading(false);
        return;
      }

      const mapStudentFields = (d: any): Omit<StudentDoc, 'id'> => {
        const data = d.data();
        return {
          studentId: data.studentId ?? d.id,
          name: data.name ?? '',
          email: data.email ?? '',
          programme: data.programme ?? '',
          level: data.level ?? '',
          attendancePercentage: data.attendancePercentage ?? 100,
          gpa: data.gpa ?? 0,
          riskLevel: data.riskLevel ?? 'low',
          academicMentor: data.academicMentor ?? '',
          createdAt: data.createdAt ?? null,
        };
      };

      try {
        const studentsSnap = await getDocs(collection(db, 'students'));
        const allStudents = studentsSnap.docs.map(d => ({ id: d.id, ...mapStudentFields(d) }));
        const myStudents: StudentDoc[] = allStudents.filter(s =>
          s.academicMentor?.trim().toLowerCase() === mentorName.trim().toLowerCase()
        );
        setStudents(myStudents);

        try {
          const mentorSnap = await getDocs(query(collection(db, 'academic_mentors'), where('email', '==', user?.email ?? '')));
          if (!mentorSnap.empty) setCalendarLink(mentorSnap.docs[0].data().calendarLink ?? '');
        } catch {}
      } finally {
        setLoading(false);
      }
    };
    fetchAll();
  }, [user?.name]);

  const atRiskStudents = students.filter(
    (s) => s.riskLevel === 'high' || s.riskLevel === 'medium'
  );

  const recentlyAssigned = students.filter(s => {
    if (!s.createdAt) return false;
    const assignedDate = s.createdAt.toDate ? s.createdAt.toDate() : new Date(s.createdAt);
    const daysDiff = (Date.now() - assignedDate.getTime()) / (1000 * 60 * 60 * 24);
    return daysDiff <= 7;
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          Good {new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 17 ? 'afternoon' : 'evening'}, {user?.name} 👋
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} · {students.length} students assigned to you
        </p>
      </div>

      {/* Recently assigned notification */}
      {!loading && recentlyAssigned.length > 0 && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
            <span className="text-blue-600 text-sm">🎓</span>
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-blue-900">
              {recentlyAssigned.length} new student{recentlyAssigned.length > 1 ? 's' : ''} assigned to you in the last 7 days
            </p>
            <p className="text-xs text-blue-700 mt-0.5">
              {recentlyAssigned.map(s => s.name).join(', ')}
            </p>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="border-blue-300 text-blue-700 hover:bg-blue-100 flex-shrink-0 text-xs"
            onClick={() => navigate('/mentor/students')}
          >
            View Students →
          </Button>
        </div>
      )}

      {/* Google Calendar banner */}
      <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 flex items-center gap-3">
        <span className="text-green-600 text-xl">📅</span>
        <div className="flex-1">
          <p className="text-sm font-medium text-green-900">Your appointments are managed via Google Calendar</p>
          <p className="text-xs text-green-700 mt-0.5">
            Students book sessions directly through your Google Calendar booking link.
            Check your Google Calendar for upcoming sessions.
          </p>
        </div>
        <Button
          size="sm"
          variant="outline"
          className="border-green-300 text-green-700 hover:bg-green-100 flex-shrink-0 text-xs gap-1.5"
          onClick={() => {
            if (calendarLink) {
              window.open(calendarLink, '_blank');
            } else {
              toast.error('No Google Calendar link set. Go to Settings to add your calendar link.');
            }
          }}
        >
          📅 Open My Calendar →
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-4">
        <Card className="border-l-4 border-l-blue-500">
          <CardContent className="pt-5 pb-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">My Students</p>
                <p className="text-3xl font-bold mt-1">{loading ? '—' : students.length}</p>
                <p className="text-xs text-muted-foreground mt-1">Assigned to you</p>
              </div>
              <div className="h-10 w-10 rounded-full bg-blue-50 flex items-center justify-center">
                <Users className="h-5 w-5 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-green-500">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">At-Risk Students</CardTitle>
            <div className="h-9 w-9 rounded-full bg-red-100 flex items-center justify-center">
              <AlertTriangle className="h-5 w-5 text-red-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold text-red-600">{loading ? '—' : atRiskStudents.length}</div>
            <p className="text-xs text-muted-foreground mt-1">Medium or high risk</p>
          </CardContent>
        </Card>

      </div>

      {/* At-Risk Students */}
      <div>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">My At-Risk Students</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-8 gap-2 text-muted-foreground text-sm">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading...
              </div>
            ) : atRiskStudents.length === 0 ? (
              <p className="text-center py-8 text-muted-foreground text-sm">
                No at-risk students.
              </p>
            ) : (
              <div className="space-y-3">
                {atRiskStudents.map((s) => (
                  <div
                    key={s.id}
                    className="flex items-center justify-between gap-3 p-3 rounded-lg border hover:bg-gray-50"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{s.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{s.programme || '—'}</p>
                      <div className="flex items-center gap-3 mt-1">
                        {getRiskBadge(s.riskLevel)}
                        <span className="text-xs text-muted-foreground">
                          Att: {s.attendancePercentage}%
                        </span>
                        <span className="text-xs text-muted-foreground">
                          GPA: {s.gpa.toFixed(2)}
                        </span>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-shrink-0 h-7 text-xs"
                      onClick={() => {
                        const link = calendarLink || 'https://calendar.google.com';
                        window.open(link, '_blank');
                      }}
                    >
                      Book Session
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
