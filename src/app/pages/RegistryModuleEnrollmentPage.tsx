import { useState, useEffect, useMemo, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import { Label } from '../components/ui/label';
import { Checkbox } from '../components/ui/checkbox';
import {
  addDoc,
  getDocs,
  collection,
  serverTimestamp,
  query,
  where,
} from 'firebase/firestore';
import { db } from '../../firebase';
import { toast } from 'sonner';
import { useAuth } from '../AuthContext';
import { BookOpen, Users, Loader2, Upload, Download, ChevronDown, ChevronRight } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────
interface Module {
  id: string;
  moduleCode: string;
  moduleName: string;
  programme: string;
  semester: string;
  yearOfStudy: string;
  faculty: string;
  credits: number;
}

interface Student {
  docId: string;
  studentId: string;
  name: string;
  programme: string;
  level: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const LEVEL_TO_YEAR: Record<string, string> = {
  'Level 4': 'Year 1', 'Level 5': 'Year 2', 'Level 6': 'Year 3', 'Level 7': 'Year 4',
  '1st Year': 'Year 1', '2nd Year': 'Year 2', '3rd Year': 'Year 3', '4th Year': 'Year 4',
  'Year 1': 'Year 1', 'Year 2': 'Year 2', 'Year 3': 'Year 3', 'Year 4': 'Year 4',
  '1': 'Year 1', '2': 'Year 2', '3': 'Year 3', '4': 'Year 4',
};

// ─── Component ────────────────────────────────────────────────────────────────
export default function RegistryModuleEnrollmentPage() {
  const { user } = useAuth();

  // All modules (loaded once)
  const [allModules, setAllModules] = useState<Module[]>([]);
  const [loadingAllModules, setLoadingAllModules] = useState(true);

  // Cohort filters
  const [selectedFaculty, setSelectedFaculty] = useState('');
  const [selectedProgramme, setSelectedProgramme] = useState('');
  const [selectedYear, setSelectedYear] = useState('');
  const [selectedSemester, setSelectedSemester] = useState('');

  // Cohort data
  const [cohortStudents, setCohortStudents] = useState<Student[]>([]);
  const [cohortModules, setCohortModules] = useState<Module[]>([]);
  const [loadingCohort, setLoadingCohort] = useState(false);

  // Selected module IDs for enrollment (all by default after cohort loads)
  const [selectedModuleIds, setSelectedModuleIds] = useState<Set<string>>(new Set());

  // Existing enrolled pairs: "studentId::moduleId"
  const [enrolledPairs, setEnrolledPairs] = useState<Set<string>>(new Set());

  // Enroll progress
  const [enrolling, setEnrolling] = useState(false);
  const [enrollProgress, setEnrollProgress] = useState<{ current: number; total: number } | null>(null);

  // CSV section
  const [csvExpanded, setCsvExpanded] = useState(false);
  const [bulkUploading, setBulkUploading] = useState(false);
  const csvInputRef = useRef<HTMLInputElement>(null);

  // ── Derived filter options ────────────────────────────────────────────────
  const facultyOptions = useMemo(
    () => Array.from(new Set(allModules.map((m) => m.faculty).filter(Boolean))).sort(),
    [allModules]
  );

  const programmeOptions = useMemo(() => {
    if (!selectedFaculty) return [];
    return Array.from(
      new Set(allModules.filter((m) => m.faculty === selectedFaculty).map((m) => m.programme).filter(Boolean))
    ).sort();
  }, [allModules, selectedFaculty]);

  // ── Load all modules once ─────────────────────────────────────────────────
  useEffect(() => {
    getDocs(collection(db, 'modules'))
      .then((snap) => {
        setAllModules(
          snap.docs
            .map((d) => ({
              id: d.id,
              moduleCode: d.data().moduleCode ?? '',
              moduleName: d.data().moduleName ?? d.data().name ?? '',
              programme: d.data().programme ?? '',
              semester: d.data().semester ?? '',
              yearOfStudy: d.data().yearOfStudy ?? d.data().year ?? '',
              faculty: d.data().faculty ?? '',
              credits: d.data().credits ?? 0,
            }))
            .sort((a, b) => a.moduleCode.localeCompare(b.moduleCode))
        );
      })
      .catch(() => toast.error('Failed to load modules'))
      .finally(() => setLoadingAllModules(false));
  }, []);

  // ── Load cohort when all filters are selected ─────────────────────────────
  useEffect(() => {
    if (!selectedFaculty || !selectedProgramme || !selectedYear || !selectedSemester) {
      setCohortStudents([]);
      setCohortModules([]);
      setSelectedModuleIds(new Set());
      setEnrolledPairs(new Set());
      return;
    }

    const loadCohort = async () => {
      setLoadingCohort(true);
      try {
        // 1. Cohort modules from already-loaded allModules
        const mods = allModules.filter(
          (m) =>
            m.programme === selectedProgramme &&
            m.yearOfStudy === selectedYear &&
            (m.semester === selectedSemester ||
              m.semester === 'Semester 1 & 2' ||
              selectedSemester === 'Semester 1 & 2')
        );
        setCohortModules(mods);
        setSelectedModuleIds(new Set(mods.map((m) => m.id)));

        // 2. Cohort students: fetch by programme, filter by normalised year
        const studentsSnap = await getDocs(
          query(collection(db, 'students'), where('programme', '==', selectedProgramme))
        );
        const students: Student[] = [];
        studentsSnap.forEach((d) => {
          const data = d.data();
          const rawLevel = String(data.level ?? data.yearOfStudy ?? '').trim();
          const normYear = LEVEL_TO_YEAR[rawLevel] ?? rawLevel;
          if (normYear === selectedYear) {
            students.push({
              docId: d.id,
              studentId: String(data.studentId ?? '').trim(),
              name: data.name ?? '',
              programme: data.programme ?? '',
              level: rawLevel,
            });
          }
        });
        students.sort((a, b) => a.studentId.localeCompare(b.studentId));
        setCohortStudents(students);

        // 3. Existing enrollments for these modules (chunked 'in' queries)
        if (mods.length > 0) {
          const moduleIds = mods.map((m) => m.id);
          const pairs = new Set<string>();
          for (let i = 0; i < moduleIds.length; i += 30) {
            const chunk = moduleIds.slice(i, i + 30);
            const snap = await getDocs(
              query(collection(db, 'moduleEnrollments'), where('moduleId', 'in', chunk))
            );
            snap.forEach((d) => {
              pairs.add(`${d.data().studentId}::${d.data().moduleId}`);
            });
          }
          setEnrolledPairs(pairs);
        }
      } catch {
        toast.error('Failed to load cohort data');
      } finally {
        setLoadingCohort(false);
      }
    };

    loadCohort();
  }, [selectedFaculty, selectedProgramme, selectedYear, selectedSemester, allModules]);

  // ── Derived stats ─────────────────────────────────────────────────────────
  const studentEnrolledAny = useMemo(() => {
    const set = new Set<string>();
    enrolledPairs.forEach((pair) => set.add(pair.split('::')[0]));
    return set;
  }, [enrolledPairs]);

  const alreadyEnrolledCount = cohortStudents.filter((s) => studentEnrolledAny.has(s.studentId)).length;
  const pendingCount = cohortStudents.length - alreadyEnrolledCount;

  const selectedModulesArray = cohortModules.filter((m) => selectedModuleIds.has(m.id));

  const newEnrollmentCount = useMemo(() => {
    let count = 0;
    for (const s of cohortStudents) {
      for (const m of selectedModulesArray) {
        if (!enrolledPairs.has(`${s.studentId}::${m.id}`)) count++;
      }
    }
    return count;
  }, [cohortStudents, selectedModulesArray, enrolledPairs]);

  // ── Module checkbox helpers ───────────────────────────────────────────────
  const allModulesSelected =
    cohortModules.length > 0 && cohortModules.every((m) => selectedModuleIds.has(m.id));

  const toggleModule = (id: string) => {
    setSelectedModuleIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAllModules = () => {
    if (allModulesSelected) setSelectedModuleIds(new Set());
    else setSelectedModuleIds(new Set(cohortModules.map((m) => m.id)));
  };

  // ── Enroll all students in selected modules ───────────────────────────────
  const handleEnrollAll = async () => {
    if (cohortStudents.length === 0 || selectedModulesArray.length === 0) return;
    setEnrolling(true);
    setEnrollProgress({ current: 0, total: newEnrollmentCount });
    try {
      let done = 0;
      let skipped = 0;
      for (const student of cohortStudents) {
        for (const mod of selectedModulesArray) {
          const pairKey = `${student.studentId}::${mod.id}`;
          if (enrolledPairs.has(pairKey)) { skipped++; continue; }
          await addDoc(collection(db, 'moduleEnrollments'), {
            studentId: student.studentId,
            studentName: student.name,
            moduleId: mod.id,
            moduleCode: mod.moduleCode,
            moduleName: mod.moduleName,
            programme: selectedProgramme,
            faculty: selectedFaculty,
            yearOfStudy: selectedYear,
            semester: selectedSemester,
            enrolledBy: user?.name ?? 'Registry',
            enrolledAt: serverTimestamp(),
            status: 'active',
          });
          done++;
          setEnrollProgress({ current: done, total: newEnrollmentCount });
          setEnrolledPairs((prev) => new Set(prev).add(pairKey));
        }
      }
      const msg =
        skipped > 0
          ? `${done} enrollments created, ${skipped} already existed (skipped)`
          : `${done} enrollments created successfully`;
      toast.success(msg);
    } catch {
      toast.error('Failed to complete enrollment');
    } finally {
      setEnrolling(false);
      setEnrollProgress(null);
    }
  };

  // ── Bulk CSV ──────────────────────────────────────────────────────────────
  const downloadBulkTemplate = () => {
    const csv = 'studentId,moduleCode\nSTD001,BIS101\nSTD002,BIS101';
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'bulk_enrollment_template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleBulkCsvUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    setBulkUploading(true);
    try {
      const Papa = (await import('papaparse')).default;
      const text = await file.text();
      const { data } = Papa.parse<Record<string, string>>(text, { header: true, skipEmptyLines: true });

      const studentsSnap = await getDocs(collection(db, 'students'));
      const studentMap = new Map<string, { name: string; programme: string; level: string }>();
      studentsSnap.forEach((d) => {
        const sid = String(d.data().studentId ?? '').trim();
        if (sid)
          studentMap.set(sid, {
            name: d.data().name ?? '',
            programme: d.data().programme ?? '',
            level: String(d.data().level ?? d.data().yearOfStudy ?? ''),
          });
      });

      const moduleMap = new Map<string, Module>();
      allModules.forEach((m) => moduleMap.set(m.moduleCode.toUpperCase(), m));

      let enrolled = 0, duplicates = 0, notFound = 0;
      const errors: string[] = [];

      for (const row of data) {
        const sid = row.studentId?.trim();
        const code = row.moduleCode?.trim().toUpperCase();
        if (!sid || !code) { notFound++; errors.push('Row missing studentId or moduleCode'); continue; }
        const mod = moduleMap.get(code);
        if (!mod) { notFound++; errors.push(`Module not found: ${code}`); continue; }
        const student = studentMap.get(sid);
        if (!student) { notFound++; errors.push(`Student not found: ${sid}`); continue; }
        const existingSnap = await getDocs(
          query(collection(db, 'moduleEnrollments'), where('moduleId', '==', mod.id), where('studentId', '==', sid))
        );
        if (!existingSnap.empty) { duplicates++; continue; }
        await addDoc(collection(db, 'moduleEnrollments'), {
          moduleId: mod.id,
          moduleCode: mod.moduleCode,
          moduleName: mod.moduleName,
          studentId: sid,
          studentName: student.name,
          programme: student.programme,
          yearOfStudy: student.level,
          enrolledBy: user?.name ?? 'Registry',
          enrolledAt: serverTimestamp(),
          status: 'enrolled',
        });
        enrolled++;
      }

      const parts = [`${enrolled} enrolled`];
      if (duplicates > 0) parts.push(`${duplicates} duplicate${duplicates !== 1 ? 's' : ''} skipped`);
      if (notFound > 0) parts.push(`${notFound} not found`);
      toast.success(parts.join(', '));
      if (errors.length > 0) console.warn('Bulk enrollment errors:', errors);
    } catch (err) {
      console.error(err);
      toast.error('Failed to process CSV');
    } finally {
      setBulkUploading(false);
    }
  };

  const cohortReady = !!(selectedFaculty && selectedProgramme && selectedYear && selectedSemester);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Module Enrollment</h1>
        <p className="text-muted-foreground text-sm mt-1">Enroll student cohorts into modules</p>
      </div>

      {/* ── Step 1: Select Cohort ── */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base flex items-center gap-2">
            <BookOpen className="h-4 w-4" />
            Step 1 — Select Cohort
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-1.5">
              <Label>Faculty</Label>
              <Select
                value={selectedFaculty}
                onValueChange={(v) => {
                  setSelectedFaculty(v);
                  setSelectedProgramme('');
                  setSelectedYear('');
                  setSelectedSemester('');
                }}
                disabled={loadingAllModules}
              >
                <SelectTrigger>
                  <SelectValue placeholder={loadingAllModules ? 'Loading…' : '— Select faculty —'} />
                </SelectTrigger>
                <SelectContent>
                  {facultyOptions.map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Programme</Label>
              <Select
                value={selectedProgramme}
                onValueChange={(v) => { setSelectedProgramme(v); setSelectedYear(''); setSelectedSemester(''); }}
                disabled={!selectedFaculty}
              >
                <SelectTrigger><SelectValue placeholder="— Select programme —" /></SelectTrigger>
                <SelectContent>
                  {programmeOptions.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Year</Label>
              <Select
                value={selectedYear}
                onValueChange={(v) => { setSelectedYear(v); setSelectedSemester(''); }}
                disabled={!selectedProgramme}
              >
                <SelectTrigger><SelectValue placeholder="— Select year —" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Year 1">Year 1</SelectItem>
                  <SelectItem value="Year 2">Year 2</SelectItem>
                  <SelectItem value="Year 3">Year 3</SelectItem>
                  <SelectItem value="Year 4">Year 4</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Semester</Label>
              <Select
                value={selectedSemester}
                onValueChange={setSelectedSemester}
                disabled={!selectedYear}
              >
                <SelectTrigger><SelectValue placeholder="— Select semester —" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Semester 1">Semester 1</SelectItem>
                  <SelectItem value="Semester 2">Semester 2</SelectItem>
                  <SelectItem value="Semester 1 & 2">Semester 1 &amp; 2</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── KPI Cards ── */}
      {cohortReady && (
        <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
          <Card className="border-l-4 border-l-blue-500">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Students in Cohort</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-blue-600">
                {loadingCohort ? <Loader2 className="h-6 w-6 animate-spin" /> : cohortStudents.length}
              </div>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-purple-500">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Modules Available</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-purple-600">
                {loadingCohort ? <Loader2 className="h-6 w-6 animate-spin" /> : cohortModules.length}
              </div>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-green-500">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Already Enrolled</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-green-600">
                {loadingCohort ? <Loader2 className="h-6 w-6 animate-spin" /> : alreadyEnrolledCount}
              </div>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-amber-500">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Pending Enrollment</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-amber-600">
                {loadingCohort ? <Loader2 className="h-6 w-6 animate-spin" /> : pendingCount}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── Step 2: Students + Modules ── */}
      {cohortReady && (
        loadingCohort ? (
          <div className="flex items-center justify-center h-48">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* LEFT: Students */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    Students
                    <span className="text-muted-foreground font-normal text-sm ml-1">
                      — {cohortStudents.length} in cohort
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  {cohortStudents.length === 0 ? (
                    <div className="text-center py-10 text-muted-foreground px-4">
                      <Users className="h-10 w-10 mx-auto mb-3 opacity-30" />
                      <p className="text-sm">No students found for this cohort</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto max-h-96 overflow-y-auto">
                      <table className="w-full text-sm">
                        <thead className="sticky top-0 bg-gray-50 z-10">
                          <tr className="border-b">
                            <th className="text-left font-medium text-muted-foreground px-4 py-2.5">Student ID</th>
                            <th className="text-left font-medium text-muted-foreground px-4 py-2.5">Name</th>
                            <th className="text-left font-medium text-muted-foreground px-4 py-2.5">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {cohortStudents.map((s) => {
                            const isEnrolled = studentEnrolledAny.has(s.studentId);
                            return (
                              <tr key={s.docId} className="border-b last:border-0 hover:bg-gray-50">
                                <td className="px-4 py-2.5 font-mono text-xs">{s.studentId}</td>
                                <td className="px-4 py-2.5 font-medium">{s.name}</td>
                                <td className="px-4 py-2.5">
                                  {isEnrolled ? (
                                    <Badge className="bg-green-100 text-green-800 border-green-200 text-xs">
                                      Enrolled
                                    </Badge>
                                  ) : (
                                    <Badge variant="outline" className="text-xs text-muted-foreground">
                                      Not Enrolled
                                    </Badge>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* RIGHT: Modules */}
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base flex items-center gap-2">
                      <BookOpen className="h-4 w-4" />
                      Modules
                      <span className="text-muted-foreground font-normal text-sm ml-1">
                        — {cohortModules.length} available
                      </span>
                    </CardTitle>
                    {cohortModules.length > 0 && (
                      <Button variant="ghost" size="sm" className="text-xs h-7" onClick={toggleAllModules}>
                        {allModulesSelected ? 'Deselect All' : 'Select All'}
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  {cohortModules.length === 0 ? (
                    <div className="text-center py-10 text-muted-foreground px-4">
                      <BookOpen className="h-10 w-10 mx-auto mb-3 opacity-30" />
                      <p className="text-sm">No modules found for this cohort</p>
                    </div>
                  ) : (
                    <div className="max-h-96 overflow-y-auto">
                      {cohortModules.map((m) => (
                        <div
                          key={m.id}
                          className="flex items-center gap-3 px-4 py-3 border-b last:border-0 hover:bg-gray-50"
                        >
                          <Checkbox
                            checked={selectedModuleIds.has(m.id)}
                            onCheckedChange={() => toggleModule(m.id)}
                            id={`mod-${m.id}`}
                          />
                          <label htmlFor={`mod-${m.id}`} className="flex-1 cursor-pointer min-w-0">
                            <span className="font-mono text-xs text-blue-700 mr-2">{m.moduleCode}</span>
                            <span className="font-medium text-sm">{m.moduleName}</span>
                          </label>
                          {m.credits > 0 && (
                            <span className="text-xs text-muted-foreground shrink-0">{m.credits} cr</span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* ── Enroll button ── */}
            {cohortStudents.length > 0 && selectedModulesArray.length > 0 && (
              <Card className="border-blue-200 bg-blue-50/40">
                <CardContent className="pt-5 pb-5">
                  <div className="flex items-center justify-between gap-4 flex-wrap">
                    <div>
                      <p className="font-medium text-sm">
                        Ready to enroll {cohortStudents.length} student{cohortStudents.length !== 1 ? 's' : ''} in {selectedModulesArray.length} selected module{selectedModulesArray.length !== 1 ? 's' : ''}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {newEnrollmentCount} new enrollment{newEnrollmentCount !== 1 ? 's' : ''} will be created
                        {cohortStudents.length * selectedModulesArray.length - newEnrollmentCount > 0
                          ? `, ${cohortStudents.length * selectedModulesArray.length - newEnrollmentCount} already exist (will be skipped)`
                          : ''}
                      </p>
                    </div>
                    <Button
                      onClick={handleEnrollAll}
                      disabled={enrolling || newEnrollmentCount === 0}
                      className="gap-2 min-w-[240px]"
                    >
                      {enrolling ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          {enrollProgress
                            ? `Enrolling… ${enrollProgress.current}/${enrollProgress.total}`
                            : 'Enrolling…'}
                        </>
                      ) : newEnrollmentCount === 0 ? (
                        'All already enrolled'
                      ) : (
                        `Enroll ${cohortStudents.length} Students in ${selectedModulesArray.length} Module${selectedModulesArray.length !== 1 ? 's' : ''}`
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )
      )}

      {/* ── Advanced: Manual CSV Upload ── */}
      <Card>
        <CardHeader
          className="pb-3 cursor-pointer select-none"
          onClick={() => setCsvExpanded((v) => !v)}
        >
          <div className="flex items-center gap-2">
            {csvExpanded
              ? <ChevronDown className="h-4 w-4 text-muted-foreground" />
              : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Advanced: Manual CSV Upload
            </CardTitle>
          </div>
        </CardHeader>
        {csvExpanded && (
          <CardContent className="pt-0">
            <p className="text-sm text-muted-foreground mb-3">
              Upload a CSV with columns{' '}
              <code className="bg-gray-100 px-1 rounded text-xs">studentId</code> and{' '}
              <code className="bg-gray-100 px-1 rounded text-xs">moduleCode</code> to enroll
              individual student–module pairs.
            </p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="gap-1.5" onClick={downloadBulkTemplate}>
                <Download className="h-4 w-4" />
                CSV Template
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5"
                disabled={bulkUploading}
                onClick={() => csvInputRef.current?.click()}
              >
                {bulkUploading ? (
                  <><Loader2 className="h-4 w-4 animate-spin" />Processing…</>
                ) : (
                  <><Upload className="h-4 w-4" />Upload CSV</>
                )}
              </Button>
              <input
                ref={csvInputRef}
                type="file"
                accept=".csv"
                className="hidden"
                onChange={handleBulkCsvUpload}
              />
            </div>
          </CardContent>
        )}
      </Card>
    </div>
  );
}
