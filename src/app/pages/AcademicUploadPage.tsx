import { useState, useEffect } from 'react';
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
import { Input } from '../components/ui/input';
import {
  setDoc,
  getDocs,
  updateDoc,
  doc,
  collection,
  serverTimestamp,
  query,
  where,
  limit,
  arrayUnion,
} from 'firebase/firestore';
import { db } from '../../firebase';
import { toast } from 'sonner';
import { useAuth } from '../AuthContext';
import {
  Upload,
  Download,
  Loader2,
  Users,
  BookOpen,
  CheckCircle,
} from 'lucide-react';

// ─── Recalculate per-module + overall attendance + consecutive absences ────────
async function recalculateStudentAttendance(
  studentDocId: string,
  studentId: string,
  moduleId: string,
  gpa: number
): Promise<void> {
  // 1. Per-module attendance for this specific module
  const moduleAttSnap = await getDocs(
    query(
      collection(db, 'attendance'),
      where('studentId', '==', studentId),
      where('moduleId', '==', moduleId)
    )
  );
  const moduleSessions = moduleAttSnap.docs.map((d) => d.data());
  const totalModSessions = moduleSessions.length;
  const presentModSessions = moduleSessions.filter((s) => s.status === 'present').length;
  const moduleAttendancePct = totalModSessions > 0
    ? Math.round((presentModSessions / totalModSessions) * 100)
    : 0;

  // 2. Overall attendance as average of per-module rates across ALL modules
  const allAttSnap = await getDocs(
    query(collection(db, 'attendance'), where('studentId', '==', studentId))
  );
  const allSessions = allAttSnap.docs.map(
    (d) => d.data() as { moduleId: string; status: string; date: string }
  );

  const byModule: Record<string, { present: number; total: number }> = {};
  allSessions.forEach((s) => {
    if (!byModule[s.moduleId]) byModule[s.moduleId] = { present: 0, total: 0 };
    byModule[s.moduleId].total++;
    if (s.status === 'present') byModule[s.moduleId].present++;
  });
  const moduleRates = Object.values(byModule).map((m) => m.present / m.total);
  const overallAttendance = moduleRates.length > 0
    ? Math.round((moduleRates.reduce((a, b) => a + b, 0) / moduleRates.length) * 100)
    : 0;

  // 3. Consecutive absences: most recent unbroken absent streak across all modules
  const sorted = [...allSessions].sort((a, b) => b.date.localeCompare(a.date));
  let consecutiveAbsences = 0;
  for (const r of sorted) {
    if (r.status === 'absent') consecutiveAbsences++;
    else break;
  }

  await updateDoc(doc(db, 'students', studentDocId), {
    attendancePercentage: overallAttendance,
    [`moduleAttendance.${moduleId}`]: moduleAttendancePct,
    consecutiveAbsences,
    attendance_by_semester: arrayUnion(
      Math.round((overallAttendance / 100) * 10000) / 10000
    ),
  });
}

// ─── Types ────────────────────────────────────────────────────────────────────
interface Module {
  id: string;
  moduleCode: string;
  moduleName: string;
  faculty: string;
  programme: string;
  yearOfStudy: string;
  semester: string;
}

interface EnrolledStudent {
  studentDocId: string;
  studentId: string;
  name: string;
  programme: string;
  gpa: number;
}

type AttendanceStatus = 'present' | 'absent' | null;

// ─── Helpers ──────────────────────────────────────────────────────────────────
const todayStr = () => new Date().toISOString().split('T')[0];

const SESSION_TYPES = ['Lecture', 'Tutorial', 'Lab', 'Seminar'];

const formatDate = (d: string) => {
  if (!d) return '—';
  try {
    return new Date(d + 'T00:00:00').toLocaleDateString('en-GB', {
      day: 'numeric', month: 'short', year: 'numeric',
    });
  } catch {
    return d;
  }
};

// ─── Deterministic attendance document ID ─────────────────────────────────────
// Same student + module + date + sessionType always maps to the same Firestore doc,
// so setDoc naturally prevents duplicates.
function makeAttendanceDocId(
  studentId: string,
  moduleId: string,
  date: string,
  sessionType: string
): string {
  return `${studentId}_${moduleId}_${date}_${sessionType.replace(/\s+/g, '_')}`;
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function AcademicUploadPage() {
  const { user } = useAuth();

  // Section 1 — module & session
  const [modules, setModules] = useState<Module[]>([]);
  const [loadingModules, setLoadingModules] = useState(true);
  const [selectedModuleId, setSelectedModuleId] = useState('');
  const [sessionDate, setSessionDate] = useState(todayStr());
  const [sessionType, setSessionType] = useState('Lecture');
  const [filterProgramme, setFilterProgramme] = useState('all');
  const [filterYear, setFilterYear] = useState('all');
  const [filterSemester, setFilterSemester] = useState('all');

  // Section 2 — attendance table
  const [enrolledStudents, setEnrolledStudents] = useState<EnrolledStudent[]>([]);
  const [attendanceMap, setAttendanceMap] = useState<Map<string, AttendanceStatus>>(new Map());
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [studentsLoaded, setStudentsLoaded] = useState(false);
  const [entryMode, setEntryMode] = useState<'manual' | 'csv'>('csv');
  const [csvProcessing, setCsvProcessing] = useState(false);

  // Section 3 — save
  const [saving, setSaving] = useState(false);
  const [overwriteConfirmPending, setOverwriteConfirmPending] = useState(false);

  // Academic year and semester for attendance tagging
  const [attAcademicYear, setAttAcademicYear] = useState('2025/2026');
  const [attSemester, setAttSemester] = useState('Semester 1');

  // Faculty admin profile
  const [adminFaculty, setAdminFaculty] = useState('');
  const [loadingAdmin, setLoadingAdmin] = useState(true);

  // Section 5 — bulk session upload
  const [sessionMode, setSessionMode] = useState<'single' | 'bulk'>('bulk');
  const [bulkCsvRows, setBulkCsvRows] = useState<Array<{ studentId: string; sessionDate: string; sessionType: string; status: 'present' | 'absent' }>>([]);
  const [bulkSessionHeaders, setBulkSessionHeaders] = useState<Array<{ label: string; date: string; sessionType: string }>>([]);
  const [bulkCsvProcessing, setBulkCsvProcessing] = useState(false);
  const [bulkSaving, setBulkSaving] = useState(false);

  // ── Load faculty admin profile ───────────────────────────────────────────────
  useEffect(() => {
    if (!user?.email) { setLoadingAdmin(false); return; }
    getDocs(
      query(collection(db, 'faculty_administrators'), where('email', '==', user.email))
    )
      .then((snap) => {
        if (!snap.empty) {
          const data = snap.docs[0].data();
          setAdminFaculty(data.faculty ?? data.department ?? '');
        }
      })
      .catch(() => {})
      .finally(() => setLoadingAdmin(false));
  }, [user?.email]);

  // ── Load modules ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (loadingAdmin) return;
    setFilterProgramme('all');
    setFilterYear('all');
    setFilterSemester('all');
    setSelectedModuleId('');
    getDocs(collection(db, 'modules'))
      .then((snap) => {
        const mods = snap.docs
          .map((d) => ({
            id: d.id,
            moduleCode: d.data().moduleCode ?? '',
            moduleName: d.data().moduleName ?? d.data().name ?? '',
            faculty: d.data().faculty ?? '',
            programme: d.data().programme ?? '',
            yearOfStudy: d.data().yearOfStudy ?? d.data().year ?? '',
            semester: d.data().semester ?? '',
          }))
          .filter((m) => !adminFaculty || m.faculty === adminFaculty)
          .sort((a, b) => a.moduleCode.localeCompare(b.moduleCode));
        setModules(mods);
      })
      .catch(() => toast.error('Failed to load modules'))
      .finally(() => setLoadingModules(false));
  }, [loadingAdmin, adminFaculty]);

  // ── Load enrolled students ──────────────────────────────────────────────────
  const handleLoadStudents = async () => {
    if (!selectedModuleId) {
      toast.error('Please select a module first');
      return;
    }
    setLoadingStudents(true);
    setStudentsLoaded(false);
    setEnrolledStudents([]);
    setAttendanceMap(new Map());

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

      const enrolledIds = new Set<string>(
        enrollSnap.docs
          .map((d) => String(d.data().studentId ?? '').trim())
          .filter(Boolean)
      );

      const studentMap = new Map<string, { docId: string; name: string; programme: string; gpa: number }>();
      studentsSnap.forEach((d) => {
        const sid = String(d.data().studentId ?? '').trim();
        if (sid) {
          studentMap.set(sid, {
            docId: d.id,
            name: d.data().name ?? '',
            programme: d.data().programme ?? '',
            gpa: d.data().gpa ?? 0,
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
            gpa: s.gpa,
          });
        }
      });
      students.sort((a, b) => a.studentId.localeCompare(b.studentId));

      setEnrolledStudents(students);
      const map = new Map<string, AttendanceStatus>();
      students.forEach((s) => map.set(s.studentId, null));
      setAttendanceMap(map);
      setStudentsLoaded(true);

      if (students.length === 0) {
        toast.warning('Enrolled student IDs did not match any students in the system');
      } else {
        toast.success(`Loaded ${students.length} students`);
      }
    } catch {
      toast.error('Failed to load students');
    } finally {
      setLoadingStudents(false);
    }
  };

  // ── Mark all ────────────────────────────────────────────────────────────────
  const markAll = (status: AttendanceStatus) => {
    setAttendanceMap((prev) => {
      const next = new Map(prev);
      enrolledStudents.forEach((s) => next.set(s.studentId, status));
      return next;
    });
  };

  // ── Status summary ──────────────────────────────────────────────────────────
  const counts = enrolledStudents.reduce(
    (acc, s) => {
      const st = attendanceMap.get(s.studentId);
      if (st === 'present') acc.present++;
      else if (st === 'absent') acc.absent++;
      else acc.unmarked++;
      return acc;
    },
    { present: 0, absent: 0, unmarked: 0 }
  );
  const unmarkedCount = counts.unmarked;

  // ── Module filter derived values ─────────────────────────────────────────────
  const programmeOptions = [...new Set(modules.map((m) => m.programme).filter(Boolean))].sort();
  const yearOptions = ['1st Year', '2nd Year', '3rd Year', '4th Year'];
  const semesterOptions = ['Semester 1', 'Semester 2'];

  const YEAR_MAP: Record<string, string[]> = {
    '1st Year': ['1st Year', 'Year 1', 'Level 4', '1'],
    '2nd Year': ['2nd Year', 'Year 2', 'Level 5', '2'],
    '3rd Year': ['3rd Year', 'Year 3', 'Level 6', '3'],
    '4th Year': ['4th Year', 'Year 4', 'Level 7', '4'],
  };

  const filteredModules = modules.filter((m) => {
    const matchProgramme = filterProgramme === 'all' || m.programme === filterProgramme;
    const matchYear =
      filterYear === 'all' ||
      (YEAR_MAP[filterYear] ?? [filterYear]).includes(m.yearOfStudy ?? '');
    const matchSemester =
      filterSemester === 'all' ||
      m.semester === filterSemester ||
      m.semester === 'Semester 1 & 2';
    return matchProgramme && matchYear && matchSemester;
  });

  // ── Download pre-filled CSV template ───────────────────────────────────────
  const downloadCsvTemplate = () => {
    const rows = [
      'StudentID,StudentName,Status',
      ...enrolledStudents.map((s) => `${s.studentId},"${s.name}",absent`),
    ];
    const blob = new Blob([rows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const mod = modules.find((m) => m.id === selectedModuleId);
    a.download = `attendance_${mod?.moduleCode ?? selectedModuleId}_${sessionDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ── Handle CSV upload ───────────────────────────────────────────────────────
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
            const newMap = new Map(attendanceMap);
            let updated = 0;
            rows.forEach((row) => {
              const sid = (row['StudentID'] ?? row['studentId'] ?? '').trim();
              const raw = (row['Status'] ?? row['status'] ?? '').trim().toLowerCase();
              const status: AttendanceStatus = raw === 'absent' ? 'absent' : 'present';
              if (newMap.has(sid)) {
                newMap.set(sid, status);
                updated++;
              }
            });
            setAttendanceMap(newMap);
            toast.success(`Applied CSV: ${updated} students updated`);
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

  // ── Download bulk CSV template ──────────────────────────────────────────────
  const downloadBulkCsvTemplate = async () => {
    const mod = modules.find((m) => m.id === selectedModuleId);

    // Generate 3 session columns: today, +7 days, +14 days
    const base = new Date();
    const sessionCols = [
      { offset: 0, type: 'Lecture' },
      { offset: 7, type: 'Lab' },
      { offset: 14, type: 'Lecture' },
    ].map(({ offset, type }) => {
      const d = new Date(base);
      d.setDate(d.getDate() + offset);
      return `${d.toISOString().split('T')[0]} ${type}`;
    });

    // Fetch enrolled students for this module
    let studentIds: string[] = [];
    try {
      const [enrollSnap, studentsSnap] = await Promise.all([
        getDocs(query(collection(db, 'moduleEnrollments'), where('moduleId', '==', selectedModuleId))),
        getDocs(collection(db, 'students')),
      ]);
      const enrolledIds = new Set(
        enrollSnap.docs.map((d) => String(d.data().studentId ?? '').trim()).filter(Boolean)
      );
      const studentMap = new Set<string>();
      studentsSnap.forEach((d) => {
        const sid = String(d.data().studentId ?? '').trim();
        if (sid) studentMap.add(sid);
      });
      studentIds = [...enrolledIds].filter((sid) => studentMap.has(sid)).sort();
    } catch {
      studentIds = ['STD001', 'STD002', 'STD003'];
    }
    if (studentIds.length === 0) studentIds = ['STD001', 'STD002', 'STD003'];

    const header = ['StudentID', ...sessionCols];
    const dataRows = studentIds.map((sid) => [sid, ...sessionCols.map(() => '')]);

    const csvLines = [header, ...dataRows].map((r) => r.join(','));
    const blob = new Blob([csvLines.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bulk_attendance_${mod?.moduleCode ?? selectedModuleId}_template.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ── Handle bulk CSV file (wide format: students as rows, sessions as columns) ─
  const handleBulkCsvFile = async (file: File) => {
    setBulkCsvProcessing(true);
    try {
      // Pre-fetch enrolled students for validation warning
      let enrolledIds = new Set<string>();
      try {
        const enrollSnap = await getDocs(
          query(collection(db, 'moduleEnrollments'), where('moduleId', '==', selectedModuleId))
        );
        enrolledIds = new Set(
          enrollSnap.docs.map((d) => String(d.data().studentId ?? '').trim()).filter(Boolean)
        );
      } catch { /* skip enrollment check if fetch fails */ }

      const VALID_SESSION_TYPES = ['Lecture', 'Lab', 'Tutorial', 'Seminar', 'Workshop'];
      const Papa = (await import('papaparse')).default;

      await new Promise<void>((resolve, reject) => {
        Papa.parse(file, {
          header: true,
          skipEmptyLines: true,
          complete: (res) => {
            const rows = res.data as Record<string, string>[];
            if (rows.length === 0) { resolve(); return; }

            // All headers except StudentID are session columns ("YYYY-MM-DD SessionType")
            const allHeaders = Object.keys(rows[0]);
            const sessionHeaderKeys = allHeaders.filter(
              (h) => h !== 'StudentID' && h !== 'studentId'
            );

            const parsedHeaders: Array<{ label: string; date: string; sessionType: string }> = [];
            sessionHeaderKeys.forEach((header) => {
              const parts = header.trim().split(' ');
              const date = parts[0];
              const rawType = parts.slice(1).join(' ').trim();
              const normalised = VALID_SESSION_TYPES.find(
                (t) => t.toLowerCase() === rawType.toLowerCase()
              );
              parsedHeaders.push({ label: header, date, sessionType: normalised ?? 'Lecture' });
            });

            const parsed: Array<{ studentId: string; sessionDate: string; sessionType: string; status: 'present' | 'absent' }> = [];
            const unenrolledIds = new Set<string>();

            rows.forEach((row) => {
              const sid = (row['StudentID'] ?? row['studentId'] ?? '').trim();
              if (!sid) return; // skip rows with no StudentID
              if (enrolledIds.size > 0 && !enrolledIds.has(sid)) unenrolledIds.add(sid);

              parsedHeaders.forEach(({ label, date, sessionType }) => {
                const cellValue = (row[label] ?? '').trim().toLowerCase();
                if (cellValue === 'present' || cellValue === 'absent') {
                  parsed.push({ studentId: sid, sessionDate: date, sessionType, status: cellValue });
                }
                // empty cells are silently skipped
              });
            });

            if (unenrolledIds.size > 0) {
              toast.warning(
                `${unenrolledIds.size} student ID${unenrolledIds.size !== 1 ? 's' : ''} not enrolled in this module — records will still be saved`
              );
            }

            setBulkSessionHeaders(parsedHeaders);
            setBulkCsvRows(parsed);
            const uniqueStudents = new Set(parsed.map((r) => r.studentId)).size;
            toast.success(
              `Parsed ${parsed.length} records across ${parsedHeaders.length} session${parsedHeaders.length !== 1 ? 's' : ''} for ${uniqueStudents} student${uniqueStudents !== 1 ? 's' : ''}`
            );
            resolve();
          },
          error: reject,
        });
      });
    } catch {
      toast.error('Failed to parse CSV');
    } finally {
      setBulkCsvProcessing(false);
    }
  };

  // ── Save bulk sessions ──────────────────────────────────────────────────────
  const handleBulkSave = async () => {
    if (!selectedModuleId || bulkCsvRows.length === 0) return;
    const selectedModule = modules.find((m) => m.id === selectedModuleId);
    if (!selectedModule) return;

    setBulkSaving(true);
    try {
      // Build deterministic doc IDs for every row
      const rowsWithIds = bulkCsvRows.map((row) => ({
        ...row,
        docId: makeAttendanceDocId(row.studentId, selectedModuleId, row.sessionDate, row.sessionType),
      }));

      // Upsert all rows using deterministic IDs — no duplicates possible
      await Promise.all(
        rowsWithIds.map((row) =>
          setDoc(doc(db, 'attendance', row.docId), {
            moduleId: selectedModuleId,
            moduleCode: selectedModule.moduleCode,
            moduleName: selectedModule.moduleName,
            studentId: row.studentId,
            date: row.sessionDate,
            sessionType: row.sessionType,
            status: row.status,
            semester: attSemester,
            academicYear: attAcademicYear,
            recordedBy: user?.name ?? 'Faculty Administrator',
            createdAt: serverTimestamp(),
          }, { merge: true })
        )
      );

      // Fetch student doc info for all unique students in the CSV
      const uniqueStudentIds = [...new Set(bulkCsvRows.map((r) => r.studentId))];
      const studentsSnap = await getDocs(collection(db, 'students'));
      const studentDocMap = new Map<string, { docId: string; gpa: number }>();
      studentsSnap.forEach((d) => {
        const sid = String(d.data().studentId ?? '').trim();
        if (sid) studentDocMap.set(sid, { docId: d.id, gpa: d.data().gpa ?? 0 });
      });

      // Recalculate attendance for each affected student
      await Promise.all(
        uniqueStudentIds
          .filter((sid) => studentDocMap.has(sid))
          .map((sid) => {
            const s = studentDocMap.get(sid)!;
            return recalculateStudentAttendance(s.docId, sid, selectedModuleId, s.gpa).catch(
              (err) => console.error('Failed to update student attendance record:', (err as Error).message)
            );
          })
      );

      toast.success(
        `Attendance saved — ${rowsWithIds.length} record${rowsWithIds.length !== 1 ? 's' : ''} processed (duplicates automatically handled)`
      );
      setBulkCsvRows([]);
      setBulkSessionHeaders([]);
    } catch {
      toast.error('Failed to save bulk attendance');
    } finally {
      setBulkSaving(false);
    }
  };

  // ── Save attendance ─────────────────────────────────────────────────────────
  const handleSave = async (overwrite = false) => {
    if (!studentsLoaded || enrolledStudents.length === 0) return;
    const selectedModule = modules.find((m) => m.id === selectedModuleId);
    if (!selectedModule) return;

    // Duplicate session guard
    if (!overwrite) {
      const dupSnap = await getDocs(
        query(
          collection(db, 'attendance'),
          where('moduleId', '==', selectedModuleId),
          where('date', '==', sessionDate),
          where('sessionType', '==', sessionType),
          limit(1)
        )
      );
      if (!dupSnap.empty) {
        setOverwriteConfirmPending(true);
        return;
      }
    }

    setSaving(true);
    try {
      // Only save students with an explicit present/absent mark
      const studentsToSave = enrolledStudents.filter(
        (student) => attendanceMap.get(student.studentId) != null
      );

      // 1. Upsert one attendance record per student using a deterministic doc ID
      //    setDoc with merge:true creates the doc if new, or updates it if it exists —
      //    no delete step needed and no duplicates possible.
      await Promise.all(
        studentsToSave.map((student) => {
          const docId = makeAttendanceDocId(
            student.studentId, selectedModuleId, sessionDate, sessionType
          );
          return setDoc(doc(db, 'attendance', docId), {
            moduleId: selectedModuleId,
            moduleCode: selectedModule.moduleCode,
            moduleName: selectedModule.moduleName,
            studentId: student.studentId,
            studentName: student.name,
            date: sessionDate,
            sessionType,
            status: attendanceMap.get(student.studentId) as 'present' | 'absent',
            semester: attSemester,
            academicYear: attAcademicYear,
            recordedBy: user?.name ?? 'Faculty Administrator',
            createdAt: serverTimestamp(),
          }, { merge: true });
        })
      );

      // 2. Recalculate per-module and overall attendance for each student
      await Promise.all(
        studentsToSave.map((student) =>
          recalculateStudentAttendance(
            student.studentDocId,
            student.studentId,
            selectedModuleId,
            student.gpa
          ).catch((err) =>
            console.error('Failed to update student attendance record:', (err as Error).message)
          )
        )
      );

      toast.success(
        `Attendance saved — ${studentsToSave.length} record${studentsToSave.length !== 1 ? 's' : ''} processed (duplicates automatically handled)`
      );

      // Reset section 2
      setStudentsLoaded(false);
      setEnrolledStudents([]);
      setAttendanceMap(new Map());
    } catch {
      toast.error('Failed to save attendance');
    } finally {
      setSaving(false);
    }
  };

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Attendance Management</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Record and manage student attendance per module and session
        </p>
        {!loadingAdmin && adminFaculty && (
          <p className="text-sm font-medium text-primary mt-1">
            Managing: {adminFaculty}
          </p>
        )}
      </div>

      {/* ── Section 1: Select Module & Session ── */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base flex items-center gap-2">
            <BookOpen className="h-4 w-4" />
            Select Module & Session
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Mode toggle */}
          <div className="flex rounded-md border overflow-hidden text-sm w-fit">
            <button
              onClick={() => {
                setSessionMode('bulk');
                setStudentsLoaded(false);
                setEnrolledStudents([]);
                setAttendanceMap(new Map());
              }}
              className={`px-4 py-2 transition-colors ${
                sessionMode === 'bulk'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-white text-muted-foreground hover:bg-gray-50'
              }`}
            >
              Bulk Sessions
            </button>
            <button
              onClick={() => { setSessionMode('single'); setBulkCsvRows([]); setBulkSessionHeaders([]); }}
              className={`px-4 py-2 border-l transition-colors ${
                sessionMode === 'single'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-white text-muted-foreground hover:bg-gray-50'
              }`}
            >
              Single Session
            </button>
          </div>

          {/* Row 1 — Filters */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label>Programme</Label>
              <Select
                value={filterProgramme}
                onValueChange={(v) => {
                  setFilterProgramme(v);
                  setSelectedModuleId('');
                  setStudentsLoaded(false);
                  setEnrolledStudents([]);
                  setAttendanceMap(new Map());
                }}
                disabled={loadingModules || loadingAdmin}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All Programmes" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Programmes</SelectItem>
                  {programmeOptions.map((p) => (
                    <SelectItem key={p} value={p}>{p}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Year</Label>
              <Select
                value={filterYear}
                onValueChange={(v) => {
                  setFilterYear(v);
                  setSelectedModuleId('');
                  setStudentsLoaded(false);
                  setEnrolledStudents([]);
                  setAttendanceMap(new Map());
                }}
                disabled={loadingModules || loadingAdmin}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All Years" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Years</SelectItem>
                  {yearOptions.map((y) => (
                    <SelectItem key={y} value={y}>{y}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Semester</Label>
              <Select
                value={filterSemester}
                onValueChange={(v) => {
                  setFilterSemester(v);
                  setSelectedModuleId('');
                  setStudentsLoaded(false);
                  setEnrolledStudents([]);
                  setAttendanceMap(new Map());
                }}
                disabled={loadingModules || loadingAdmin}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All Semesters" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Semesters</SelectItem>
                  {semesterOptions.map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Module count hint */}
          {!loadingModules && (
            <p className="text-xs text-muted-foreground">
              {filteredModules.length} module{filteredModules.length !== 1 ? 's' : ''} available
            </p>
          )}

          {/* Row 2 — Module & Session */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
            <div className="space-y-1.5">
              <Label>Module</Label>
              <Select
                value={selectedModuleId}
                onValueChange={(v) => {
                  setSelectedModuleId(v);
                  setStudentsLoaded(false);
                  setEnrolledStudents([]);
                  setAttendanceMap(new Map());
                  setBulkCsvRows([]);
                  setBulkSessionHeaders([]);
                }}
                disabled={loadingModules || loadingAdmin}
              >
                <SelectTrigger>
                  <SelectValue placeholder={loadingAdmin || loadingModules ? 'Loading modules…' : '— Select module —'} />
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

            {sessionMode === 'single' && (
              <div className="space-y-1.5">
                <Label>Session Date</Label>
                <Input
                  type="date"
                  value={sessionDate}
                  onChange={(e) => setSessionDate(e.target.value)}
                />
              </div>
            )}

            {sessionMode === 'single' && (
              <div className="space-y-1.5">
                <Label>Session Type</Label>
                <Select value={sessionType} onValueChange={setSessionType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SESSION_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {sessionMode === 'single' && (
              <Button
                onClick={handleLoadStudents}
                disabled={!selectedModuleId || loadingStudents}
                className="gap-2"
              >
                {loadingStudents
                  ? <><Loader2 className="h-4 w-4 animate-spin" />Loading…</>
                  : <><Users className="h-4 w-4" />Load Students</>
                }
              </Button>
            )}
          </div>

          {/* Row 3 — Academic Year & Semester tagging */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Academic Year</Label>
              <Select value={attAcademicYear} onValueChange={setAttAcademicYear}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {['2022/2023', '2023/2024', '2024/2025', '2025/2026', '2026/2027'].map((y) => (
                    <SelectItem key={y} value={y}>{y}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Semester</Label>
              <Select value={attSemester} onValueChange={setAttSemester}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Semester 1">Semester 1</SelectItem>
                  <SelectItem value="Semester 2">Semester 2</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Section 2: Mark Attendance / Bulk Sessions ── */}
      {(studentsLoaded || (sessionMode === 'bulk' && !!selectedModuleId)) && (
        <Card>
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <CardTitle className="text-base flex items-center gap-2">
                <CheckCircle className="h-4 w-4" />
                {sessionMode === 'bulk' ? 'Bulk Sessions Upload' : 'Mark Attendance'}
                {sessionMode === 'single' && enrolledStudents.length > 0 && (
                  <span className="text-muted-foreground font-normal text-sm ml-1">
                    — {enrolledStudents.length} students enrolled
                  </span>
                )}
              </CardTitle>
              {/* CSV / Manual tab — single session only */}
              {sessionMode === 'single' && (
                <div className="flex rounded-md border overflow-hidden text-sm">
                  <button
                    onClick={() => setEntryMode('csv')}
                    className={`px-3 py-1.5 transition-colors ${
                      entryMode === 'csv'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-white text-muted-foreground hover:bg-gray-50'
                    }`}
                  >
                    CSV Upload
                  </button>
                  <button
                    onClick={() => setEntryMode('manual')}
                    className={`px-3 py-1.5 border-l transition-colors ${
                      entryMode === 'manual'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-white text-muted-foreground hover:bg-gray-50'
                    }`}
                  >
                    Manual
                  </button>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {sessionMode === 'bulk' ? (
              /* ── Bulk Sessions Upload UI ── */
              <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-3">
                  <Button size="sm" variant="outline" className="gap-2" onClick={downloadBulkCsvTemplate} disabled={!selectedModuleId}>
                    <Download className="h-4 w-4" />
                    Download Template
                  </Button>
                  <p className="text-sm text-muted-foreground">
                    CSV format: <span className="font-mono text-xs">StudentID, YYYY-MM-DD SessionType, …</span> — students as rows, sessions as columns
                  </p>
                </div>

                <div className="border-2 border-dashed rounded-lg p-8 text-center">
                  <input
                    type="file"
                    accept=".csv"
                    id="csv-bulk-upload"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleBulkCsvFile(f);
                      e.target.value = '';
                    }}
                  />
                  <label htmlFor="csv-bulk-upload" className="cursor-pointer">
                    {bulkCsvProcessing ? (
                      <div className="flex flex-col items-center gap-2">
                        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                        <p className="text-sm text-muted-foreground">Processing…</p>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-2">
                        <Upload className="h-8 w-8 text-muted-foreground" />
                        <p className="font-medium text-sm">Click to upload Bulk Sessions CSV</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          First column: StudentID — remaining columns: "YYYY-MM-DD SessionType"
                        </p>
                      </div>
                    )}
                  </label>
                </div>

                {bulkCsvRows.length > 0 && (() => {
                  const uniqueStudents = [...new Set(bulkCsvRows.map((r) => r.studentId))].sort();
                  const lookup = new Map<string, 'present' | 'absent'>();
                  bulkCsvRows.forEach((r) =>
                    lookup.set(`${r.studentId}|${r.sessionDate}|${r.sessionType}`, r.status)
                  );
                  return (
                    <>
                      <div className="flex items-center gap-3 flex-wrap">
                        <Badge className="bg-blue-100 text-blue-800 border-blue-200">
                          {uniqueStudents.length} student{uniqueStudents.length !== 1 ? 's' : ''} × {bulkSessionHeaders.length} session{bulkSessionHeaders.length !== 1 ? 's' : ''} = {bulkCsvRows.length} records
                        </Badge>
                        <Badge className="bg-green-100 text-green-800 border-green-200">
                          {bulkCsvRows.filter((r) => r.status === 'present').length} Present
                        </Badge>
                        <Badge className="bg-red-100 text-red-800 border-red-200">
                          {bulkCsvRows.filter((r) => r.status === 'absent').length} Absent
                        </Badge>
                      </div>

                      <div className="overflow-x-auto rounded-md border max-h-72">
                        <table className="text-sm border-collapse">
                          <thead className="sticky top-0 bg-gray-50">
                            <tr className="border-b">
                              <th className="text-left font-medium text-muted-foreground px-3 py-2 whitespace-nowrap border-r">
                                Student ID
                              </th>
                              {bulkSessionHeaders.map((h) => (
                                <th key={h.label} className="text-center font-medium text-muted-foreground px-3 py-2 whitespace-nowrap border-r last:border-r-0">
                                  <div className="text-xs">{formatDate(h.date)}</div>
                                  <div className="text-xs font-normal text-gray-400">{h.sessionType}</div>
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {uniqueStudents.map((sid) => (
                              <tr key={sid} className="border-b last:border-0 hover:bg-gray-50">
                                <td className="px-3 py-2 font-mono text-xs border-r whitespace-nowrap">{sid}</td>
                                {bulkSessionHeaders.map((h) => {
                                  const status = lookup.get(`${sid}|${h.date}|${h.sessionType}`);
                                  return (
                                    <td key={h.label} className="px-3 py-2 text-center border-r last:border-r-0">
                                      {status === 'present' ? (
                                        <Badge className="bg-green-100 text-green-700 border-green-200 text-xs">P</Badge>
                                      ) : status === 'absent' ? (
                                        <Badge className="bg-red-100 text-red-700 border-red-200 text-xs">A</Badge>
                                      ) : (
                                        <span className="text-gray-300 text-xs">—</span>
                                      )}
                                    </td>
                                  );
                                })}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      <div className="pt-2 border-t">
                        <Button onClick={handleBulkSave} disabled={bulkSaving} className="gap-2">
                          {bulkSaving ? (
                            <><Loader2 className="h-4 w-4 animate-spin" />Saving…</>
                          ) : (
                            <><CheckCircle className="h-4 w-4" />Save Bulk Sessions</>
                          )}
                        </Button>
                      </div>
                    </>
                  );
                })()}
              </div>
            ) : enrolledStudents.length === 0 ? (
              <p className="text-center py-8 text-muted-foreground text-sm">
                No students found for this module
              </p>
            ) : entryMode === 'manual' ? (
              <>
                {/* Controls row */}
                <div className="flex flex-wrap items-center gap-3">
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-green-300 text-green-700 hover:bg-green-50"
                    onClick={() => markAll('present')}
                  >
                    Mark All Present
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-red-300 text-red-700 hover:bg-red-50"
                    onClick={() => markAll('absent')}
                  >
                    Mark All Absent
                  </Button>
                  <div className="ml-auto flex items-center gap-2">
                    <Badge className="bg-gray-100 text-gray-600 border-gray-200">
                      {counts.unmarked} Not Marked
                    </Badge>
                    <Badge className="bg-green-100 text-green-800 border-green-200">
                      {counts.present} Present
                    </Badge>
                    <Badge className="bg-red-100 text-red-800 border-red-200">
                      {counts.absent} Absent
                    </Badge>
                  </div>
                </div>

                {/* Table */}
                <div className="overflow-x-auto rounded-md border">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 border-b">
                        <th className="text-left font-medium text-muted-foreground px-4 py-3">Student ID</th>
                        <th className="text-left font-medium text-muted-foreground px-4 py-3">Name</th>
                        <th className="text-left font-medium text-muted-foreground px-4 py-3 hidden sm:table-cell">
                          Programme
                        </th>
                        <th className="text-left font-medium text-muted-foreground px-4 py-3">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {enrolledStudents.map((student) => {
                        const status = attendanceMap.get(student.studentId) ?? null;
                        return (
                          <tr key={student.studentId} className="border-b last:border-0 hover:bg-gray-50">
                            <td className="px-4 py-3 font-mono text-xs">{student.studentId}</td>
                            <td className="px-4 py-3 font-medium">{student.name}</td>
                            <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell">
                              {student.programme || '—'}
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                {status === null && (
                                  <Badge className="bg-gray-100 text-gray-500 border-gray-200 text-xs font-medium">
                                    Not Marked
                                  </Badge>
                                )}
                                {status === 'present' && (
                                  <Badge className="bg-green-100 text-green-700 border-green-200 text-xs font-medium">
                                    Present
                                  </Badge>
                                )}
                                {status === 'absent' && (
                                  <Badge className="bg-red-100 text-red-700 border-red-200 text-xs font-medium">
                                    Absent
                                  </Badge>
                                )}
                                <div className="flex gap-1">
                                  {(['present', 'absent'] as ('present' | 'absent')[]).map((s) => (
                                    <button
                                      key={s}
                                      onClick={() =>
                                        setAttendanceMap(
                                          (prev) => new Map(prev).set(student.studentId, s)
                                        )
                                      }
                                      className={`px-2.5 py-1 text-xs rounded capitalize font-medium border transition-colors ${
                                        status === s
                                          ? s === 'present'
                                            ? 'bg-green-100 text-green-700 border-green-400'
                                            : 'bg-red-100 text-red-700 border-red-400'
                                          : 'bg-white text-gray-400 border-gray-200 hover:border-gray-300 hover:text-gray-600'
                                      }`}
                                    >
                                      {s}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
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
                    Fill in the Status column (present or absent), then upload below
                  </p>
                </div>

                <div className="border-2 border-dashed rounded-lg p-8 text-center">
                  <input
                    type="file"
                    accept=".csv"
                    id="csv-attendance-upload"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleCsvFile(f);
                      e.target.value = '';
                    }}
                  />
                  <label htmlFor="csv-attendance-upload" className="cursor-pointer">
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
                          Columns: StudentID, StudentName, Status
                        </p>
                      </div>
                    )}
                  </label>
                </div>

                {attendanceMap.size > 0 && (
                  <div className="flex items-center gap-2">
                    {counts.unmarked > 0 && (
                      <Badge className="bg-gray-100 text-gray-600 border-gray-200">
                        {counts.unmarked} Not Marked
                      </Badge>
                    )}
                    <Badge className="bg-green-100 text-green-800 border-green-200">
                      {counts.present} Present
                    </Badge>
                    <Badge className="bg-red-100 text-red-800 border-red-200">
                      {counts.absent} Absent
                    </Badge>
                  </div>
                )}
              </div>
            )}

            {/* Save button */}
            {enrolledStudents.length > 0 && (
              <div className="pt-3 border-t space-y-3">
                {unmarkedCount > 0 && (
                  <p className="text-sm text-amber-700">
                    {unmarkedCount} student{unmarkedCount !== 1 ? 's' : ''} not marked yet — please mark all students before saving
                  </p>
                )}
                <Button onClick={() => handleSave(false)} disabled={saving || unmarkedCount > 0} className="gap-2">
                  {saving ? (
                    <><Loader2 className="h-4 w-4 animate-spin" />Saving…</>
                  ) : (
                    <><CheckCircle className="h-4 w-4" />Save Attendance</>
                  )}
                </Button>

                {/* Overwrite confirmation */}
                {overwriteConfirmPending && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 space-y-2">
                    <p className="text-sm font-medium text-amber-900">
                      Attendance for this module, date and session type already exists. Do you want to overwrite it?
                    </p>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setOverwriteConfirmPending(false)}
                      >
                        Cancel
                      </Button>
                      <Button
                        size="sm"
                        className="bg-amber-600 hover:bg-amber-700 text-white"
                        onClick={() => { setOverwriteConfirmPending(false); handleSave(true); }}
                      >
                        Overwrite
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

    </div>
  );
}
