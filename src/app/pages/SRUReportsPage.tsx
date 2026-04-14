import { useState, useEffect } from 'react';
import { collection, getDocs, query, orderBy, where } from 'firebase/firestore';
import { db } from '../../firebase';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { FileText, Download, Loader2, AlertTriangle, CalendarDays, ClipboardList, Brain, TrendingUp, ArrowLeft, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';

const INTERVENTION_TYPES = [
  'Phone Call',
  'Text Message',
  'Email',
  'Online Meeting',
  'In-Person Meeting',
  'Referral',
  'Formal Notice',
  'Other',
];

const OUTCOME_COLORS: Record<string, string> = {
  'Positive Response': '#22c55e',
  'No Response': '#ef4444',
  'Follow Up Required': '#f59e0b',
  'Resolved': '#3b82f6',
};

interface MLReportRow {
  studentId: string;
  name: string;
  programme: string;
  riskLevel: string;
  riskScore: number | null;
  attendancePercentage: number;
  gpa: number;
  flagged: boolean;
}

interface InterventionDoc {
  id: string;
  studentId: string;
  studentName: string;
  interventionType: string;
  date: string;
  outcome: string;
  openStatus: string;
  caseStatus: string;
  recordedBy: string;
  createdAt: any;
}

interface AttendanceReportRow {
  studentId: string;
  studentName: string;
  programme: string;
  faculty: string;
  moduleCode: string;
  moduleName: string;
  total: number;
  present: number;
  absent: number;
  percentage: number;
  status: 'Good' | 'At Risk' | 'Critical';
  studentYear: string;
  moduleSemester: string;
}

const YEAR_MAP: Record<string, string[]> = {
  '1st Year': ['1st Year', 'Year 1', 'Level 4', '1'],
  '2nd Year': ['2nd Year', 'Year 2', 'Level 5', '2'],
  '3rd Year': ['3rd Year', 'Year 3', 'Level 6', '3'],
  '4th Year': ['4th Year', 'Year 4', 'Level 7', '4'],
};

const getRiskBadge = (riskLevel: string) => {
  if (riskLevel === 'high')
    return <Badge className="bg-red-100 text-red-800 border-red-200 text-xs">High</Badge>;
  if (riskLevel === 'medium')
    return <Badge className="bg-amber-100 text-amber-800 border-amber-200 text-xs">Medium</Badge>;
  return <Badge className="bg-green-100 text-green-800 border-green-200 text-xs">Low</Badge>;
};

const formatDate = (val: any) => {
  if (!val) return '—';
  try {
    const d = val?.toDate ? val.toDate() : new Date(val);
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return '—';
  }
};

const downloadCSV = (headers: string[], rows: string[][], filename: string) => {
  const csvContent = [headers.join(','), ...rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','))].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
};

const exportPDF = async (title: string, headers: string[], rows: string[][]) => {
  const { jsPDF } = await import('jspdf');
  const { default: autoTable } = await import('jspdf-autotable');
  const docPDF = new jsPDF();
  docPDF.setFontSize(16);
  docPDF.text(title, 14, 15);
  docPDF.setFontSize(10);
  docPDF.text(`Generated: ${new Date().toLocaleDateString()}`, 14, 22);
  autoTable(docPDF, {
    head: [headers],
    body: rows,
    startY: 28,
    styles: { fontSize: 9 },
    headStyles: { fillColor: [59, 130, 246] },
  });
  docPDF.save(`${title.toLowerCase().replace(/\s+/g, '-')}.pdf`);
};

type ReportType = 'attendance' | 'interventions' | 'semester' | 'ml-risk' | 'progress' | null;

export default function SRUReportsPage() {
  const [activeReport, setActiveReport] = useState<ReportType>(null);

  // Intervention Summary state
  const [interventions, setInterventions] = useState<InterventionDoc[]>([]);
  const [loadingInterventions, setLoadingInterventions] = useState(false);
  const [interventionSemesterFilter, setInterventionSemesterFilter] = useState('all');
  const [interventionDateFrom, setInterventionDateFrom] = useState('');
  const [interventionDateTo, setInterventionDateTo] = useState('');

  // Semester Comparison state
  const [semesterComparison, setSemesterComparison] = useState<{
    semester: string;
    interventions: number;
    resolved: number;
    successRate: number;
    flaggedStudents: number;
  }[]>([]);
  const [loadingSemester, setLoadingSemester] = useState(false);

  // ML Risk Report state
  const [mlReport, setMlReport] = useState<MLReportRow[]>([]);
  const [loadingMLReport, setLoadingMLReport] = useState(false);

  // Student Progress state
  const [progressReport, setProgressReport] = useState<{
    studentId: string;
    studentName: string;
    programme: string;
    interventionDate: string;
    interventionType: string;
    attendanceBefore: number;
    attendanceAfter: number;
    gpaBefore: number;
    gpaAfter: number;
    improved: boolean;
  }[]>([]);
  const [loadingProgress, setLoadingProgress] = useState(false);

  // Attendance Analysis state
  const [attFaculty, setAttFaculty] = useState('');
  const [attProgramme, setAttProgramme] = useState('');
  const [attModule, setAttModule] = useState('');
  const [attDateFrom, setAttDateFrom] = useState('');
  const [attDateTo, setAttDateTo] = useState('');
  const [attYear, setAttYear] = useState('');
  const [attSemester, setAttSemester] = useState('');
  const [attReport, setAttReport] = useState<AttendanceReportRow[]>([]);
  const [attLoading, setAttLoading] = useState(false);
  const [attGenerated, setAttGenerated] = useState(false);
  const [attModuleOptions, setAttModuleOptions] = useState<{ id: string; code: string; name: string; faculty: string; programme: string; yearOfStudy: string; semester: string }[]>([]);

  // Load modules for attendance filters on mount
  useEffect(() => {
    getDocs(collection(db, 'modules')).then((snap) => {
      setAttModuleOptions(
        snap.docs.map((d) => ({
          id: d.id,
          code: d.data().moduleCode ?? '',
          name: d.data().moduleName ?? d.data().name ?? '',
          faculty: d.data().faculty ?? '',
          programme: d.data().programme ?? '',
          yearOfStudy: d.data().yearOfStudy ?? d.data().year ?? '',
          semester: d.data().semester ?? '',
        })).sort((a, b) => a.code.localeCompare(b.code))
      );
    }).catch(() => {});
  }, []);

  const generateAttendanceReport = async () => {
    setAttLoading(true);
    try {
      const attConstraints = [];
      if (attDateFrom) attConstraints.push(where('date', '>=', attDateFrom));
      if (attDateTo)   attConstraints.push(where('date', '<=', attDateTo));
      const attQuery = attConstraints.length > 0
        ? query(collection(db, 'attendance'), ...attConstraints)
        : query(collection(db, 'attendance'));

      const [attSnap, studentSnap] = await Promise.all([
        getDocs(attQuery),
        getDocs(collection(db, 'students')),
      ]);

      const studentMap = new Map<string, { name: string; programme: string; faculty: string; level: string }>();
      studentSnap.forEach((d) => {
        const sid = String(d.data().studentId ?? '').trim();
        if (sid) studentMap.set(sid, {
          name: d.data().name ?? '',
          programme: d.data().programme ?? '',
          faculty: d.data().faculty ?? '',
          level: d.data().level ?? '',
        });
      });

      const moduleMetaMap = new Map(attModuleOptions.map((m) => [m.id, m]));

      const validModuleIds = new Set(
        attModuleOptions
          .filter((m) => {
            const yearOk = !attYear || (YEAR_MAP[attYear] ?? [attYear]).includes(m.yearOfStudy);
            const semOk = !attSemester || m.semester === attSemester || m.semester === 'Semester 1 & 2';
            return yearOk && semOk;
          })
          .map((m) => m.id)
      );

      const groups = new Map<string, { present: number; total: number; moduleCode: string; moduleName: string; moduleFaculty: string }>();
      attSnap.forEach((d) => {
        const data = d.data();
        const sid = data.studentId ?? '';
        const mid = data.moduleId ?? '';
        if (!sid || !mid) return;
        if (attModule && mid !== attModule) return;
        if ((attYear || attSemester) && !validModuleIds.has(mid)) return;

        const key = `${sid}___${mid}`;
        if (!groups.has(key)) {
          groups.set(key, { present: 0, total: 0, moduleCode: data.moduleCode ?? '', moduleName: data.moduleName ?? '', moduleFaculty: '' });
        }
        const g = groups.get(key)!;
        g.total++;
        if (data.status === 'present') g.present++;
      });

      const rows: AttendanceReportRow[] = [];
      groups.forEach((stats, key) => {
        const [sid, mid] = key.split('___');
        const stu = studentMap.get(sid);
        const pct = stats.total > 0 ? Math.round((stats.present / stats.total) * 100) : 0;
        const row: AttendanceReportRow = {
          studentId: sid,
          studentName: stu?.name ?? sid,
          programme: stu?.programme ?? '',
          faculty: stu?.faculty ?? '',
          moduleCode: stats.moduleCode,
          moduleName: stats.moduleName,
          total: stats.total,
          present: stats.present,
          absent: stats.total - stats.present,
          percentage: pct,
          status: pct >= 80 ? 'Good' : pct >= 60 ? 'At Risk' : 'Critical',
          studentYear: stu?.level ?? '',
          moduleSemester: moduleMetaMap.get(mid)?.semester ?? '',
        };
        if (attFaculty && row.faculty !== attFaculty) return;
        if (attProgramme && row.programme !== attProgramme) return;
        rows.push(row);
      });

      rows.sort((a, b) => a.percentage - b.percentage);
      setAttReport(rows);
      setAttGenerated(true);
      toast.success('Attendance report generated');
    } catch {
      toast.error('Failed to generate attendance report');
    } finally {
      setAttLoading(false);
    }
  };

  const fetchInterventions = async () => {
    setLoadingInterventions(true);
    try {
      const q = query(collection(db, 'interventions'), orderBy('createdAt', 'desc'));
      const snap = await getDocs(q);
      setInterventions(
        snap.docs.map((d) => ({
          id: d.id,
          studentId: d.data().studentId ?? '',
          studentName: d.data().studentName ?? '',
          interventionType: d.data().interventionType ?? '',
          date: d.data().date ?? '',
          outcome: d.data().outcome ?? '',
          openStatus: d.data().openStatus ?? '',
          caseStatus: d.data().caseStatus ?? 'open',
          recordedBy: d.data().recordedBy ?? '',
          createdAt: d.data().createdAt,
        }))
      );
    } finally {
      setLoadingInterventions(false);
    }
  };

  const handleGenerateInterventions = async () => {
    if (interventions.length === 0) await fetchInterventions();
  };

  const handleGenerateSemesterComparison = async () => {
    setLoadingSemester(true);
    try {
      const intSnap = await getDocs(query(collection(db, 'interventions'), orderBy('createdAt', 'desc')));
      const allInts = intSnap.docs.map(d => d.data());
      const semesters = ['Semester 1', 'Semester 2', 'Semester 3'];
      const getIntSemester = (dateStr: string) => {
        const month = new Date(dateStr).getMonth() + 1;
        if (month >= 9 && month <= 12) return 'Semester 1';
        if (month >= 1 && month <= 4) return 'Semester 2';
        return 'Semester 3';
      };
      const rows = semesters.map(sem => {
        const semInts = allInts.filter(i => getIntSemester(i.date ?? '') === sem);
        const resolved = semInts.filter(i => i.caseStatus === 'closed').length;
        const successRate = semInts.length > 0 ? Math.round((resolved / semInts.length) * 100) : 0;
        return { semester: sem, interventions: semInts.length, resolved, successRate, flaggedStudents: 0 };
      });
      setSemesterComparison(rows);
      toast.success('Semester comparison generated');
    } catch {
      toast.error('Failed to generate semester comparison');
    } finally {
      setLoadingSemester(false);
    }
  };

  const handleGenerateMLReport = async () => {
    setLoadingMLReport(true);
    try {
      const snap = await getDocs(collection(db, 'students'));
      const rows: MLReportRow[] = snap.docs.map((d) => ({
        studentId: d.data().studentId ?? d.id,
        name: d.data().name ?? '—',
        programme: d.data().programme ?? '—',
        riskLevel: (d.data().riskLevel ?? 'low').toLowerCase(),
        riskScore: d.data().riskScore ?? d.data().mlRiskScore ?? null,
        attendancePercentage: d.data().attendancePercentage ?? 0,
        gpa: d.data().gpa ?? 0,
        flagged: d.data().flagged ?? false,
      }));
      const order: Record<string, number> = { high: 0, medium: 1, low: 2 };
      rows.sort((a, b) => (order[a.riskLevel] ?? 3) - (order[b.riskLevel] ?? 3));
      setMlReport(rows);
      toast.success('ML risk report generated');
    } catch {
      toast.error('Failed to load ML risk report');
    } finally {
      setLoadingMLReport(false);
    }
  };

  const exportMLReportJSON = () => {
    const data = mlReport.map((r) => ({
      student_id: r.studentId,
      name: r.name,
      programme: r.programme,
      risk_level: r.riskLevel,
      risk_score: r.riskScore,
      attendance_percentage: r.attendancePercentage,
      gpa: r.gpa,
      flagged: r.flagged,
    }));
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `ml-risk-report-${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleGenerateProgress = async () => {
    setLoadingProgress(true);
    try {
      const intSnap = await getDocs(query(collection(db, 'interventions'), orderBy('createdAt', 'desc')));
      const studSnap = await getDocs(collection(db, 'students'));
      const studentMap = new Map(
        studSnap.docs.map(d => [d.data().studentId, {
          name: d.data().name,
          programme: d.data().programme,
          gpa: d.data().gpa ?? 0,
          attendance: d.data().attendancePercentage ?? 0,
        }])
      );
      const seen = new Set<string>();
      const rows = intSnap.docs
        .filter(d => {
          const sid = d.data().studentId;
          if (seen.has(sid)) return false;
          seen.add(sid);
          return true;
        })
        .map(d => {
          const data = d.data();
          const student = studentMap.get(data.studentId);
          if (!student) return null;
          const improved =
            (student.attendance > (data.attendanceBefore ?? 0)) ||
            (student.gpa > (data.gpaBefore ?? 0));
          return {
            studentId: data.studentId,
            studentName: data.studentName ?? student.name,
            programme: student.programme,
            interventionDate: data.date ?? '',
            interventionType: data.interventionType ?? data.type ?? '',
            attendanceBefore: data.attendanceBefore ?? 0,
            attendanceAfter: student.attendance,
            gpaBefore: data.gpaBefore ?? 0,
            gpaAfter: student.gpa,
            improved,
          };
        })
        .filter(Boolean);
      setProgressReport(rows as any);
      toast.success('Progress report generated');
    } catch {
      toast.error('Failed to generate progress report');
    } finally {
      setLoadingProgress(false);
    }
  };

  const attFacultyOptions = [...new Set(attModuleOptions.map((m) => m.faculty).filter(Boolean))].sort();
  const filteredProgrammeOptions = [...new Set(
    attModuleOptions
      .filter((m) => !attFaculty || m.faculty === attFaculty)
      .map((m) => m.programme)
      .filter(Boolean)
  )].sort();
  const filteredModuleOptions = attModuleOptions.filter((m) => {
    const matchFaculty = !attFaculty || m.faculty === attFaculty;
    const matchProgramme = !attProgramme || m.programme === attProgramme;
    const matchYear = !attYear || (YEAR_MAP[attYear] ?? [attYear]).some((y) => m.yearOfStudy === y);
    const matchSemester = !attSemester || m.semester === attSemester || m.semester === 'Semester 1 & 2';
    return matchFaculty && matchProgramme && matchYear && matchSemester;
  });

  const getInterventionSemester = (dateStr: string) => {
    const month = new Date(dateStr).getMonth() + 1;
    if (month >= 9 && month <= 12) return 'Semester 1';
    if (month >= 1 && month <= 4) return 'Semester 2';
    return 'Semester 3';
  };

  const filteredInterventions = interventions
    .filter(i => interventionSemesterFilter === 'all' || getInterventionSemester(i.date) === interventionSemesterFilter)
    .filter(i => {
      if (interventionDateFrom && i.date < interventionDateFrom) return false;
      if (interventionDateTo && i.date > interventionDateTo) return false;
      return true;
    });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Reports</h1>
        <p className="text-muted-foreground text-sm mt-1">Generate student support reports</p>
      </div>

      {/* Card grid — no active report */}
      {activeReport === null && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Attendance Analysis */}
          <Card
            className="hover:shadow-md transition-shadow cursor-pointer"
            onClick={() => setActiveReport('attendance')}
          >
            <CardHeader className="pb-3">
              <div className="h-10 w-10 rounded-full bg-blue-50 flex items-center justify-center mb-2">
                <CalendarDays className="h-5 w-5 text-blue-600" />
              </div>
              <CardTitle className="text-base">Attendance Analysis Report</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Detailed attendance breakdown by module, faculty, programme, and date range.
              </p>
              <div className="flex items-center text-sm font-medium text-primary gap-1">
                View Report <ChevronRight className="h-4 w-4" />
              </div>
            </CardContent>
          </Card>

          {/* Intervention Summary */}
          <Card
            className="hover:shadow-md transition-shadow cursor-pointer"
            onClick={() => setActiveReport('interventions')}
          >
            <CardHeader className="pb-3">
              <div className="h-10 w-10 rounded-full bg-purple-50 flex items-center justify-center mb-2">
                <ClipboardList className="h-5 w-5 text-purple-600" />
              </div>
              <CardTitle className="text-base">Intervention Summary Report</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Summary of all interventions logged, with outcome breakdown charts.
              </p>
              <div className="flex items-center text-sm font-medium text-primary gap-1">
                View Report <ChevronRight className="h-4 w-4" />
              </div>
            </CardContent>
          </Card>

          {/* Semester Comparison */}
          <Card
            className="hover:shadow-md transition-shadow cursor-pointer"
            onClick={() => setActiveReport('semester')}
          >
            <CardHeader className="pb-3">
              <div className="h-10 w-10 rounded-full bg-green-50 flex items-center justify-center mb-2">
                <TrendingUp className="h-5 w-5 text-green-600" />
              </div>
              <CardTitle className="text-base">Semester Comparison Report</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Compare intervention activity and success rates across semesters.
              </p>
              <div className="flex items-center text-sm font-medium text-primary gap-1">
                View Report <ChevronRight className="h-4 w-4" />
              </div>
            </CardContent>
          </Card>

          {/* ML Risk Score */}
          <Card
            className="hover:shadow-md transition-shadow cursor-pointer"
            onClick={() => setActiveReport('ml-risk')}
          >
            <CardHeader className="pb-3">
              <div className="h-10 w-10 rounded-full bg-red-50 flex items-center justify-center mb-2">
                <Brain className="h-5 w-5 text-red-600" />
              </div>
              <CardTitle className="text-base">ML Risk Score Report</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Predicted dropout probabilities and risk level per student from the ML model.
              </p>
              <div className="flex items-center text-sm font-medium text-primary gap-1">
                View Report <ChevronRight className="h-4 w-4" />
              </div>
            </CardContent>
          </Card>

          {/* Student Progress */}
          <Card
            className="hover:shadow-md transition-shadow cursor-pointer"
            onClick={() => setActiveReport('progress')}
          >
            <CardHeader className="pb-3">
              <div className="h-10 w-10 rounded-full bg-amber-50 flex items-center justify-center mb-2">
                <AlertTriangle className="h-5 w-5 text-amber-600" />
              </div>
              <CardTitle className="text-base">Student Progress Report</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Students who received interventions and their current academic standing.
              </p>
              <div className="flex items-center text-sm font-medium text-primary gap-1">
                View Report <ChevronRight className="h-4 w-4" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── Attendance Analysis ── */}
      {activeReport === 'attendance' && (
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
                <CalendarDays className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <h2 className="text-xl font-semibold">Attendance Analysis Report</h2>
                <p className="text-sm text-muted-foreground">Detailed attendance breakdown by module and date range.</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="gap-2"
                disabled={!attGenerated || attReport.length === 0}
                onClick={() =>
                  downloadCSV(
                    ['Student ID', 'Student Name', 'Programme', 'Year', 'Faculty', 'Module Code', 'Module Name', 'Semester', 'Sessions', 'Present', 'Absent', 'Attendance %', 'Status'],
                    attReport.map((r) => [r.studentId, r.studentName, r.programme, r.studentYear, r.faculty, r.moduleCode, r.moduleName, r.moduleSemester, String(r.total), String(r.present), String(r.absent), `${r.percentage}%`, r.status]),
                    'attendance-analysis.csv'
                  )
                }
              >
                <Download className="h-4 w-4" /> Export CSV
              </Button>
              <Button className="gap-2" onClick={generateAttendanceReport} disabled={attLoading}>
                {attLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
                Generate Report
              </Button>
            </div>
          </div>

          {/* Filters */}
          <Card>
            <CardContent className="pt-4 space-y-3">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Faculty</Label>
                  <Select value={attFaculty || 'all'} onValueChange={(v) => { setAttFaculty(v === 'all' ? '' : v); setAttProgramme(''); setAttYear(''); setAttSemester(''); setAttModule(''); }}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="All Faculties" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Faculties</SelectItem>
                      {attFacultyOptions.map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Programme</Label>
                  <Select value={attProgramme || 'all'} onValueChange={(v) => { setAttProgramme(v === 'all' ? '' : v); setAttYear(''); setAttSemester(''); setAttModule(''); }}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="All Programmes" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Programmes</SelectItem>
                      {filteredProgrammeOptions.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Year</Label>
                  <Select value={attYear || 'all'} onValueChange={(v) => { setAttYear(v === 'all' ? '' : v); setAttSemester(''); setAttModule(''); }}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="All Years" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Years</SelectItem>
                      <SelectItem value="1st Year">1st Year</SelectItem>
                      <SelectItem value="2nd Year">2nd Year</SelectItem>
                      <SelectItem value="3rd Year">3rd Year</SelectItem>
                      <SelectItem value="4th Year">4th Year</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Semester</Label>
                  <Select value={attSemester || 'all'} onValueChange={(v) => { setAttSemester(v === 'all' ? '' : v); setAttModule(''); }}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="All Semesters" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Semesters</SelectItem>
                      <SelectItem value="Semester 1">Semester 1</SelectItem>
                      <SelectItem value="Semester 2">Semester 2</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Module</Label>
                  <Select value={attModule || 'all'} onValueChange={(v) => setAttModule(v === 'all' ? '' : v)}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="All Modules" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Modules</SelectItem>
                      {filteredModuleOptions.map((m) => (
                        <SelectItem key={m.id} value={m.id}>{m.code} — {m.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Date From</Label>
                  <Input type="date" className="h-8 text-xs" value={attDateFrom} onChange={(e) => setAttDateFrom(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Date To</Label>
                  <Input type="date" className="h-8 text-xs" value={attDateTo} onChange={(e) => setAttDateTo(e.target.value)} />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-gray-50">
                      <th className="text-left font-medium text-muted-foreground px-4 py-3">Student ID</th>
                      <th className="text-left font-medium text-muted-foreground px-4 py-3">Name</th>
                      <th className="text-left font-medium text-muted-foreground px-4 py-3">Programme</th>
                      <th className="text-left font-medium text-muted-foreground px-4 py-3">Year</th>
                      <th className="text-left font-medium text-muted-foreground px-4 py-3">Semester</th>
                      <th className="text-left font-medium text-muted-foreground px-4 py-3">Module</th>
                      <th className="text-center font-medium text-muted-foreground px-4 py-3">Sessions</th>
                      <th className="text-center font-medium text-muted-foreground px-4 py-3">Present</th>
                      <th className="text-center font-medium text-muted-foreground px-4 py-3">Absent</th>
                      <th className="text-center font-medium text-muted-foreground px-4 py-3">%</th>
                      <th className="text-center font-medium text-muted-foreground px-4 py-3">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {!attGenerated ? (
                      <tr>
                        <td colSpan={11} className="text-center py-12 text-muted-foreground text-sm">
                          Click "Generate Report" to load data.
                        </td>
                      </tr>
                    ) : attReport.length === 0 ? (
                      <tr>
                        <td colSpan={11} className="text-center py-12 text-muted-foreground text-sm">
                          No records found for the selected filters.
                        </td>
                      </tr>
                    ) : attReport.map((r, i) => (
                      <tr key={i} className="border-b last:border-0 hover:bg-gray-50">
                        <td className="px-4 py-3 text-xs text-muted-foreground font-mono">{r.studentId}</td>
                        <td className="px-4 py-3 font-medium">{r.studentName}</td>
                        <td className="px-4 py-3 text-xs text-muted-foreground max-w-[140px]"><span className="truncate block">{r.programme || '—'}</span></td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">{r.studentYear || '—'}</td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">{r.moduleSemester || '—'}</td>
                        <td className="px-4 py-3">
                          <div className="font-medium text-xs">{r.moduleCode}</div>
                          <div className="text-xs text-muted-foreground">{r.moduleName}</div>
                        </td>
                        <td className="px-4 py-3 text-center text-muted-foreground">{r.total}</td>
                        <td className="px-4 py-3 text-center text-green-600 font-medium">{r.present}</td>
                        <td className="px-4 py-3 text-center text-red-500">{r.absent}</td>
                        <td className="px-4 py-3 text-center">
                          <span className={`font-semibold ${r.percentage >= 80 ? 'text-green-600' : r.percentage >= 60 ? 'text-amber-600' : 'text-red-600'}`}>
                            {r.percentage}%
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          {r.status === 'Good' ? (
                            <Badge className="bg-green-100 text-green-800 border-green-200 text-xs">Good</Badge>
                          ) : r.status === 'At Risk' ? (
                            <Badge className="bg-amber-100 text-amber-800 border-amber-200 text-xs">At Risk</Badge>
                          ) : (
                            <Badge className="bg-red-100 text-red-800 border-red-200 text-xs">Critical</Badge>
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

      {/* ── Intervention Summary ── */}
      {activeReport === 'interventions' && (
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
                <h2 className="text-xl font-semibold">Intervention Summary Report</h2>
                <p className="text-sm text-muted-foreground">Summary of all interventions logged in the system.</p>
              </div>
            </div>
            <div className="flex gap-2 flex-wrap">
              <Button
                variant="outline"
                className="gap-2"
                disabled={filteredInterventions.length === 0}
                onClick={() =>
                  downloadCSV(
                    ['Student', 'Intervention Type', 'Date', 'Outcome', 'Recorded By'],
                    filteredInterventions.map((i) => [i.studentName, i.interventionType, i.date || formatDate(i.createdAt), i.outcome, i.recordedBy]),
                    'intervention-summary.csv'
                  )
                }
              >
                <Download className="h-4 w-4" /> Export CSV
              </Button>
              <Button
                variant="outline"
                className="gap-2"
                disabled={filteredInterventions.length === 0}
                onClick={() =>
                  exportPDF(
                    'Intervention Summary Report',
                    ['Student', 'Intervention Type', 'Date', 'Outcome', 'Recorded By'],
                    filteredInterventions.map((i) => [i.studentName, i.interventionType, i.date || formatDate(i.createdAt), i.outcome, i.recordedBy])
                  )
                }
              >
                <FileText className="h-4 w-4" /> Export PDF
              </Button>
              <Button className="gap-2" onClick={handleGenerateInterventions} disabled={loadingInterventions}>
                {loadingInterventions ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
                Generate Report
              </Button>
            </div>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-3">
            <Select value={interventionSemesterFilter} onValueChange={setInterventionSemesterFilter}>
              <SelectTrigger className="w-[180px] h-8 text-xs">
                <SelectValue placeholder="All Semesters" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Semesters</SelectItem>
                <SelectItem value="Semester 1">Semester 1 (Sep-Dec)</SelectItem>
                <SelectItem value="Semester 2">Semester 2 (Jan-Apr)</SelectItem>
                <SelectItem value="Semester 3">Semester 3 (May-Aug)</SelectItem>
              </SelectContent>
            </Select>
            <input type="date" value={interventionDateFrom} onChange={e => setInterventionDateFrom(e.target.value)} className="flex h-8 rounded-md border border-input bg-transparent px-3 py-1 text-xs" />
            <span className="text-sm text-muted-foreground">to</span>
            <input type="date" value={interventionDateTo} onChange={e => setInterventionDateTo(e.target.value)} className="flex h-8 rounded-md border border-input bg-transparent px-3 py-1 text-xs" />
            {interventions.length > 0 && <p className="text-sm text-muted-foreground">{filteredInterventions.length} interventions found</p>}
          </div>

          {/* Charts */}
          {filteredInterventions.length > 0 && (() => {
            const typeData = INTERVENTION_TYPES.map(type => ({
              name: type,
              count: filteredInterventions.filter(i => i.interventionType === type).length,
            })).filter(d => d.count > 0);
            const outcomeData = Object.keys(OUTCOME_COLORS).map(outcome => ({
              name: outcome,
              value: filteredInterventions.filter(i => i.outcome === outcome).length,
            })).filter(d => d.value > 0);
            return (
              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-lg border p-4">
                  <p className="text-sm font-medium mb-3">Interventions by Type</p>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={typeData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                      <YAxis allowDecimals={false} />
                      <Tooltip />
                      <Bar dataKey="count" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="rounded-lg border p-4">
                  <p className="text-sm font-medium mb-3">Outcome Breakdown</p>
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie data={outcomeData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                        {outcomeData.map((entry, index) => (
                          <Cell key={index} fill={OUTCOME_COLORS[entry.name] ?? '#6b7280'} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
            );
          })()}

          <Card>
            <CardContent className="pt-4">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-gray-50">
                      <th className="text-left font-medium text-muted-foreground px-4 py-3">Student</th>
                      <th className="text-left font-medium text-muted-foreground px-4 py-3">Intervention Type</th>
                      <th className="text-left font-medium text-muted-foreground px-4 py-3">Date</th>
                      <th className="text-left font-medium text-muted-foreground px-4 py-3">Outcome</th>
                      <th className="text-left font-medium text-muted-foreground px-4 py-3">Recorded By</th>
                    </tr>
                  </thead>
                  <tbody>
                    {interventions.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="text-center py-12 text-muted-foreground text-sm">
                          Click "Generate Report" to load data.
                        </td>
                      </tr>
                    ) : filteredInterventions.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="text-center py-12 text-muted-foreground text-sm">
                          No interventions match the selected filters.
                        </td>
                      </tr>
                    ) : filteredInterventions.map((i) => (
                      <tr key={i.id} className="border-b last:border-0 hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium">{i.studentName}</td>
                        <td className="px-4 py-3 text-sm">{i.interventionType}</td>
                        <td className="px-4 py-3 text-sm whitespace-nowrap">{i.date || formatDate(i.createdAt)}</td>
                        <td className="px-4 py-3 text-sm">{i.outcome}</td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">{i.recordedBy}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── Semester Comparison ── */}
      {activeReport === 'semester' && (
        <div className="space-y-6">
          <button
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
            onClick={() => setActiveReport(null)}
          >
            <ArrowLeft className="h-4 w-4" /> Back to Reports
          </button>

          <div className="flex items-start justify-between flex-wrap gap-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-green-50 flex items-center justify-center shrink-0">
                <TrendingUp className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <h2 className="text-xl font-semibold">Semester Comparison Report</h2>
                <p className="text-sm text-muted-foreground">Compare intervention activity and success rates across semesters.</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="gap-2"
                disabled={semesterComparison.length === 0}
                onClick={() =>
                  downloadCSV(
                    ['Semester', 'Total Interventions', 'Resolved', 'Success Rate'],
                    semesterComparison.map((r) => [r.semester, String(r.interventions), String(r.resolved), `${r.successRate}%`]),
                    'semester-comparison.csv'
                  )
                }
              >
                <Download className="h-4 w-4" /> Export CSV
              </Button>
              <Button
                variant="outline"
                className="gap-2"
                disabled={semesterComparison.length === 0}
                onClick={() =>
                  exportPDF(
                    'Semester Comparison Report',
                    ['Semester', 'Total Interventions', 'Resolved', 'Success Rate'],
                    semesterComparison.map((r) => [r.semester, String(r.interventions), String(r.resolved), `${r.successRate}%`])
                  )
                }
              >
                <FileText className="h-4 w-4" /> Export PDF
              </Button>
              <Button className="gap-2" onClick={handleGenerateSemesterComparison} disabled={loadingSemester}>
                {loadingSemester ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
                Generate Report
              </Button>
            </div>
          </div>

          {semesterComparison.length > 0 && (
            <div className="rounded-lg border p-4">
              <p className="text-sm font-medium mb-3">Interventions vs Resolved by Semester</p>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={semesterComparison}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="semester" tick={{ fontSize: 12 }} />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="interventions" name="Interventions" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="resolved" name="Resolved" fill="#22c55e" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          <Card>
            <CardContent className="pt-4">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-gray-50">
                      <th className="text-left font-medium text-muted-foreground px-4 py-3">Semester</th>
                      <th className="text-center font-medium text-muted-foreground px-4 py-3">Total Interventions</th>
                      <th className="text-center font-medium text-muted-foreground px-4 py-3">Resolved</th>
                      <th className="text-center font-medium text-muted-foreground px-4 py-3">Success Rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {semesterComparison.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="text-center py-12 text-muted-foreground text-sm">
                          Click "Generate Report" to load data.
                        </td>
                      </tr>
                    ) : semesterComparison.map((r, i) => (
                      <tr key={i} className="border-b last:border-0 hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium">{r.semester}</td>
                        <td className="px-4 py-3 text-center">{r.interventions}</td>
                        <td className="px-4 py-3 text-center text-green-600 font-medium">{r.resolved}</td>
                        <td className="px-4 py-3 text-center">
                          <span className={`font-semibold ${r.successRate >= 70 ? 'text-green-600' : r.successRate >= 40 ? 'text-amber-600' : 'text-red-600'}`}>
                            {r.successRate}%
                          </span>
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

      {/* ── ML Risk Score ── */}
      {activeReport === 'ml-risk' && (
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
                <Brain className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <h2 className="text-xl font-semibold">ML Risk Score Report</h2>
                <p className="text-sm text-muted-foreground">Predicted dropout probabilities and risk level per student.</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="gap-2"
                disabled={mlReport.length === 0}
                onClick={exportMLReportJSON}
              >
                <Download className="h-4 w-4" /> Export JSON
              </Button>
              <Button
                variant="outline"
                className="gap-2"
                disabled={mlReport.length === 0}
                onClick={() => {
                  const headers = ['Student ID', 'Name', 'Programme', 'Risk Level', 'Risk Score', 'Attendance %', 'GPA', 'Flagged'];
                  const rows = mlReport.map((r) => [
                    r.studentId, r.name, r.programme,
                    r.riskLevel.charAt(0).toUpperCase() + r.riskLevel.slice(1),
                    r.riskScore !== null ? String(Math.round(r.riskScore)) + '%' : '—',
                    String(r.attendancePercentage) + '%',
                    String(r.gpa),
                    r.flagged ? 'Yes' : 'No',
                  ]);
                  downloadCSV(headers, rows, `ml-risk-report-${new Date().toISOString().split('T')[0]}.csv`);
                }}
              >
                <Download className="h-4 w-4" /> Export CSV
              </Button>
              <Button className="gap-2" onClick={handleGenerateMLReport} disabled={loadingMLReport}>
                {loadingMLReport ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
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
                      <th className="text-left font-medium text-muted-foreground px-4 py-3">Risk Level</th>
                      <th className="text-right font-medium text-muted-foreground px-4 py-3">Risk Score</th>
                      <th className="text-right font-medium text-muted-foreground px-4 py-3">Attendance %</th>
                      <th className="text-right font-medium text-muted-foreground px-4 py-3">GPA</th>
                      <th className="text-center font-medium text-muted-foreground px-4 py-3">Flagged</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mlReport.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="text-center py-12 text-muted-foreground text-sm">
                          Click "Generate Report" to load data.
                        </td>
                      </tr>
                    ) : mlReport.map((r, i) => (
                      <tr key={r.studentId + i} className="border-b last:border-0 hover:bg-gray-50">
                        <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{r.studentId}</td>
                        <td className="px-4 py-3 font-medium">{r.name}</td>
                        <td className="px-4 py-3 text-muted-foreground text-xs max-w-[160px] truncate">{r.programme}</td>
                        <td className="px-4 py-3">{getRiskBadge(r.riskLevel)}</td>
                        <td className="px-4 py-3 text-right">
                          {r.riskScore !== null ? (
                            <span className={r.riskScore >= 70 ? 'text-red-600 font-semibold' : r.riskScore >= 40 ? 'text-amber-600 font-semibold' : 'text-green-600'}>
                              {Math.round(r.riskScore)}%
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">{r.attendancePercentage}%</td>
                        <td className="px-4 py-3 text-right">{r.gpa.toFixed(2)}</td>
                        <td className="px-4 py-3 text-center">
                          {r.flagged
                            ? <Badge className="bg-orange-100 text-orange-800 border-orange-200 text-xs">Yes</Badge>
                            : <span className="text-muted-foreground text-xs">No</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {mlReport.length > 0 && (
                <p className="text-xs text-muted-foreground mt-3">{mlReport.length} students · Risk score sourced from Firestore riskScore / mlRiskScore field</p>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── Student Progress ── */}
      {activeReport === 'progress' && (
        <div className="space-y-6">
          <button
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
            onClick={() => setActiveReport(null)}
          >
            <ArrowLeft className="h-4 w-4" /> Back to Reports
          </button>

          <div className="flex items-start justify-between flex-wrap gap-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-amber-50 flex items-center justify-center shrink-0">
                <AlertTriangle className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <h2 className="text-xl font-semibold">Student Progress Report</h2>
                <p className="text-sm text-muted-foreground">Students who received interventions and their current academic standing.</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="gap-2"
                disabled={progressReport.length === 0}
                onClick={() =>
                  downloadCSV(
                    ['Student ID', 'Student Name', 'Programme', 'Intervention Date', 'Intervention Type', 'Attendance Before', 'Attendance After', 'GPA Before', 'GPA After', 'Status'],
                    progressReport.map((r) => [
                      r.studentId, r.studentName, r.programme, r.interventionDate, r.interventionType,
                      `${r.attendanceBefore}%`, `${r.attendanceAfter}%`, r.gpaBefore.toFixed(2), r.gpaAfter.toFixed(2),
                      r.improved ? 'Improving' : 'Monitoring',
                    ]),
                    'student-progress.csv'
                  )
                }
              >
                <Download className="h-4 w-4" /> Export CSV
              </Button>
              <Button
                variant="outline"
                className="gap-2"
                disabled={progressReport.length === 0}
                onClick={() =>
                  exportPDF(
                    'Student Progress Report',
                    ['Student ID', 'Student Name', 'Programme', 'Intervention Date', 'Type', 'Att. Before', 'Att. After', 'GPA Before', 'GPA After', 'Status'],
                    progressReport.map((r) => [
                      r.studentId, r.studentName, r.programme, r.interventionDate, r.interventionType,
                      `${r.attendanceBefore}%`, `${r.attendanceAfter}%`, r.gpaBefore.toFixed(2), r.gpaAfter.toFixed(2),
                      r.improved ? 'Improving' : 'Monitoring',
                    ])
                  )
                }
              >
                <FileText className="h-4 w-4" /> Export PDF
              </Button>
              <Button className="gap-2" onClick={handleGenerateProgress} disabled={loadingProgress}>
                {loadingProgress ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
                Generate Report
              </Button>
            </div>
          </div>

          {progressReport.length > 0 && (
            <div className="rounded-lg border border-blue-100 bg-blue-50 p-3 text-xs text-blue-700">
              Note: Attendance and GPA values are automatically captured when an intervention is logged. Historical data only available for interventions logged after this feature was implemented.
            </div>
          )}

          <Card>
            <CardContent className="pt-4">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-gray-50">
                      <th className="text-left font-medium text-muted-foreground px-4 py-3">Student</th>
                      <th className="text-left font-medium text-muted-foreground px-4 py-3">Programme</th>
                      <th className="text-left font-medium text-muted-foreground px-4 py-3">Intervention Date</th>
                      <th className="text-left font-medium text-muted-foreground px-4 py-3">Type</th>
                      <th className="text-center font-medium text-muted-foreground px-4 py-3">Att. Before</th>
                      <th className="text-center font-medium text-muted-foreground px-4 py-3">Att. After</th>
                      <th className="text-center font-medium text-muted-foreground px-4 py-3">GPA Before</th>
                      <th className="text-center font-medium text-muted-foreground px-4 py-3">GPA After</th>
                      <th className="text-center font-medium text-muted-foreground px-4 py-3">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {progressReport.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="text-center py-12 text-muted-foreground text-sm">
                          Click "Generate Report" to load data.
                        </td>
                      </tr>
                    ) : progressReport.map((r, i) => (
                      <tr key={i} className="border-b last:border-0 hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <div className="font-medium text-sm">{r.studentName}</div>
                          <div className="text-xs text-muted-foreground font-mono">{r.studentId}</div>
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground max-w-[140px]"><span className="truncate block">{r.programme || '—'}</span></td>
                        <td className="px-4 py-3 text-sm whitespace-nowrap">{r.interventionDate || '—'}</td>
                        <td className="px-4 py-3 text-sm">{r.interventionType || '—'}</td>
                        <td className="px-4 py-3 text-center">
                          <span className={`font-medium text-sm ${r.attendanceBefore < 80 ? 'text-red-600' : 'text-green-600'}`}>
                            {r.attendanceBefore > 0 ? `${r.attendanceBefore}%` : '—'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`font-medium text-sm ${r.attendanceAfter < 80 ? 'text-red-600' : 'text-green-600'}`}>
                            {r.attendanceAfter}%
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center text-sm text-muted-foreground">{r.gpaBefore > 0 ? r.gpaBefore.toFixed(2) : '—'}</td>
                        <td className="px-4 py-3 text-center text-sm">{r.gpaAfter.toFixed(2)}</td>
                        <td className="px-4 py-3 text-center">
                          {r.improved ? (
                            <Badge className="bg-green-100 text-green-800 border-green-200 text-xs">Improving</Badge>
                          ) : (
                            <Badge className="bg-amber-100 text-amber-800 border-amber-200 text-xs">Monitoring</Badge>
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
    </div>
  );
}
