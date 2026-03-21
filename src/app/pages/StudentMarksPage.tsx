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
  module: string;
  component1: number;
  component2: number;
  overall: number;
  moduleStatus: 'pass' | 'fail';
  semester: string;
  academicYear: string;
}

const PassIcon = () => <CheckCircle className="h-4 w-4 text-green-600 inline" />;
const FailIcon = () => <XCircle className="h-4 w-4 text-red-600 inline" />;

export default function StudentMarksPage() {
  const { user } = useAuth();
  const [results, setResults] = useState<ResultDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [semesterFilter, setSemesterFilter] = useState('all');
  const [yearFilter, setYearFilter] = useState('all');

  useEffect(() => {
    const fetchResults = async () => {
      setLoading(true);
      try {
        const snap = await getDocs(
          query(collection(db, 'results'), where('studentId', '==', user?.id))
        );
        setResults(
          snap.docs.map((d) => ({
            id: d.id,
            studentId: d.data().studentId ?? '',
            module: d.data().module ?? d.data().moduleName ?? '',
            component1: d.data().component1 ?? 0,
            component2: d.data().component2 ?? 0,
            overall: d.data().overall ?? 0,
            moduleStatus: d.data().moduleStatus ?? (d.data().overall >= 40 ? 'pass' : 'fail'),
            semester: d.data().semester ?? '',
            academicYear: d.data().academicYear ?? '',
          }))
        );
      } finally {
        setLoading(false);
      }
    };
    fetchResults();
  }, [user?.id]);

  const semesters = useMemo(() => {
    const s = new Set(results.map((r) => r.semester).filter(Boolean));
    return Array.from(s).sort();
  }, [results]);

  const academicYears = useMemo(() => {
    const s = new Set(results.map((r) => r.academicYear).filter(Boolean));
    return Array.from(s).sort().reverse();
  }, [results]);

  const filtered = useMemo(() => {
    let list = results;
    if (semesterFilter !== 'all') list = list.filter((r) => r.semester === semesterFilter);
    if (yearFilter !== 'all') list = list.filter((r) => r.academicYear === yearFilter);
    return list;
  }, [results, semesterFilter, yearFilter]);

  const passedCount = results.filter((r) => r.moduleStatus === 'pass').length;
  const failedCount = results.filter((r) => r.moduleStatus === 'fail').length;

  // Compute GPA from results if available (overall >= 40 = pass, scale 0–100 → 0–4)
  const gpa = results.length > 0
    ? (results.reduce((sum, r) => sum + Math.min(4, (r.overall / 100) * 4), 0) / results.length)
    : 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">My Marks</h1>
        <p className="text-muted-foreground text-sm mt-1">View your module results</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-l-4 border-l-purple-500">
          <CardContent className="pt-5 pb-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Current GPA</p>
                <p className="text-3xl font-bold mt-1 text-purple-600">
                  {loading ? '—' : gpa.toFixed(2)}
                </p>
                <p className="text-xs text-muted-foreground mt-1">Based on module results</p>
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
                <p className="text-3xl font-bold mt-1 text-green-600">
                  {loading ? '—' : passedCount}
                </p>
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
                <p className="text-3xl font-bold mt-1 text-red-600">
                  {loading ? '—' : failedCount}
                </p>
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
            {semesters.map((s) => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={yearFilter} onValueChange={setYearFilter}>
          <SelectTrigger className="w-[170px]">
            <SelectValue placeholder="Academic Year" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Years</SelectItem>
            {academicYears.map((y) => (
              <SelectItem key={y} value={y}>{y}</SelectItem>
            ))}
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
                <th className="text-left font-medium text-muted-foreground px-4 py-3">Module</th>
                <th className="text-center font-medium text-muted-foreground px-4 py-3">Component 1</th>
                <th className="text-center font-medium text-muted-foreground px-4 py-3">Component 2</th>
                <th className="text-center font-medium text-muted-foreground px-4 py-3">Overall</th>
                <th className="text-center font-medium text-muted-foreground px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-12 text-muted-foreground text-sm">
                    No results yet.
                  </td>
                </tr>
              ) : (
                filtered.map((r) => (
                  <tr key={r.id} className="border-b last:border-0 hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium">
                      <div>{r.module || '—'}</div>
                      {(r.semester || r.academicYear) && (
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {[r.semester, r.academicYear].filter(Boolean).join(' · ')}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        {r.component1 >= 30 ? <PassIcon /> : <FailIcon />}
                        <span className={r.component1 >= 30 ? 'text-green-700' : 'text-red-700'}>
                          {r.component1}%
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        {r.component2 >= 30 ? <PassIcon /> : <FailIcon />}
                        <span className={r.component2 >= 30 ? 'text-green-700' : 'text-red-700'}>
                          {r.component2}%
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`font-semibold ${
                          r.overall >= 40 ? 'text-green-700' : 'text-red-700'
                        }`}
                      >
                        {r.overall}%
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {r.moduleStatus === 'pass' ? (
                        <Badge className="bg-green-100 text-green-800 border-green-200 text-xs">Pass</Badge>
                      ) : (
                        <Badge className="bg-red-100 text-red-800 border-red-200 text-xs">Fail</Badge>
                      )}
                    </td>
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
