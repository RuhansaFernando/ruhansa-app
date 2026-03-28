import { useState, useEffect } from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { AlertTriangle, CheckCircle, Loader2 } from 'lucide-react';

interface StudentDoc {
  attendancePercentage: number;
  consecutiveAbsences: number;
}

const getAttendanceColor = (pct: number) => {
  if (pct >= 80) return 'text-green-600';
  if (pct >= 60) return 'text-amber-600';
  return 'text-red-600';
};

const getStatus = (pct: number): { label: string; color: string; border: string; bg: string } => {
  if (pct >= 80) return { label: 'Good Standing', color: 'text-green-800', border: 'border-green-200', bg: 'bg-green-50' };
  if (pct >= 60) return { label: 'At Risk', color: 'text-amber-800', border: 'border-amber-200', bg: 'bg-amber-50' };
  return { label: 'Critical', color: 'text-red-800', border: 'border-red-200', bg: 'bg-red-50' };
};

// Simple circular progress SVG
const CircularProgress = ({ percentage }: { percentage: number }) => {
  const radius = 60;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (Math.min(percentage, 100) / 100) * circumference;
  const color = percentage >= 80 ? '#16a34a' : percentage >= 60 ? '#d97706' : '#dc2626';

  return (
    <svg width="160" height="160" viewBox="0 0 160 160">
      <circle cx="80" cy="80" r={radius} fill="none" stroke="#e5e7eb" strokeWidth="12" />
      <circle
        cx="80"
        cy="80"
        r={radius}
        fill="none"
        stroke={color}
        strokeWidth="12"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
        transform="rotate(-90 80 80)"
        style={{ transition: 'stroke-dashoffset 0.5s ease' }}
      />
      <text x="80" y="75" textAnchor="middle" fontSize="28" fontWeight="700" fill={color}>
        {percentage}%
      </text>
      <text x="80" y="97" textAnchor="middle" fontSize="12" fill="#6b7280">
        Attendance
      </text>
    </svg>
  );
};

export default function StudentAttendancePage() {
  const { user } = useAuth();
  const [student, setStudent] = useState<StudentDoc | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    const fetchStudent = async () => {
      setLoading(true);
      setNotFound(false);
      try {
        let snap = await getDocs(
          query(collection(db, 'students'), where('uid', '==', user?.id))
        );
        if (snap.empty && user?.email) {
          snap = await getDocs(
            query(collection(db, 'students'), where('email', '==', user?.email))
          );
        }
        if (!snap.empty) {
          const d = snap.docs[0].data();
          setStudent({
            attendancePercentage: d.attendancePercentage ?? 100,
            consecutiveAbsences: d.consecutiveAbsences ?? 0,
          });
        } else {
          setNotFound(true);
        }
      } finally {
        setLoading(false);
      }
    };
    fetchStudent();
  }, [user?.id, user?.email]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 gap-2 text-muted-foreground text-sm">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading...
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">My Attendance</h1>
          <p className="text-muted-foreground text-sm mt-1">View your attendance records</p>
        </div>
        <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">
          No attendance data found.
        </div>
      </div>
    );
  }

  const pct = student?.attendancePercentage ?? 0;
  const consec = student?.consecutiveAbsences ?? 0;
  const status = getStatus(pct);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">My Attendance</h1>
        <p className="text-muted-foreground text-sm mt-1">View your attendance records</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-l-4 border-l-blue-500">
          <CardContent className="pt-5 pb-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Attendance %</p>
                <p className={`text-3xl font-bold mt-1 ${getAttendanceColor(pct)}`}>
                  {student ? `${pct}%` : '—'}
                </p>
                <p className="text-xs text-muted-foreground mt-1">Overall attendance rate</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className={`border-l-4 ${consec >= 3 ? 'border-l-red-500' : 'border-l-gray-300'}`}>
          <CardContent className="pt-5 pb-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Consecutive Absences</p>
                <p className={`text-3xl font-bold mt-1 ${consec >= 3 ? 'text-red-600' : ''}`}>
                  {student ? consec : '—'}
                </p>
                <p className="text-xs text-muted-foreground mt-1">Days absent in a row</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className={`border-l-4 ${status.border.replace('border-', 'border-l-')}`}>
          <CardContent className="pt-5 pb-5">
            <div>
              <p className="text-sm text-muted-foreground">Status</p>
              <div className="mt-2">
                {pct >= 80 ? (
                  <Badge className="bg-green-100 text-green-800 border-green-200">Good Standing</Badge>
                ) : pct >= 60 ? (
                  <Badge className="bg-amber-100 text-amber-800 border-amber-200">At Risk</Badge>
                ) : (
                  <Badge className="bg-red-100 text-red-800 border-red-200">Critical</Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-1">Based on attendance rate</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Attendance Status Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Attendance Overview</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row items-center gap-8">
            {/* Circular progress */}
            <div className="flex-shrink-0">
              <CircularProgress percentage={pct} />
            </div>

            {/* Status info */}
            <div className="flex-1 space-y-4">
              <div className={`rounded-lg border ${status.border} ${status.bg} px-4 py-3`}>
                <div className="flex items-center gap-2">
                  {pct >= 80 ? (
                    <CheckCircle className="h-5 w-5 text-green-600" />
                  ) : (
                    <AlertTriangle className={`h-5 w-5 ${pct >= 60 ? 'text-amber-600' : 'text-red-600'}`} />
                  )}
                  <p className={`font-medium text-sm ${status.color}`}>
                    {pct >= 80
                      ? 'Your attendance is in good standing.'
                      : pct >= 60
                      ? 'Your attendance needs improvement.'
                      : 'Your attendance is critically low.'}
                  </p>
                </div>
              </div>

              {pct < 80 && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3">
                  <p className="text-sm text-red-800">
                    Your attendance is below the required 80% threshold. Please contact your
                    Student Support Advisor.
                  </p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="space-y-0.5">
                  <p className="text-xs text-muted-foreground">Attendance Rate</p>
                  <p className={`text-2xl font-bold ${getAttendanceColor(pct)}`}>{pct}%</p>
                </div>
                <div className="space-y-0.5">
                  <p className="text-xs text-muted-foreground">Consecutive Absences</p>
                  <p className={`text-2xl font-bold ${consec >= 3 ? 'text-red-600' : ''}`}>
                    {consec}
                  </p>
                </div>
              </div>

              <div className="text-xs text-muted-foreground">
                Minimum required attendance: <span className="font-medium">80%</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
