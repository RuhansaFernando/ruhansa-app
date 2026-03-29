import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '../components/ui/select';
import { Label } from '../components/ui/label';
import { Input } from '../components/ui/input';
import {
  addDoc, getDocs, updateDoc, doc, collection,
  serverTimestamp, query, where, orderBy, limit,
} from 'firebase/firestore';
import { db } from '../../firebase';
import { toast } from 'sonner';
import { useAuth } from '../AuthContext';
import { Upload, Download, Loader2, Users, Clock, BookOpen, CheckCircle } from 'lucide-react';

// ─── Risk calculation ─────────────────────────────────────────────────────────
function calculateRisk(gpa: number, attendance: number, absences: number) {
  let score = 0;
  if (gpa < 1.5) score += 40;
  else if (gpa < 2.0) score += 30;
  else if (gpa < 2.5) score += 20;
  else if (gpa < 3.0) score += 10;

  if (attendance < 60) score += 40;
  else if (attendance < 70) score += 30;
  else if (attendance < 75) score += 20;
  else if (attendance < 80) score += 10;

  if (absences >= 7) score += 20;
  else if (absences >= 5) score += 15;
  else if (absences >= 3) score += 10;
  else if (absences >= 2) score += 5;

  return {
    riskLevel: score >= 50 ? 'high' : score >= 25 ? 'medium' : 'low',
    riskScore: score,
  };
}

// ─── Grade helpers ────────────────────────────────────────────────────────────
function calculateGrade(mark: number): string {
  if (mark >= 70) return 'A';
  if (mark >= 60) return 'B';
  if (mark >= 50) return 'C';
  if (mark >= 40) return 'D';
  return 'F';
}

function gradeToPoints(grade: string): number {
  switch (grade) {
    case 'A': return 4.0;
    case 'B': return 3.0;
    case 'C': return 2.0;
    case 'D': return 1.0;
    default: return 0.0;
  }
}

const SEMESTERS = ['Semester 1', 'Semester 2', 'Semester 1 & 2'];

// ─── Types ────────────────────────────────────────────────────────────────────
interface Module {
  id: string;
  moduleCode: string;
  moduleName: string;
  yearOfStudy: string;
  semester: string;
  components: { name: string; weight: number }[];
}

interface EnrolledStudent {
  studentDocId: string;
  studentId: string;
  name: string;
  programme: string;
  level: string;
}

interface MarkHistoryRecord {
  id: string;
  moduleCode: string;
  moduleName: string;
  studentId: string;
  studentName: string;
  assessmentComponent: string;
  mark: number;
  grade: string;
  status: 'pass' | 'fail';
  uploadedBy: string;
  createdAt: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const currentAcademicYear = () => {
  const now = new Date();
  const year = now.getFullYear();
  return now.getMonth() + 1 >= 9 ? `${year}/${year + 1}` : `${year - 1}/${year}`;
};

const formatDate = (d: string) => {
  if (!d) return '—';
  try {
    return new Date(d).toLocaleDateString('en-GB', {
      day: 'numeric', month: 'short', year: 'numeric',
    });
  } catch {
    return d;
  }
};

const gradeBadgeClass = (grade: string) => {
  switch (grade) {
    case 'A': return 'bg-green-100 text-green-800 border-green-200';
    case 'B': return 'bg-blue-100 text-blue-800 border-blue-200';
    case 'C': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    case 'D': return 'bg-orange-100 text-orange-800 border-orange-200';
    default: return 'bg-red-100 text-red-800 border-red-200';
  }
};

// ─── Component ────────────────────────────────────────────────────────────────
export default function RegistryMarksPage() {
  const { user } = useAuth();

  // Section 1 — selection
  const [modules, setModules] = useState<Module[]>([]);
  const [loadingModules, setLoadingModules] = useState(true);
  const [selectedModuleId, setSelectedModuleId] = useState('');
  const [selectedAssessment, setSelectedAssessment] = useState('');
  const [academicYear, setAcademicYear] = useState(currentAcademicYear());
  const [selectedSemester, setSelectedSemester] = useState('');

  // Section 2 — students & marks
  const [enrolledStudents, setEnrolledStudents] = useState<EnrolledStudent[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [studentsLoaded, setStudentsLoaded] = useState(false);
  const [markMap, setMarkMap] = useState<Map<string, number | ''>>(new Map());
  const [entryMode, setEntryMode] = useState<'manual' | 'csv'>('manual');
  const [saving, setSaving] = useState(false);

  // CSV state
  const [csvPreviewRows, setCsvPreviewRows] = useState<{ studentId: string; mark: string }[]>([]);
  const [csvProcessing, setCsvProcessing] = useState(false);
  const [showCsvPreview, setShowCsvPreview] = useState(false);

  // Section 3 — history
  const [history, setHistory] = useState<MarkHistoryRecord[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [historyFilterModuleId, setHistoryFilterModuleId] = useState('all');
  const [historyFilterAssessment, setHistoryFilterAssessment] = useState('all');

  const selectedModule = modules.find((m) => m.id === selectedModuleId) ?? null;
  const assessmentOptions = selectedModule?.components.map((c) => c.name) ?? [];

  // ── Load modules ────────────────────────────────────────────────────────────
  useEffect(() => {
    getDocs(collection(db, 'modules'))
      .then((snap) => {
        const mods = snap.docs
          .map((d) => ({
            id: d.id,
            moduleCode: d.data().moduleCode ?? '',
            moduleName: d.data().moduleName ?? '',
            yearOfStudy: d.data().yearOfStudy ?? '',
            semester: d.data().semester ?? '',
            components: d.data().components ?? [],
          }))
          .sort((a, b) => a.moduleCode.localeCompare(b.moduleCode));
        setModules(mods);
      })
      .catch(() => toast.error('Failed to load modules'))
      .finally(() => setLoadingModules(false));
  }, []);

  // Reset assessment & students when module changes
  useEffect(() => {
    setSelectedAssessment('');
    setStudentsLoaded(false);
    setEnrolledStudents([]);
    setMarkMap(new Map());
    setCsvPreviewRows([]);
    setShowCsvPreview(false);
  }, [selectedModuleId]);

  // ── Load history ────────────────────────────────────────────────────────────
  const loadHistory = useCallback(async () => {
    setLoadingHistory(true);
    try {
      let snap;
      if (historyFilterModuleId && historyFilterModuleId !== 'all') {
        snap = await getDocs(
          query(collection(db, 'results'), where('moduleId', '==', historyFilterModuleId), limit(50))
        );
      } else {
        snap = await getDocs(
          query(collection(db, 'results'), orderBy('createdAt', 'desc'), limit(50))
        );
      }

      let records: MarkHistoryRecord[] = snap.docs.map((d) => ({
        id: d.id,
        moduleCode: d.data().moduleCode ?? '',
        moduleName: d.data().moduleName ?? '',
        studentId: d.data().studentId ?? '',
        studentName: d.data().studentName ?? '',
        assessmentComponent: d.data().assessmentComponent ?? '',
        mark: d.data().mark ?? 0,
        grade: d.data().grade ?? '',
        status: d.data().status ?? 'pass',
        uploadedBy: d.data().uploadedBy ?? '',
        createdAt: d.data().createdAt?.toDate?.().toISOString() ?? '',
      }));

      // Client-side sort when no orderBy was used (module filter path)
      if (historyFilterModuleId !== 'all') {
        records.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      }

      // Client-side assessment filter
      if (historyFilterAssessment && historyFilterAssessment !== 'all') {
        records = records.filter((r) => r.assessmentComponent === historyFilterAssessment);
      }

      setHistory(records);
    } catch {
      toast.error('Failed to load marks history');
    } finally {
      setLoadingHistory(false);
    }
  }, [historyFilterModuleId, historyFilterAssessment]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  // ── Load enrolled students ──────────────────────────────────────────────────
  const handleLoadStudents = async () => {
    if (!selectedModuleId) { toast.error('Please select a module'); return; }
    if (!selectedAssessment) { toast.error('Please select an assessment component'); return; }
    if (!academicYear.trim()) { toast.error('Please enter an academic year'); return; }
    if (!selectedSemester) { toast.error('Please select a semester'); return; }

    setLoadingStudents(true);
    setStudentsLoaded(false);
    setEnrolledStudents([]);
    setMarkMap(new Map());
    setCsvPreviewRows([]);
    setShowCsvPreview(false);

    try {
      const [enrollSnap, studentsSnap] = await Promise.all([
        getDocs(query(collection(db, 'moduleEnrollments'), where('moduleId', '==', selectedModuleId))),
        getDocs(collection(db, 'students')),
      ]);

      if (enrollSnap.empty) {
        toast.warning('No students enrolled in this module');
        setStudentsLoaded(true);
        return;
      }

      const enrolledIds = new Set(
        enrollSnap.docs
          .map((d) => String(d.data().studentId ?? '').trim())
          .filter(Boolean)
      );

      const studentMap = new Map<string, { docId: string; name: string; programme: string; level: string }>();
      studentsSnap.forEach((d) => {
        const sid = String(d.data().studentId ?? '').trim();
        if (sid) {
          studentMap.set(sid, {
            docId: d.id,
            name: d.data().name ?? '',
            programme: d.data().programme ?? '',
            level: String(d.data().level ?? d.data().yearOfStudy ?? ''),
          });
        }
      });

      const students: EnrolledStudent[] = [];
      enrolledIds.forEach((sid) => {
        const s = studentMap.get(sid);
        if (s) {
          students.push({
            studentDocId: s.docId,
            studentId: sid,
            name: s.name,
            programme: s.programme,
            level: s.level,
          });
        }
      });
      students.sort((a, b) => a.studentId.localeCompare(b.studentId));

      setEnrolledStudents(students);
      const map = new Map<string, number | ''>();
      students.forEach((s) => map.set(s.studentId, ''));
      setMarkMap(map);
      setStudentsLoaded(true);

      if (students.length === 0) {
        toast.warning('No matching students found');
      } else {
        toast.success(`Loaded ${students.length} students`);
      }
    } catch {
      toast.error('Failed to load students');
    } finally {
      setLoadingStudents(false);
    }
  };

  // ── Save marks ──────────────────────────────────────────────────────────────
  const handleSave = async (
    studentsToSave?: EnrolledStudent[],
    marksToUse?: Map<string, number | ''>
  ) => {
    const students = studentsToSave ?? enrolledStudents;
    const marks = marksToUse ?? markMap;
    const mod = selectedModule;
    if (!mod) return;

    const toSave = students.filter((s) => {
      const m = marks.get(s.studentId);
      return m !== '' && m !== undefined;
    });

    if (toSave.length === 0) {
      toast.error('No marks to save');
      return;
    }

    setSaving(true);
    try {
      // 1. Write one results doc per student (update if already exists)
      await Promise.all(
        toSave.map(async (student) => {
          const mark = marks.get(student.studentId) as number;
          const grade = calculateGrade(mark);
          const status = mark >= 40 ? 'pass' : 'fail';

          const existingSnap = await getDocs(query(
            collection(db, 'results'),
            where('studentId', '==', student.studentId),
            where('moduleCode', '==', mod.moduleCode),
          ));

          const existingDoc = existingSnap.docs.find((d) =>
            d.data().assessmentComponent === selectedAssessment &&
            d.data().academicYear === academicYear.trim() &&
            d.data().semester === selectedSemester
          );

          if (existingDoc) {
            return updateDoc(doc(db, 'results', existingDoc.id), {
              mark,
              grade,
              status,
              uploadedBy: user?.name ?? 'Registry',
            });
          } else {
            return addDoc(collection(db, 'results'), {
              moduleId: mod.id,
              moduleCode: mod.moduleCode,
              moduleName: mod.moduleName,
              studentId: student.studentId,
              studentName: student.name,
              programme: student.programme,
              yearOfStudy: student.level,
              assessmentComponent: selectedAssessment,
              academicYear: academicYear.trim(),
              semester: selectedSemester,
              mark,
              grade,
              status,
              uploadedBy: user?.name ?? 'Registry',
              createdAt: serverTimestamp(),
            });
          }
        })
      );

      // 2. Recalculate GPA + risk for each saved student
      await Promise.all(
        toSave.map(async (student) => {
          try {
            const resultsSnap = await getDocs(
              query(collection(db, 'results'), where('studentId', '==', student.studentId))
            );

            const grades = resultsSnap.docs.map((d) => d.data().grade ?? '');
            const gpa =
              grades.length > 0
                ? Math.round(
                    (grades.reduce((sum, g) => sum + gradeToPoints(g), 0) / grades.length) * 100
                  ) / 100
                : 0;

            // Get current attendance stats from the student doc directly
            const studentDocRef = doc(db, 'students', student.studentDocId);
            const studentSnap = await getDocs(
              query(collection(db, 'students'), where('studentId', '==', student.studentId))
            );
            const sData = studentSnap.docs[0]?.data();
            const attendance = sData?.attendancePercentage ?? 100;
            const absences = sData?.consecutiveAbsences ?? 0;

            const { riskLevel, riskScore } = calculateRisk(gpa, attendance, absences);

            await updateDoc(studentDocRef, { gpa, riskLevel, riskScore });
          } catch (err) {
            console.error('Failed to update student marks:', (err as Error).message);
          }
        })
      );

      toast.success(`Marks saved for ${toSave.length} students`);
      setStudentsLoaded(false);
      setEnrolledStudents([]);
      setMarkMap(new Map());
      setCsvPreviewRows([]);
      setShowCsvPreview(false);
      await loadHistory();
    } catch {
      toast.error('Failed to save marks');
    } finally {
      setSaving(false);
    }
  };

  // ── Download CSV template ───────────────────────────────────────────────────
  const downloadCsvTemplate = () => {
    const rows = [
      'StudentID,StudentName,Mark',
      ...enrolledStudents.map((s) => `${s.studentId},"${s.name}",`),
    ];
    const blob = new Blob([rows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `marks_${selectedModule?.moduleCode ?? ''}_${selectedAssessment.replace(/\s+/g, '_')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ── Handle CSV file upload ──────────────────────────────────────────────────
  const handleCsvFile = async (file: File) => {
    setCsvProcessing(true);
    try {
      const Papa = (await import('papaparse')).default;
      await new Promise<void>((resolve, reject) => {
        Papa.parse(file, {
          header: true,
          skipEmptyLines: true,
          complete: (res) => {
            const rows = res.data as Record<string, string>[];
            const preview: { studentId: string; mark: string }[] = [];
            rows.forEach((row) => {
              const sid = (row['StudentID'] ?? row['studentId'] ?? '').trim();
              const mark = (row['Mark'] ?? row['mark'] ?? '').trim();
              if (sid) preview.push({ studentId: sid, mark });
            });
            setCsvPreviewRows(preview);
            setShowCsvPreview(true);
            resolve();
          },
          error: reject,
        });
      });
    } catch {
      toast.error('Failed to parse CSV');
    } finally {
      setCsvProcessing(false);
    }
  };

  // ── Confirm & save CSV marks ────────────────────────────────────────────────
  const handleCsvSave = async () => {
    const newMap = new Map(markMap);
    let applied = 0;
    csvPreviewRows.forEach(({ studentId, mark }) => {
      const num = Number(mark);
      if (newMap.has(studentId) && !isNaN(num) && num >= 0 && num <= 100) {
        newMap.set(studentId, num);
        applied++;
      }
    });
    if (applied === 0) {
      toast.error('No valid marks to apply from CSV');
      return;
    }
    setMarkMap(newMap);
    await handleSave(enrolledStudents, newMap);
  };

  // ── Derived stats ───────────────────────────────────────────────────────────
  const markStats = enrolledStudents.reduce(
    (acc, s) => {
      const m = markMap.get(s.studentId);
      if (m !== '' && m !== undefined) {
        acc.filled++;
        const g = calculateGrade(m as number);
        acc.grades[g] = (acc.grades[g] ?? 0) + 1;
      }
      return acc;
    },
    { filled: 0, grades: {} as Record<string, number> }
  );

  const historyAssessments = [
    ...new Set(history.map((h) => h.assessmentComponent).filter(Boolean)),
  ];

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Marks Management</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Upload and manage student module marks
        </p>
      </div>

      {/* ── Section 1: Select Module & Assessment ── */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base flex items-center gap-2">
            <BookOpen className="h-4 w-4" />
            Select Module & Assessment
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
            <div className="space-y-1.5">
              <Label>Module</Label>
              <Select
                value={selectedModuleId}
                onValueChange={setSelectedModuleId}
                disabled={loadingModules}
              >
                <SelectTrigger>
                  <SelectValue placeholder={loadingModules ? 'Loading…' : '— Select module —'} />
                </SelectTrigger>
                <SelectContent>
                  {modules.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.moduleCode} — {m.moduleName}
                      {(m.yearOfStudy || m.semester)
                        ? ` (${[m.yearOfStudy, m.semester].filter(Boolean).join(', ')})`
                        : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Assessment Component</Label>
              <Select
                value={selectedAssessment}
                onValueChange={setSelectedAssessment}
                disabled={!selectedModuleId || assessmentOptions.length === 0}
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={
                      !selectedModuleId
                        ? 'Select module first'
                        : assessmentOptions.length === 0
                        ? 'No components defined'
                        : '— Select assessment —'
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {assessmentOptions.map((a) => (
                    <SelectItem key={a} value={a}>{a}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Academic Year</Label>
              <Input
                value={academicYear}
                onChange={(e) => setAcademicYear(e.target.value)}
                placeholder="e.g. 2024/2025"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Semester</Label>
              <Select value={selectedSemester} onValueChange={setSelectedSemester}>
                <SelectTrigger>
                  <SelectValue placeholder="— Select —" />
                </SelectTrigger>
                <SelectContent>
                  {SEMESTERS.map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="mt-4">
            <Button
              onClick={handleLoadStudents}
              disabled={
                !selectedModuleId ||
                !selectedAssessment ||
                !academicYear.trim() ||
                !selectedSemester ||
                loadingStudents
              }
              className="gap-2"
            >
              {loadingStudents ? (
                <><Loader2 className="h-4 w-4 animate-spin" />Loading…</>
              ) : (
                <><Users className="h-4 w-4" />Load Students</>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ── Section 2: Enter Marks ── */}
      {studentsLoaded && (
        <Card>
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <CardTitle className="text-base flex items-center gap-2">
                <CheckCircle className="h-4 w-4" />
                Enter Marks
                {enrolledStudents.length > 0 && (
                  <span className="text-muted-foreground font-normal text-sm ml-1">
                    — {enrolledStudents.length} students enrolled
                  </span>
                )}
              </CardTitle>
              {/* Tab switcher */}
              <div className="flex rounded-md border overflow-hidden text-sm">
                <button
                  onClick={() => { setEntryMode('manual'); setShowCsvPreview(false); }}
                  className={`px-3 py-1.5 transition-colors ${
                    entryMode === 'manual'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-white text-muted-foreground hover:bg-gray-50'
                  }`}
                >
                  Manual Entry
                </button>
                <button
                  onClick={() => setEntryMode('csv')}
                  className={`px-3 py-1.5 border-l transition-colors ${
                    entryMode === 'csv'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-white text-muted-foreground hover:bg-gray-50'
                  }`}
                >
                  CSV Upload
                </button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {enrolledStudents.length === 0 ? (
              <p className="text-center py-8 text-muted-foreground text-sm">
                No students found for this module
              </p>
            ) : entryMode === 'manual' ? (
              <>
                {/* Stats row */}
                {markStats.filled > 0 && (
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm text-muted-foreground">
                      {markStats.filled}/{enrolledStudents.length} marks entered
                    </span>
                    {Object.entries(markStats.grades).sort().map(([grade, count]) => (
                      <Badge key={grade} className={`text-xs ${gradeBadgeClass(grade)}`}>
                        {grade}: {count}
                      </Badge>
                    ))}
                  </div>
                )}

                {/* Table */}
                <div className="overflow-x-auto rounded-md border">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 border-b">
                        <th className="text-left font-medium text-muted-foreground px-4 py-3">Student ID</th>
                        <th className="text-left font-medium text-muted-foreground px-4 py-3">Name</th>
                        <th className="text-left font-medium text-muted-foreground px-4 py-3 hidden sm:table-cell">Programme</th>
                        <th className="text-left font-medium text-muted-foreground px-4 py-3 hidden sm:table-cell">Year</th>
                        <th className="text-left font-medium text-muted-foreground px-4 py-3">Mark (0–100)</th>
                        <th className="text-left font-medium text-muted-foreground px-4 py-3">Grade</th>
                        <th className="text-left font-medium text-muted-foreground px-4 py-3">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {enrolledStudents.map((student) => {
                        const mark = markMap.get(student.studentId);
                        const hasMark = mark !== '' && mark !== undefined;
                        const grade = hasMark ? calculateGrade(mark as number) : null;
                        const pass = hasMark && (mark as number) >= 40;
                        return (
                          <tr key={student.studentId} className="border-b last:border-0 hover:bg-gray-50">
                            <td className="px-4 py-3 font-mono text-xs">{student.studentId}</td>
                            <td className="px-4 py-3 font-medium">{student.name}</td>
                            <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell">
                              {student.programme || '—'}
                            </td>
                            <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell">
                              {student.level || '—'}
                            </td>
                            <td className="px-4 py-3">
                              <Input
                                type="number"
                                min={0}
                                max={100}
                                value={mark === '' || mark === undefined ? '' : String(mark)}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setMarkMap((prev) => {
                                    const next = new Map(prev);
                                    if (val === '') {
                                      next.set(student.studentId, '');
                                    } else {
                                      next.set(student.studentId, Math.min(100, Math.max(0, Number(val))));
                                    }
                                    return next;
                                  });
                                }}
                                className="w-24 h-8 text-sm"
                                placeholder="0–100"
                              />
                            </td>
                            <td className="px-4 py-3">
                              {grade ? (
                                <Badge className={`text-xs ${gradeBadgeClass(grade)}`}>{grade}</Badge>
                              ) : (
                                <span className="text-muted-foreground text-xs">—</span>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              {hasMark ? (
                                <Badge
                                  className={`text-xs ${
                                    pass
                                      ? 'bg-green-100 text-green-800 border-green-200'
                                      : 'bg-red-100 text-red-800 border-red-200'
                                  }`}
                                >
                                  {pass ? 'Pass' : 'Fail'}
                                </Badge>
                              ) : (
                                <span className="text-muted-foreground text-xs">—</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="pt-3 border-t">
                  <Button
                    onClick={() => handleSave()}
                    disabled={saving || markStats.filled === 0}
                    className="gap-2"
                  >
                    {saving ? (
                      <><Loader2 className="h-4 w-4 animate-spin" />Saving…</>
                    ) : (
                      <><CheckCircle className="h-4 w-4" />Save Marks ({markStats.filled})</>
                    )}
                  </Button>
                </div>
              </>
            ) : (
              /* CSV Upload mode */
              <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-3">
                  <Button size="sm" variant="outline" className="gap-2" onClick={downloadCsvTemplate}>
                    <Download className="h-4 w-4" />
                    Download Pre-filled Template
                  </Button>
                  <p className="text-sm text-muted-foreground">
                    Fill in the Mark column (0–100), then upload below
                  </p>
                </div>

                {!showCsvPreview ? (
                  <div className="border-2 border-dashed rounded-lg p-8 text-center">
                    <input
                      type="file"
                      accept=".csv"
                      id="csv-marks-upload"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) handleCsvFile(f);
                        e.target.value = '';
                      }}
                    />
                    <label htmlFor="csv-marks-upload" className="cursor-pointer">
                      {csvProcessing ? (
                        <div className="flex flex-col items-center gap-2">
                          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                          <p className="text-sm text-muted-foreground">Processing…</p>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center gap-2">
                          <Upload className="h-8 w-8 text-muted-foreground" />
                          <p className="font-medium text-sm">Click to upload CSV</p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            Columns: StudentID, StudentName, Mark
                          </p>
                        </div>
                      )}
                    </label>
                  </div>
                ) : (
                  /* CSV Preview */
                  <div className="space-y-3">
                    <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3">
                      <p className="text-sm font-medium text-green-900">
                        {csvPreviewRows.length} rows loaded — review before saving
                      </p>
                    </div>

                    <div className="overflow-x-auto rounded-md border max-h-72 overflow-y-auto">
                      <table className="w-full text-sm">
                        <thead className="sticky top-0 bg-gray-50 z-10">
                          <tr className="border-b">
                            <th className="text-left font-medium text-muted-foreground px-4 py-3">Student ID</th>
                            <th className="text-left font-medium text-muted-foreground px-4 py-3">Student Name</th>
                            <th className="text-left font-medium text-muted-foreground px-4 py-3">Mark</th>
                            <th className="text-left font-medium text-muted-foreground px-4 py-3">Grade</th>
                            <th className="text-left font-medium text-muted-foreground px-4 py-3">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {csvPreviewRows.map(({ studentId, mark }, idx) => {
                            const student = enrolledStudents.find((s) => s.studentId === studentId);
                            const num = Number(mark);
                            const valid = mark !== '' && !isNaN(num) && num >= 0 && num <= 100;
                            const grade = valid ? calculateGrade(num) : null;
                            const pass = valid && num >= 40;
                            return (
                              <tr
                                key={idx}
                                className={`border-b last:border-0 ${!student || !valid ? 'bg-red-50/60' : ''}`}
                              >
                                <td className="px-4 py-3 font-mono text-xs">{studentId}</td>
                                <td className="px-4 py-3 text-muted-foreground">
                                  {student?.name ?? (
                                    <span className="text-red-500 text-xs">Not enrolled</span>
                                  )}
                                </td>
                                <td className="px-4 py-3">
                                  {valid ? (
                                    mark
                                  ) : (
                                    <span className="text-red-500 text-xs">
                                      Invalid: {mark || '(empty)'}
                                    </span>
                                  )}
                                </td>
                                <td className="px-4 py-3">
                                  {grade ? (
                                    <Badge className={`text-xs ${gradeBadgeClass(grade)}`}>{grade}</Badge>
                                  ) : '—'}
                                </td>
                                <td className="px-4 py-3">
                                  {valid ? (
                                    <Badge
                                      className={`text-xs ${
                                        pass
                                          ? 'bg-green-100 text-green-800 border-green-200'
                                          : 'bg-red-100 text-red-800 border-red-200'
                                      }`}
                                    >
                                      {pass ? 'Pass' : 'Fail'}
                                    </Badge>
                                  ) : '—'}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => { setCsvPreviewRows([]); setShowCsvPreview(false); }}
                      >
                        Cancel
                      </Button>
                      <Button
                        size="sm"
                        disabled={saving}
                        onClick={handleCsvSave}
                        className="gap-2"
                      >
                        {saving ? (
                          <><Loader2 className="h-3.5 w-3.5 animate-spin" />Saving…</>
                        ) : (
                          <><CheckCircle className="h-3.5 w-3.5" />Confirm & Save Marks</>
                        )}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Section 3: Marks History ── */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Marks History
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Filters */}
          <div className="flex flex-wrap gap-3 items-center">
            <div className="flex-1 min-w-[200px] max-w-[300px]">
              <Select value={historyFilterModuleId} onValueChange={setHistoryFilterModuleId}>
                <SelectTrigger>
                  <SelectValue placeholder="All modules" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All modules</SelectItem>
                  {modules.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.moduleCode} — {m.moduleName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="w-[200px]">
              <Select value={historyFilterAssessment} onValueChange={setHistoryFilterAssessment}>
                <SelectTrigger>
                  <SelectValue placeholder="All assessments" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All assessments</SelectItem>
                  {historyAssessments.map((a) => (
                    <SelectItem key={a} value={a}>{a}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {(historyFilterModuleId !== 'all' || historyFilterAssessment !== 'all') && (
              <Button
                size="sm"
                variant="ghost"
                className="text-muted-foreground"
                onClick={() => {
                  setHistoryFilterModuleId('all');
                  setHistoryFilterAssessment('all');
                }}
              >
                Clear filters
              </Button>
            )}
          </div>

          {loadingHistory ? (
            <div className="flex items-center justify-center h-24">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : history.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              <Clock className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">No marks records found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-gray-50">
                    <th className="text-left font-medium text-muted-foreground px-4 py-3">Module</th>
                    <th className="text-left font-medium text-muted-foreground px-4 py-3">Student</th>
                    <th className="text-left font-medium text-muted-foreground px-4 py-3">Assessment</th>
                    <th className="text-center font-medium text-muted-foreground px-4 py-3">Mark</th>
                    <th className="text-center font-medium text-muted-foreground px-4 py-3">Grade</th>
                    <th className="text-center font-medium text-muted-foreground px-4 py-3">Status</th>
                    <th className="text-left font-medium text-muted-foreground px-4 py-3">Uploaded By</th>
                    <th className="text-left font-medium text-muted-foreground px-4 py-3">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((h) => (
                    <tr key={h.id} className="border-b last:border-0 hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="font-mono font-medium text-blue-700 text-xs">{h.moduleCode}</div>
                        <div className="text-xs text-muted-foreground">{h.moduleName}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium">{h.studentName}</div>
                        <div className="text-xs text-muted-foreground font-mono">{h.studentId}</div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">{h.assessmentComponent}</td>
                      <td className="px-4 py-3 text-center font-semibold">{h.mark}</td>
                      <td className="px-4 py-3 text-center">
                        <Badge className={`text-xs ${gradeBadgeClass(h.grade)}`}>{h.grade}</Badge>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <Badge
                          className={`text-xs ${
                            h.status === 'pass'
                              ? 'bg-green-100 text-green-800 border-green-200'
                              : 'bg-red-100 text-red-800 border-red-200'
                          }`}
                        >
                          {h.status === 'pass' ? 'Pass' : 'Fail'}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">{h.uploadedBy}</td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">{formatDate(h.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
