import { useStudentData } from '../contexts/StudentDataContext';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { AlertTriangle, CheckCircle } from 'lucide-react';
import { Skeleton } from '../components/ui/skeleton';

const getAttendanceColor = (pct: number, noData: boolean) => {
  if (noData) return 'text-gray-400';
  if (pct >= 80) return 'text-green-600';
  if (pct >= 60) return 'text-amber-600';
  return 'text-red-600';
};

type StatusLevel = 'no-data' | 'critical' | 'low' | 'at-risk' | 'good';

const getStatus = (
  pct: number,
  consec: number,
): { level: StatusLevel; label: string; borderLeft: string } => {
  if (pct === 0 && consec === 0) {
    return { level: 'no-data', label: 'No Data', borderLeft: 'border-l-gray-300' };
  }
  if (pct < 50 && consec >= 3) {
    return { level: 'critical', label: 'Critical', borderLeft: 'border-l-red-500' };
  }
  if (pct < 80 || consec >= 2) {
    return { level: 'low', label: 'Low', borderLeft: 'border-l-amber-400' };
  }
  if (pct < 85) {
    return { level: 'at-risk', label: 'At Risk', borderLeft: 'border-l-amber-400' };
  }
  return { level: 'good', label: 'Good Standing', borderLeft: 'border-l-green-500' };
};

const getModuleStatus = (pct: number): { label: string; className: string } => {
  if (pct >= 80) return { label: 'Good', className: 'bg-green-100 text-green-800 border-green-200' };
  if (pct >= 70) return { label: 'At Risk', className: 'bg-amber-100 text-amber-800 border-amber-200' };
  if (pct >= 50) return { label: 'Low', className: 'bg-orange-100 text-orange-800 border-orange-200' };
  return { label: 'Critical', className: 'bg-red-100 text-red-800 border-red-200' };
};

const CircularProgress = ({ percentage, noData }: { percentage: number; noData: boolean }) => {
  const radius = 60;
  const circumference = 2 * Math.PI * radius;
  const offset = noData ? circumference : circumference - (Math.min(percentage, 100) / 100) * circumference;
  const color = noData ? '#9ca3af' : percentage >= 80 ? '#16a34a' : percentage >= 60 ? '#d97706' : '#dc2626';

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
        {noData ? '—' : `${percentage}%`}
      </text>
      <text x="80" y="97" textAnchor="middle" fontSize="12" fill="#6b7280">
        Attendance
      </text>
    </svg>
  );
};

export default function StudentAttendancePage() {
  const { studentData, loading } = useStudentData();

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <Skeleton className="h-8 w-48 mb-2" />
          <Skeleton className="h-4 w-64" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Skeleton className="h-28 rounded-xl" />
          <Skeleton className="h-28 rounded-xl" />
          <Skeleton className="h-28 rounded-xl" />
        </div>
        <Skeleton className="h-64 rounded-xl" />
        <Skeleton className="h-48 rounded-xl" />
      </div>
    );
  }

  if (!studentData) {
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

  const pct = studentData.attendancePercentage;
  const consec = studentData.consecutiveAbsences;
  const noData = pct === 0 && consec === 0;
  const status = getStatus(pct, consec);
  const moduleRows = studentData.moduleAttendance;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">My Attendance</h1>
        <p className="text-muted-foreground text-sm mt-1">View your attendance records</p>
      </div>

      {/* Warning banner for low attendance */}
      {!noData && pct < 80 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 flex items-center gap-3">
          <AlertTriangle className="h-4 w-4 text-amber-600 flex-shrink-0" />
          <p className="text-sm text-amber-800">
            Your attendance is below the required <span className="font-semibold">80%</span> threshold.
            Please contact your Student Support Advisor as soon as possible.
          </p>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-l-4 border-l-blue-500">
          <CardContent className="pt-5 pb-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Attendance %</p>
                <p className={`text-3xl font-bold mt-1 ${getAttendanceColor(pct, noData)}`}>
                  {noData ? '—' : `${pct}%`}
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
                  {consec}
                </p>
                <p className="text-xs text-muted-foreground mt-1">Days absent in a row</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className={`border-l-4 ${status.borderLeft}`}>
          <CardContent className="pt-5 pb-5">
            <div>
              <p className="text-sm text-muted-foreground">Status</p>
              <div className="mt-2">
                {status.level === 'no-data'  && <Badge className="bg-gray-100 text-gray-700 border-gray-200">No Data</Badge>}
                {status.level === 'good'     && <Badge className="bg-green-100 text-green-800 border-green-200">Good Standing</Badge>}
                {status.level === 'at-risk'  && <Badge className="bg-amber-100 text-amber-800 border-amber-200">At Risk</Badge>}
                {status.level === 'low'      && <Badge className="bg-amber-100 text-amber-800 border-amber-200">Low</Badge>}
                {status.level === 'critical' && <Badge className="bg-red-100 text-red-800 border-red-200">Critical</Badge>}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {noData ? 'No attendance uploaded yet' : 'Based on attendance & absences'}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Attendance Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Attendance Overview</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row items-center gap-8">
            <div className="flex-shrink-0">
              <CircularProgress percentage={pct} noData={noData} />
            </div>

            <div className="flex-1 space-y-4">
              {status.level === 'no-data' && (
                <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-gray-400" />
                    <p className="text-sm text-gray-600 font-medium">No attendance records found yet.</p>
                  </div>
                </div>
              )}
              {status.level === 'critical' && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-red-600" />
                    <p className="text-sm text-red-800 font-medium">
                      Your attendance is critically low. Please contact your Student Support Advisor immediately.
                    </p>
                  </div>
                </div>
              )}
              {status.level === 'low' && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-amber-600" />
                    <p className="text-sm text-amber-800 font-medium">
                      Your attendance is below the required 80% threshold. Please contact your Student Support Advisor.
                    </p>
                  </div>
                </div>
              )}
              {status.level === 'at-risk' && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-amber-600" />
                    <p className="text-sm text-amber-800 font-medium">Your attendance needs improvement.</p>
                  </div>
                </div>
              )}
              {status.level === 'good' && (
                <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-5 w-5 text-green-600" />
                    <p className="text-sm text-green-800 font-medium">Your attendance is in good standing.</p>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="space-y-0.5">
                  <p className="text-xs text-muted-foreground">Attendance Rate</p>
                  <p className={`text-2xl font-bold ${getAttendanceColor(pct, noData)}`}>{noData ? '—' : `${pct}%`}</p>
                </div>
                <div className="space-y-0.5">
                  <p className="text-xs text-muted-foreground">Consecutive Absences</p>
                  <p className={`text-2xl font-bold ${consec >= 3 ? 'text-red-600' : ''}`}>{consec}</p>
                </div>
              </div>

              <div className="text-xs text-muted-foreground">
                Minimum required attendance: <span className="font-medium">80%</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Per-Module Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Module Attendance Breakdown</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="text-left font-medium text-muted-foreground px-4 py-3">Module Code</th>
                  <th className="text-left font-medium text-muted-foreground px-4 py-3">Module Name</th>
                  <th className="text-center font-medium text-muted-foreground px-4 py-3">Sessions</th>
                  <th className="text-center font-medium text-muted-foreground px-4 py-3">Present</th>
                  <th className="text-center font-medium text-muted-foreground px-4 py-3">Absent</th>
                  <th className="text-center font-medium text-muted-foreground px-4 py-3">Attendance %</th>
                  <th className="text-center font-medium text-muted-foreground px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {moduleRows.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-12 text-muted-foreground text-sm">
                      No per-module attendance data available yet.
                    </td>
                  </tr>
                ) : (
                  moduleRows.map((row, i) => {
                    const modStatus = getModuleStatus(row.percentage);
                    return (
                      <tr key={i} className="border-b last:border-0 hover:bg-gray-50">
                        <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                          {row.moduleCode || '—'}
                        </td>
                        <td className="px-4 py-3 font-medium">{row.moduleName || '—'}</td>
                        <td className="px-4 py-3 text-center">{row.total}</td>
                        <td className="px-4 py-3 text-center text-green-700 font-medium">{row.present}</td>
                        <td className="px-4 py-3 text-center text-red-600 font-medium">{row.absent}</td>
                        <td className="px-4 py-3 text-center">
                          <span className={`font-bold ${row.percentage >= 80 ? 'text-green-700' : row.percentage >= 70 ? 'text-amber-600' : 'text-red-600'}`}>
                            {row.percentage}%
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <Badge className={`text-xs ${modStatus.className}`}>{modStatus.label}</Badge>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
