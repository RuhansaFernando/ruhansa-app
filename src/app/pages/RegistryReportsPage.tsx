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
  AlertTriangle,
  ClipboardX,
  BarChart3,
  Download,
  Loader2,
} from "lucide-react";
import { collection, getDocs, query, where } from "firebase/firestore";
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
  missingComponents: string;
  notifiedSRU: boolean;
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
  // Failing Students
  const [failingRows, setFailingRows] = useState<FailingRow[] | null>(null);
  const [loadingFailing, setLoadingFailing] = useState(false);

  // Missing Submissions
  const [missingRows, setMissingRows] = useState<MissingRow[] | null>(null);
  const [loadingMissing, setLoadingMissing] = useState(false);

  // Module Performance
  const [performanceRows, setPerformanceRows] = useState<
    PerformanceRow[] | null
  >(null);
  const [loadingPerformance, setLoadingPerformance] = useState(false);

  const generateFailing = async () => {
    setLoadingFailing(true);
    try {
      // Fetch all results that are fails
      const resultsSnap = await getDocs(
        query(collection(db, "results"), where("moduleStatus", "==", "fail"))
      );

      // Fetch students for displayId lookup
      const studentsSnap = await getDocs(collection(db, "students"));
      const studentMap = new Map(
        studentsSnap.docs.map((d) => [
          d.id,
          { studentId: d.data().studentId ?? d.id.slice(0, 8) },
        ])
      );

      const rows: FailingRow[] = resultsSnap.docs.map((d) => {
        const data = d.data();
        const st = studentMap.get(data.studentId);
        return {
          studentDisplayId: st?.studentId ?? data.studentId?.slice(0, 8) ?? "—",
          name: data.studentName ?? "—",
          programme: data.programme ?? "—",
          level: semesterToLevel(data.semester ?? ""),
          moduleName: data.moduleName ?? "—",
          overallMark: data.overallMark ?? 0,
          moduleStatus: data.moduleStatus ?? "fail",
        };
      });

      rows.sort((a, b) => a.name.localeCompare(b.name));
      setFailingRows(rows);
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
      // Fetch all results
      const resultsSnap = await getDocs(collection(db, "results"));
      const allResults = resultsSnap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter(
          (d: any) => d.component1Submitted === false || d.component2Submitted === false
        ) as any[];

      // Fetch students for displayId lookup
      const studentsSnap = await getDocs(collection(db, "students"));
      const studentMap = new Map(
        studentsSnap.docs.map((d) => [
          d.id,
          { studentId: d.data().studentId ?? d.id.slice(0, 8) },
        ])
      );

      // Fetch notifications to check if SRU was notified
      const notifSnap = await getDocs(
        query(
          collection(db, "notifications"),
          where("type", "==", "missing_submission")
        )
      );
      const notifiedSet = new Set(
        notifSnap.docs.map(
          (d) => `${d.data().studentId}|${d.data().moduleName}`
        )
      );

      const rows: MissingRow[] = allResults.map((data) => {
        const st = studentMap.get(data.studentId);
        const missing: string[] = [];
        if (!data.component1Submitted)
          missing.push(data.component1Name || "Component 1");
        if (!data.component2Submitted)
          missing.push(data.component2Name || "Component 2");
        const key = `${data.studentId}|${data.moduleName}`;
        return {
          studentDisplayId: st?.studentId ?? data.studentId?.slice(0, 8) ?? "—",
          name: data.studentName ?? "—",
          programme: data.programme ?? "—",
          moduleName: data.moduleName ?? "—",
          missingComponents: missing.join(", "),
          notifiedSRU: notifiedSet.has(key),
        };
      });

      rows.sort((a, b) => a.name.localeCompare(b.name));
      setMissingRows(rows);
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
      [
        "Student ID",
        "Name",
        "Programme",
        "Module",
        "Missing Component",
        "Notified SRU",
      ],
      missingRows.map((r) => [
        r.studentDisplayId,
        r.name,
        r.programme,
        r.moduleName,
        r.missingComponents,
        r.notifiedSRU ? "Yes" : "No",
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
        if (data.moduleStatus === "pass") entry.pass += 1;
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Reports</h1>
        <p className="text-muted-foreground">
          Generate and export academic reports
        </p>
      </div>

      {/* Report Cards */}
      <div className="grid gap-4 md:grid-cols-3">
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
      </div>

      {/* Failing Students Table */}
      {failingRows && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Failing Students</CardTitle>
              <CardDescription>
                {failingRows.length} record{failingRows.length !== 1 ? "s" : ""}
              </CardDescription>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="gap-2"
              onClick={exportFailingCSV}
            >
              <Download className="h-3.5 w-3.5" />
              Export CSV
            </Button>
          </CardHeader>
          <CardContent>
            {failingRows.length === 0 ? (
              <p className="text-center py-8 text-muted-foreground">
                No failing students found.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-gray-50">
                      <th className="text-left font-medium text-muted-foreground px-4 py-3">
                        Student ID
                      </th>
                      <th className="text-left font-medium text-muted-foreground px-4 py-3">
                        Name
                      </th>
                      <th className="text-left font-medium text-muted-foreground px-4 py-3">
                        Programme
                      </th>
                      <th className="text-left font-medium text-muted-foreground px-4 py-3">
                        Level
                      </th>
                      <th className="text-left font-medium text-muted-foreground px-4 py-3">
                        Module
                      </th>
                      <th className="text-left font-medium text-muted-foreground px-4 py-3">
                        Overall Mark
                      </th>
                      <th className="text-left font-medium text-muted-foreground px-4 py-3">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {failingRows.map((r, i) => (
                      <tr
                        key={i}
                        className="border-b last:border-0 hover:bg-gray-50 transition-colors"
                      >
                        <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                          {r.studentDisplayId}
                        </td>
                        <td className="px-4 py-3 font-medium">{r.name}</td>
                        <td className="px-4 py-3 text-muted-foreground text-xs max-w-[160px] truncate">
                          {r.programme}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {r.level}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground max-w-[160px] truncate">
                          {r.moduleName}
                        </td>
                        <td className="px-4 py-3 font-medium text-red-600">
                          {r.overallMark}%
                        </td>
                        <td className="px-4 py-3">
                          <Badge className="bg-red-100 text-red-800 border-red-200">
                            Fail
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Missing Submissions Table */}
      {missingRows && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Missing Submissions</CardTitle>
              <CardDescription>
                {missingRows.length} record{missingRows.length !== 1 ? "s" : ""}
              </CardDescription>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="gap-2"
              onClick={exportMissingCSV}
            >
              <Download className="h-3.5 w-3.5" />
              Export CSV
            </Button>
          </CardHeader>
          <CardContent>
            {missingRows.length === 0 ? (
              <p className="text-center py-8 text-muted-foreground">
                No missing submissions found.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-gray-50">
                      <th className="text-left font-medium text-muted-foreground px-4 py-3">
                        Student ID
                      </th>
                      <th className="text-left font-medium text-muted-foreground px-4 py-3">
                        Name
                      </th>
                      <th className="text-left font-medium text-muted-foreground px-4 py-3">
                        Programme
                      </th>
                      <th className="text-left font-medium text-muted-foreground px-4 py-3">
                        Module
                      </th>
                      <th className="text-left font-medium text-muted-foreground px-4 py-3">
                        Missing Component
                      </th>
                      <th className="text-left font-medium text-muted-foreground px-4 py-3">
                        Notified SRU
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {missingRows.map((r, i) => (
                      <tr
                        key={i}
                        className="border-b last:border-0 hover:bg-gray-50 transition-colors"
                      >
                        <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                          {r.studentDisplayId}
                        </td>
                        <td className="px-4 py-3 font-medium">{r.name}</td>
                        <td className="px-4 py-3 text-muted-foreground text-xs max-w-[160px] truncate">
                          {r.programme}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground max-w-[160px] truncate">
                          {r.moduleName}
                        </td>
                        <td className="px-4 py-3 text-amber-700">
                          {r.missingComponents}
                        </td>
                        <td className="px-4 py-3">
                          <Badge
                            className={
                              r.notifiedSRU
                                ? "bg-green-100 text-green-800 border-green-200"
                                : "bg-gray-100 text-gray-600 border-gray-200"
                            }
                          >
                            {r.notifiedSRU ? "Yes" : "No"}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Module Performance Table */}
      {performanceRows && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Module Performance</CardTitle>
              <CardDescription>
                {performanceRows.length} module
                {performanceRows.length !== 1 ? "s" : ""}
              </CardDescription>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="gap-2"
              onClick={exportPerformanceCSV}
            >
              <Download className="h-3.5 w-3.5" />
              Export CSV
            </Button>
          </CardHeader>
          <CardContent>
            {performanceRows.length === 0 ? (
              <p className="text-center py-8 text-muted-foreground">
                No module data found.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-gray-50">
                      <th className="text-left font-medium text-muted-foreground px-4 py-3">
                        Module
                      </th>
                      <th className="text-left font-medium text-muted-foreground px-4 py-3">
                        Programme
                      </th>
                      <th className="text-left font-medium text-muted-foreground px-4 py-3">
                        Level
                      </th>
                      <th className="text-left font-medium text-muted-foreground px-4 py-3">
                        Total Students
                      </th>
                      <th className="text-left font-medium text-muted-foreground px-4 py-3">
                        Pass
                      </th>
                      <th className="text-left font-medium text-muted-foreground px-4 py-3">
                        Fail
                      </th>
                      <th className="text-left font-medium text-muted-foreground px-4 py-3">
                        Pass Rate %
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {performanceRows.map((r, i) => (
                      <tr
                        key={i}
                        className="border-b last:border-0 hover:bg-gray-50 transition-colors"
                      >
                        <td className="px-4 py-3 font-medium max-w-[160px] truncate">
                          {r.moduleName}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground text-xs max-w-[160px] truncate">
                          {r.programme}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {r.level}
                        </td>
                        <td className="px-4 py-3 text-center font-medium">
                          {r.total}
                        </td>
                        <td className="px-4 py-3 text-center text-green-600 font-medium">
                          {r.pass}
                        </td>
                        <td className="px-4 py-3 text-center text-red-600 font-medium">
                          {r.fail}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 bg-gray-200 rounded-full h-1.5 max-w-[80px]">
                              <div
                                className={`h-1.5 rounded-full ${
                                  r.passRate >= 70
                                    ? "bg-green-500"
                                    : r.passRate >= 50
                                    ? "bg-amber-500"
                                    : "bg-red-500"
                                }`}
                                style={{ width: `${r.passRate}%` }}
                              />
                            </div>
                            <span
                              className={`font-medium text-sm ${
                                r.passRate >= 70
                                  ? "text-green-600"
                                  : r.passRate >= 50
                                  ? "text-amber-600"
                                  : "text-red-600"
                              }`}
                            >
                              {r.passRate}%
                            </span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
