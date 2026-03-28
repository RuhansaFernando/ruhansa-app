import { useState, useEffect, useMemo } from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../AuthContext';
import { Card, CardContent } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { BookOpen, CheckCircle, XCircle, Loader2 } from 'lucide-react';

interface ResultDoc {
  id: string;
  studentId: string;
  moduleCode: string;
  moduleName: string;
  component1: number;
  component2: number;
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
  const { user } = useAuth();
  const [results, setResults] = useState<ResultDoc[]>([]);
  const [gpa, setGpa] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [semesterFilter, setSemesterFilter] = useState('all');
  const [yearFilter, setYearFilter] = useState('all');

  useEffect(() => {
    const fetchResults = async () => {
      setLoading(true);
      try {
        // Step 1: find student record by email
        const studentSnap = await getDocs(
          query(collection(db, 'students'), where('email', '==', user?.email ?? ''))
        );

        if (studentSnap.empty) {
          setLoading(false);
          return;
        }

        const studentData = studentSnap.docs[0].data();
        const studentId = studentData.studentId ?? studentSnap.docs[0].id;
        setGpa(studentData.gpa ?? null);

        // Step 2: load modules for name lookup
        const modSnap = await getDocs(collection(db, 'modules'));
        const moduleByCode = new Map<string, string>();
        const moduleById = new Map<string, string>();
        modSnap.forEach((d) => {
          const code = d.data().moduleCode ?? '';
          const name = d.data().moduleName ?? '';
          if (code) moduleByCode.set(code, name);
          moduleById.set(d.id, name);
        });

        // Step 3: load results by studentId
        const resultsSnap = await getDocs(
          query(collection(db, 'results'), where('studentId', '==', studentId))
        );

        setResults(
          resultsSnap.docs.map((d) => {
            const data = d.data();
            const rawCode = data.moduleCode ?? '';
            const rawName = data.moduleName ?? data.module ?? '';
            const resolvedName =
              rawName ||
              (rawCode ? (moduleByCode.get(rawCode) ?? '') : '') ||
              (data.moduleId ? (moduleById.get(data.moduleId) ?? '') : '');
            const overallMark = data.overall ?? data.finalMark ?? data.mark ?? 0;
            const c1Mark = data.component1 ?? data.courseworkMark ?? data.assessmentMark ?? 0;
            const c2Mark = data.component2 ?? data.examMark ?? data.finalExamMark ?? 0;
            return {
              id: d.id,
              studentId: data.studentId ?? '',
              moduleCode: rawCode,
              moduleName: resolvedName,
              component1: c1Mark,
              component2: c2Mark,
              overall: overallMark,
              moduleStatus: data.moduleStatus ?? (overallMark >= 40 ? 'pass' : 'fail'),
              semester: data.semester ?? '',
              academicYear: data.academicYear ?? '',
            };
          })
        );
      } finally {
        setLoading(false);
      }
    };
    fetchResults();
  }, [(user as any)?.uid, user?.email]);

  const semesters = useMemo(() => Array.from(new Set(results.map((r) => r.semester).filter(Boolean))).sort(), [results]);
  const academicYears = useMemo(() => Array.from(new Set(results.map((r) => r.academicYear).filter(Boolean))).sort().reverse(), [results]);

  const filtered = useMemo(() => {
    let list = results;
    if (semesterFilter !== 'all') list = list.filter((r) => r.semester === semesterFilter);
    if (yearFilter !== 'all') list = list.filter((r) => r.academicYear === yearFilter);
    return list;
  }, [results, semesterFilter, yearFilter]);

  const passedCount = results.filter((r) => r.moduleStatus === 'pass').length;
  const failedCount = results.filter((r) => r.moduleStatus === 'fail').length;

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
                  {loading ? '—' : gpa !== null ? gpa.toFixed(2) : '—'}
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
                <p className="text-3xl font-bold mt-1 text-green-600">{loading ? '—' : passedCount}</p>
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
                <p className="text-3xl font-bold mt-1 text-red-600">{loading ? '—' : failedCount}</p>
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
        {loading ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground gap-2 text-sm">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading results...
          </div>
        ) : (
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
                    No marks recorded yet.
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
                      <div className="text-xs text-muted-foreground space-y-0.5">
                        <div>C1: <span className={r.component1 >= 30 ? 'text-green-700 font-medium' : 'text-red-700 font-medium'}>{r.component1}%</span></div>
                        <div>C2: <span className={r.component2 >= 30 ? 'text-green-700 font-medium' : 'text-red-700 font-medium'}>{r.component2}%</span></div>
                      </div>
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
        )}
      </div>
    </div>
  );
}
