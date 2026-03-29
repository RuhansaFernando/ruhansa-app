import { useState, useMemo } from 'react';
import { useStudentData } from '../contexts/StudentDataContext';
import { Card, CardContent } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Skeleton } from '../components/ui/skeleton';
import { BookOpen, CheckCircle, XCircle } from 'lucide-react';

interface ResultRow {
  id: string;
  moduleCode: string;
  moduleName: string;
  components: { name: string; mark: number | null }[];
  overall: number;
  moduleStatus: 'pass' | 'fail';
  semester: string;
  academicYear: string;
}

const getGrade = (mark: number): string => {
  if (mark >= 70) return 'A';
  if (mark >= 60) return 'B';
  if (mark >= 50) return 'C';
  if (mark >= 40) return 'D';
  return 'F';
};

export default function StudentMarksPage() {
  const { studentData, loading } = useStudentData();
  const [semesterFilter, setSemesterFilter] = useState('all');
  const [yearFilter, setYearFilter] = useState('all');

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
        <Skeleton className="h-16 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  // Group results by moduleCode+semester+academicYear to avoid duplicate rows per module
  const groupedResults = useMemo(() => {
    const map = new Map<string, ResultRow>();

    (studentData?.results ?? []).forEach((r, i) => {
      const key = `${r.moduleCode}_${r.semester}_${r.academicYear}` || String(i);
      const componentName = r.assessmentComponent || 'Overall';
      const componentMark = r.overall;

      if (map.has(key)) {
        const existing = map.get(key)!;
        existing.components.push({ name: componentName, mark: componentMark });

        // Recalculate overall as weighted average if weights available
        const allResults = (studentData?.results ?? []).filter(res =>
          `${res.moduleCode}_${res.semester}_${res.academicYear}` === key
        );
        const totalWeight = allResults.reduce((s, res) => s + (res.weight || 0), 0);
        if (totalWeight > 0) {
          existing.overall = Math.round(
            allResults.reduce((s, res) => s + (res.overall * (res.weight || 0)), 0) / totalWeight
          );
        } else {
          existing.overall = Math.round(
            existing.components.reduce((s, c) => s + (c.mark ?? 0), 0) /
            existing.components.length
          );
        }
        existing.moduleStatus = existing.overall >= 40 ? 'pass' : 'fail';
      } else {
        map.set(key, {
          id: String(i),
          moduleCode: r.moduleCode,
          moduleName: r.moduleName,
          components: [{ name: componentName, mark: componentMark }],
          overall: r.overall,
          moduleStatus: r.overall >= 40 ? 'pass' : 'fail',
          semester: r.semester,
          academicYear: r.academicYear,
        });
      }
    });

    return Array.from(map.values());
  }, [studentData?.results]);

  // GPA from grouped results, fallback to student record GPA
  const gradePoints: Record<string, number> = { A: 4, B: 3, C: 2, D: 1, F: 0 };
  const calcGPA =
    groupedResults.length > 0
      ? Math.round(
          (groupedResults.reduce((sum, r) => {
            const g = r.overall >= 70 ? 'A' : r.overall >= 60 ? 'B' : r.overall >= 50 ? 'C' : r.overall >= 40 ? 'D' : 'F';
            return sum + gradePoints[g];
          }, 0) /
            groupedResults.length) *
            100,
        ) / 100
      : (studentData?.gpa ?? 0);

  const semesters = [...new Set(groupedResults.map((r) => r.semester).filter(Boolean))].sort();
  const academicYears = [...new Set(groupedResults.map((r) => r.academicYear).filter(Boolean))].sort().reverse();

  const filtered = useMemo(() => {
    let list = groupedResults;
    if (semesterFilter !== 'all') list = list.filter((r) => r.semester === semesterFilter);
    if (yearFilter !== 'all') list = list.filter((r) => r.academicYear === yearFilter);
    return list;
  }, [groupedResults, semesterFilter, yearFilter]);

  const passedCount = groupedResults.filter((r) => r.moduleStatus === 'pass').length;
  const failedCount = groupedResults.filter((r) => r.moduleStatus === 'fail').length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">My Marks</h1>
        <p className="text-muted-foreground text-sm mt-1">View your module results and grades</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-l-4 border-l-purple-500">
          <CardContent className="pt-5 pb-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Current GPA</p>
                <p className="text-3xl font-bold mt-1 text-purple-600">
                  {calcGPA !== null ? calcGPA.toFixed(2) : '—'}
                </p>
                <p className="text-xs text-muted-foreground mt-1">From student record</p>
              </div>
              <div className="h-10 w-10 rounded-full bg-purple-50 flex items-center justify-center">
                <BookOpen className="h-5 w-5 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-green-500">
          <CardContent className="pt-5 pb-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Modules Passed</p>
                <p className="text-3xl font-bold mt-1 text-green-600">{passedCount}</p>
                <p className="text-xs text-muted-foreground mt-1">Overall ≥ 40%</p>
              </div>
              <div className="h-10 w-10 rounded-full bg-green-50 flex items-center justify-center">
                <CheckCircle className="h-5 w-5 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-red-500">
          <CardContent className="pt-5 pb-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Modules Failed</p>
                <p className="text-3xl font-bold mt-1 text-red-600">{failedCount}</p>
                <p className="text-xs text-muted-foreground mt-1">Overall &lt; 40%</p>
              </div>
              <div className="h-10 w-10 rounded-full bg-red-50 flex items-center justify-center">
                <XCircle className="h-5 w-5 text-red-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <Select value={semesterFilter} onValueChange={setSemesterFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Semester" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Semesters</SelectItem>
            {semesters.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={yearFilter} onValueChange={setYearFilter}>
          <SelectTrigger className="w-[170px]">
            <SelectValue placeholder="Academic Year" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Years</SelectItem>
            {academicYears.map((y) => <SelectItem key={y} value={y}>{y}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="rounded-lg border bg-white overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-gray-50">
              <th className="text-left font-medium text-muted-foreground px-4 py-3">Module Code</th>
              <th className="text-left font-medium text-muted-foreground px-4 py-3">Module Name</th>
              <th className="text-center font-medium text-muted-foreground px-4 py-3">Assessment</th>
              <th className="text-center font-medium text-muted-foreground px-4 py-3">Mark</th>
              <th className="text-center font-medium text-muted-foreground px-4 py-3">Grade</th>
              <th className="text-center font-medium text-muted-foreground px-4 py-3">Status</th>
              <th className="text-left font-medium text-muted-foreground px-4 py-3">Semester</th>
              <th className="text-left font-medium text-muted-foreground px-4 py-3">Academic Year</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={8} className="text-center py-16 text-muted-foreground text-sm">
                  <BookOpen className="h-10 w-10 mx-auto mb-3 opacity-30" />
                  <p>No marks recorded yet.</p>
                  <p className="text-xs mt-1">Results will appear here once your Registry uploads them.</p>
                </td>
              </tr>
            ) : (
              filtered.map((r) => (
                <tr key={r.id} className="border-b last:border-0 hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                    {r.moduleCode || '—'}
                  </td>
                  <td className="px-4 py-3 font-medium">{r.moduleName || '—'}</td>
                  <td className="px-4 py-3 text-center">
                    {r.components.length === 0 ? (
                      <span className="text-gray-400 text-xs">—</span>
                    ) : (
                      <div className="text-xs text-muted-foreground space-y-0.5">
                        {r.components.map((c) => (
                          <div key={c.name}>
                            {c.name}:{' '}
                            {c.mark !== null
                              ? <span className={c.mark >= 30 ? 'text-green-700 font-medium' : 'text-red-700 font-medium'}>{c.mark}%</span>
                              : <span className="text-gray-400">—</span>
                            }
                          </div>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`text-lg font-bold ${r.overall >= 40 ? 'text-green-700' : 'text-red-700'}`}>
                      {r.overall}%
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`font-bold text-base ${r.overall >= 40 ? 'text-green-700' : 'text-red-600'}`}>
                      {getGrade(r.overall)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    {r.moduleStatus === 'pass' ? (
                      <Badge className="bg-green-100 text-green-800 border-green-200 text-xs">Pass</Badge>
                    ) : (
                      <Badge className="bg-red-100 text-red-800 border-red-200 text-xs">Fail</Badge>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground text-sm">{r.semester || '—'}</td>
                  <td className="px-4 py-3 text-muted-foreground text-sm">{r.academicYear || '—'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
