import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
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
  deleteDoc,
  doc,
  collection,
  serverTimestamp,
  query,
  where,
} from 'firebase/firestore';
import { db } from '../../firebase';
import { toast } from 'sonner';
import { useAuth } from '../AuthContext';
import { BookOpen, Users, Loader2, Trash2, GraduationCap, Upload, Download } from 'lucide-react';

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
  status: string;
}

interface Enrollment {
  docId: string;
  studentId: string;
  studentName: string;
  programme: string;
  yearOfStudy: string;
  enrolledAt: string;
  enrolledBy: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Normalise any student level/year format to "Year N" to match module yearOfStudy
const LEVEL_TO_YEAR: Record<string, string> = {
  // Level format (RegistryStudentsPage edit form)
  'Level 4': 'Year 1',
  'Level 5': 'Year 2',
  'Level 6': 'Year 3',
  'Level 7': 'Year 4',
  // Ordinal format
  '1st Year': 'Year 1',
  '2nd Year': 'Year 2',
  '3rd Year': 'Year 3',
  '4th Year': 'Year 4',
  // Already correct
  'Year 1': 'Year 1',
  'Year 2': 'Year 2',
  'Year 3': 'Year 3',
  'Year 4': 'Year 4',
  // Number only
  '1': 'Year 1',
  '2': 'Year 2',
  '3': 'Year 3',
  '4': 'Year 4',
};

const formatDate = (dateStr: string) => {
  if (!dateStr) return '—';
  try {
    return new Date(dateStr).toLocaleDateString('en-GB', {
      day: 'numeric', month: 'short', year: 'numeric',
    });
  } catch {
    return dateStr;
  }
};

// ─── Component ────────────────────────────────────────────────────────────────
export default function RegistryModuleEnrollmentPage() {
  const { user } = useAuth();

  // Section 1 — filters + module selection
  const [modules, setModules] = useState<Module[]>([]);
  const [loadingModules, setLoadingModules] = useState(true);
  const [selectedFaculty, setSelectedFaculty] = useState('');
  const [selectedProgramme, setSelectedProgramme] = useState('');
  const [selectedYear, setSelectedYear] = useState('');
  const [selectedSemester, setSelectedSemester] = useState('');
  const [selectedModuleId, setSelectedModuleId] = useState('');

  // Section 2 — eligible students
  const [eligibleStudents, setEligibleStudents] = useState<Student[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(false);

  // Enrollments for selected module
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [loadingEnrollments, setLoadingEnrollments] = useState(false);

  // Checkbox selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Save / remove state
  const [enrolling, setEnrolling] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);

  // Bulk CSV upload
  const [bulkUploading, setBulkUploading] = useState(false);
  const csvInputRef = useRef<HTMLInputElement>(null);

  // Unique faculties from loaded modules
  const facultyOptions = useMemo(
    () => Array.from(new Set(modules.map((m) => m.faculty).filter(Boolean))).sort(),
    [modules]
  );

  // Unique programmes filtered by selected faculty
  const programmeOptions = useMemo(() => {
    if (!selectedFaculty) return [];
    return Array.from(
      new Set(modules.filter((m) => m.faculty === selectedFaculty).map((m) => m.programme).filter(Boolean))
    ).sort();
  }, [modules, selectedFaculty]);

  // Filter modules by all active filters
  const filteredModules = useMemo(
    () =>
      modules.filter(
        (m) =>
          (!selectedFaculty || m.faculty === selectedFaculty) &&
          (!selectedProgramme || m.programme === selectedProgramme) &&
          (!selectedYear || m.yearOfStudy === selectedYear) &&
          (!selectedSemester || m.semester === selectedSemester)
      ),
    [modules, selectedFaculty, selectedProgramme, selectedYear, selectedSemester]
  );

  const selectedModule = modules.find((m) => m.id === selectedModuleId) ?? null;

  // ── Load modules ──────────────────────────────────────────────────────────
  useEffect(() => {
    getDocs(collection(db, 'modules'))
      .then((snap) => {
        const mods = snap.docs
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
          .sort((a, b) => a.moduleCode.localeCompare(b.moduleCode));
        setModules(mods);
      })
      .catch(() => toast.error('Failed to load modules'))
      .finally(() => setLoadingModules(false));
  }, []);

  // ── Load enrollments for selected module ──────────────────────────────────
  const loadEnrollments = useCallback(async (moduleId: string) => {
    if (!moduleId) return;
    setLoadingEnrollments(true);
    try {
      const snap = await getDocs(
        query(collection(db, 'moduleEnrollments'), where('moduleId', '==', moduleId))
      );
      setEnrollments(
        snap.docs.map((d) => ({
          docId: d.id,
          studentId: d.data().studentId ?? '',
          studentName: d.data().studentName ?? '',
          programme: d.data().programme ?? '',
          yearOfStudy: String(d.data().yearOfStudy ?? ''),
          enrolledAt: d.data().enrolledAt?.toDate?.().toISOString() ?? '',
          enrolledBy: d.data().enrolledBy ?? '',
        }))
      );
    } catch {
      toast.error('Failed to load enrollments');
    } finally {
      setLoadingEnrollments(false);
    }
  }, []);

  // ── Load eligible students when module changes ────────────────────────────
  useEffect(() => {
    if (!selectedModuleId || !selectedModule) {
      setEligibleStudents([]);
      setEnrollments([]);
      setSelectedIds(new Set());
      return;
    }

    setLoadingStudents(true);
    setSelectedIds(new Set());

    getDocs(collection(db, 'students'))
      .then((snap) => {
        const students: Student[] = [];
        snap.forEach((d) => {
          const data = d.data();
          const studentProgramme = String(data.programme ?? '').trim();
          const rawLevel = String(data.level ?? data.yearOfStudy ?? '').trim();
          const studentYear = LEVEL_TO_YEAR[rawLevel] ?? rawLevel;

          const programmeMatch = !selectedModule.programme || studentProgramme === selectedModule.programme;
          const yearMatch = !selectedModule.yearOfStudy || studentYear === selectedModule.yearOfStudy;

          if (programmeMatch && yearMatch) {
            students.push({
              docId: d.id,
              studentId: String(data.studentId ?? '').trim(),
              name: data.name ?? '',
              programme: data.programme ?? '',
              level: String(data.level ?? data.yearOfStudy ?? ''),
              status: data.status ?? 'active',
            });
          }
        });

        students.sort((a, b) => a.studentId.localeCompare(b.studentId));
        setEligibleStudents(students);
      })
      .catch(() => toast.error('Failed to load students'))
      .finally(() => setLoadingStudents(false));

    loadEnrollments(selectedModuleId);
  }, [selectedModuleId, selectedModule, loadEnrollments]);

  const enrolledIds = new Set(enrollments.map((e) => e.studentId));
  const unenrolledEligible = eligibleStudents.filter((s) => !enrolledIds.has(s.studentId));

  // ── Checkbox helpers ──────────────────────────────────────────────────────
  const allSelected =
    unenrolledEligible.length > 0 &&
    unenrolledEligible.every((s) => selectedIds.has(s.studentId));

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(unenrolledEligible.map((s) => s.studentId)));
    }
  };

  const toggleStudent = (studentId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(studentId)) next.delete(studentId);
      else next.add(studentId);
      return next;
    });
  };

  // ── Enroll selected ───────────────────────────────────────────────────────
  const handleEnroll = async () => {
    if (!selectedModule || selectedIds.size === 0) return;
    setEnrolling(true);
    try {
      const studentsToEnroll = eligibleStudents.filter((s) => selectedIds.has(s.studentId));
      let enrolled = 0;
      let skipped = 0;

      await Promise.all(
        studentsToEnroll.map(async (student) => {
          if (enrolledIds.has(student.studentId)) {
            skipped++;
            return;
          }
          await addDoc(collection(db, 'moduleEnrollments'), {
            moduleId: selectedModule.id,
            moduleCode: selectedModule.moduleCode,
            moduleName: selectedModule.moduleName,
            studentId: student.studentId,
            studentName: student.name,
            programme: student.programme,
            yearOfStudy: student.level,
            enrolledBy: user?.name ?? 'Registry',
            enrolledAt: serverTimestamp(),
            status: 'enrolled',
          });
          enrolled++;
        })
      );

      const msg =
        skipped > 0
          ? `${enrolled} students enrolled in ${selectedModule.moduleName}, ${skipped} already enrolled (skipped)`
          : `${enrolled} students enrolled in ${selectedModule.moduleName}`;
      toast.success(msg);

      setSelectedIds(new Set());
      await loadEnrollments(selectedModuleId);
    } catch {
      toast.error('Failed to enroll students');
    } finally {
      setEnrolling(false);
    }
  };

  // ── Bulk CSV download template ────────────────────────────────────────────
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

  // ── Bulk CSV upload ────────────────────────────────────────────────────────
  const handleBulkCsvUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Reset so same file can be re-uploaded
    e.target.value = '';

    setBulkUploading(true);
    try {
      const Papa = (await import('papaparse')).default;
      const text = await file.text();
      const { data } = Papa.parse<Record<string, string>>(text, { header: true, skipEmptyLines: true });

      // Pre-fetch all students once for lookup
      const studentsSnap = await getDocs(collection(db, 'students'));
      const studentMap = new Map<string, { name: string; programme: string; level: string }>();
      studentsSnap.forEach((d) => {
        const sid = String(d.data().studentId ?? '').trim();
        if (sid) studentMap.set(sid, { name: d.data().name ?? '', programme: d.data().programme ?? '', level: String(d.data().level ?? d.data().yearOfStudy ?? '') });
      });

      // Module lookup from already-loaded modules state
      const moduleMap = new Map<string, Module>();
      modules.forEach((m) => moduleMap.set(m.moduleCode.toUpperCase(), m));

      let enrolled = 0;
      let duplicates = 0;
      let notFound = 0;
      const errors: string[] = [];

      for (const row of data) {
        const sid = row.studentId?.trim();
        const code = row.moduleCode?.trim().toUpperCase();
        if (!sid || !code) { notFound++; errors.push(`Row missing studentId or moduleCode`); continue; }

        const mod = moduleMap.get(code);
        if (!mod) { notFound++; errors.push(`Module not found: ${code}`); continue; }

        const student = studentMap.get(sid);
        if (!student) { notFound++; errors.push(`Student not found: ${sid}`); continue; }

        // Check existing enrollment
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

      // Refresh enrollments if a module is selected
      if (selectedModuleId) await loadEnrollments(selectedModuleId);
    } catch (err) {
      console.error(err);
      toast.error('Failed to process CSV');
    } finally {
      setBulkUploading(false);
    }
  };

  // ── Remove enrollment ─────────────────────────────────────────────────────
  const handleRemove = async (enrollment: Enrollment) => {
    setRemoving(enrollment.docId);
    try {
      await deleteDoc(doc(db, 'moduleEnrollments', enrollment.docId));
      toast.success(`${enrollment.studentName} removed from ${selectedModule?.moduleName}`);
      await loadEnrollments(selectedModuleId);
    } catch {
      toast.error('Failed to remove enrollment');
    } finally {
      setRemoving(null);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Module Enrollment</h1>
          <p className="text-muted-foreground text-sm mt-1">Assign students to their modules</p>
        </div>
        <div className="flex gap-2 items-center">
          <Button variant="outline" size="sm" className="gap-1.5" onClick={downloadBulkTemplate}>
            <Download className="h-4 w-4" />
            CSV Template
          </Button>
          <Button
            size="sm"
            className="gap-1.5"
            disabled={bulkUploading}
            onClick={() => csvInputRef.current?.click()}
          >
            {bulkUploading ? (
              <><Loader2 className="h-4 w-4 animate-spin" />Processing…</>
            ) : (
              <><Upload className="h-4 w-4" />Bulk Enroll via CSV</>
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
      </div>

      {/* ── Section 1: Select Module ── */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base flex items-center gap-2">
            <BookOpen className="h-4 w-4" />
            Select Module
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {/* Faculty filter */}
            <div className="space-y-1.5">
              <Label>Faculty</Label>
              <Select
                value={selectedFaculty}
                onValueChange={(v) => {
                  setSelectedFaculty(v);
                  setSelectedProgramme('');
                  setSelectedYear('');
                  setSelectedSemester('');
                  setSelectedModuleId('');
                }}
                disabled={loadingModules}
              >
                <SelectTrigger>
                  <SelectValue placeholder={loadingModules ? 'Loading…' : '— Select faculty —'} />
                </SelectTrigger>
                <SelectContent>
                  {facultyOptions.map((f) => (
                    <SelectItem key={f} value={f}>{f}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Programme filter */}
            <div className="space-y-1.5">
              <Label>Programme</Label>
              <Select
                value={selectedProgramme}
                onValueChange={(v) => {
                  setSelectedProgramme(v);
                  setSelectedYear('');
                  setSelectedSemester('');
                  setSelectedModuleId('');
                }}
                disabled={!selectedFaculty}
              >
                <SelectTrigger>
                  <SelectValue placeholder="— Select programme —" />
                </SelectTrigger>
                <SelectContent>
                  {programmeOptions.map((p) => (
                    <SelectItem key={p} value={p}>{p}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Year filter */}
            <div className="space-y-1.5">
              <Label>Year</Label>
              <Select
                value={selectedYear}
                onValueChange={(v) => {
                  setSelectedYear(v);
                  setSelectedSemester('');
                  setSelectedModuleId('');
                }}
                disabled={!selectedProgramme}
              >
                <SelectTrigger>
                  <SelectValue placeholder="— Select year —" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Year 1">Year 1</SelectItem>
                  <SelectItem value="Year 2">Year 2</SelectItem>
                  <SelectItem value="Year 3">Year 3</SelectItem>
                  <SelectItem value="Year 4">Year 4</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Semester filter */}
            <div className="space-y-1.5">
              <Label>Semester</Label>
              <Select
                value={selectedSemester}
                onValueChange={(v) => {
                  setSelectedSemester(v);
                  setSelectedModuleId('');
                }}
                disabled={!selectedYear}
              >
                <SelectTrigger>
                  <SelectValue placeholder="— Select semester —" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Semester 1">Semester 1</SelectItem>
                  <SelectItem value="Semester 2">Semester 2</SelectItem>
                  <SelectItem value="Semester 1 & 2">Semester 1 &amp; 2</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Module dropdown */}
            <div className="space-y-1.5">
              <Label>Module</Label>
              <Select
                value={selectedModuleId}
                onValueChange={setSelectedModuleId}
                disabled={loadingModules || !selectedSemester}
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={
                      !selectedSemester
                        ? 'Select filters first'
                        : filteredModules.length === 0
                        ? 'No modules found'
                        : '— Select module —'
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {filteredModules.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.moduleCode} — {m.moduleName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Module details card */}
          {selectedModule && (
            <div className="rounded-lg border bg-gray-50 p-4 grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
              <div>
                <p className="text-xs text-muted-foreground">Module Code</p>
                <p className="font-semibold mt-0.5">{selectedModule.moduleCode || '—'}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Module Name</p>
                <p className="font-semibold mt-0.5">{selectedModule.moduleName || '—'}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Programme</p>
                <p className="font-semibold mt-0.5">{selectedModule.programme || '—'}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Year</p>
                <p className="font-semibold mt-0.5">{selectedModule.yearOfStudy || '—'}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Semester</p>
                <p className="font-semibold mt-0.5">{selectedModule.semester || '—'}</p>
              </div>
              {selectedModule.credits > 0 && (
                <div>
                  <p className="text-xs text-muted-foreground">Credits</p>
                  <p className="font-semibold mt-0.5">{selectedModule.credits}</p>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Section 2: Eligible Students ── */}
      {selectedModuleId && (
        <Card>
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Users className="h-4 w-4" />
                Eligible Students
                {!loadingStudents && (
                  <span className="text-muted-foreground font-normal text-sm ml-1">
                    — {eligibleStudents.length} students eligible for this module
                  </span>
                )}
              </CardTitle>

              {!loadingStudents && !loadingEnrollments && selectedIds.size > 0 && (
                <Button onClick={handleEnroll} disabled={enrolling} className="gap-2">
                  {enrolling ? (
                    <><Loader2 className="h-4 w-4 animate-spin" />Enrolling…</>
                  ) : (
                    `Enroll Selected (${selectedIds.size})`
                  )}
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {loadingStudents || loadingEnrollments ? (
              <div className="flex items-center justify-center h-24">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : eligibleStudents.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground">
                <Users className="h-10 w-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm">No students match this module's programme and year</p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-md border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b">
                      <th className="px-4 py-3 w-10">
                        <Checkbox
                          checked={allSelected}
                          onCheckedChange={toggleSelectAll}
                          aria-label="Select all unenrolled students"
                        />
                      </th>
                      <th className="text-left font-medium text-muted-foreground px-4 py-3">
                        Student ID
                      </th>
                      <th className="text-left font-medium text-muted-foreground px-4 py-3">
                        Name
                      </th>
                      <th className="text-left font-medium text-muted-foreground px-4 py-3 hidden sm:table-cell">
                        Programme
                      </th>
                      <th className="text-left font-medium text-muted-foreground px-4 py-3 hidden sm:table-cell">
                        Year
                      </th>
                      <th className="text-left font-medium text-muted-foreground px-4 py-3">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {eligibleStudents.map((student) => {
                      const isEnrolled = enrolledIds.has(student.studentId);
                      return (
                        <tr
                          key={student.docId}
                          className={`border-b last:border-0 transition-colors ${
                            isEnrolled ? 'bg-green-50/40' : 'hover:bg-gray-50'
                          }`}
                        >
                          <td className="px-4 py-3">
                            <Checkbox
                              checked={selectedIds.has(student.studentId)}
                              onCheckedChange={() =>
                                !isEnrolled && toggleStudent(student.studentId)
                              }
                              disabled={isEnrolled}
                              aria-label={`Select ${student.name}`}
                            />
                          </td>
                          <td className="px-4 py-3 font-mono text-xs">{student.studentId}</td>
                          <td className="px-4 py-3 font-medium">{student.name}</td>
                          <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell">
                            {student.programme || '—'}
                          </td>
                          <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell">
                            {student.level || '—'}
                          </td>
                          <td className="px-4 py-3">
                            {isEnrolled ? (
                              <Badge className="bg-green-100 text-green-800 border-green-200 text-xs">
                                Enrolled
                              </Badge>
                            ) : (
                              <Badge
                                variant="outline"
                                className="text-xs text-muted-foreground"
                              >
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
      )}

      {/* ── Section 4: Currently Enrolled ── */}
      {selectedModuleId && (
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-base flex items-center gap-2">
              <GraduationCap className="h-4 w-4" />
              Currently Enrolled
              {!loadingEnrollments && enrollments.length > 0 && (
                <span className="text-muted-foreground font-normal text-sm ml-1">
                  — {enrollments.length} student{enrollments.length !== 1 ? 's' : ''}
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loadingEnrollments ? (
              <div className="flex items-center justify-center h-24">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : enrollments.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground">
                <GraduationCap className="h-10 w-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm">No students enrolled in this module yet</p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-md border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b">
                      <th className="text-left font-medium text-muted-foreground px-4 py-3">
                        Student ID
                      </th>
                      <th className="text-left font-medium text-muted-foreground px-4 py-3">
                        Name
                      </th>
                      <th className="text-left font-medium text-muted-foreground px-4 py-3 hidden sm:table-cell">
                        Programme
                      </th>
                      <th className="text-left font-medium text-muted-foreground px-4 py-3 hidden sm:table-cell">
                        Year
                      </th>
                      <th className="text-left font-medium text-muted-foreground px-4 py-3">
                        Enrolled Date
                      </th>
                      <th className="text-left font-medium text-muted-foreground px-4 py-3">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {enrollments.map((enrollment) => (
                      <tr
                        key={enrollment.docId}
                        className="border-b last:border-0 hover:bg-gray-50 transition-colors"
                      >
                        <td className="px-4 py-3 font-mono text-xs">{enrollment.studentId}</td>
                        <td className="px-4 py-3 font-medium">{enrollment.studentName}</td>
                        <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell">
                          {enrollment.programme || '—'}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell">
                          {enrollment.yearOfStudy || '—'}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {formatDate(enrollment.enrolledAt)}
                        </td>
                        <td className="px-4 py-3">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 w-8 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                            disabled={removing === enrollment.docId}
                            onClick={() => handleRemove(enrollment)}
                            aria-label="Remove enrollment"
                          >
                            {removing === enrollment.docId ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Trash2 className="h-3.5 w-3.5" />
                            )}
                          </Button>
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
