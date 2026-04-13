import { useState, useEffect } from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { FileText, Download, Loader2, BarChart2, Users, ClipboardList, ArrowLeft, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';

type ReportType = 'attendance-summary' | 'low-attendance' | 'module-history' | null;

interface ModuleSummary {
  moduleId: string;
  moduleCode: string;
  moduleName: string;
  totalSessions: number;
  avgAttendancePct: number;
  belowThreshold: number;
}

interface LowAttendanceStudent {
  studentId: string;
  name: string;
  programme: string;
  attendancePercentage: number;
  riskLevel: string;
}

interface SessionHistory {
  date: string;
  moduleId: string;
  moduleCode: string;
  moduleName: string;
  sessionType: string;
  present: number;
  absent: number;
  late: number;
}

const formatDate = (d: string) => {
  if (!d) return '—';
  try {
    return new Date(d + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch { return d; }
};

const downloadCsv = (filename: string, headers: string[], rows: (string | number)[][]) => {
  const lines = [headers.join(','), ...rows.map((r) => r.map((v) => `"${v}"`).join(','))];
  const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};

export default function FacultyAdminReportsPage() {
  const { user } = useAuth();

  const [adminFaculty, setAdminFaculty] = useState('');
  const [loadingAdmin, setLoadingAdmin] = useState(true);
  const [adminModuleIds, setAdminModuleIds] = useState<Set<string>>(new Set());
  const [modules, setModules] = useState<{ id: string; moduleCode: string; moduleName: string }[]>([]);
  const [modulesLoaded, setModulesLoaded] = useState(false);

  const [activeReport, setActiveReport] = useState<ReportType>(null);
  const [generating, setGenerating] = useState(false);

  // Report data
  const [summaryData, setSummaryData] = useState<ModuleSummary[]>([]);
  const [lowAttendanceData, setLowAttendanceData] = useState<LowAttendanceStudent[]>([]);
  const [historyData, setHistoryData] = useState<SessionHistory[]>([]);
  const [historyModuleFilter, setHistoryModuleFilter] = useState('all');

  // Load admin profile
  useEffect(() => {
    if (!user?.email) { setLoadingAdmin(false); return; }
    getDocs(query(collection(db, 'faculty_administrators'), where('email', '==', user.email)))
      .then(async (snap) => {
        if (!snap.empty) {
          const faculty = snap.docs[0].data().faculty ?? snap.docs[0].data().department ?? '';
          setAdminFaculty(faculty);
          if (faculty) {
            const modSnap = await getDocs(query(collection(db, 'modules'), where('faculty', '==', faculty)));
            const mods = modSnap.docs.map((d) => ({
              id: d.id,
              moduleCode: d.data().moduleCode ?? '',
              moduleName: d.data().moduleName ?? '',
            }));
            setModules(mods);
            setAdminModuleIds(new Set(mods.map((m) => m.id)));
            setModulesLoaded(true);
          }
        }
      })
      .catch(() => toast.error('Failed to load faculty info'))
      .finally(() => setLoadingAdmin(false));
  }, [user?.email]);

  const generateSummary = async () => {
    setGenerating(true);
    try {
      const attSnap = await getDocs(collection(db, 'attendance'));
      const relevant = attSnap.docs.filter((d) => adminModuleIds.has(d.data().moduleId));

      const sessionMap = new Map<string, { present: number; total: number }>();
      const moduleSessionSet = new Map<string, Set<string>>();

      relevant.forEach((d) => {
        const data = d.data();
        const sessionKey = `${data.moduleId}|${data.date}|${data.sessionType}`;
        const modSessions = moduleSessionSet.get(data.moduleId) ?? new Set<string>();
        modSessions.add(`${data.date}|${data.sessionType}`);
        moduleSessionSet.set(data.moduleId, modSessions);

        const cur = sessionMap.get(sessionKey) ?? { present: 0, total: 0 };
        cur.total++;
        if (data.status === 'present' || data.status === 'late') cur.present++;
        sessionMap.set(sessionKey, cur);
      });

      const studentAttMap = new Map<string, Map<string, { present: number; total: number }>>();
      relevant.forEach((d) => {
        const data = d.data();
        const modMap = studentAttMap.get(data.moduleId) ?? new Map();
        const cur = modMap.get(data.studentId) ?? { present: 0, total: 0 };
        cur.total++;
        if (data.status === 'present' || data.status === 'late') cur.present++;
        modMap.set(data.studentId, cur);
        studentAttMap.set(data.moduleId, modMap);
      });

      const summary: ModuleSummary[] = modules.map((m) => {
        const sessions = moduleSessionSet.get(m.id)?.size ?? 0;
        const studMap = studentAttMap.get(m.id);
        let totalPct = 0;
        let below = 0;
        let count = 0;
        if (studMap) {
          studMap.forEach((v) => {
            const pct = v.total > 0 ? Math.round((v.present / v.total) * 100) : 0;
            totalPct += pct;
            if (pct < 80) below++;
            count++;
          });
        }
        return {
          moduleId: m.id,
          moduleCode: m.moduleCode,
          moduleName: m.moduleName,
          totalSessions: sessions,
          avgAttendancePct: count > 0 ? Math.round(totalPct / count) : 0,
          belowThreshold: below,
        };
      }).sort((a, b) => a.moduleCode.localeCompare(b.moduleCode));

      setSummaryData(summary);
    } catch {
      toast.error('Failed to generate report');
    } finally {
      setGenerating(false);
    }
  };

  const generateLowAttendance = async () => {
    setGenerating(true);
    try {
      const enrollSnap = await getDocs(collection(db, 'moduleEnrollments'));
      const facultyStudentIds = new Set(
        enrollSnap.docs
          .filter((d) => adminModuleIds.has(d.data().moduleId))
          .map((d) => d.data().studentId)
      );
      const studSnap = await getDocs(collection(db, 'students'));
      const low: LowAttendanceStudent[] = studSnap.docs
        .map((d) => ({
          studentId: d.data().studentId ?? d.id,
          name: d.data().name ?? '',
          programme: d.data().programme ?? '',
          attendancePercentage: d.data().attendancePercentage ?? 100,
          riskLevel: d.data().riskLevel ?? 'low',
        }))
        .filter((s) => s.attendancePercentage < 80 && facultyStudentIds.has(s.studentId))
        .sort((a, b) => a.attendancePercentage - b.attendancePercentage);
      setLowAttendanceData(low);
    } catch {
      toast.error('Failed to generate report');
    } finally {
      setGenerating(false);
    }
  };

  const generateHistory = async () => {
    setGenerating(true);
    try {
      const attSnap = await getDocs(collection(db, 'attendance'));
      const relevant = attSnap.docs.filter((d) => adminModuleIds.has(d.data().moduleId));

      const groupMap = new Map<string, SessionHistory>();
      relevant.forEach((d) => {
        const data = d.data();
        const key = `${data.date}|${data.moduleId}|${data.sessionType}`;
        if (!groupMap.has(key)) {
          groupMap.set(key, {
            date: data.date ?? '',
            moduleId: data.moduleId ?? '',
            moduleCode: data.moduleCode ?? '',
            moduleName: data.moduleName ?? '',
            sessionType: data.sessionType ?? '',
            present: 0, absent: 0, late: 0,
          });
        }
        const entry = groupMap.get(key)!;
        if (data.status === 'present') entry.present++;
        else if (data.status === 'absent') entry.absent++;
        else if (data.status === 'late') entry.late++;
      });

      setHistoryData(
        Array.from(groupMap.values()).sort((a, b) => b.date.localeCompare(a.date))
      );
      setHistoryModuleFilter('all');
    } catch {
      toast.error('Failed to generate report');
    } finally {
      setGenerating(false);
    }
  };

  const exportSummaryCsv = () => {
    downloadCsv(
      `attendance_summary_${adminFaculty.replace(/\s+/g, '_')}.csv`,
      ['Module Code', 'Module Name', 'Total Sessions', 'Avg Attendance %', 'Students Below 80%'],
      summaryData.map((r) => [r.moduleCode, r.moduleName, r.totalSessions, r.avgAttendancePct, r.belowThreshold])
    );
  };

  const exportLowAttendanceCsv = () => {
    downloadCsv(
      `low_attendance_students.csv`,
      ['Student ID', 'Name', 'Programme', 'Attendance %', 'Risk Level'],
      lowAttendanceData.map((r) => [r.studentId, r.name, r.programme, r.attendancePercentage, r.riskLevel])
    );
  };

  const exportHistoryCsv = () => {
    const rows = filteredHistory.map((h) => [h.date, h.moduleCode, h.moduleName, h.sessionType, h.present, h.absent]);
    downloadCsv(
      `module_attendance_history.csv`,
      ['Date', 'Module Code', 'Module Name', 'Session Type', 'Present', 'Absent'],
      rows
    );
  };

  const filteredHistory = historyModuleFilter === 'all'
    ? historyData
    : historyData.filter((h) => h.moduleId === historyModuleFilter);

  if (loadingAdmin) {
    return (
      <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">
        <Loader2 className="h-4 w-4 animate-spin mr-2" />Loading...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Reports</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Generate attendance and performance reports for {adminFaculty || 'your faculty'}
        </p>
      </div>

      {/* Cards grid — no active report */}
      {activeReport === null && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Attendance Summary card */}
          <Card
            className="hover:shadow-md transition-shadow cursor-pointer"
            onClick={() => setActiveReport('attendance-summary')}
          >
            <CardHeader className="pb-3">
              <div className="h-10 w-10 rounded-full bg-blue-50 flex items-center justify-center mb-2">
                <BarChart2 className="h-5 w-5 text-blue-600" />
              </div>
              <CardTitle className="text-base">Attendance Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Per-module breakdown: total sessions, average attendance percentage, and students below 80%.
              </p>
              <div className="flex items-center text-sm font-medium text-primary gap-1">
                View Report <ChevronRight className="h-4 w-4" />
              </div>
            </CardContent>
          </Card>

          {/* Low Attendance Students card */}
          <Card
            className="hover:shadow-md transition-shadow cursor-pointer"
            onClick={() => setActiveReport('low-attendance')}
          >
            <CardHeader className="pb-3">
              <div className="h-10 w-10 rounded-full bg-red-50 flex items-center justify-center mb-2">
                <Users className="h-5 w-5 text-red-600" />
              </div>
              <CardTitle className="text-base">Low Attendance Students</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                All students with attendance below 80%, sorted by attendance percentage ascending.
              </p>
              <div className="flex items-center text-sm font-medium text-primary gap-1">
                View Report <ChevronRight className="h-4 w-4" />
              </div>
            </CardContent>
          </Card>

          {/* Module Attendance History card */}
          <Card
            className="hover:shadow-md transition-shadow cursor-pointer"
            onClick={() => setActiveReport('module-history')}
          >
            <CardHeader className="pb-3">
              <div className="h-10 w-10 rounded-full bg-purple-50 flex items-center justify-center mb-2">
                <ClipboardList className="h-5 w-5 text-purple-600" />
              </div>
              <CardTitle className="text-base">Module Attendance History</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                All recorded sessions for your faculty modules, filterable by module.
              </p>
              <div className="flex items-center text-sm font-medium text-primary gap-1">
                View Report <ChevronRight className="h-4 w-4" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Full page — Attendance Summary */}
      {activeReport === 'attendance-summary' && (
        <div className="space-y-6">
          <button
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
            onClick={() => setActiveReport(null)}
          >
            <ArrowLeft className="h-4 w-4" /> Back to Reports
          </button>

          <div className="flex items-start justify-between flex-wrap gap-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-blue-50 flex items-center justify-center shrink-0">
                <BarChart2 className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <h2 className="text-xl font-semibold">Attendance Summary</h2>
                <p className="text-sm text-muted-foreground">
                  Per-module breakdown: total sessions, average attendance percentage, and students below 80%.
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="gap-2"
                onClick={exportSummaryCsv}
                disabled={summaryData.length === 0}
              >
                <Download className="h-4 w-4" />Export CSV
              </Button>
              <Button
                className="gap-2"
                onClick={generateSummary}
                disabled={generating || !modulesLoaded}
              >
                {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
                Generate Report
              </Button>
            </div>
          </div>

          <Card>
            <CardContent className="pt-4">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-gray-50">
                      <th className="text-left font-medium text-muted-foreground px-4 py-3">Module Code</th>
                      <th className="text-left font-medium text-muted-foreground px-4 py-3">Module Name</th>
                      <th className="text-center font-medium text-muted-foreground px-4 py-3">Total Sessions</th>
                      <th className="text-center font-medium text-muted-foreground px-4 py-3">Avg Attendance</th>
                      <th className="text-center font-medium text-muted-foreground px-4 py-3">Below 80%</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summaryData.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="text-center py-12 text-muted-foreground text-sm">
                          Click "Generate Report" to load data.
                        </td>
                      </tr>
                    ) : summaryData.map((r) => (
                      <tr key={r.moduleId} className="border-b last:border-0 hover:bg-gray-50">
                        <td className="px-4 py-3 font-mono font-medium text-blue-700">{r.moduleCode}</td>
                        <td className="px-4 py-3">{r.moduleName}</td>
                        <td className="px-4 py-3 text-center font-medium">{r.totalSessions}</td>
                        <td className="px-4 py-3 text-center">
                          <span className={r.avgAttendancePct < 80 ? 'text-red-600 font-semibold' : 'text-green-600 font-semibold'}>
                            {r.avgAttendancePct}%
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          {r.belowThreshold > 0 ? (
                            <Badge className="bg-red-100 text-red-800 border-red-200 text-xs">{r.belowThreshold}</Badge>
                          ) : (
                            <span className="text-green-600 text-xs font-medium">None</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Full page — Low Attendance Students */}
      {activeReport === 'low-attendance' && (
        <div className="space-y-6">
          <button
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
            onClick={() => setActiveReport(null)}
          >
            <ArrowLeft className="h-4 w-4" /> Back to Reports
          </button>

          <div className="flex items-start justify-between flex-wrap gap-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-red-50 flex items-center justify-center shrink-0">
                <Users className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <h2 className="text-xl font-semibold">Low Attendance Students</h2>
                <p className="text-sm text-muted-foreground">
                  All students with attendance below 80%, sorted by attendance percentage ascending.
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="gap-2"
                onClick={exportLowAttendanceCsv}
                disabled={lowAttendanceData.length === 0}
              >
                <Download className="h-4 w-4" />Export CSV
              </Button>
              <Button
                className="gap-2"
                onClick={generateLowAttendance}
                disabled={generating || !modulesLoaded}
              >
                {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
                Generate Report
              </Button>
            </div>
          </div>

          <Card>
            <CardContent className="pt-4">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-gray-50">
                      <th className="text-left font-medium text-muted-foreground px-4 py-3">Student ID</th>
                      <th className="text-left font-medium text-muted-foreground px-4 py-3">Name</th>
                      <th className="text-left font-medium text-muted-foreground px-4 py-3">Programme</th>
                      <th className="text-center font-medium text-muted-foreground px-4 py-3">Attendance %</th>
                      <th className="text-center font-medium text-muted-foreground px-4 py-3">Risk</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lowAttendanceData.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="text-center py-12 text-muted-foreground text-sm">
                          Click "Generate Report" to load data.
                        </td>
                      </tr>
                    ) : lowAttendanceData.map((s) => (
                      <tr key={s.studentId} className="border-b last:border-0 hover:bg-gray-50">
                        <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{s.studentId}</td>
                        <td className="px-4 py-3 font-medium">{s.name || '—'}</td>
                        <td className="px-4 py-3 text-muted-foreground text-xs max-w-[200px] truncate">{s.programme || '—'}</td>
                        <td className="px-4 py-3 text-center">
                          <span className={s.attendancePercentage < 60 ? 'text-red-600 font-bold' : 'text-amber-600 font-semibold'}>
                            {s.attendancePercentage}%
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          {s.riskLevel === 'high' ? (
                            <Badge className="bg-red-100 text-red-800 border-red-200 text-xs">High</Badge>
                          ) : s.riskLevel === 'medium' ? (
                            <Badge className="bg-amber-100 text-amber-800 border-amber-200 text-xs">Medium</Badge>
                          ) : (
                            <Badge className="bg-green-100 text-green-800 border-green-200 text-xs">Low</Badge>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Full page — Module Attendance History */}
      {activeReport === 'module-history' && (
        <div className="space-y-6">
          <button
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
            onClick={() => setActiveReport(null)}
          >
            <ArrowLeft className="h-4 w-4" /> Back to Reports
          </button>

          <div className="flex items-start justify-between flex-wrap gap-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-purple-50 flex items-center justify-center shrink-0">
                <ClipboardList className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <h2 className="text-xl font-semibold">Module Attendance History</h2>
                <p className="text-sm text-muted-foreground">
                  All recorded sessions for your faculty modules, filterable by module.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Select value={historyModuleFilter} onValueChange={setHistoryModuleFilter}>
                <SelectTrigger className="w-[220px] h-9 text-sm">
                  <SelectValue placeholder="All modules" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All modules</SelectItem>
                  {modules.map((m) => (
                    <SelectItem key={m.id} value={m.id}>{m.moduleCode} — {m.moduleName}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                className="gap-2"
                onClick={exportHistoryCsv}
                disabled={historyData.length === 0}
              >
                <Download className="h-4 w-4" />Export CSV
              </Button>
              <Button
                className="gap-2"
                onClick={generateHistory}
                disabled={generating || !modulesLoaded}
              >
                {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
                Generate Report
              </Button>
            </div>
          </div>

          <Card>
            <CardContent className="pt-4">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-gray-50">
                      <th className="text-left font-medium text-muted-foreground px-4 py-3">Date</th>
                      <th className="text-left font-medium text-muted-foreground px-4 py-3">Module</th>
                      <th className="text-left font-medium text-muted-foreground px-4 py-3">Session Type</th>
                      <th className="text-center font-medium text-muted-foreground px-4 py-3">Present</th>
                      <th className="text-center font-medium text-muted-foreground px-4 py-3">Absent</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredHistory.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="text-center py-12 text-muted-foreground text-sm">
                          Click "Generate Report" to load data.
                        </td>
                      </tr>
                    ) : filteredHistory.map((h, i) => (
                      <tr key={i} className="border-b last:border-0 hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3 text-muted-foreground">{formatDate(h.date)}</td>
                        <td className="px-4 py-3">
                          <div className="font-medium">{h.moduleCode}</div>
                          <div className="text-xs text-muted-foreground">{h.moduleName}</div>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{h.sessionType}</td>
                        <td className="px-4 py-3 text-center">
                          <span className="text-green-600 font-semibold">{h.present}</span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          {h.absent > 0
                            ? <span className="text-red-600 font-semibold">{h.absent}</span>
                            : <span className="text-muted-foreground">—</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
