import { useState, useEffect } from 'react';
import { collection, getDocs, query, orderBy, where } from 'firebase/firestore';
import { db } from '../../firebase';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { FileText, Download, Loader2, Users, CheckCircle, AlertTriangle, CalendarDays, ClipboardList, Brain, TrendingUp } from 'lucide-react';
import { toast } from 'sonner';

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

export default function SRUReportsPage() {
  const [students, setStudents] = useState<StudentDoc[]>([]);
  const [interventions, setInterventions] = useState<InterventionDoc[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [loadingInterventions, setLoadingInterventions] = useState(false);
  const [kpiLoading, setKpiLoading] = useState(true);
  const [kpiStudents, setKpiStudents] = useState<StudentDoc[]>([]);
  const [kpiInterventions, setKpiInterventions] = useState<InterventionDoc[]>([]);
  const [totalInterventions, setTotalInterventions] = useState(0);
  const [interventionSuccessRate, setInterventionSuccessRate] = useState(0);
  const [closedInterventionsCount, setClosedInterventionsCount] = useState(0);

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
  const [showProgressReport, setShowProgressReport] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(false);

const [showAtRisk, setShowAtRisk] = useState(false);
  const [showInterventions, setShowInterventions] = useState(false);
  const [showAttFilters, setShowAttFilters] = useState(false);

  // Attendance Analysis Report state
  const [attFaculty, setAttFaculty] = useState('');
  const [attProgramme, setAttProgramme] = useState('');
  const [attModule, setAttModule] = useState('');
  const [attDateFrom, setAttDateFrom] = useState('');
  const [attDateTo, setAttDateTo] = useState('');
  const [attYear, setAttYear] = useState('');
  const [attSemester, setAttSemester] = useState('');
  const [attReport, setAttReport] = useState<AttendanceReportRow[]>([]);
  const [attLoading, setAttLoading] = useState(false);
  const [showAttReport, setShowAttReport] = useState(false);
  const [attModuleOptions, setAttModuleOptions] = useState<{ id: string; code: string; name: string; faculty: string; programme: string; yearOfStudy: string; semester: string }[]>([]);

  // Load KPI data on mount
  useEffect(() => {
    const fetchKpi = async () => {
      setKpiLoading(true);
      try {
        const [studentSnap, intSnap, modSnap] = await Promise.all([
          getDocs(collection(db, 'students')),
          getDocs(collection(db, 'interventions')),
          getDocs(collection(db, 'modules')),
        ]);
        setAttModuleOptions(
          modSnap.docs.map((d) => ({
            id: d.id,
            code: d.data().moduleCode ?? '',
            name: d.data().moduleName ?? d.data().name ?? '',
            faculty: d.data().faculty ?? '',
            programme: d.data().programme ?? '',
            yearOfStudy: d.data().yearOfStudy ?? d.data().year ?? '',
            semester: d.data().semester ?? '',
          })).sort((a, b) => a.code.localeCompare(b.code))
        );
        setKpiStudents(
          studentSnap.docs.map((d) => ({
            id: d.id,
            studentId: d.data().studentId ?? d.id,
            name: d.data().name ?? '',
            programme: d.data().programme ?? '',
            level: d.data().level ?? '',
            attendancePercentage: d.data().attendancePercentage ?? 100,
            consecutiveAbsences: d.data().consecutiveAbsences ?? 0,
            gpa: d.data().gpa ?? 0,
            riskLevel: d.data().riskLevel ?? 'low',
            flagged: d.data().flagged ?? false,
          }))
        );
        setKpiInterventions(
          intSnap.docs.map((d) => ({
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
        setTotalInterventions(intSnap.size);
        const closedCount = intSnap.docs.filter(d => d.data().caseStatus === 'closed').length;
        setClosedInterventionsCount(closedCount);
        setInterventionSuccessRate(intSnap.size > 0 ? Math.round((closedCount / intSnap.size) * 100) : 0);
      } finally {
        setKpiLoading(false);
      }
    };
    fetchKpi();
  }, []);

  const fetchStudents = async () => {
    setLoadingStudents(true);
    try {
      const snap = await getDocs(collection(db, 'students'));
      setStudents(
        snap.docs.map((d) => ({
          id: d.id,
          studentId: d.data().studentId ?? d.id,
          name: d.data().name ?? '',
          programme: d.data().programme ?? '',
          level: d.data().level ?? '',
          attendancePercentage: d.data().attendancePercentage ?? 100,
          consecutiveAbsences: d.data().consecutiveAbsences ?? 0,
          gpa: d.data().gpa ?? 0,
          riskLevel: d.data().riskLevel ?? 'low',
          flagged: d.data().flagged ?? false,
        }))
      );
    } finally {
      setLoadingStudents(false);
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

  const generateAttendanceReport = async () => {
    setAttLoading(true);
    setShowAttReport(false);
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

      // Module meta map for year/semester lookup on each row
      const moduleMetaMap = new Map(attModuleOptions.map((m) => [m.id, m]));

      // Build set of module IDs that pass year/semester filters
      const validModuleIds = new Set(
        attModuleOptions
          .filter((m) => {
            const yearOk = !attYear || (YEAR_MAP[attYear] ?? [attYear]).includes(m.yearOfStudy);
            const semOk = !attSemester || m.semester === attSemester || m.semester === 'Semester 1 & 2';
            return yearOk && semOk;
          })
          .map((m) => m.id)
      );
      // Group by studentId + moduleId
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
          groups.set(key, {
            present: 0, total: 0,
            moduleCode: data.moduleCode ?? '',
            moduleName: data.moduleName ?? '',
            moduleFaculty: '',
          });
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
      setShowAttReport(true);
    } catch {
      toast.error('Failed to generate attendance report');
    } finally {
      setAttLoading(false);
    }
  };

  const handleGenerateAtRisk = async () => {
    if (students.length === 0) await fetchStudents();
    setShowAtRisk(true);
  };

  const handleGenerateInterventions = async () => {
    if (interventions.length === 0) await fetchInterventions();
    setShowInterventions(true);
  };

  const handleGenerateProgress = async () => {
    setLoadingProgress(true);
    try {
      const intSnap = await getDocs(
        query(collection(db, 'interventions'), orderBy('createdAt', 'desc'))
      );
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
          const improved = student.attendance >= 80 || student.gpa >= 2.5;
          return {
            studentId: data.studentId,
            studentName: data.studentName ?? student.name,
            programme: student.programme,
            interventionDate: data.date ?? '',
            interventionType: data.interventionType ?? data.type ?? '',
            attendanceBefore: 0,
            attendanceAfter: student.attendance,
            gpaBefore: 0,
            gpaAfter: student.gpa,
            improved,
          };
        })
        .filter(Boolean);
      setProgressReport(rows as any);
      setShowProgressReport(true);
    } catch (err) {
      console.error('Progress report error:', err);
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

  const atRiskStudents = students.filter((s) => s.attendancePercentage < 80 || s.consecutiveAbsences >= 3);

  // KPI calculations
  const ML_CONNECTED = !!(import.meta.env.VITE_ML_API_URL);
  const totalStudents = kpiStudents.length;
  const studentsAtRisk = ML_CONNECTED
    ? kpiStudents.filter((s) => s.riskLevel === 'high' || s.riskLevel === 'critical').length
    : 0;
  const flaggedStudents = kpiStudents.filter((s) => s.flagged === true);
  const interventionStudentIds = new Set(kpiInterventions.map((i) => i.studentId));
  const respondedCount = flaggedStudents.filter((s) => interventionStudentIds.has(s.studentId)).length;
  const alertResponseRate = flaggedStudents.length > 0
    ? Math.round((respondedCount / flaggedStudents.length) * 100)
    : 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Reports</h1>
        <p className="text-muted-foreground text-sm mt-1">Generate student support reports</p>
      </div>

      {/* KPI Summary Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-l-4 border-l-red-500">
          <CardContent className="pt-5 pb-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Students at Risk</p>
                <p className="text-3xl font-bold mt-1 text-red-600">
                  {kpiLoading ? '—' : studentsAtRisk}
                </p>
                <p className="text-xs text-muted-foreground mt-1">{ML_CONNECTED ? 'High or critical risk' : 'ML not connected yet'}</p>
              </div>
              <div className="h-10 w-10 rounded-full bg-red-50 flex items-center justify-center">
                <AlertTriangle className="h-5 w-5 text-red-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-blue-500">
          <CardContent className="pt-5 pb-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Intervention Success</p>
                <p className="text-3xl font-bold mt-1 text-blue-600">
                  {kpiLoading ? '—' : `${interventionSuccessRate}%`}
                </p>
                <p className="text-xs text-muted-foreground mt-1">{kpiLoading ? '—' : `${closedInterventionsCount} of ${totalInterventions} cases closed`}</p>
              </div>
              <div className="h-10 w-10 rounded-full bg-blue-50 flex items-center justify-center">
                <CheckCircle className="h-5 w-5 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-blue-500">
          <CardContent className="pt-5 pb-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Alert Response Rate</p>
                <p className="text-3xl font-bold mt-1 text-blue-600">
                  {kpiLoading ? '—' : `${alertResponseRate}%`}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {kpiLoading ? '—' : flaggedStudents.length > 0
                    ? `${respondedCount} of ${flaggedStudents.length} alerts actioned`
                    : 'No alerts raised yet'}
                </p>
              </div>
              <div className="h-10 w-10 rounded-full bg-blue-50 flex items-center justify-center">
                <CheckCircle className="h-5 w-5 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-amber-500">
          <CardContent className="pt-5 pb-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Interventions</p>
                <p className="text-3xl font-bold mt-1 text-amber-600">
                  {kpiLoading ? '—' : totalInterventions}
                </p>
                <p className="text-xs text-muted-foreground mt-1">Logged in system</p>
              </div>
              <div className="h-10 w-10 rounded-full bg-amber-50 flex items-center justify-center">
                <Users className="h-5 w-5 text-amber-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Report Cards */}
      <Card>
        <CardContent className="pt-5 pb-5 space-y-3">

          {/* Report 0: Attendance Analysis Report */}
          <div className="flex items-center gap-4 p-4 border rounded-xl hover:shadow-sm transition-shadow">
            <CalendarDays className="h-5 w-5 text-gray-400 flex-shrink-0" />
            <div className="flex-1">
              <p className="font-medium text-sm">Attendance Analysis Report</p>
              <p className="text-xs text-muted-foreground mt-0.5">Detailed attendance breakdown by module and date range</p>
              <div className="flex gap-2 mt-2">
                <Badge variant="outline" className="text-xs">CSV</Badge>
              </div>
            </div>
            <Button
              size="sm"
              className="bg-blue-600 hover:bg-blue-700 text-white text-xs flex-shrink-0"
              onClick={() => { setShowAttFilters((v) => !v); }}
            >
              {attLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Generate Report'}
            </Button>
          </div>

          {/* Attendance Analysis — filters (hidden until toggled) + table */}
          {showAttFilters && (
            <div className="px-1 space-y-4">
              {/* Filters — row 1: Faculty / Programme / Year / Semester */}
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
              {/* Filters — row 2: Module / Date From / Date To */}
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
              <div className="flex justify-between items-center">
                <Button size="sm" variant="outline" className="text-xs" onClick={() => { setShowAttFilters(false); setShowAttReport(false); }}>
                  ← Back
                </Button>
                <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white text-xs" onClick={generateAttendanceReport} disabled={attLoading}>
                  {attLoading ? <><Loader2 className="h-3 w-3 animate-spin mr-1" />Generating…</> : 'Run Report'}
                </Button>
              </div>

              {/* Results table */}
              {showAttReport && (
                <>
                  <div className="flex justify-end">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        downloadCSV(
                          ['Student ID', 'Student Name', 'Programme', 'Year', 'Faculty', 'Module Code', 'Module Name', 'Semester', 'Sessions', 'Present', 'Absent', 'Attendance %', 'Status'],
                          attReport.map((r) => [r.studentId, r.studentName, r.programme, r.studentYear, r.faculty, r.moduleCode, r.moduleName, r.moduleSemester, String(r.total), String(r.present), String(r.absent), `${r.percentage}%`, r.status]),
                          'attendance-analysis.csv'
                        )
                      }
                    >
                      <Download className="mr-2 h-4 w-4" />
                      Export CSV
                    </Button>
                  </div>
                  <div className="overflow-x-auto rounded-lg border">
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
                        {attReport.length === 0 ? (
                          <tr>
                            <td colSpan={11} className="text-center py-8 text-muted-foreground text-sm">
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
                </>
              )}
            </div>
          )}

          {/* Report 1: Students Needing Attention */}
          <div className="flex items-center gap-4 p-4 border rounded-xl hover:shadow-sm transition-shadow">
            <Users className="h-5 w-5 text-gray-400 flex-shrink-0" />
            <div className="flex-1">
              <p className="font-medium text-sm">Students Needing Attention</p>
              <p className="text-xs text-muted-foreground mt-0.5">Students with low attendance or consecutive absences</p>
              <div className="flex gap-2 mt-2">
                <Badge variant="outline" className="text-xs">CSV</Badge>
              </div>
            </div>
            <Button
              size="sm"
              className="bg-blue-600 hover:bg-blue-700 text-white text-xs flex-shrink-0"
              onClick={handleGenerateAtRisk}
              disabled={loadingStudents}
            >
              {loadingStudents ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Generate Report'}
            </Button>
          </div>

          {/* Report 1 expanded table */}
          {showAtRisk && (
            <div className="px-1">
              <div className="flex items-center justify-between mb-3">
                <Button size="sm" variant="outline" className="text-xs" onClick={() => setShowAtRisk(false)}>
                  ← Back
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    downloadCSV(
                      ['Student ID', 'Name', 'Programme', 'Level', 'Attendance %', 'Consecutive Absences', 'GPA'],
                      atRiskStudents.map((s) => [s.studentId, s.name, s.programme, s.level, String(s.attendancePercentage), String(s.consecutiveAbsences), String(s.gpa)]),
                      'students-needing-attention.csv'
                    )
                  }
                >
                  <Download className="mr-2 h-4 w-4" />
                  Export CSV
                </Button>
              </div>
              <div className="overflow-x-auto rounded-lg border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-gray-50">
                      <th className="text-left font-medium text-muted-foreground px-4 py-3">Student ID</th>
                      <th className="text-left font-medium text-muted-foreground px-4 py-3">Name</th>
                      <th className="text-left font-medium text-muted-foreground px-4 py-3">Programme</th>
                      <th className="text-left font-medium text-muted-foreground px-4 py-3">Level</th>
                      <th className="text-left font-medium text-muted-foreground px-4 py-3">Attendance %</th>
                      <th className="text-left font-medium text-muted-foreground px-4 py-3">Consec. Absences</th>
                      <th className="text-left font-medium text-muted-foreground px-4 py-3">GPA</th>
                    </tr>
                  </thead>
                  <tbody>
                    {atRiskStudents.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="text-center py-8 text-muted-foreground text-sm">No students needing attention found.</td>
                      </tr>
                    ) : atRiskStudents.map((s) => (
                      <tr key={s.id} className="border-b last:border-0 hover:bg-gray-50">
                        <td className="px-4 py-3 text-xs text-muted-foreground">{s.studentId}</td>
                        <td className="px-4 py-3 font-medium">{s.name}</td>
                        <td className="px-4 py-3 text-xs text-muted-foreground max-w-[160px]"><span className="truncate block">{s.programme || '—'}</span></td>
                        <td className="px-4 py-3 text-sm">{s.level || '—'}</td>
                        <td className="px-4 py-3">
                          <span className={`font-medium text-sm ${s.attendancePercentage < 80 ? 'text-red-600' : ''}`}>{s.attendancePercentage}%</span>
                        </td>
                        <td className="px-4 py-3 text-center text-sm">
                          <span className={s.consecutiveAbsences >= 3 ? 'text-red-600 font-medium' : ''}>{s.consecutiveAbsences}</span>
                        </td>
                        <td className="px-4 py-3 text-sm">{s.gpa.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Report 2: Intervention Summary */}
          <div className="flex items-center gap-4 p-4 border rounded-xl hover:shadow-sm transition-shadow">
            <ClipboardList className="h-5 w-5 text-gray-400 flex-shrink-0" />
            <div className="flex-1">
              <p className="font-medium text-sm">Intervention Summary Report</p>
              <p className="text-xs text-muted-foreground mt-0.5">Summary of all interventions logged this semester</p>
              <div className="flex gap-2 mt-2">
                <Badge variant="outline" className="text-xs">CSV</Badge>
              </div>
            </div>
            <Button
              size="sm"
              className="bg-blue-600 hover:bg-blue-700 text-white text-xs flex-shrink-0"
              onClick={handleGenerateInterventions}
              disabled={loadingInterventions}
            >
              {loadingInterventions ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Generate Report'}
            </Button>
          </div>

          {/* Report 2 expanded table */}
          {showInterventions && (
            <div className="px-1">
              <div className="flex items-center justify-between mb-3">
                <Button size="sm" variant="outline" className="text-xs" onClick={() => setShowInterventions(false)}>
                  ← Back
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    downloadCSV(
                      ['Student', 'Intervention Type', 'Date', 'Outcome', 'Recorded By'],
                      interventions.map((i) => [i.studentName, i.interventionType, i.date || formatDate(i.createdAt), i.outcome, i.recordedBy]),
                      'intervention-summary.csv'
                    )
                  }
                >
                  <Download className="mr-2 h-4 w-4" />
                  Export CSV
                </Button>
              </div>
              <div className="overflow-x-auto rounded-lg border">
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
                        <td colSpan={5} className="text-center py-8 text-muted-foreground text-sm">No interventions found.</td>
                      </tr>
                    ) : interventions.map((i) => (
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
            </div>
          )}

          {/* Report 3: ML Risk Score Report */}
          <div className="flex items-center gap-4 p-4 border rounded-xl hover:shadow-sm transition-shadow">
            <Brain className="h-5 w-5 text-gray-400 flex-shrink-0" />
            <div className="flex-1">
              <p className="font-medium text-sm">ML Risk Score Report</p>
              <p className="text-xs text-muted-foreground mt-0.5">Predicted dropout probabilities and key risk factor contributions per student</p>
              <div className="flex gap-2 mt-2">
                <Badge variant="outline" className="text-xs">JSON</Badge>
              </div>
            </div>
            <Button
              size="sm"
              className="bg-blue-600 hover:bg-blue-700 text-white text-xs flex-shrink-0"
              onClick={() => toast.info('ML Risk Score report will be available once AI model is connected')}
            >
              Generate Report
            </Button>
          </div>

          {/* Report 4: Student Progress Report */}
          <div className="flex items-center gap-4 p-4 border rounded-xl hover:shadow-sm transition-shadow">
            <TrendingUp className="h-5 w-5 text-gray-400 flex-shrink-0" />
            <div className="flex-1">
              <p className="font-medium text-sm">Student Progress Report</p>
              <p className="text-xs text-muted-foreground mt-0.5">Students who received interventions and their current academic standing</p>
              <div className="flex gap-2 mt-2">
                <Badge variant="outline" className="text-xs">CSV</Badge>
              </div>
            </div>
            <Button
              size="sm"
              className="bg-blue-600 hover:bg-blue-700 text-white text-xs flex-shrink-0"
              onClick={handleGenerateProgress}
              disabled={loadingProgress}
            >
              {loadingProgress ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Generate Report'}
            </Button>
          </div>

          {/* Report 4 expanded table */}
          {showProgressReport && (
            <div className="px-1 space-y-3">
              <div className="flex items-center justify-between">
                <Button size="sm" variant="outline" className="text-xs" onClick={() => setShowProgressReport(false)}>
                  ← Back
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    downloadCSV(
                      ['Student ID', 'Student Name', 'Programme', 'Intervention Date', 'Intervention Type', 'Current Attendance %', 'Current GPA', 'Status'],
                      progressReport.map((r) => [
                        r.studentId,
                        r.studentName,
                        r.programme,
                        r.interventionDate,
                        r.interventionType,
                        String(r.attendanceAfter),
                        String(r.gpaAfter),
                        r.improved ? 'Improving' : 'Monitoring',
                      ]),
                      'student-progress.csv'
                    )
                  }
                >
                  <Download className="mr-2 h-4 w-4" />
                  Export CSV
                </Button>
              </div>
              <div className="rounded-lg border border-blue-100 bg-blue-50 p-3 text-xs text-blue-700">
                Note: Historical attendance and GPA before intervention are not yet tracked. Future enhancement will show before/after comparison.
              </div>
              <div className="overflow-x-auto rounded-lg border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-gray-50">
                      <th className="text-left font-medium text-muted-foreground px-4 py-3">Student</th>
                      <th className="text-left font-medium text-muted-foreground px-4 py-3">Programme</th>
                      <th className="text-left font-medium text-muted-foreground px-4 py-3">Intervention Date</th>
                      <th className="text-left font-medium text-muted-foreground px-4 py-3">Type</th>
                      <th className="text-center font-medium text-muted-foreground px-4 py-3">Current Attendance</th>
                      <th className="text-center font-medium text-muted-foreground px-4 py-3">Current GPA</th>
                      <th className="text-center font-medium text-muted-foreground px-4 py-3">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {progressReport.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="text-center py-8 text-muted-foreground text-sm">No intervention records found.</td>
                      </tr>
                    ) : progressReport.map((r, i) => (
                      <tr key={i} className="border-b last:border-0 hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <div className="font-medium text-sm">{r.studentName}</div>
                          <div className="text-xs text-muted-foreground font-mono">{r.studentId}</div>
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground max-w-[160px]"><span className="truncate block">{r.programme || '—'}</span></td>
                        <td className="px-4 py-3 text-sm whitespace-nowrap">{r.interventionDate || '—'}</td>
                        <td className="px-4 py-3 text-sm">{r.interventionType || '—'}</td>
                        <td className="px-4 py-3 text-center">
                          <span className={`font-medium text-sm ${r.attendanceAfter < 80 ? 'text-red-600' : 'text-green-600'}`}>
                            {r.attendanceAfter}%
                          </span>
                        </td>
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
            </div>
          )}

        </CardContent>
      </Card>
    </div>
  );
}
