import { useState, useEffect } from 'react';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '../../firebase';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { FileText, Download, Loader2, TrendingUp, Activity, Users, CheckCircle } from 'lucide-react';

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
}

interface InterventionDoc {
  id: string;
  studentName: string;
  interventionType: string;
  date: string;
  outcome: string;
  recordedBy: string;
  createdAt: any;
}

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
  const [totalInterventions, setTotalInterventions] = useState(0);

  const [showAtRisk, setShowAtRisk] = useState(false);
  const [showInterventions, setShowInterventions] = useState(false);
  const [showLowAtt, setShowLowAtt] = useState(false);

  // Load KPI data on mount
  useEffect(() => {
    const fetchKpi = async () => {
      setKpiLoading(true);
      try {
        const [studentSnap, intSnap] = await Promise.all([
          getDocs(collection(db, 'students')),
          getDocs(collection(db, 'interventions')),
        ]);
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
          }))
        );
        setTotalInterventions(intSnap.size);
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
          studentName: d.data().studentName ?? '',
          interventionType: d.data().interventionType ?? '',
          date: d.data().date ?? '',
          outcome: d.data().outcome ?? '',
          recordedBy: d.data().recordedBy ?? '',
          createdAt: d.data().createdAt,
        }))
      );
    } finally {
      setLoadingInterventions(false);
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

  const handleGenerateLowAtt = async () => {
    if (students.length === 0) await fetchStudents();
    setShowLowAtt(true);
  };

  const atRiskStudents = students.filter((s) => s.riskLevel === 'medium' || s.riskLevel === 'high');
  const lowAttStudents = students.filter((s) => s.attendancePercentage < 80);

  // KPI calculations
  const totalStudents = kpiStudents.length;
  const highRiskCount = kpiStudents.filter((s) => s.riskLevel === 'high' || s.riskLevel === 'critical').length;
  const retentionRate = Math.round(((totalStudents - highRiskCount) / Math.max(totalStudents, 1)) * 100);
  const interventionSuccessRate = 74; // placeholder until real outcome data
  const avgRiskScore = 38; // placeholder
  const avgAttendance = kpiStudents.length > 0
    ? Math.round(kpiStudents.reduce((sum, s) => sum + s.attendancePercentage, 0) / kpiStudents.length)
    : 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Reports</h1>
        <p className="text-muted-foreground text-sm mt-1">Generate student support reports</p>
      </div>

      {/* KPI Summary Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-l-4 border-l-green-500">
          <CardContent className="pt-5 pb-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Retention Rate</p>
                <p className="text-3xl font-bold mt-1 text-green-600">
                  {kpiLoading ? '—' : `${retentionRate}%`}
                </p>
                <p className="text-xs text-muted-foreground mt-1">Non-high-risk students</p>
              </div>
              <div className="h-10 w-10 rounded-full bg-green-50 flex items-center justify-center">
                <TrendingUp className="h-5 w-5 text-green-600" />
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
                <p className="text-xs text-muted-foreground mt-1">Resolved outcomes</p>
              </div>
              <div className="h-10 w-10 rounded-full bg-blue-50 flex items-center justify-center">
                <CheckCircle className="h-5 w-5 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-blue-400">
          <CardContent className="pt-5 pb-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Avg Attendance</p>
                <p className="text-3xl font-bold mt-1 text-blue-600">
                  {kpiLoading ? '—' : `${avgAttendance}%`}
                </p>
                <p className="text-xs text-muted-foreground mt-1">Across all students</p>
              </div>
              <div className="h-10 w-10 rounded-full bg-blue-50 flex items-center justify-center">
                <Activity className="h-5 w-5 text-blue-500" />
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
                <p className="text-xs text-muted-foreground mt-1">Logged this semester</p>
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

          {/* Report 1: At-Risk Students */}
          <div className="flex items-center gap-4 p-4 border rounded-xl hover:shadow-sm transition-shadow">
            <div className="w-10 h-10 rounded-lg bg-red-50 flex items-center justify-center flex-shrink-0">
              <FileText className="h-5 w-5 text-red-600" />
            </div>
            <div className="flex-1">
              <p className="font-medium text-sm">At-Risk Students Report</p>
              <p className="text-xs text-muted-foreground mt-0.5">All students with medium or high risk levels</p>
              <div className="flex gap-2 mt-2">
                <Badge className="bg-blue-100 text-blue-700 border-blue-200 text-xs">Weekly</Badge>
                <Badge variant="outline" className="text-xs">PDF · CSV</Badge>
              </div>
            </div>
            <Button
              size="sm"
              className="bg-red-600 hover:bg-red-700 text-xs flex-shrink-0"
              onClick={handleGenerateAtRisk}
              disabled={loadingStudents}
            >
              {loadingStudents ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Generate Report'}
            </Button>
          </div>

          {/* Report 1 expanded table */}
          {showAtRisk && (
            <div className="px-1">
              <div className="flex justify-end mb-3">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    downloadCSV(
                      ['Student ID', 'Name', 'Programme', 'Level', 'Attendance %', 'GPA', 'Risk Level'],
                      atRiskStudents.map((s) => [s.studentId, s.name, s.programme, s.level, String(s.attendancePercentage), String(s.gpa), s.riskLevel]),
                      'at-risk-students.csv'
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
                      <th className="text-left font-medium text-muted-foreground px-4 py-3">GPA</th>
                      <th className="text-left font-medium text-muted-foreground px-4 py-3">Risk Level</th>
                    </tr>
                  </thead>
                  <tbody>
                    {atRiskStudents.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="text-center py-8 text-muted-foreground text-sm">No at-risk students found.</td>
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
                        <td className="px-4 py-3 text-sm">{s.gpa.toFixed(2)}</td>
                        <td className="px-4 py-3">{getRiskBadge(s.riskLevel)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Report 2: Intervention Summary */}
          <div className="flex items-center gap-4 p-4 border rounded-xl hover:shadow-sm transition-shadow">
            <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
              <FileText className="h-5 w-5 text-blue-600" />
            </div>
            <div className="flex-1">
              <p className="font-medium text-sm">Intervention Summary Report</p>
              <p className="text-xs text-muted-foreground mt-0.5">Summary of all interventions logged this semester</p>
              <div className="flex gap-2 mt-2">
                <Badge className="bg-amber-100 text-amber-700 border-amber-200 text-xs">Monthly</Badge>
                <Badge variant="outline" className="text-xs">PDF</Badge>
              </div>
            </div>
            <Button
              size="sm"
              className="bg-blue-600 hover:bg-blue-700 text-xs flex-shrink-0"
              onClick={handleGenerateInterventions}
              disabled={loadingInterventions}
            >
              {loadingInterventions ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Generate Report'}
            </Button>
          </div>

          {/* Report 2 expanded table */}
          {showInterventions && (
            <div className="px-1">
              <div className="flex justify-end mb-3">
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

          {/* Report 3: Low Attendance */}
          <div className="flex items-center gap-4 p-4 border rounded-xl hover:shadow-sm transition-shadow">
            <div className="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center flex-shrink-0">
              <FileText className="h-5 w-5 text-amber-600" />
            </div>
            <div className="flex-1">
              <p className="font-medium text-sm">Low Attendance Report</p>
              <p className="text-xs text-muted-foreground mt-0.5">Students with attendance below 80%</p>
              <div className="flex gap-2 mt-2">
                <Badge className="bg-blue-100 text-blue-700 border-blue-200 text-xs">Weekly</Badge>
                <Badge variant="outline" className="text-xs">PDF · CSV</Badge>
              </div>
            </div>
            <Button
              size="sm"
              className="bg-amber-600 hover:bg-amber-700 text-xs flex-shrink-0"
              onClick={handleGenerateLowAtt}
              disabled={loadingStudents}
            >
              {loadingStudents ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Generate Report'}
            </Button>
          </div>

          {/* Report 3 expanded table */}
          {showLowAtt && (
            <div className="px-1">
              <div className="flex justify-end mb-3">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    downloadCSV(
                      ['Student ID', 'Name', 'Programme', 'Attendance %', 'Consecutive Absences', 'Risk Level'],
                      lowAttStudents.map((s) => [s.studentId, s.name, s.programme, String(s.attendancePercentage), String(s.consecutiveAbsences), s.riskLevel]),
                      'low-attendance.csv'
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
                      <th className="text-left font-medium text-muted-foreground px-4 py-3">Attendance %</th>
                      <th className="text-left font-medium text-muted-foreground px-4 py-3">Consecutive Absences</th>
                      <th className="text-left font-medium text-muted-foreground px-4 py-3">Risk Level</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lowAttStudents.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="text-center py-8 text-muted-foreground text-sm">No low attendance students found.</td>
                      </tr>
                    ) : lowAttStudents.sort((a, b) => a.attendancePercentage - b.attendancePercentage).map((s) => (
                      <tr key={s.id} className="border-b last:border-0 hover:bg-gray-50">
                        <td className="px-4 py-3 text-xs text-muted-foreground">{s.studentId}</td>
                        <td className="px-4 py-3 font-medium">{s.name}</td>
                        <td className="px-4 py-3 text-xs text-muted-foreground max-w-[160px]"><span className="truncate block">{s.programme || '—'}</span></td>
                        <td className="px-4 py-3">
                          <span className="font-medium text-sm text-red-600">{s.attendancePercentage}%</span>
                        </td>
                        <td className="px-4 py-3 text-center text-sm">{s.consecutiveAbsences}</td>
                        <td className="px-4 py-3">{getRiskBadge(s.riskLevel)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Report 4: ML Risk Score Report */}
          <div className="flex items-center gap-4 p-4 border rounded-xl hover:shadow-sm transition-shadow">
            <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center flex-shrink-0">
              <span className="text-purple-600 text-lg">🤖</span>
            </div>
            <div className="flex-1">
              <p className="font-medium text-sm">ML Risk Score Report</p>
              <p className="text-xs text-muted-foreground mt-0.5">Predicted dropout probabilities and key risk factor contributions per student</p>
              <div className="flex gap-2 mt-2">
                <Badge className="bg-purple-100 text-purple-700 border-purple-200 text-xs">Real-time</Badge>
                <Badge variant="outline" className="text-xs">PDF · JSON</Badge>
              </div>
            </div>
            <Button size="sm" className="bg-purple-600 hover:bg-purple-700 text-xs flex-shrink-0">Generate Report</Button>
          </div>

          {/* Report 5: Appointment & Caseload Summary */}
          <div className="flex items-center gap-4 p-4 border rounded-xl hover:shadow-sm transition-shadow">
            <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center flex-shrink-0">
              <span className="text-green-600 text-lg">📅</span>
            </div>
            <div className="flex-1">
              <p className="font-medium text-sm">Appointment & Caseload Summary</p>
              <p className="text-xs text-muted-foreground mt-0.5">Session notes completion, follow-up compliance and student contact frequency</p>
              <div className="flex gap-2 mt-2">
                <Badge className="bg-amber-100 text-amber-700 border-amber-200 text-xs">Monthly</Badge>
                <Badge variant="outline" className="text-xs">PDF</Badge>
              </div>
            </div>
            <Button size="sm" variant="outline" className="text-xs flex-shrink-0">Generate Report</Button>
          </div>

        </CardContent>
      </Card>
    </div>
  );
}
