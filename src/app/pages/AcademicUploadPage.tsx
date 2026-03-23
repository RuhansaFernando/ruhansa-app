import { useState, useEffect, useCallback } from 'react';
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
  addDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  doc,
  collection,
  serverTimestamp,
  query,
  where,
  orderBy,
  limit,
} from 'firebase/firestore';
import { db } from '../../firebase';
import { toast } from 'sonner';
import { useAuth } from '../AuthContext';
import {
  Upload,
  Download,
  Loader2,
  Users,
  Clock,
  BookOpen,
  CheckCircle,
} from 'lucide-react';

// ─── Risk calculation ─────────────────────────────────────────────────────────
function calculateRisk(gpa: number, attendance: number, absences: number) {
  let score = 0;
  if (gpa < 1.5) score += 40;
  else if (gpa < 2.0) score += 30;
  else if (gpa < 2.5) score += 20;
  else if (gpa < 3.0) score += 10;

  if (attendance < 60) score += 40;
  else if (attendance < 70) score += 30;
  else if (attendance < 80) score += 20;
  else if (attendance < 85) score += 10;

  if (absences >= 7) score += 20;
  else if (absences >= 5) score += 15;
  else if (absences >= 3) score += 10;
  else if (absences >= 2) score += 5;

  return {
    riskLevel: score >= 50 ? 'high' : score >= 25 ? 'medium' : 'low',
    riskScore: score,
  };
}

// ─── Types ────────────────────────────────────────────────────────────────────
interface Module {
  id: string;
  moduleCode: string;
  moduleName: string;
  faculty: string;
}

interface EnrolledStudent {
  studentDocId: string;
  studentId: string;
  name: string;
  programme: string;
  gpa: number;
}

type AttendanceStatus = 'present' | 'absent' | 'late';

interface SessionSummary {
  key: string;
  date: string;
  moduleCode: string;
  moduleName: string;
  sessionType: string;
  present: number;
  absent: number;
  late: number;
  recordedBy: string;
}

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

// ─── Component ────────────────────────────────────────────────────────────────
export default function AcademicUploadPage() {
  const { user } = useAuth();

  // Section 1 — module & session
  const [modules, setModules] = useState<Module[]>([]);
  const [loadingModules, setLoadingModules] = useState(true);
  const [selectedModuleId, setSelectedModuleId] = useState('');
  const [sessionDate, setSessionDate] = useState(todayStr());
  const [sessionType, setSessionType] = useState('Lecture');

  // Section 2 — attendance table
  const [enrolledStudents, setEnrolledStudents] = useState<EnrolledStudent[]>([]);
  const [attendanceMap, setAttendanceMap] = useState<Map<string, AttendanceStatus>>(new Map());
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [studentsLoaded, setStudentsLoaded] = useState(false);
  const [entryMode, setEntryMode] = useState<'manual' | 'csv'>('manual');
  const [csvProcessing, setCsvProcessing] = useState(false);

  // Section 3 — save
  const [saving, setSaving] = useState(false);
  const [overwriteConfirmPending, setOverwriteConfirmPending] = useState(false);

  // Section 4 — history
  const [history, setHistory] = useState<SessionSummary[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [historyFilterModuleId, setHistoryFilterModuleId] = useState('all');
  const [historyFilterDate, setHistoryFilterDate] = useState('');

  // Faculty admin profile
  const [adminFaculty, setAdminFaculty] = useState('');
  const [loadingAdmin, setLoadingAdmin] = useState(true);

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
    getDocs(collection(db, 'modules'))
      .then((snap) => {
        const mods = snap.docs
          .map((d) => ({
            id: d.id,
            moduleCode: d.data().moduleCode ?? '',
            moduleName: d.data().moduleName ?? d.data().name ?? '',
            faculty: d.data().faculty ?? '',
          }))
          .filter((m) => !adminFaculty || m.faculty === adminFaculty)
          .sort((a, b) => a.moduleCode.localeCompare(b.moduleCode));
        setModules(mods);
      })
      .catch(() => toast.error('Failed to load modules'))
      .finally(() => setLoadingModules(false));
  }, [loadingAdmin, adminFaculty]);

  // ── Load history ────────────────────────────────────────────────────────────
  const loadHistory = useCallback(async () => {
    setLoadingHistory(true);
    try {
      let snap;
      // Use Firestore filter where possible; apply secondary filter client-side
      const activeModuleFilter = historyFilterModuleId && historyFilterModuleId !== 'all'
        ? historyFilterModuleId
        : null;
      if (activeModuleFilter) {
        snap = await getDocs(
          query(collection(db, 'attendance'), where('moduleId', '==', activeModuleFilter))
        );
      } else if (historyFilterDate) {
        snap = await getDocs(
          query(collection(db, 'attendance'), where('date', '==', historyFilterDate))
        );
      } else {
        snap = await getDocs(query(collection(db, 'attendance'), orderBy('createdAt', 'desc'), limit(50)));
      }

      const myModuleIds = new Set(modules.map((m) => m.id));

      const groupMap = new Map<string, SessionSummary>();
      snap.forEach((d) => {
        const data = d.data();
        // Only show records belonging to this admin's faculty modules
        if (!myModuleIds.has(data.moduleId)) return;
        // Client-side secondary date filter when module filter is also active
        if (activeModuleFilter && historyFilterDate && data.date !== historyFilterDate) return;
        const key = `${data.date}|${data.moduleId}|${data.sessionType}`;
        if (!groupMap.has(key)) {
          groupMap.set(key, {
            key,
            date: data.date ?? '',
            moduleCode: data.moduleCode ?? '',
            moduleName: data.moduleName ?? '',
            sessionType: data.sessionType ?? '',
            present: 0,
            absent: 0,
            late: 0,
            recordedBy: data.recordedBy ?? '',
          });
        }
        const entry = groupMap.get(key)!;
        if (data.status === 'present') entry.present++;
        else if (data.status === 'absent') entry.absent++;
        else if (data.status === 'late') entry.late++;
      });

      setHistory(
        Array.from(groupMap.values()).sort((a, b) => b.date.localeCompare(a.date))
      );
    } catch {
      toast.error('Failed to load attendance history');
    } finally {
      setLoadingHistory(false);
    }
  }, [historyFilterModuleId, historyFilterDate, modules]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

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
      students.forEach((s) => map.set(s.studentId, 'present'));
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
      acc[attendanceMap.get(s.studentId) ?? 'present']++;
      return acc;
    },
    { present: 0, absent: 0, late: 0 }
  );

  // ── Download pre-filled CSV template ───────────────────────────────────────
  const downloadCsvTemplate = () => {
    const rows = [
      'StudentID,StudentName,Status',
      ...enrolledStudents.map((s) => `${s.studentId},"${s.name}",present`),
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
              const status: AttendanceStatus =
                raw === 'absent' ? 'absent' : raw === 'late' ? 'late' : 'present';
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
      // 0. Delete old records when overwriting
      if (overwrite) {
        const existingSnap = await getDocs(
          query(
            collection(db, 'attendance'),
            where('moduleId', '==', selectedModuleId),
            where('date', '==', sessionDate),
            where('sessionType', '==', sessionType)
          )
        );
        await Promise.all(existingSnap.docs.map((d) => deleteDoc(doc(db, 'attendance', d.id))));
      }

      // 1. Write one attendance record per student
      await Promise.all(
        enrolledStudents.map((student) =>
          addDoc(collection(db, 'attendance'), {
            moduleId: selectedModuleId,
            moduleCode: selectedModule.moduleCode,
            moduleName: selectedModule.moduleName,
            studentId: student.studentId,
            studentName: student.name,
            date: sessionDate,
            sessionType,
            status: attendanceMap.get(student.studentId) ?? 'present',
            recordedBy: user?.name ?? 'Faculty Administrator',
            createdAt: serverTimestamp(),
          })
        )
      );

      // 2. Recalculate attendance % and risk for each student
      await Promise.all(
        enrolledStudents.map(async (student) => {
          try {
            const attSnap = await getDocs(
              query(collection(db, 'attendance'), where('studentId', '==', student.studentId))
            );

            const records: { date: string; status: string }[] = [];
            attSnap.forEach((d) =>
              records.push({ date: d.data().date ?? '', status: d.data().status ?? '' })
            );

            const total = records.length;
            const presentOrLate = records.filter(
              (r) => r.status === 'present' || r.status === 'late'
            ).length;
            const attendancePct = total > 0 ? Math.round((presentOrLate / total) * 100) : 0;

            // Consecutive absences: most recent unbroken absent streak
            const sorted = [...records].sort((a, b) => b.date.localeCompare(a.date));
            let consecutiveAbsences = 0;
            for (const r of sorted) {
              if (r.status === 'absent') consecutiveAbsences++;
              else break;
            }

            const { riskLevel, riskScore } = calculateRisk(
              student.gpa,
              attendancePct,
              consecutiveAbsences
            );

            await updateDoc(doc(db, 'students', student.studentDocId), {
              attendancePercentage: attendancePct,
              consecutiveAbsences,
              riskLevel,
              riskScore,
            });
          } catch (err) {
            console.error(`Failed to update student ${student.studentId}:`, err);
          }
        })
      );

      toast.success(`Attendance saved for ${enrolledStudents.length} students`);

      // Reset section 2
      setStudentsLoaded(false);
      setEnrolledStudents([]);
      setAttendanceMap(new Map());
      await loadHistory();
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
        <CardContent>
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
                }}
                disabled={loadingModules || loadingAdmin}
              >
                <SelectTrigger>
                  <SelectValue placeholder={loadingAdmin || loadingModules ? 'Loading modules…' : '— Select module —'} />
                </SelectTrigger>
                <SelectContent>
                  {modules.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.moduleCode} — {m.moduleName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Session Date</Label>
              <Input
                type="date"
                value={sessionDate}
                onChange={(e) => setSessionDate(e.target.value)}
              />
            </div>

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
          </div>
        </CardContent>
      </Card>

      {/* ── Section 2: Mark Attendance ── */}
      {studentsLoaded && (
        <Card>
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <CardTitle className="text-base flex items-center gap-2">
                <CheckCircle className="h-4 w-4" />
                Mark Attendance
                {enrolledStudents.length > 0 && (
                  <span className="text-muted-foreground font-normal text-sm ml-1">
                    — {enrolledStudents.length} students enrolled
                  </span>
                )}
              </CardTitle>
              {/* Manual / CSV tab */}
              <div className="flex rounded-md border overflow-hidden text-sm">
                <button
                  onClick={() => setEntryMode('manual')}
                  className={`px-3 py-1.5 transition-colors ${
                    entryMode === 'manual'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-white text-muted-foreground hover:bg-gray-50'
                  }`}
                >
                  Manual
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
                    <Badge className="bg-green-100 text-green-800 border-green-200">
                      {counts.present} Present
                    </Badge>
                    <Badge className="bg-red-100 text-red-800 border-red-200">
                      {counts.absent} Absent
                    </Badge>
                    <Badge className="bg-amber-100 text-amber-800 border-amber-200">
                      {counts.late} Late
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
                        const status = attendanceMap.get(student.studentId) ?? 'present';
                        return (
                          <tr key={student.studentId} className="border-b last:border-0 hover:bg-gray-50">
                            <td className="px-4 py-3 font-mono text-xs">{student.studentId}</td>
                            <td className="px-4 py-3 font-medium">{student.name}</td>
                            <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell">
                              {student.programme || '—'}
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex gap-1">
                                {(['present', 'late', 'absent'] as AttendanceStatus[]).map((s) => (
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
                                          : s === 'late'
                                          ? 'bg-amber-100 text-amber-700 border-amber-400'
                                          : 'bg-red-100 text-red-700 border-red-400'
                                        : 'bg-white text-gray-400 border-gray-200 hover:border-gray-300 hover:text-gray-600'
                                    }`}
                                  >
                                    {s}
                                  </button>
                                ))}
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
                    Fill in the Status column (present / absent / late), then upload below
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
                    <Badge className="bg-green-100 text-green-800 border-green-200">
                      {counts.present} Present
                    </Badge>
                    <Badge className="bg-red-100 text-red-800 border-red-200">
                      {counts.absent} Absent
                    </Badge>
                    <Badge className="bg-amber-100 text-amber-800 border-amber-200">
                      {counts.late} Late
                    </Badge>
                  </div>
                )}
              </div>
            )}

            {/* Save button */}
            {enrolledStudents.length > 0 && (
              <div className="pt-3 border-t space-y-3">
                <Button onClick={() => handleSave(false)} disabled={saving} className="gap-2">
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

      {/* ── Section 4: Attendance History ── */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Attendance History
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Filters */}
          <div className="flex flex-wrap gap-3 items-center">
            <div className="flex-1 min-w-[200px] max-w-[300px]">
              <Select
                value={historyFilterModuleId}
                onValueChange={setHistoryFilterModuleId}
              >
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
            <Input
              type="date"
              value={historyFilterDate}
              onChange={(e) => setHistoryFilterDate(e.target.value)}
              className="w-[160px]"
            />
            {((historyFilterModuleId && historyFilterModuleId !== 'all') || historyFilterDate) && (
              <Button
                size="sm"
                variant="ghost"
                className="text-muted-foreground"
                onClick={() => { setHistoryFilterModuleId('all'); setHistoryFilterDate(''); }}
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
              <p className="text-sm">No attendance records found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-gray-50">
                    <th className="text-left font-medium text-muted-foreground px-4 py-3">Date</th>
                    <th className="text-left font-medium text-muted-foreground px-4 py-3">Module</th>
                    <th className="text-left font-medium text-muted-foreground px-4 py-3">Session Type</th>
                    <th className="text-center font-medium text-muted-foreground px-4 py-3">Present</th>
                    <th className="text-center font-medium text-muted-foreground px-4 py-3">Absent</th>
                    <th className="text-center font-medium text-muted-foreground px-4 py-3">Late</th>
                    <th className="text-left font-medium text-muted-foreground px-4 py-3">Recorded By</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((h) => (
                    <tr key={h.key} className="border-b last:border-0 hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 text-muted-foreground">{formatDate(h.date)}</td>
                      <td className="px-4 py-3">
                        <div className="font-medium">{h.moduleCode}</div>
                        <div className="text-xs text-muted-foreground">{h.moduleName}</div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{h.sessionType}</td>
                      <td className="px-4 py-3 text-center">
                        <span className="text-green-600 font-semibold">{h.present}</span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {h.absent > 0
                          ? <span className="text-red-600 font-semibold">{h.absent}</span>
                          : <span className="text-muted-foreground">—</span>
                        }
                      </td>
                      <td className="px-4 py-3 text-center">
                        {h.late > 0
                          ? <span className="text-amber-600 font-semibold">{h.late}</span>
                          : <span className="text-muted-foreground">—</span>
                        }
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">{h.recordedBy}</td>
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
