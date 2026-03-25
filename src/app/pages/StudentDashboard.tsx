// ============================================================
// StudentDashboard.tsx  —  UPGRADED with Novelty 3
// Replaces the basic "Personalised Recommendations" card with
// the full Academic Health Self-Awareness panel.
// All original functionality preserved.
// ============================================================

import { useState, useEffect } from 'react';
import { collection, getDocs, query, where, orderBy } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../AuthContext';
import { useRiskScore } from '../hooks/useRiskScore';
import { AcademicHealthScore } from '../components/AcademicHealthScore';
import { StudentFactorBars } from '../components/StudentFactorBars';
import { MicroActionCards } from '../components/MicroActionCards';
import { HealthTrendChart } from '../components/HealthTrendChart';
import { markStudentProfileViewed } from '../services/studentViewedService';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { AlertTriangle, CheckCircle, Calendar, TrendingUp, BookOpen, Loader2 } from 'lucide-react';
import { CALENDAR_LINKS } from '../config/calendarLinks';
import { useNavigate, Link } from 'react-router';

interface StudentDoc {
  id: string;
  studentId: string;
  name: string;
  programme: string;
  level: string;
  attendancePercentage: number;
  consecutiveAbsences: number;
  gpa: number;
  riskLevel: string;
  engagementScore?: number;
  academicMentor?: string;
  email?: string;
}

interface AppointmentDoc {
  id: string;
  studentId: string;
  advisorName?: string;
  mentorName?: string;
  counsellorName?: string;
  whoToMeet?: string;
  type: string;
  date: string;
  time: string;
  status: string;
}

const getStatusBadge = (status: string) => {
  switch (status) {
    case 'pending':   return <Badge className="bg-amber-100 text-amber-800 border-amber-200 text-xs">Pending</Badge>;
    case 'scheduled': return <Badge className="bg-blue-100 text-blue-800 border-blue-200 text-xs">Scheduled</Badge>;
    case 'completed': return <Badge className="bg-green-100 text-green-800 border-green-200 text-xs">Completed</Badge>;
    default:          return <Badge className="text-xs">{status}</Badge>;
  }
};

export default function StudentDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [student,      setStudent]      = useState<StudentDoc | null>(null);
  const [appointments, setAppointments] = useState<AppointmentDoc[]>([]);
  const [loading,      setLoading]      = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        console.log('Auth user id:', user?.id, 'email:', user?.email);

        const [studentSnap, apptSnap] = await Promise.all([
          getDocs(query(collection(db, 'students'), where('uid', '==', user?.id))),
          getDocs(query(collection(db, 'appointments'), orderBy('date', 'asc'))),
        ]);

        // If not found by uid, try by email as fallback
        let studentDoc = studentSnap.empty
          ? await getDocs(query(collection(db, 'students'), where('email', '==', user?.email)))
          : studentSnap;

        if (!studentDoc.empty) {
          const d = studentDoc.docs[0];
          const studentData: StudentDoc = {
            id: d.id,
            studentId: d.data().studentId ?? '',
            name: d.data().name ?? '',
            programme: d.data().programme ?? '',
            level: d.data().level ?? '',
            attendancePercentage: d.data().attendancePercentage ?? 100,
            consecutiveAbsences: d.data().consecutiveAbsences ?? 0,
            gpa: d.data().gpa ?? 0,
            riskLevel: d.data().riskLevel ?? 'low',
            engagementScore: d.data().engagementScore ?? 50,
            academicMentor: d.data().academicMentor ?? '',
            email: d.data().email ?? '',
          };
          console.log('Student academicMentor:', d.data().academicMentor);
          console.log('Full student data:', studentData);
          console.log('academicMentor value:', studentData.academicMentor);
          console.log('academicMentor length:', studentData.academicMentor?.length);
          console.log('student id:', studentData.id);
          setStudent(studentData);

          // Novelty 3: log that student has viewed their health profile
          markStudentProfileViewed(d.id);
        }

        const myAppts: AppointmentDoc[] = apptSnap.docs
          .map((d) => ({
            id: d.id,
            studentId: d.data().studentId ?? '',
            advisorName: d.data().advisorName ?? '',
            mentorName: d.data().mentorName ?? '',
            counsellorName: d.data().counsellorName ?? '',
            whoToMeet: d.data().whoToMeet ?? '',
            type: d.data().type ?? d.data().appointmentType ?? '',
            date: d.data().date ?? d.data().preferredDate ?? '',
            time: d.data().time ?? d.data().preferredTime ?? '',
            status: d.data().status ?? 'pending',
          }))
          .filter((a) => a.studentId === user?.id);
        setAppointments(myAppts);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [user?.id]);

  // ── Novelty 1 + 3: ML risk score ─────────────────────────
  const riskData = useRiskScore({
    attendancePercentage: student?.attendancePercentage,
    gpa:                  student?.gpa,
    studentId:            student?.studentId,
  });

  // Health score = inverse of risk score (100 = perfect health, 0 = max risk)
  const healthScore = Math.max(0, 100 - riskData.score);

  const today = new Date().toISOString().split('T')[0];
  const upcomingAppts = appointments
    .filter((a) => (a.status === 'scheduled' || a.status === 'pending') && a.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 3);
  const upcomingScheduledCount = appointments.filter(
    (a) => a.status === 'scheduled' && a.date >= today
  ).length;

  const getWithName = (a: AppointmentDoc) =>
    a.advisorName || a.mentorName || a.counsellorName || a.whoToMeet || '—';

  const attColor = !student ? '' : student.attendancePercentage >= 80 ? 'text-green-600' : student.attendancePercentage >= 60 ? 'text-amber-600' : 'text-red-600';
  const gpaColor = !student ? '' : student.gpa >= 2.5 ? 'text-green-600' : student.gpa >= 2.0 ? 'text-amber-600' : 'text-red-600';

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 gap-2 text-muted-foreground text-sm">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">My Dashboard</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Welcome back, {student?.name ?? user?.name}
        </p>
      </div>

      {/* ── Risk Alert Banner ─────────────────────────────── */}
      {riskData?.level === 'critical' || riskData?.level === 'high' ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-4 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-medium text-red-900 text-sm">
              ⚠️ Your academic performance requires immediate attention. Please book an appointment with your Student Support Advisor as soon as possible.
            </p>
          </div>
          <Button size="sm" className="bg-red-600 hover:bg-red-700 flex-shrink-0 text-xs"
            onClick={() => navigate('/student/appointments')}>
            Book Appointment Now
          </Button>
        </div>
      ) : riskData?.level === 'medium' ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-4 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-medium text-amber-900 text-sm">
              Your performance is being monitored. We recommend booking a support session.
            </p>
          </div>
          <Button size="sm" className="bg-amber-600 hover:bg-amber-700 flex-shrink-0 text-xs"
            onClick={() => navigate('/student/appointments')}>
            Book Appointment
          </Button>
        </div>
      ) : (
        <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 flex items-center gap-3">
          <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0" />
          <p className="text-sm text-green-900 font-medium">You are performing well. Keep it up!</p>
        </div>
      )}

      {/* ── Summary Cards ─────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-l-4 border-l-blue-500">
          <CardContent className="pt-5 pb-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Attendance</p>
                <p className={`text-3xl font-bold mt-1 ${attColor}`}>
                  {student ? `${student.attendancePercentage}%` : '—'}
                </p>
                <p className="text-xs text-muted-foreground mt-1">Overall attendance rate</p>
              </div>
              <div className="h-10 w-10 rounded-full bg-blue-50 flex items-center justify-center">
                <TrendingUp className="h-5 w-5 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-purple-500">
          <CardContent className="pt-5 pb-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">GPA</p>
                <p className={`text-3xl font-bold mt-1 ${gpaColor}`}>
                  {student ? student.gpa.toFixed(2) : '—'}
                </p>
                <p className="text-xs text-muted-foreground mt-1">Current grade point average</p>
              </div>
              <div className="h-10 w-10 rounded-full bg-purple-50 flex items-center justify-center">
                <BookOpen className="h-5 w-5 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-red-500">
          <CardContent className="pt-5 pb-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Risk Level</p>
                <div className="mt-2">
                  {riskData ? (
                    <Badge className={
                      riskData.level === 'critical' ? 'bg-red-100 text-red-800 border-red-200' :
                      riskData.level === 'high'     ? 'bg-amber-100 text-amber-800 border-amber-200' :
                      riskData.level === 'medium'   ? 'bg-blue-100 text-blue-800 border-blue-200' :
                      'bg-green-100 text-green-800 border-green-200'
                    }>
                      {riskData.level.charAt(0).toUpperCase() + riskData.level.slice(1)} Risk
                    </Badge>
                  ) : '—'}
                </div>
                <p className="text-xs text-muted-foreground mt-1">Current academic risk</p>
              </div>
              <div className="h-10 w-10 rounded-full bg-red-50 flex items-center justify-center">
                <AlertTriangle className="h-5 w-5 text-red-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-green-500">
          <CardContent className="pt-5 pb-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Upcoming Appointments</p>
                <p className="text-3xl font-bold mt-1 text-green-600">{upcomingScheduledCount}</p>
                <p className="text-xs text-muted-foreground mt-1">Scheduled sessions</p>
              </div>
              <div className="h-10 w-10 rounded-full bg-green-50 flex items-center justify-center">
                <Calendar className="h-5 w-5 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* TEMPORARY DEBUG - show mentor card always */}
      {student && (
        <Card className="border-l-4 border-l-green-500">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                  <span className="text-green-700 text-sm font-medium">AM</span>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Your Academic Mentor</p>
                  <p className="font-semibold text-base">
                    {student.academicMentor && student.academicMentor.trim() !== ''
                      ? student.academicMentor
                      : 'Not assigned yet'}
                  </p>
                  <p className="text-xs text-muted-foreground">Academic Department · DropGuard</p>
                </div>
              </div>
              {student.academicMentor && student.academicMentor.trim() !== '' && (
                <Button
                  size="sm"
                  className="bg-green-600 hover:bg-green-700 gap-1.5 flex-shrink-0"
                  onClick={() => window.open('https://calendar.app.google/jCLhbY857ksnKQNC8', '_blank')}
                >
                  📅 Book a Session
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── NOVELTY 3: Academic Health Self-Awareness Panel ── */}
      {(student || user) && (
        <Card className="border-purple-100">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              Your Academic Health
              <Badge className="bg-purple-100 text-purple-700 border-purple-200 text-[10px]">
                Novelty 3 · Self-Awareness
              </Badge>
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              Understanding your current academic standing helps you take action early.
            </p>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Health score gauge */}
              <div className="flex flex-col justify-center">
                {riskData?.pending ? (
                  <div className="text-center p-6">
                    <p className="text-muted-foreground text-sm">
                      Academic health analysis coming soon
                    </p>
                  </div>
                ) : (
                  <AcademicHealthScore score={healthScore} />
                )}
              </div>

              {/* Factor bars */}
              <div>
                <StudentFactorBars
                  attendancePct={student?.attendancePercentage ?? 0}
                  gpa={student?.gpa ?? 0}
                  engagementPct={student?.engagementScore ?? 50}
                />
                <div className="mt-4">
                  <HealthTrendChart currentScore={healthScore} />
                </div>
              </div>

              {/* Micro-actions */}
              <div>
                <MicroActionCards
                  attendancePct={student?.attendancePercentage ?? 0}
                  gpa={student?.gpa ?? 0}
                  engagementPct={student?.engagementScore ?? 50}
                  riskScore={riskData?.score ?? 0}
                />
              </div>
            </div>

            <p className="text-[10px] text-gray-400 text-center mt-4">
              DropGuard shows this data to help you — not to judge you. All data is only visible to you and your assigned Student Support Advisor.
            </p>
          </CardContent>
        </Card>
      )}

      {/* ── Upcoming Appointments ─────────────────────────── */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-base">Upcoming Appointments</CardTitle>
          <Link to="/student/appointments" className="text-xs text-blue-600 hover:underline">View All</Link>
        </CardHeader>
        <CardContent>
          {upcomingAppts.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-sm text-muted-foreground mb-3">No upcoming appointments.</p>
              <div className="flex flex-col gap-2 mt-3">
                <p className="text-xs text-muted-foreground text-center mb-1">Book with:</p>
                <div className="flex gap-2 justify-center flex-wrap">
                  <Button size="sm" variant="outline" className="text-xs gap-1.5"
                    onClick={() => window.open(CALENDAR_LINKS.ssa, '_blank')}>
                    👩‍💼 SSA
                  </Button>
                  <Button size="sm" variant="outline" className="text-xs gap-1.5"
                    onClick={() => window.open(CALENDAR_LINKS.mentor, '_blank')}>
                    👨‍🏫 Mentor
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {upcomingAppts.map((a) => (
                <div key={a.id} className="flex items-center justify-between gap-3 p-3 rounded-lg border hover:bg-gray-50">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{a.type || '—'}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">With: {getWithName(a)}</p>
                    <p className="text-xs text-muted-foreground">{a.date || '—'}{a.time ? ` · ${a.time}` : ''}</p>
                  </div>
                  {getStatusBadge(a.status)}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
