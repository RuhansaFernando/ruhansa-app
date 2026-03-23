import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import {
  AlertTriangle,
  ClipboardX,
  BarChart3,
  Download,
  Loader2,
  ShieldAlert,
} from "lucide-react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../../firebase";
import { toast } from "sonner";

interface FailingRow {
  studentDisplayId: string;
  name: string;
  programme: string;
  level: string;
  moduleName: string;
  overallMark: number;
  moduleStatus: string;
}

interface MissingRow {
  studentDisplayId: string;
  name: string;
  programme: string;
  moduleName: string;
  enrolledDate: string;
}

interface PerformanceRow {
  moduleName: string;
  programme: string;
  level: string;
  total: number;
  pass: number;
  fail: number;
  passRate: number;
}

interface AtRiskRow {
  studentId: string;
  name: string;
  programme: string;
  level: string;
  riskLevel: string;
  riskScore: number;
  attendancePercentage: number;
  gpa: number;
  academicMentor: string;
}

function semesterToLevel(semester: string): string {
  if (["Semester 1", "Semester 2"].includes(semester)) return "Level 4";
  if (["Semester 3", "Semester 4"].includes(semester)) return "Level 5";
  if (["Semester 5", "Semester 6"].includes(semester)) return "Level 6";
  return semester || "—";
}

function todayStr(): string {
  return new Date().toISOString().split("T")[0];
}

function downloadCSV(
  filename: string,
  headers: string[],
  rows: (string | number)[][]
) {
  const csvContent = [
    headers.join(","),
    ...rows.map((row) =>
      row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")
    ),
  ].join("\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export default function RegistryReportsPage() {
  // Active report
  const [activeReport, setActiveReport] = useState<'failing' | 'missing' | 'performance' | 'atrisk' | null>(null);

  // Failing Students
  const [failingRows, setFailingRows] = useState<FailingRow[] | null>(null);
  const [loadingFailing, setLoadingFailing] = useState(false);

  // Missing Submissions
  const [missingRows, setMissingRows] = useState<MissingRow[] | null>(null);
  const [loadingMissing, setLoadingMissing] = useState(false);

  // Module Performance
  const [performanceRows, setPerformanceRows] = useState<PerformanceRow[] | null>(null);
  const [loadingPerformance, setLoadingPerformance] = useState(false);

  // At-Risk Students
  const [atRiskRows, setAtRiskRows] = useState<AtRiskRow[] | null>(null);
  const [loadingAtRisk, setLoadingAtRisk] = useState(false);

  // Report scope filters
  const [reportAcademicYear, setReportAcademicYear] = useState('2025/2026');
  const [reportSemester, setReportSemester] = useState('all');

  const generateFailing = async () => {
    setLoadingFailing(true);
    try {
      // Fetch all results — filter client-side to handle both 'status' and 'moduleStatus' field names
      const resultsSnap = await getDocs(collection(db, "results"));
      const failingDocs = resultsSnap.docs.filter((d) => {
        const data = d.data();
        const statusVal = data.moduleStatus ?? data.status ?? "";
        if (statusVal !== "fail") return false;
        if (data.academicYear && data.academicYear !== reportAcademicYear) return false;
        if (reportSemester !== 'all' && data.semester && data.semester !== reportSemester) return false;
        return true;
      });

      const rows: FailingRow[] = failingDocs.map((d) => {
        const data = d.data();
        return {
          studentDisplayId: data.studentId ?? "—",
          name: data.studentName ?? "—",
          programme: data.programme ?? "—",
          level: semesterToLevel(data.semester ?? ""),
          moduleName: data.moduleName ?? "—",
          overallMark: data.overallMark ?? data.mark ?? 0,
          moduleStatus: data.moduleStatus ?? data.status ?? "fail",
        };
      });

      rows.sort((a, b) => a.name.localeCompare(b.name));
      setFailingRows(rows);
      setActiveReport('failing');
      toast.success("Failing Students Report generated");
    } catch {
      toast.error("Failed to generate report");
    } finally {
      setLoadingFailing(false);
    }
  };

  const exportFailingCSV = () => {
    if (!failingRows) return;
    downloadCSV(
      `Failing_Students_${todayStr()}.csv`,
      [
        "Student ID",
        "Name",
        "Programme",
        "Level",
        "Module",
        "Overall Mark",
        "Status",
      ],
      failingRows.map((r) => [
        r.studentDisplayId,
        r.name,
        r.programme,
        r.level,
        r.moduleName,
        `${r.overallMark}%`,
        r.moduleStatus,
      ])
    );
  };

  const generateMissing = async () => {
    setLoadingMissing(true);
    try {
      // Fetch all enrollments and results in parallel
      const [enrollmentsSnap, resultsSnap, studentsSnap, modulesSnap] =
        await Promise.all([
          getDocs(collection(db, "moduleEnrollments")),
          getDocs(collection(db, "results")),
          getDocs(collection(db, "students")),
          getDocs(collection(db, "modules")),
        ]);

      // Build a set of studentId|moduleId keys that have a result recorded
      const resultKeys = new Set(
        resultsSnap.docs.map((d) => `${d.data().studentId}|${d.data().moduleId}`)
      );

      // Lookup maps for student and module names
      const studentMap = new Map(
        studentsSnap.docs.map((d) => [
          d.data().studentId ?? d.id,
          { name: d.data().name ?? "—", programme: d.data().programme ?? "—" },
        ])
      );
      const moduleMap = new Map(
        modulesSnap.docs.map((d) => [
          d.id,
          d.data().moduleName ?? d.data().name ?? "—",
        ])
      );

      // Find enrollments with no matching result record
      const rows: MissingRow[] = [];
      for (const d of enrollmentsSnap.docs) {
        const data = d.data();
        if (data.academicYear && data.academicYear !== reportAcademicYear) continue;
        const key = `${data.studentId}|${data.moduleId}`;
        if (!resultKeys.has(key)) {
          const student = studentMap.get(data.studentId);
          const enrolledAt = data.enrolledAt?.toDate?.();
          rows.push({
            studentDisplayId: data.studentId ?? "—",
            name: data.studentName ?? student?.name ?? "—",
            programme: data.programme ?? student?.programme ?? "—",
            moduleName: data.moduleName ?? moduleMap.get(data.moduleId) ?? "—",
            enrolledDate: enrolledAt
              ? enrolledAt.toISOString().split("T")[0]
              : "—",
          });
        }
      }

      rows.sort((a, b) => a.name.localeCompare(b.name));
      setMissingRows(rows);
      setActiveReport('missing');
      toast.success("Missing Submissions Report generated");
    } catch {
      toast.error("Failed to generate report");
    } finally {
      setLoadingMissing(false);
    }
  };

  const exportMissingCSV = () => {
    if (!missingRows) return;
    downloadCSV(
      `Missing_Submissions_${todayStr()}.csv`,
      ["Student ID", "Name", "Programme", "Module", "Enrolled Date"],
      missingRows.map((r) => [
        r.studentDisplayId,
        r.name,
        r.programme,
        r.moduleName,
        r.enrolledDate,
      ])
    );
  };

  const generatePerformance = async () => {
    setLoadingPerformance(true);
    try {
      const resultsSnap = await getDocs(collection(db, "results"));

      // Group by moduleId
      const moduleMap = new Map<
        string,
        {
          moduleName: string;
          programme: string;
          semester: string;
          total: number;
          pass: number;
          fail: number;
        }
      >();

      for (const d of resultsSnap.docs) {
        const data = d.data();
        if (data.academicYear && data.academicYear !== reportAcademicYear) continue;
        if (reportSemester !== 'all' && data.semester && data.semester !== reportSemester) continue;
        const key = data.moduleId ?? data.moduleName;
        if (!moduleMap.has(key)) {
          moduleMap.set(key, {
            moduleName: data.moduleName ?? "—",
            programme: data.programme ?? "—",
            semester: data.semester ?? "",
            total: 0,
            pass: 0,
            fail: 0,
          });
        }
        const entry = moduleMap.get(key)!;
        entry.total += 1;
        const statusVal = data.moduleStatus ?? data.status ?? "fail";
        if (statusVal === "pass") entry.pass += 1;
        else entry.fail += 1;
      }

      const rows: PerformanceRow[] = Array.from(moduleMap.values()).map(
        (entry) => ({
          moduleName: entry.moduleName,
          programme: entry.programme,
          level: semesterToLevel(entry.semester),
          total: entry.total,
          pass: entry.pass,
          fail: entry.fail,
          passRate:
            entry.total > 0
              ? Math.round((entry.pass / entry.total) * 100)
              : 0,
        })
      );

      rows.sort((a, b) => a.moduleName.localeCompare(b.moduleName));
      setPerformanceRows(rows);
      setActiveReport('performance');
      toast.success("Module Performance Report generated");
    } catch {
      toast.error("Failed to generate report");
    } finally {
      setLoadingPerformance(false);
    }
  };

  const exportPerformanceCSV = () => {
    if (!performanceRows) return;
    downloadCSV(
      `Module_Performance_${todayStr()}.csv`,
      [
        "Module",
        "Programme",
        "Level",
        "Total Students",
        "Pass",
        "Fail",
        "Pass Rate %",
      ],
      performanceRows.map((r) => [
        r.moduleName,
        r.programme,
        r.level,
        r.total,
        r.pass,
        r.fail,
        `${r.passRate}%`,
      ])
    );
  };

  const generateAtRisk = async () => {
    setLoadingAtRisk(true);
    try {
      const studentsSnap = await getDocs(collection(db, "students"));
      const rows: AtRiskRow[] = studentsSnap.docs
        .map((d) => {
          const data = d.data();
          return {
            studentId: data.studentId ?? d.id,
            name: data.name ?? "—",
            programme: data.programme ?? "—",
            level: data.level ?? "—",
            riskLevel: data.riskLevel ?? "",
            riskScore: data.riskScore ?? 0,
            attendancePercentage: data.attendancePercentage ?? 0,
            gpa: data.gpa ?? 0,
            academicMentor: data.academicMentor ?? "—",
          };
        })
        .filter((r) => r.riskLevel === "high" || r.riskLevel === "medium");

      rows.sort((a, b) => {
        if (a.riskLevel !== b.riskLevel) return a.riskLevel === "high" ? -1 : 1;
        return b.riskScore - a.riskScore;
      });
      setAtRiskRows(rows);
      setActiveReport('atrisk');
      toast.success("At-Risk Students Report generated");
    } catch {
      toast.error("Failed to generate report");
    } finally {
      setLoadingAtRisk(false);
    }
  };

  const exportAtRiskCSV = () => {
    if (!atRiskRows) return;
    downloadCSV(
      `At_Risk_Students_${todayStr()}.csv`,
      [
        "Student ID",
        "Name",
        "Programme",
        "Year/Level",
        "Risk Level",
        "Risk Score",
        "Attendance %",
        "GPA",
        "Academic Mentor",
      ],
      atRiskRows.map((r) => [
        r.studentId,
        r.name,
        r.programme,
        r.level,
        r.riskLevel,
        r.riskScore,
        `${r.attendancePercentage}%`,
        r.gpa,
        r.academicMentor,
      ])
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Reports</h1>
        <p className="text-muted-foreground">
          Generate and export academic reports
        </p>
      </div>

      {/* Scope Filters */}
      <div className="flex gap-3 items-center">
        <Select value={reportAcademicYear} onValueChange={setReportAcademicYear}>
          <SelectTrigger className="w-[150px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="2025/2026">2025/2026</SelectItem>
            <SelectItem value="2024/2025">2024/2025</SelectItem>
            <SelectItem value="2023/2024">2023/2024</SelectItem>
          </SelectContent>
        </Select>
        <Select value={reportSemester} onValueChange={setReportSemester}>
          <SelectTrigger className="w-[150px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Semesters</SelectItem>
            <SelectItem value="Semester 1">Semester 1</SelectItem>
            <SelectItem value="Semester 2">Semester 2</SelectItem>
            <SelectItem value="Semester 1 & 2">Semester 1 &amp; 2</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-sm text-muted-foreground">Reports filtered by selected academic year and semester</p>
      </div>

      {/* Report Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* Failing Students */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-red-100">
                <AlertTriangle className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <CardTitle className="text-base">
                  Failing Students Report
                </CardTitle>
              </div>
            </div>
            <CardDescription className="pt-1">
              List of all students who have failed one or more modules this
              semester
            </CardDescription>
          </CardHeader>
          <CardContent className="flex gap-2">
            <Button
              size="sm"
              className="bg-red-600 hover:bg-red-700 text-white gap-2"
              disabled={loadingFailing}
              onClick={generateFailing}
            >
              {loadingFailing && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Generate Report
            </Button>
            {failingRows && (
              <Button
                size="sm"
                variant="outline"
                className="gap-2"
                onClick={exportFailingCSV}
              >
                <Download className="h-3.5 w-3.5" />
                Export CSV
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Missing Submissions */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-100">
                <ClipboardX className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <CardTitle className="text-base">
                  Missing Submissions Report
                </CardTitle>
              </div>
            </div>
            <CardDescription className="pt-1">
              Students who have not submitted one or more assessment components
            </CardDescription>
          </CardHeader>
          <CardContent className="flex gap-2">
            <Button
              size="sm"
              className="bg-amber-500 hover:bg-amber-600 text-white gap-2"
              disabled={loadingMissing}
              onClick={generateMissing}
            >
              {loadingMissing && (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              )}
              Generate Report
            </Button>
            {missingRows && (
              <Button
                size="sm"
                variant="outline"
                className="gap-2"
                onClick={exportMissingCSV}
              >
                <Download className="h-3.5 w-3.5" />
                Export CSV
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Module Performance */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-100">
                <BarChart3 className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <CardTitle className="text-base">
                  Module Performance Report
                </CardTitle>
              </div>
            </div>
            <CardDescription className="pt-1">
              Pass and fail rates for each module across all programmes
            </CardDescription>
          </CardHeader>
          <CardContent className="flex gap-2">
            <Button
              size="sm"
              className="bg-blue-600 hover:bg-blue-700 text-white gap-2"
              disabled={loadingPerformance}
              onClick={generatePerformance}
            >
              {loadingPerformance && (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              )}
              Generate Report
            </Button>
            {performanceRows && (
              <Button
                size="sm"
                variant="outline"
                className="gap-2"
                onClick={exportPerformanceCSV}
              >
                <Download className="h-3.5 w-3.5" />
                Export CSV
              </Button>
            )}
          </CardContent>
        </Card>

        {/* At-Risk Students */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-orange-100">
                <ShieldAlert className="h-5 w-5 text-orange-600" />
              </div>
              <div>
                <CardTitle className="text-base">
                  At-Risk Students Report
                </CardTitle>
              </div>
            </div>
            <CardDescription className="pt-1">
              Students currently identified as medium or high risk
            </CardDescription>
          </CardHeader>
          <CardContent className="flex gap-2">
            <Button
              size="sm"
              className="bg-orange-500 hover:bg-orange-600 text-white gap-2"
              disabled={loadingAtRisk}
              onClick={generateAtRisk}
            >
              {loadingAtRisk && (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              )}
              Generate Report
            </Button>
            {atRiskRows && (
              <Button
                size="sm"
                variant="outline"
                className="gap-2"
                onClick={exportAtRiskCSV}
              >
                <Download className="h-3.5 w-3.5" />
                Export CSV
              </Button>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Active Report Table */}
      {activeReport && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>
                {activeReport === 'failing' && 'Failing Students'}
                {activeReport === 'missing' && 'Missing Submissions'}
                {activeReport === 'performance' && 'Module Performance'}
                {activeReport === 'atrisk' && 'At-Risk Students'}
              </CardTitle>
              <CardDescription>
                {activeReport === 'failing' && failingRows != null && `${failingRows.length} record${failingRows.length !== 1 ? 's' : ''}`}
                {activeReport === 'missing' && missingRows != null && `${missingRows.length} record${missingRows.length !== 1 ? 's' : ''}`}
                {activeReport === 'performance' && performanceRows != null && `${performanceRows.length} module${performanceRows.length !== 1 ? 's' : ''}`}
                {activeReport === 'atrisk' && atRiskRows != null && `${atRiskRows.length} record${atRiskRows.length !== 1 ? 's' : ''}`}
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                className="gap-2"
                onClick={() => {
                  if (activeReport === 'failing') exportFailingCSV();
                  else if (activeReport === 'missing') exportMissingCSV();
                  else if (activeReport === 'performance') exportPerformanceCSV();
                  else if (activeReport === 'atrisk') exportAtRiskCSV();
                }}
              >
                <Download className="h-3.5 w-3.5" />
                Export CSV
              </Button>
              <Button size="sm" variant="outline" onClick={() => setActiveReport(null)}>
                Close Report
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {/* Failing Students */}
            {activeReport === 'failing' && (
              failingRows == null || failingRows.length === 0 ? (
                <p className="text-center py-8 text-muted-foreground">No failing students found.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-gray-50">
                        <th className="text-left font-medium text-muted-foreground px-4 py-3">Student ID</th>
                        <th className="text-left font-medium text-muted-foreground px-4 py-3">Name</th>
                        <th className="text-left font-medium text-muted-foreground px-4 py-3">Programme</th>
                        <th className="text-left font-medium text-muted-foreground px-4 py-3">Level</th>
                        <th className="text-left font-medium text-muted-foreground px-4 py-3">Module</th>
                        <th className="text-left font-medium text-muted-foreground px-4 py-3">Overall Mark</th>
                        <th className="text-left font-medium text-muted-foreground px-4 py-3">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {failingRows.map((r, i) => (
                        <tr key={i} className="border-b last:border-0 hover:bg-gray-50 transition-colors">
                          <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{r.studentDisplayId}</td>
                          <td className="px-4 py-3 font-medium">{r.name}</td>
                          <td className="px-4 py-3 text-muted-foreground text-xs max-w-[160px] truncate">{r.programme}</td>
                          <td className="px-4 py-3 text-muted-foreground">{r.level}</td>
                          <td className="px-4 py-3 text-muted-foreground max-w-[160px] truncate">{r.moduleName}</td>
                          <td className="px-4 py-3 font-medium text-red-600">{r.overallMark}%</td>
                          <td className="px-4 py-3">
                            <Badge className="bg-red-100 text-red-800 border-red-200">Fail</Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
            )}

            {/* Missing Submissions */}
            {activeReport === 'missing' && (
              missingRows == null || missingRows.length === 0 ? (
                <p className="text-center py-8 text-muted-foreground">No missing submissions found.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-gray-50">
                        <th className="text-left font-medium text-muted-foreground px-4 py-3">Student ID</th>
                        <th className="text-left font-medium text-muted-foreground px-4 py-3">Name</th>
                        <th className="text-left font-medium text-muted-foreground px-4 py-3">Programme</th>
                        <th className="text-left font-medium text-muted-foreground px-4 py-3">Module</th>
                        <th className="text-left font-medium text-muted-foreground px-4 py-3">Enrolled Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {missingRows.map((r, i) => (
                        <tr key={i} className="border-b last:border-0 hover:bg-gray-50 transition-colors">
                          <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{r.studentDisplayId}</td>
                          <td className="px-4 py-3 font-medium">{r.name}</td>
                          <td className="px-4 py-3 text-muted-foreground text-xs max-w-[160px] truncate">{r.programme}</td>
                          <td className="px-4 py-3 text-muted-foreground max-w-[160px] truncate">{r.moduleName}</td>
                          <td className="px-4 py-3 text-muted-foreground">{r.enrolledDate}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
            )}

            {/* Module Performance */}
            {activeReport === 'performance' && (
              performanceRows == null || performanceRows.length === 0 ? (
                <p className="text-center py-8 text-muted-foreground">No module data found.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-gray-50">
                        <th className="text-left font-medium text-muted-foreground px-4 py-3">Module</th>
                        <th className="text-left font-medium text-muted-foreground px-4 py-3">Programme</th>
                        <th className="text-left font-medium text-muted-foreground px-4 py-3">Level</th>
                        <th className="text-left font-medium text-muted-foreground px-4 py-3">Total Students</th>
                        <th className="text-left font-medium text-muted-foreground px-4 py-3">Pass</th>
                        <th className="text-left font-medium text-muted-foreground px-4 py-3">Fail</th>
                        <th className="text-left font-medium text-muted-foreground px-4 py-3">Pass Rate %</th>
                      </tr>
                    </thead>
                    <tbody>
                      {performanceRows.map((r, i) => (
                        <tr key={i} className="border-b last:border-0 hover:bg-gray-50 transition-colors">
                          <td className="px-4 py-3 font-medium max-w-[160px] truncate">{r.moduleName}</td>
                          <td className="px-4 py-3 text-muted-foreground text-xs max-w-[160px] truncate">{r.programme}</td>
                          <td className="px-4 py-3 text-muted-foreground">{r.level}</td>
                          <td className="px-4 py-3 text-center font-medium">{r.total}</td>
                          <td className="px-4 py-3 text-center text-green-600 font-medium">{r.pass}</td>
                          <td className="px-4 py-3 text-center text-red-600 font-medium">{r.fail}</td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <div className="flex-1 bg-gray-200 rounded-full h-1.5 max-w-[80px]">
                                <div
                                  className={`h-1.5 rounded-full ${r.passRate >= 70 ? 'bg-green-500' : r.passRate >= 50 ? 'bg-amber-500' : 'bg-red-500'}`}
                                  style={{ width: `${r.passRate}%` }}
                                />
                              </div>
                              <span className={`font-medium text-sm ${r.passRate >= 70 ? 'text-green-600' : r.passRate >= 50 ? 'text-amber-600' : 'text-red-600'}`}>
                                {r.passRate}%
                              </span>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
            )}

            {/* At-Risk Students */}
            {activeReport === 'atrisk' && (
              atRiskRows == null || atRiskRows.length === 0 ? (
                <p className="text-center py-8 text-muted-foreground">No at-risk students found.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-gray-50">
                        <th className="text-left font-medium text-muted-foreground px-4 py-3">Student ID</th>
                        <th className="text-left font-medium text-muted-foreground px-4 py-3">Name</th>
                        <th className="text-left font-medium text-muted-foreground px-4 py-3">Programme</th>
                        <th className="text-left font-medium text-muted-foreground px-4 py-3">Year</th>
                        <th className="text-left font-medium text-muted-foreground px-4 py-3">Risk Level</th>
                        <th className="text-left font-medium text-muted-foreground px-4 py-3">Risk Score</th>
                        <th className="text-left font-medium text-muted-foreground px-4 py-3">Attendance %</th>
                        <th className="text-left font-medium text-muted-foreground px-4 py-3">GPA</th>
                        <th className="text-left font-medium text-muted-foreground px-4 py-3">Academic Mentor</th>
                      </tr>
                    </thead>
                    <tbody>
                      {atRiskRows.map((r, i) => (
                        <tr key={i} className="border-b last:border-0 hover:bg-gray-50 transition-colors">
                          <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{r.studentId}</td>
                          <td className="px-4 py-3 font-medium">{r.name}</td>
                          <td className="px-4 py-3 text-muted-foreground text-xs max-w-[160px] truncate">{r.programme}</td>
                          <td className="px-4 py-3 text-muted-foreground">{r.level}</td>
                          <td className="px-4 py-3">
                            <Badge className={r.riskLevel === 'high' ? 'bg-red-100 text-red-800 border-red-200' : 'bg-amber-100 text-amber-800 border-amber-200'}>
                              {r.riskLevel.charAt(0).toUpperCase() + r.riskLevel.slice(1)}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 font-medium text-center">{r.riskScore}</td>
                          <td className="px-4 py-3 text-center">{r.attendancePercentage}%</td>
                          <td className="px-4 py-3 text-center">{r.gpa.toFixed(2)}</td>
                          <td className="px-4 py-3 text-muted-foreground max-w-[140px] truncate">{r.academicMentor}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
