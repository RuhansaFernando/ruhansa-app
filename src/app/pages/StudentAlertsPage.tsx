import { useMemo } from 'react';
import { useStudentData } from '../contexts/StudentDataContext';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Avatar, AvatarFallback } from '../components/ui/avatar';
import { CheckCircle, Bell } from 'lucide-react';
import { Skeleton } from '../components/ui/skeleton';

interface Alert {
  type: 'attendance' | 'marks' | 'absence';
  severity: 'warning' | 'critical';
  message: string;
  module?: string;
}

export default function StudentAlertsPage() {
  const { studentData, loading } = useStudentData();

  const alerts = useMemo<Alert[]>(() => {
    if (!studentData) return [];
    const list: Alert[] = [];

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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">My Alerts & Messages</h1>
        <p className="text-muted-foreground text-sm mt-1">Stay informed about your academic status</p>
      </div>

      {/* Section 1 — Academic Alerts */}
      <Card>
        <CardHeader className="pb-3 flex flex-row items-center gap-2">
          <Bell className="h-4 w-4 text-amber-500" />
          <CardTitle className="text-base">Academic Alerts</CardTitle>
          {alerts.length > 0 && (
            <Badge className="bg-amber-100 text-amber-800 border-amber-200 text-xs ml-auto">{alerts.length}</Badge>
          )}
        </CardHeader>
        <CardContent className="pt-0">
          {alerts.length === 0 ? (
            <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 flex items-center gap-3">
              <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0" />
              <p className="text-sm text-green-800 font-medium">
                No academic alerts at this time. Keep up the good work!
              </p>
            </div>
          ) : (
            <div className="space-y-2">
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
            </div>
          )}
        </CardContent>
      </Card>

      {/* Section 2 — Messages from Support Team */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Messages from Support Team</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {ssaMessages.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No messages from your support team yet.
            </p>
          ) : (
            <div className="divide-y">
              {ssaMessages.map((msg) => (
                <div key={msg.id} className="py-4 first:pt-0 last:pb-0">
                  <div className="flex items-start gap-3">
                    <Avatar className="h-10 w-10 flex-shrink-0">
                      <AvatarFallback className="bg-blue-600 text-white text-xs font-semibold">
                        {msg.recordedBy.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <p className="text-sm font-semibold">{msg.recordedBy}</p>
                        {msg.interventionType && (
                          <Badge className="bg-blue-50 text-blue-700 border-blue-200 text-xs">
                            {msg.interventionType}
                          </Badge>
                        )}
                        {msg.date && (
                          <span className="text-xs text-muted-foreground ml-auto">{msg.date}</span>
                        )}
                      </div>
                      <p className="text-sm text-gray-700 leading-relaxed">{msg.notes}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
