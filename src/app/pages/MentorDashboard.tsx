import { useState, useEffect } from 'react';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Users, AlertTriangle, Activity, Loader2 } from 'lucide-react';
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

interface InterventionDoc {
  id: string;
  studentId: string;
  studentName?: string;
  interventionType?: string;
  type?: string;
  date?: string;
  description?: string;
  status: string;
  riskLevel?: string;
  recordedBy?: string;
  createdAt: any;
}

const getRiskBadge = (riskLevel: string) => {
  if (riskLevel === 'high')
    return <Badge className="bg-red-100 text-red-800 border-red-200 text-xs">High</Badge>;
  if (riskLevel === 'medium')
    return <Badge className="bg-amber-100 text-amber-800 border-amber-200 text-xs">Medium</Badge>;
  return <Badge className="bg-green-100 text-green-800 border-green-200 text-xs">Low</Badge>;
};

const getInterventionStatusBadge = (status: string) => {
  switch (status) {
    case 'completed':
      return <Badge className="bg-green-100 text-green-800 border-green-200 text-xs">Completed</Badge>;
    case 'in-progress':
      return <Badge className="bg-blue-100 text-blue-800 border-blue-200 text-xs">In Progress</Badge>;
    case 'pending':
      return <Badge className="bg-amber-100 text-amber-800 border-amber-200 text-xs">Pending</Badge>;
    case 'cancelled':
      return <Badge className="bg-red-100 text-red-800 border-red-200 text-xs">Cancelled</Badge>;
    default:
      return <Badge className="text-xs">{status}</Badge>;
  }
};

export default function MentorDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [students, setStudents] = useState<StudentDoc[]>([]);
  const [interventions, setInterventions] = useState<InterventionDoc[]>([]);
  const [interventionCount, setInterventionCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true);
      try {
        const [studentSnap, interventionSnap] = await Promise.all([
          getDocs(collection(db, 'students')),
          getDocs(query(collection(db, 'interventions'), orderBy('createdAt', 'desc'))),
        ]);

        const mentorName = user?.name ?? '';
        const mentorEmail = user?.email ?? '';
        const mentorUid = (user as any)?.uid ?? '';

        const myStudents: StudentDoc[] = studentSnap.docs
          .filter((d) => {
            const data = d.data();
            return (
              (mentorName && data.academicMentor === mentorName) ||
              (mentorEmail && data.academicMentor === mentorEmail) ||
              (mentorUid && data.mentorId === mentorUid)
            );
          })
          .map((d) => ({
          id: d.id,
          studentId: d.data().studentId ?? d.id,
          name: d.data().name ?? '',
          email: d.data().email ?? '',
          programme: d.data().programme ?? '',
          level: d.data().level ?? '',
          attendancePercentage: d.data().attendancePercentage ?? 100,
          gpa: d.data().gpa ?? 0,
          riskLevel: d.data().riskLevel ?? 'low',
          academicMentor: d.data().academicMentor ?? '',
          createdAt: d.data().createdAt ?? null,
        }));

        setStudents(myStudents);

        const myStudentIds = myStudents.map((s) => s.id);

        const myInterventions: InterventionDoc[] = interventionSnap.docs
          .filter((d) => myStudentIds.includes(d.data().studentId))
          .map((d) => ({
            id: d.id,
            studentId: d.data().studentId ?? '',
            studentName: d.data().studentName ?? '',
            interventionType: d.data().interventionType ?? '',
            type: d.data().type ?? '',
            date: d.data().date ?? '',
            description: d.data().description ?? '',
            status: d.data().status ?? 'pending',
            riskLevel: d.data().riskLevel ?? '',
            recordedBy: d.data().recordedBy ?? '',
            createdAt: d.data().createdAt ?? null,
          }));

        setInterventions(myInterventions);
        setInterventionCount(myInterventions.length);
      } finally {
        setLoading(false);
      }
    };
    fetchAll();
  }, [user?.name]);

  const atRiskStudents = students.filter(
    (s) => s.riskLevel === 'high' || s.riskLevel === 'medium'
  );

  const recentInterventions = interventions.slice(0, 3);

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
            const link = (user as any)?.calendarLink;
            if (link) {
              window.open(link, '_blank');
            } else {
              toast.error('No Google Calendar link set. Go to Settings to add your calendar link.');
            }
          }}
        >
          📅 Open My Calendar →
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4">
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

        <Card className="border-l-4 border-l-blue-500">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Interventions</CardTitle>
            <div className="h-9 w-9 rounded-full bg-purple-100 flex items-center justify-center">
              <Activity className="h-5 w-5 text-purple-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold text-purple-600">{loading ? '—' : interventionCount}</div>
            <p className="text-xs text-muted-foreground mt-1">Logged this semester</p>
          </CardContent>
        </Card>

      </div>

      {/* Two-column section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: At-Risk Students */}
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
                      onClick={() => window.open(
                        `https://calendar.app.google/jCLhbY857ksnKQNC8?email=${encodeURIComponent(s.email ?? '')}`,
                        '_blank'
                      )}
                    >
                      Book Session
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Right: Recent Interventions */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent Interventions</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-8 gap-2 text-muted-foreground text-sm">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading...
              </div>
            ) : recentInterventions.length === 0 ? (
              <p className="text-center py-8 text-muted-foreground text-sm">
                No interventions logged yet.
              </p>
            ) : (
              <div className="space-y-3">
                {recentInterventions.map((intervention: any) => (
                  <div key={intervention.id} className="p-3 border rounded-xl bg-white hover:bg-gray-50">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{intervention.studentName || '—'}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {intervention.interventionType || intervention.type || '—'}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {intervention.date || '—'} · By: {intervention.recordedBy || '—'}
                        </p>
                      </div>
                      <Badge className={
                        intervention.riskLevel === 'high' ? 'bg-red-100 text-red-800 border-red-200 text-xs' :
                        intervention.riskLevel === 'medium' ? 'bg-amber-100 text-amber-800 border-amber-200 text-xs' :
                        'bg-green-100 text-green-800 border-green-200 text-xs'
                      }>
                        {intervention.riskLevel || 'low'} risk
                      </Badge>
                    </div>
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
