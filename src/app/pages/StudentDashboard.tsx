// ============================================================
// StudentDashboard.tsx  —  UPGRADED with Novelty 3
// Replaces the basic "Personalised Recommendations" card with
// the full Academic Health Self-Awareness panel.
// All original functionality preserved.
// ============================================================

import { useEffect, useMemo } from 'react';
import { useAuth } from '../AuthContext';
import { useStudentData } from '../contexts/StudentDataContext';
import { useRiskScore } from '../hooks/useRiskScore';
import { StudentFactorBars } from '../components/StudentFactorBars';
import { markStudentProfileViewed } from '../services/studentViewedService';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { AlertTriangle, CheckCircle, Calendar, TrendingUp, BookOpen, Loader2, Bell } from 'lucide-react';
import { Avatar, AvatarFallback } from '../components/ui/avatar';
import { CALENDAR_LINKS } from '../config/calendarLinks';
import { useNavigate } from 'react-router';

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

// Maps all known level/year variants → progress info (supports '1st Year', 'Year 1', 'Level 4', etc.)
const LEVEL_TO_PROGRESS: Record<string, { pct: number; label: string; bar: string; text: string }> = {
  '1st Year': { pct: 25,  label: '1st Year', bar: 'bg-blue-500',   text: 'text-blue-600'   },
  'Year 1':   { pct: 25,  label: '1st Year', bar: 'bg-blue-500',   text: 'text-blue-600'   },
  'Level 4':  { pct: 25,  label: '1st Year', bar: 'bg-blue-500',   text: 'text-blue-600'   },
  '2nd Year': { pct: 50,  label: '2nd Year', bar: 'bg-teal-500',   text: 'text-teal-600'   },
  'Year 2':   { pct: 50,  label: '2nd Year', bar: 'bg-teal-500',   text: 'text-teal-600'   },
  'Level 5':  { pct: 50,  label: '2nd Year', bar: 'bg-teal-500',   text: 'text-teal-600'   },
  '3rd Year': { pct: 75,  label: '3rd Year', bar: 'bg-orange-500', text: 'text-orange-600' },
  'Year 3':   { pct: 75,  label: '3rd Year', bar: 'bg-orange-500', text: 'text-orange-600' },
  'Level 6':  { pct: 75,  label: '3rd Year', bar: 'bg-orange-500', text: 'text-orange-600' },
  '4th Year': { pct: 100, label: '4th Year', bar: 'bg-green-500',  text: 'text-green-600'  },
  'Year 4':   { pct: 100, label: '4th Year', bar: 'bg-green-500',  text: 'text-green-600'  },
  'Level 7':  { pct: 100, label: '4th Year', bar: 'bg-green-500',  text: 'text-green-600'  },
};


export default function StudentDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { studentData, loading } = useStudentData();

  // Mark student profile viewed once data loads
  useEffect(() => {
    if (studentData?.firestoreId) {
      markStudentProfileViewed(studentData.firestoreId);
    }
  }, [studentData?.firestoreId]);

  // Derive local shape from context
  const student = studentData
    ? {
        id: studentData.firestoreId,
        studentId: studentData.studentId,
        name: studentData.name,
        programme: studentData.programme,
        level: studentData.level,
        attendancePercentage: studentData.attendancePercentage,
        consecutiveAbsences: studentData.consecutiveAbsences,
        gpa: studentData.gpa,
        riskLevel: studentData.riskLevel,
        engagementScore: studentData.engagementScore,
        academicMentor: studentData.academicMentor,
        email: studentData.email,
      }
    : null;

  const mentorDepartment = studentData?.mentor?.department ?? null;

  const alerts = useMemo(() => {
    if (!studentData) return [] as { type: 'attendance' | 'marks' | 'absence'; severity: 'warning' | 'critical'; message: string; module?: string }[];
    const list: { type: 'attendance' | 'marks' | 'absence'; severity: 'warning' | 'critical'; message: string; module?: string }[] = [];

    if (studentData.attendancePercentage > 0 && studentData.attendancePercentage < 75) {
      list.push({
        type: 'attendance',
        severity: studentData.attendancePercentage < 50 ? 'critical' : 'warning',
        message: `Your overall attendance is ${studentData.attendancePercentage}% — below the required 80%`,
      });
    }
    if (studentData.consecutiveAbsences >= 3) {
      list.push({
        type: 'absence',
        severity: 'critical',
        message: `You have missed ${studentData.consecutiveAbsences} consecutive classes. Please contact your SSA immediately.`,
      });
    }
    studentData.results.forEach((r) => {
      if (r.overall < 40 && r.overall > 0) {
        const name = r.moduleName || r.moduleCode || 'Unknown Module';
        list.push({
          type: 'marks',
          severity: 'warning',
          message: `You are at risk of failing ${name} — current mark: ${r.overall}%`,
          module: name,
        });
      }
    });
    return list;
  }, [studentData]);

  const ssaMessages = studentData?.ssaMessages ?? [];

  const appointments: AppointmentDoc[] = (studentData?.appointments ?? []).map((a: any) => ({
    id: a.id,
    studentId: a.studentId ?? '',
    advisorName: a.advisorName ?? '',
    mentorName: a.mentorName ?? '',
    counsellorName: a.counsellorName ?? '',
    whoToMeet: a.whoToMeet ?? '',
    type: a.type ?? a.appointmentType ?? '',
    date: a.date ?? a.preferredDate ?? '',
    time: a.time ?? a.preferredTime ?? '',
    status: a.status ?? 'pending',
  }));

  // ── Novelty 1 + 3: ML risk score ─────────────────────────
  const riskData = useRiskScore({
    attendancePercentage:   student?.attendancePercentage,
    gpa:                    student?.gpa,
    studentId:              student?.studentId,
    enrollmentDate:         studentData?.enrollmentDate ?? studentData?.academicYear ?? '',
    nationality:            studentData?.nationality ?? '',
    gender:                 studentData?.gender,
    programme:              studentData?.programme,
    flagged:                studentData?.flagged,
    academic_warning_count: studentData?.academic_warning_count,
    attendanceBySemester:   studentData?.attendanceBySemester ?? [(student?.attendancePercentage ?? 0) / 100],
  });

const failedModules = (studentData?.results ?? [])
    .filter((r) => r.overall < 40 && r.overall > 0).length;
  const advisorMeetings = studentData?.advisorMeetingCount ?? 0;

  const today = new Date().toISOString().split('T')[0];
  const upcomingScheduledCount = appointments.filter(
    (a) => a.status === 'scheduled' && a.date >= today
  ).length;

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
      {riskData?.pending ? (
        <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 flex items-center gap-2">
          <span className="text-gray-400">⏳</span>
          <p className="text-sm text-gray-600">
            Your academic health analysis is being prepared. Check back soon.
          </p>
        </div>
      ) : riskData?.level === 'critical' || riskData?.level === 'high' ? (
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
      ) : riskData?.level === 'low' ? (
        <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 flex items-center gap-3">
          <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0" />
          <p className="text-sm text-green-900 font-medium">You are performing well. Keep it up!</p>
        </div>
      ) : (
        <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 flex items-center gap-2">
          <span className="text-gray-400">⏳</span>
          <p className="text-sm text-gray-600">
            Your academic health analysis is being prepared. Check back soon.
          </p>
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

      {/* ── My Alerts ────────────────────────────────────── */}
      {alerts.length > 0 && (
        <Card>
          <CardHeader className="pb-3 flex flex-row items-center gap-2">
            <Bell className="h-4 w-4 text-amber-500" />
            <CardTitle className="text-base">My Alerts</CardTitle>
            <Badge className="bg-amber-100 text-amber-800 border-amber-200 text-xs ml-auto">{alerts.length}</Badge>
          </CardHeader>
          <CardContent className="space-y-2 pt-0">
            {alerts.map((alert, i) => (
              <div
                key={i}
                className={`border-l-4 px-4 py-3 rounded-r-lg flex items-start gap-3 ${
                  alert.severity === 'critical'
                    ? 'border-l-red-500 bg-red-50'
                    : 'border-l-amber-400 bg-amber-50'
                }`}
              >
                <span className="text-base flex-shrink-0 mt-0.5">
                  {alert.type === 'absence' ? '🚨' : alert.type === 'attendance' ? '📅' : '📝'}
                </span>
                <p className={`text-sm flex-1 ${alert.severity === 'critical' ? 'text-red-800' : 'text-amber-800'}`}>
                  {alert.message}
                </p>
                <Badge className={`text-xs flex-shrink-0 ${
                  alert.severity === 'critical'
                    ? 'bg-red-100 text-red-800 border-red-200'
                    : 'bg-amber-100 text-amber-800 border-amber-200'
                }`}>
                  {alert.severity === 'critical' ? 'Critical' : 'Warning'}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* ── Messages from Your Support Team ──────────────── */}
      {ssaMessages.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Messages from Your Support Team</CardTitle>
          </CardHeader>
          <CardContent className="pt-0 space-y-0 divide-y">
            {ssaMessages.map((msg) => (
              <div key={msg.id} className="py-4 first:pt-0 last:pb-0">
                <div className="flex items-start gap-3">
                  <Avatar className="h-9 w-9 flex-shrink-0">
                    <AvatarFallback className="bg-blue-600 text-white text-xs font-semibold">
                      {msg.recordedBy.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium">{msg.recordedBy}</p>
                      {msg.interventionType && (
                        <Badge className="bg-blue-50 text-blue-700 border-blue-200 text-xs">{msg.interventionType}</Badge>
                      )}
                      {msg.date && (
                        <span className="text-xs text-muted-foreground ml-auto">{msg.date}</span>
                      )}
                    </div>
                    <p className="text-sm text-gray-700 mt-1 leading-relaxed">{msg.notes}</p>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* ── Programme Progress ────────────────────────────── */}
      {student?.level && (() => {
        const info = LEVEL_TO_PROGRESS[student.level];
        if (!info) return null;
        return (
          <Card className="shadow-sm">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center justify-between gap-4 mb-3">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">🎓</span>
                  <div>
                    <p className="font-semibold text-sm leading-snug">{student.programme || 'Programme not set'}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{info.label}</p>
                  </div>
                </div>
                <p className={`text-sm font-bold flex-shrink-0 ${info.text}`}>{info.pct}% Complete</p>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-2">
                <div
                  className={`${info.bar} h-2 rounded-full transition-all duration-500`}
                  style={{ width: `${info.pct}%` }}
                />
              </div>
            </CardContent>
          </Card>
        );
      })()}

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
                      : 'No mentor assigned yet'}
                  </p>
                  {mentorDepartment && (
                    <p className="text-xs text-muted-foreground">{mentorDepartment}</p>
                  )}
                </div>
              </div>
              {student.academicMentor && student.academicMentor.trim() !== '' && (
                <Button
                  size="sm"
                  className="bg-green-600 hover:bg-green-700 gap-1.5 flex-shrink-0"
                  onClick={() => window.open(CALENDAR_LINKS.mentor, '_blank')}
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
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              Understanding your current academic standing helps you take action early.
            </p>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">

              {/* Plain English Status */}
              {(() => {
                const att = student?.attendancePercentage ?? 0;
                const gpa = student?.gpa ?? 0;
                const hasData = att > 0 || gpa > 0;

                if (!hasData) return (
                  <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 flex items-center gap-2">
                    <span>⏳</span>
                    <p className="text-sm text-gray-600">No academic data available yet. Your support team will be in touch once data is uploaded.</p>
                  </div>
                );

                const attGood = att >= 80;
                const gpaGood = gpa >= 2.5;

                if (attGood && gpaGood) return (
                  <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 flex items-center gap-2">
                    <span>✅</span>
                    <p className="text-sm text-green-800 font-medium">Your attendance and academic performance are both on track. Keep it up!</p>
                  </div>
                );

                if (!attGood && gpaGood) return (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 flex items-center gap-2">
                    <span>⚠️</span>
                    <p className="text-sm text-amber-800 font-medium">Your attendance needs attention but your grades are good. Try to attend more regularly.</p>
                  </div>
                );

                if (attGood && !gpaGood) return (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 flex items-center gap-2">
                    <span>⚠️</span>
                    <p className="text-sm text-amber-800 font-medium">Your attendance is good but your grades need improvement. Consider speaking to your Academic Mentor.</p>
                  </div>
                );

                return (
                  <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 flex items-center gap-2">
                    <span>🔴</span>
                    <p className="text-sm text-red-800 font-medium">Both your attendance and grades need attention. Please speak to your Student Support Advisor.</p>
                  </div>
                );
              })()}

              {/* Two Factor Bars */}
              <StudentFactorBars
                attendancePct={student?.attendancePercentage ?? 0}
                gpa={student?.gpa ?? 0}
                failedModules={failedModules}
                advisorMeetings={advisorMeetings}
              />

            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
