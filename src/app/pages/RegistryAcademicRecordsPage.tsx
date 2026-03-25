import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '../components/ui/dialog';
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
} from 'firebase/firestore';
import { db } from '../../firebase';
import { toast } from 'sonner';
import { useAuth } from '../AuthContext';
import {
  Search,
  User,
  BookOpen,
  BarChart2,
  GraduationCap,
  Trash2,
  Plus,
  Loader2,
  X,
  Users,
  RefreshCw,
} from 'lucide-react';

// ─── Risk calculation ──────────────────────────────────────────────────────────
function getAcademicStanding(gpa: number): { label: string; color: string } {
  if (gpa === 0) return { label: 'No Records', color: 'gray' };
  if (gpa >= 3.0) return { label: 'Good Standing', color: 'green' };
  if (gpa >= 2.0) return { label: 'Satisfactory', color: 'blue' };
  if (gpa >= 1.0) return { label: 'Academic Warning', color: 'amber' };
  return { label: 'Academic Probation', color: 'red' };
}

// ─── Grade helpers ─────────────────────────────────────────────────────────────
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

const currentAcademicYear = () => {
  const now = new Date();
  const year = now.getFullYear();
  return now.getMonth() + 1 >= 9 ? `${year}/${year + 1}` : `${year - 1}/${year}`;
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

// ─── Types ─────────────────────────────────────────────────────────────────────
interface Student {
  docId: string;
  studentId: string;
  name: string;
  programme: string;
  level: string;
  gpa: number;
  faculty?: string;
}

interface EnrollmentRecord {
  docId: string;
  moduleId: string;
  moduleCode: string;
  moduleName: string;
  enrolledAt: string;
}

interface ResultRecord {
  id: string;
  moduleId: string;
  moduleCode: string;
  moduleName: string;
  assessmentComponent: string;
  mark: number;
  weight: number;
  grade: string;
  status: 'pass' | 'fail';
  academicYear: string;
  semester: string;
}

interface ModuleInfo {
  id: string;
  moduleCode: string;
  moduleName: string;
  programme: string;
  semester: string;
  yearOfStudy: string;
  faculty: string;
  credits: number;
  components: { name: string; weight: number }[];
}

type ProfileTab = 'modules' | 'marks' | 'summary';

const STANDING_ORDER: Record<string, number> = {
  'Academic Probation': 0, 'Academic Warning': 1, 'Satisfactory': 2, 'Good Standing': 3, 'No Records': 4,
};

const LEVEL_TO_YEAR: Record<string, string> = {
  'Level 4': 'Year 1',
  'Level 5': 'Year 2',
  'Level 6': 'Year 3',
  'Level 7': 'Year 4',
  '1st Year': 'Year 1',
  '2nd Year': 'Year 2',
  '3rd Year': 'Year 3',
  '4th Year': 'Year 4',
  'Year 1': 'Year 1',
  'Year 2': 'Year 2',
  'Year 3': 'Year 3',
  'Year 4': 'Year 4',
};

// ─── Component ─────────────────────────────────────────────────────────────────
export default function RegistryAcademicRecordsPage() {
  const { user } = useAuth();

  // Students
  const [students, setStudents] = useState<Student[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [activeTab, setActiveTab] = useState<ProfileTab>('modules');

  // Profile data
  const [enrollments, setEnrollments] = useState<EnrollmentRecord[]>([]);
  const [results, setResults] = useState<ResultRecord[]>([]);
  const [loadingProfile, setLoadingProfile] = useState(false);

  // All modules (for enrollment modal)
  const [allModules, setAllModules] = useState<ModuleInfo[]>([]);

  // Enrollment modal
  const [showEnrollModal, setShowEnrollModal] = useState(false);
  const [enrollFaculty, setEnrollFaculty] = useState('');
  const [enrollProgramme, setEnrollProgramme] = useState('');
  const [enrollYear, setEnrollYear] = useState('');
  const [enrollSemester, setEnrollSemester] = useState('');
  const [enrollModuleId, setEnrollModuleId] = useState('');
  const [enrolling, setEnrolling] = useState(false);

  // Remove enrollment
  const [removing, setRemoving] = useState<string | null>(null);

  // Marks modal
  const [showMarksModal, setShowMarksModal] = useState(false);
  const [marksModuleId, setMarksModuleId] = useState('');
  const [marksAssessment, setMarksAssessment] = useState('');
  const [marksAcademicYear, setMarksAcademicYear] = useState(currentAcademicYear());
  const [marksSemester, setMarksSemester] = useState('');
  const [marksValue, setMarksValue] = useState('');
  const [savingMark, setSavingMark] = useState(false);
  const [deletingMarkId, setDeletingMarkId] = useState<string | null>(null);
  const [confirmDeleteMarkId, setConfirmDeleteMarkId] = useState<string | null>(null);

  // Filter + sort state
  const [filterFaculty, setFilterFaculty] = useState('');
  const [filterProgramme, setFilterProgramme] = useState('');
  const [filterYear, setFilterYear] = useState('');
  const [filterStanding, setFilterStanding] = useState('');
  const [sortBy, setSortBy] = useState<'risk' | 'id' | 'name' | 'gpa'>('risk');

  // GPA backfill
  const [recalculating, setRecalculating] = useState(false);

  // Pagination
  const STUDENTS_PER_PAGE = 20;
  const [currentPage, setCurrentPage] = useState(1);

  // ── Load data on mount ───────────────────────────────────────────────────────
  useEffect(() => {
    getDocs(collection(db, 'students'))
      .then((snap) => {
        setStudents(
          snap.docs
            .map((d) => ({
              docId: d.id,
              studentId: String(d.data().studentId ?? ''),
              name: d.data().name ?? '',
              programme: d.data().programme ?? '',
              level: String(d.data().level ?? d.data().yearOfStudy ?? ''),
              gpa: d.data().gpa ?? 0,
              faculty: d.data().faculty ?? '',
            }))
            .sort((a, b) => a.studentId.localeCompare(b.studentId))
        );
      })
      .catch(() => toast.error('Failed to load students'))
      .finally(() => setLoadingStudents(false));

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
              components: d.data().components ?? d.data().assessmentComponents ?? [],
            }))
            .sort((a, b) => a.moduleCode.localeCompare(b.moduleCode))
        );
      })
      .catch(() => toast.error('Failed to load modules'));
  }, []);

  // ── Load student profile ─────────────────────────────────────────────────────
  const loadProfile = useCallback(async (studentId: string) => {
    setLoadingProfile(true);
    try {
      const [enrollSnap, resultsSnap] = await Promise.all([
        getDocs(query(collection(db, 'moduleEnrollments'), where('studentId', '==', studentId))),
        getDocs(query(collection(db, 'results'), where('studentId', '==', studentId))),
      ]);
      setEnrollments(
        enrollSnap.docs.map((d) => ({
          docId: d.id,
          moduleId: d.data().moduleId ?? '',
          moduleCode: d.data().moduleCode ?? '',
          moduleName: d.data().moduleName ?? '',
          enrolledAt: d.data().enrolledAt?.toDate?.().toISOString() ?? '',
        }))
      );
      setResults(
        resultsSnap.docs.map((d) => ({
          id: d.id,
          moduleId: d.data().moduleId ?? '',
          moduleCode: d.data().moduleCode ?? '',
          moduleName: d.data().moduleName ?? '',
          assessmentComponent: d.data().assessmentComponent ?? '',
          mark: d.data().mark ?? 0,
          weight: d.data().weight ?? 0,
          grade: d.data().grade ?? '',
          status: d.data().status ?? 'pass',
          academicYear: d.data().academicYear ?? '',
          semester: d.data().semester ?? '',
        }))
      );
    } catch {
      toast.error('Failed to load student profile');
    } finally {
      setLoadingProfile(false);
    }
  }, []);

  const handleSelectStudent = (student: Student) => {
    setSelectedStudent(student);
    setActiveTab('modules');
    loadProfile(student.studentId);
  };

  // ── Computed ─────────────────────────────────────────────────────────────────

  // programme → faculty map derived from modules
  const programmeFacultyMap = useMemo(() => {
    const map = new Map<string, string>();
    allModules.forEach((m) => { if (m.programme && m.faculty) map.set(m.programme, m.faculty); });
    return map;
  }, [allModules]);

  // Only show faculties that are actually represented in the student list
  const studentFacultyOptions = useMemo(() => {
    const faculties = new Set(
      students.map((s) => programmeFacultyMap.get(s.programme) ?? '').filter(Boolean)
    );
    return Array.from(faculties).sort();
  }, [students, programmeFacultyMap]);

  const studentProgrammeOptions = useMemo(() => {
    const base = filterFaculty
      ? students.filter((s) => (programmeFacultyMap.get(s.programme) ?? '') === filterFaculty)
      : students;
    return Array.from(new Set(base.map((s) => s.programme).filter(Boolean))).sort();
  }, [students, filterFaculty, programmeFacultyMap]);

  const filteredStudents = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    let list = students.filter((s) => {
      if (q && !s.studentId.toLowerCase().includes(q) && !s.name.toLowerCase().includes(q)) return false;
      if (filterProgramme && s.programme !== filterProgramme) return false;
      if (filterYear && (LEVEL_TO_YEAR[s.level] ?? s.level) !== filterYear) return false;
      if (filterFaculty && (programmeFacultyMap.get(s.programme) ?? '') !== filterFaculty) return false;
      return true;
    });
    list = [...list].sort((a, b) => {
      switch (sortBy) {
        case 'id':   return a.studentId.localeCompare(b.studentId);
        case 'name': return a.name.localeCompare(b.name);
        case 'gpa':  return a.gpa - b.gpa;
        default:     return (STANDING_ORDER[getAcademicStanding(a.gpa).label] ?? 5) - (STANDING_ORDER[getAcademicStanding(b.gpa).label] ?? 5);
      }
    });
    return list;
  }, [students, searchQuery, filterFaculty, filterProgramme, filterYear, sortBy, programmeFacultyMap]);

  // Reset page when filters change
  useEffect(() => { setCurrentPage(1); }, [searchQuery, filterFaculty, filterProgramme, filterYear, sortBy]);

  const totalPages = Math.ceil(filteredStudents.length / STUDENTS_PER_PAGE);
  const paginatedStudents = filteredStudents.slice(
    (currentPage - 1) * STUDENTS_PER_PAGE,
    currentPage * STUDENTS_PER_PAGE
  );

  const goodStandingCount = useMemo(() => students.filter((s) => getAcademicStanding(s.gpa).label === 'Good Standing').length, [students]);
  const satisfactoryCount = useMemo(() => students.filter((s) => getAcademicStanding(s.gpa).label === 'Satisfactory').length, [students]);
  const warningCount = useMemo(() => students.filter((s) => getAcademicStanding(s.gpa).label === 'Academic Warning').length, [students]);
  const probationCount = useMemo(() => students.filter((s) => getAcademicStanding(s.gpa).label === 'Academic Probation').length, [students]);

  const enrolledModuleIds = useMemo(
    () => new Set(
      enrollments.map((e) => {
        // Resolve to doc ID so has(m.id) works for both old (moduleCode) and new (doc ID) enrollments
        const mod = allModules.find((m) => m.id === e.moduleId || m.moduleCode === e.moduleId);
        return mod?.id ?? e.moduleId;
      })
    ),
    [enrollments, allModules]
  );

  // Enrollment modal cascading options
  const facultyOptions = useMemo(
    () => Array.from(new Set(allModules.map((m) => m.faculty).filter(Boolean))).sort(),
    [allModules]
  );

  const programmeOptions = useMemo(() => {
    if (!enrollFaculty) return [];
    return Array.from(
      new Set(allModules.filter((m) => m.faculty === enrollFaculty).map((m) => m.programme).filter(Boolean))
    ).sort();
  }, [allModules, enrollFaculty]);

  const YEAR_ALIASES: Record<string, string[]> = {
    'Year 1': ['Year 1', '1st Year', 'Level 4'],
    'Year 2': ['Year 2', '2nd Year', 'Level 5'],
    'Year 3': ['Year 3', '3rd Year', 'Level 6'],
    'Year 4': ['Year 4', '4th Year', 'Level 7'],
  };
  const normalizeYear = (y: string) => {
    for (const [key, aliases] of Object.entries(YEAR_ALIASES)) {
      if (aliases.includes(y)) return key;
    }
    return y;
  };

  const filteredModuleList = useMemo(() => {
    if (!enrollProgramme) return [];
    return allModules.filter((m) => {
      const facultyMatch = !enrollFaculty || m.faculty === enrollFaculty;
      const programmeMatch = m.programme === enrollProgramme;
      const yearMatch = !enrollYear || normalizeYear(m.yearOfStudy ?? '') === normalizeYear(enrollYear ?? '');
      const semesterMatch =
        !enrollSemester ||
        m.semester === enrollSemester ||
        m.semester === 'Semester 1 & 2' ||
        enrollSemester === 'Semester 1 & 2';
      const notEnrolled = !enrolledModuleIds.has(m.id);
      return facultyMatch && programmeMatch && yearMatch && semesterMatch && notEnrolled;
    });
  }, [allModules, enrollFaculty, enrollProgramme, enrollYear, enrollSemester, enrolledModuleIds]);

  const semesterOptions = useMemo(() => {
    if (!enrollProgramme) return [];
    const sems = new Set(
      allModules
        .filter((m) =>
          (!enrollFaculty || m.faculty === enrollFaculty) &&
          m.programme === enrollProgramme &&
          (!enrollYear || normalizeYear(m.yearOfStudy ?? '') === normalizeYear(enrollYear ?? ''))
        )
        .map((m) => m.semester)
        .filter(Boolean)
    );
    return Array.from(sems).sort();
  }, [allModules, enrollFaculty, enrollProgramme, enrollYear]);

  const selectedEnrollModule = allModules.find((m) => m.id === enrollModuleId) ?? null;

  // Marks modal: modules the student is enrolled in
  const marksEnrolledModules = useMemo(
    () =>
      enrollments
        .map((e) => allModules.find((m) => m.id === e.moduleId || m.moduleCode === e.moduleId))
        .filter(Boolean) as ModuleInfo[],
    [enrollments, allModules]
  );

  const selectedMarksModule = allModules.find((m) => m.id === marksModuleId) ?? null;
  const marksComponentOptions = selectedMarksModule?.components ?? [];

  // Strip "__idx" suffix added to dropdown values to make duplicate names unique
  const stripCompIdx = (v: string) => v.replace(/__\d+$/, '');
  const marksAssessmentName = stripCompIdx(marksAssessment);

  const markNum = parseFloat(marksValue);
  const computedGrade =
    !isNaN(markNum) && markNum >= 0 && markNum <= 100 ? calculateGrade(markNum) : '';

  // Preview of weighted final mark after entering current component
  const selectedComponentWeight =
    selectedMarksModule?.components.find((c) => c.name === marksAssessmentName)?.weight ?? 0;

  const weightedFinalPreview = (() => {
    if (!marksModuleId || !marksAssessment || !selectedMarksModule || isNaN(markNum) || markNum < 0 || markNum > 100)
      return null;
    // Existing results for this module, excluding current component (will be replaced)
    const existing = results
      .filter((r) => r.moduleId === marksModuleId && r.assessmentComponent !== marksAssessmentName)
      .map((r) => ({
        mark: r.mark,
        weight: r.weight > 0
          ? r.weight
          : (selectedMarksModule.components.find((c) => c.name === r.assessmentComponent)?.weight ?? 0),
      }));
    const simulated = [...existing, { mark: markNum, weight: selectedComponentWeight }];
    const totalWeight = simulated.reduce((s, c) => s + c.weight, 0);
    if (totalWeight === 0) return null;
    const weighted = simulated.reduce((s, c) => s + (c.mark * c.weight) / 100, 0);
    const norm = totalWeight === 100 ? weighted : (weighted / totalWeight) * 100;
    const allComponents = selectedMarksModule.components.length;
    const enteredComponents = simulated.length;
    return { mark: norm, grade: calculateGrade(norm), pass: norm >= 40, allComponents, enteredComponents };
  })();

  // Academic summary
  const resultsByModule = useMemo(() => {
    const map = new Map<string, ResultRecord[]>();
    results.forEach((r) => {
      const arr = map.get(r.moduleId) ?? [];
      arr.push(r);
      map.set(r.moduleId, arr);
    });
    return map;
  }, [results]);

  const groupedResults = useMemo(() => {
    const groups: Record<string, ResultRecord[]> = {};
    results.forEach((r) => {
      const key = `${r.academicYear || 'Unknown Year'} — ${r.semester || 'Unknown Semester'}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(r);
    });
    return groups;
  }, [results]);

  const passedModulesCount = useMemo(() => {
    let count = 0;
    resultsByModule.forEach((recs) => {
      if (recs.some((r) => r.status === 'pass')) count++;
    });
    return count;
  }, [resultsByModule]);

  const failedModulesCount = useMemo(() => {
    let count = 0;
    resultsByModule.forEach((recs) => {
      if (recs.length > 0 && recs.every((r) => r.status === 'fail')) count++;
    });
    return count;
  }, [resultsByModule]);

  const missingSubmissions = useMemo(
    () => enrollments.filter((e) => {
      const mod = allModules.find((m) => m.id === e.moduleId || m.moduleCode === e.moduleId);
      const moduleCode = mod?.moduleCode ?? '';
      return !resultsByModule.has(e.moduleId) && !resultsByModule.has(moduleCode);
    }).length,
    [enrollments, resultsByModule, allModules]
  );

  // ── Enrollment handlers ──────────────────────────────────────────────────────
  const openEnrollModal = () => {
    setEnrollFaculty(programmeFacultyMap.get(selectedStudent?.programme ?? '') ?? '');
    setEnrollProgramme(selectedStudent?.programme ?? '');
    setEnrollYear(LEVEL_TO_YEAR[selectedStudent?.level ?? ''] ?? '');
    setEnrollSemester('Semester 1');
    setEnrollModuleId('');
    setShowEnrollModal(true);
  };

  const handleEnroll = async () => {
    if (!selectedStudent || !enrollModuleId || !selectedEnrollModule) return;
    if (enrolledModuleIds.has(enrollModuleId)) {
      toast.error('Student is already enrolled in this module');
      return;
    }
    setEnrolling(true);
    try {
      await addDoc(collection(db, 'moduleEnrollments'), {
        moduleId: selectedEnrollModule.id,
        moduleCode: selectedEnrollModule.moduleCode,
        moduleName: selectedEnrollModule.moduleName,
        studentId: selectedStudent.studentId,
        studentName: selectedStudent.name,
        programme: selectedStudent.programme,
        yearOfStudy: selectedStudent.level,
        enrolledBy: user?.name ?? 'Registry',
        enrolledAt: serverTimestamp(),
        status: 'enrolled',
      });
      toast.success(`Enrolled in ${selectedEnrollModule.moduleName}`);
      setShowEnrollModal(false);
      await loadProfile(selectedStudent.studentId);
    } catch {
      toast.error('Failed to enroll');
    } finally {
      setEnrolling(false);
    }
  };

  const handleRemoveEnrollment = async (enrollment: EnrollmentRecord) => {
    if (!selectedStudent) return;
    setRemoving(enrollment.docId);
    try {
      await deleteDoc(doc(db, 'moduleEnrollments', enrollment.docId));
      toast.success(`Removed from ${enrollment.moduleName}`);
      await loadProfile(selectedStudent.studentId);
    } catch {
      toast.error('Failed to remove enrollment');
    } finally {
      setRemoving(null);
    }
  };

  // ── GPA backfill ─────────────────────────────────────────────────────────────
  const handleRecalculateAllGPAs = async () => {
    setRecalculating(true);
    try {
      const studentsSnap = await getDocs(collection(db, 'students'));
      const total = studentsSnap.docs.length;
      let done = 0;
      const toastId = 'recalc-progress';
      toast.loading(`Recalculating GPAs... 0/${total} done`, { id: toastId });

      for (const studentDoc of studentsSnap.docs) {
        const resultsSnap = await getDocs(
          query(collection(db, 'results'), where('studentId', '==', studentDoc.data().studentId))
        );

        // Group by module — normalise moduleId: short string = moduleCode, long = doc ID
        const byModule = new Map<string, { mark: number; weight: number }[]>();
        resultsSnap.docs.forEach((d) => {
          const data = d.data();
          const key = (data.moduleId ?? '').length > 15
            ? data.moduleId
            : (data.moduleCode ?? data.moduleId ?? '');
          if (!key) return;
          const arr = byModule.get(key) ?? [];
          arr.push({ mark: data.mark ?? 0, weight: data.weight ?? 0 });
          byModule.set(key, arr);
        });

        const modulePoints: number[] = [];
        byModule.forEach((components) => {
          const totalWeight = components.reduce((s, c) => s + c.weight, 0);
          if (totalWeight > 0) {
            const weightedMark = components.reduce((s, c) => s + (c.mark * c.weight) / 100, 0);
            const normMark = totalWeight === 100 ? weightedMark : (weightedMark / totalWeight) * 100;
            modulePoints.push(gradeToPoints(calculateGrade(normMark)));
          } else {
            const avgMark = components.reduce((s, c) => s + c.mark, 0) / components.length;
            modulePoints.push(gradeToPoints(calculateGrade(avgMark)));
          }
        });

        const gpa =
          modulePoints.length > 0
            ? Math.round((modulePoints.reduce((s, p) => s + p, 0) / modulePoints.length) * 100) / 100
            : 0;

        await updateDoc(doc(db, 'students', studentDoc.id), { gpa });

        done++;
        toast.loading(`Recalculating GPAs... ${done}/${total} done`, { id: toastId });
      }

      toast.success('All GPAs recalculated successfully', { id: toastId });

      // Refresh student list
      const refreshed = await getDocs(collection(db, 'students'));
      setStudents(
        refreshed.docs.map((d) => ({
          docId: d.id,
          studentId: d.data().studentId ?? '',
          name: d.data().name ?? '',
          programme: d.data().programme ?? '',
          level: d.data().level ?? '',
          gpa: d.data().gpa ?? 0,
        })).sort((a, b) => a.studentId.localeCompare(b.studentId))
      );
    } catch {
      toast.error('GPA recalculation failed');
    } finally {
      setRecalculating(false);
    }
  };

  // ── Marks handlers ───────────────────────────────────────────────────────────
  const handleDeleteMark = async (resultId: string) => {
    if (!selectedStudent) return;
    setDeletingMarkId(resultId);
    try {
      await deleteDoc(doc(db, 'results', resultId));

      // Recalculate GPA using weighted marks per module
      const allResultsSnap = await getDocs(
        query(collection(db, 'results'), where('studentId', '==', selectedStudent.studentId))
      );
      const byModule = new Map<string, { mark: number; weight: number }[]>();
      allResultsSnap.docs.forEach((d) => {
        const data = d.data();
        const key = (data.moduleId ?? '').length > 15
          ? data.moduleId
          : (data.moduleCode ?? data.moduleId ?? '');
        if (!key) return;
        const arr = byModule.get(key) ?? [];
        arr.push({ mark: data.mark ?? 0, weight: data.weight ?? 0 });
        byModule.set(key, arr);
      });
      const modulePoints: number[] = [];
      byModule.forEach((components) => {
        const totalWeight = components.reduce((s, c) => s + c.weight, 0);
        if (totalWeight > 0) {
          const weightedMark = components.reduce((s, c) => s + (c.mark * c.weight) / 100, 0);
          const normMark = totalWeight === 100 ? weightedMark : (weightedMark / totalWeight) * 100;
          modulePoints.push(gradeToPoints(calculateGrade(normMark)));
        } else {
          const avgMark = components.reduce((s, c) => s + c.mark, 0) / components.length;
          modulePoints.push(gradeToPoints(calculateGrade(avgMark)));
        }
      });
      const gpa = modulePoints.length > 0
        ? Math.round((modulePoints.reduce((s, p) => s + p, 0) / modulePoints.length) * 100) / 100
        : 0;
      await updateDoc(doc(db, 'students', selectedStudent.docId), { gpa });

      const updated = { ...selectedStudent, gpa };
      setSelectedStudent(updated);
      setStudents((prev) => prev.map((s) => (s.docId === selectedStudent.docId ? updated : s)));

      await loadProfile(selectedStudent.studentId);
      toast.success('Mark deleted successfully');
    } catch {
      toast.error('Failed to delete mark');
    } finally {
      setDeletingMarkId(null);
      setConfirmDeleteMarkId(null);
    }
  };

  const openMarksModal = () => {
    setMarksModuleId('');
    setMarksAssessment('');
    setMarksAcademicYear(currentAcademicYear());
    setMarksSemester('');
    setMarksValue('');
    setShowMarksModal(true);
  };

  const handleSaveMark = async () => {
    if (
      !selectedStudent ||
      !marksModuleId ||
      !marksAssessment ||
      !marksAcademicYear.trim() ||
      !marksSemester ||
      !marksValue
    ) {
      toast.error('Please fill in all fields');
      return;
    }
    const mark = parseFloat(marksValue);
    if (isNaN(mark) || mark < 0 || mark > 100) {
      toast.error('Mark must be between 0 and 100');
      return;
    }
    const mod = selectedMarksModule;
    if (!mod) return;

    const assessmentName = stripCompIdx(marksAssessment);
    const componentWeight = mod.components.find((c) => c.name === assessmentName)?.weight ?? 0;

    setSavingMark(true);
    try {
      const grade = calculateGrade(mark);
      const status = mark >= 40 ? 'pass' : 'fail';

      // Upsert: 2-field Firestore query + client-side filter to avoid composite index
      const existingSnap = await getDocs(
        query(
          collection(db, 'results'),
          where('studentId', '==', selectedStudent.studentId),
          where('moduleId', '==', mod.id)
        )
      );
      const existingDoc = existingSnap.docs.find(
        (d) =>
          d.data().assessmentComponent === assessmentName &&
          d.data().academicYear === marksAcademicYear.trim() &&
          d.data().semester === marksSemester
      );

      if (existingDoc) {
        await updateDoc(doc(db, 'results', existingDoc.id), {
          mark,
          grade,
          status,
          weight: componentWeight,
          uploadedBy: user?.name ?? 'Registry',
        });
      } else {
        await addDoc(collection(db, 'results'), {
          moduleId: mod.id,
          moduleCode: mod.moduleCode,
          moduleName: mod.moduleName,
          studentId: selectedStudent.studentId,
          studentName: selectedStudent.name,
          programme: selectedStudent.programme,
          yearOfStudy: selectedStudent.level,
          assessmentComponent: assessmentName,
          academicYear: marksAcademicYear.trim(),
          semester: marksSemester,
          mark,
          grade,
          status,
          weight: componentWeight,
          uploadedBy: user?.name ?? 'Registry',
          createdAt: serverTimestamp(),
        });
      }

      // Recalculate GPA using weighted marks per module
      const allResultsSnap = await getDocs(
        query(collection(db, 'results'), where('studentId', '==', selectedStudent.studentId))
      );

      // Group results by module — normalise key: short string = moduleCode, long = doc ID
      const byModule = new Map<string, { mark: number; weight: number }[]>();
      allResultsSnap.docs.forEach((d) => {
        const data = d.data();
        const key = (data.moduleId ?? '').length > 15
          ? data.moduleId
          : (data.moduleCode ?? data.moduleId ?? '');
        if (!key) return;
        const arr = byModule.get(key) ?? [];
        arr.push({ mark: data.mark ?? 0, weight: data.weight ?? 0 });
        byModule.set(key, arr);
      });

      // Per module: compute weighted mark → grade points
      const modulePoints: number[] = [];
      byModule.forEach((components) => {
        const totalWeight = components.reduce((sum, c) => sum + c.weight, 0);
        if (totalWeight > 0) {
          const weightedMark = components.reduce((sum, c) => sum + (c.mark * c.weight) / 100, 0);
          // Normalise in case weights don't perfectly sum to 100
          const normalisedMark = totalWeight === 100 ? weightedMark : (weightedMark / totalWeight) * 100;
          modulePoints.push(gradeToPoints(calculateGrade(normalisedMark)));
        } else {
          // Fallback: equal weighting (no weight stored for legacy records)
          const avgMark = components.reduce((sum, c) => sum + c.mark, 0) / components.length;
          modulePoints.push(gradeToPoints(calculateGrade(avgMark)));
        }
      });

      const gpa =
        modulePoints.length > 0
          ? Math.round((modulePoints.reduce((sum, p) => sum + p, 0) / modulePoints.length) * 100) / 100
          : 0;
      await updateDoc(doc(db, 'students', selectedStudent.docId), { gpa });

      // Update local state
      const updated = { ...selectedStudent, gpa };
      setSelectedStudent(updated);
      setStudents((prev) =>
        prev.map((s) => (s.docId === selectedStudent.docId ? updated : s))
      );

      toast.success('Mark saved');
      setShowMarksModal(false);
      await loadProfile(selectedStudent.studentId);
    } catch {
      toast.error('Failed to save mark');
    } finally {
      setSavingMark(false);
    }
  };

  // ── Academic Standing badge helper ───────────────────────────────────────────
  const standingBadge = (gpa: number) => {
    const { label, color } = getAcademicStanding(gpa);
    const cls =
      color === 'green' ? 'bg-green-100 text-green-800 border-green-200' :
      color === 'blue'  ? 'bg-blue-100 text-blue-800 border-blue-200' :
      color === 'amber' ? 'bg-amber-100 text-amber-800 border-amber-200' :
      color === 'red'   ? 'bg-red-100 text-red-800 border-red-200' :
                          'bg-gray-100 text-gray-600 border-gray-200';
    return <Badge className={`${cls} text-xs`}>{label}</Badge>;
  };

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Academic Records</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Manage student module enrollments and marks
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleRecalculateAllGPAs}
          disabled={recalculating}
          className="shrink-0"
        >
          {recalculating ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4 mr-2" />
          )}
          Recalculate All GPAs
        </Button>
      </div>


      {/* Main layout */}
      <div className={`flex gap-6 items-start ${selectedStudent ? '' : 'flex-col'}`}>
        {/* Left: Student Search */}
        <div className={selectedStudent ? 'w-[360px] shrink-0' : 'w-full'}>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Users className="h-4 w-4" />
                Student Search
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="relative mb-3">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name or student ID…"
                  className="pl-9"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              {/* Filter + sort controls */}
              {!selectedStudent && (
                <>
                  <div className="grid grid-cols-3 gap-2 mb-2">
                    <Select
                      value={filterFaculty || '_all'}
                      onValueChange={(v) => {
                        setFilterFaculty(v === '_all' ? '' : v);
                        setFilterProgramme('');
                      }}
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue placeholder="Faculty" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="_all">All Faculties</SelectItem>
                        {studentFacultyOptions.map((f) => (
                          <SelectItem key={f} value={f}>{f}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <Select
                      value={filterProgramme || '_all'}
                      onValueChange={(v) => setFilterProgramme(v === '_all' ? '' : v)}
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue placeholder="Programme" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="_all">All Programmes</SelectItem>
                        {studentProgrammeOptions.map((p) => (
                          <SelectItem key={p} value={p}>{p}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <Select
                      value={filterYear || '_all'}
                      onValueChange={(v) => setFilterYear(v === '_all' ? '' : v)}
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue placeholder="Year" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="_all">All Years</SelectItem>
                        {['Year 1', 'Year 2', 'Year 3', 'Year 4'].map((y) => (
                          <SelectItem key={y} value={y}>{y}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                  </div>

                  {/* Sort + counts row */}
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-muted-foreground">Sort:</span>
                      <Select value={sortBy} onValueChange={(v) => setSortBy(v as typeof sortBy)}>
                        <SelectTrigger className="h-7 text-xs w-[150px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="risk">Standing (Probation first)</SelectItem>
                          <SelectItem value="id">Student ID</SelectItem>
                          <SelectItem value="name">Name</SelectItem>
                          <SelectItem value="gpa">GPA (Low first)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Showing{' '}
                      <span className="font-medium text-foreground">
                        {filteredStudents.length === 0 ? 0 : Math.min((currentPage - 1) * STUDENTS_PER_PAGE + 1, filteredStudents.length)}–{Math.min(currentPage * STUDENTS_PER_PAGE, filteredStudents.length)}
                      </span>
                      {' of '}
                      <span className="font-medium text-foreground">{filteredStudents.length}</span>
                      {' students'}
                    </div>
                  </div>
                </>
              )}


              {loadingStudents ? (
                <div className="flex items-center justify-center h-24">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <div className="overflow-x-auto rounded-md border max-h-[480px] overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 z-10">
                      <tr className="bg-gray-50 border-b">
                        <th className="text-left font-medium text-muted-foreground px-4 py-3">
                          Student ID
                        </th>
                        <th className="text-left font-medium text-muted-foreground px-4 py-3">
                          Name
                        </th>
                        {!selectedStudent && (
                          <>
                            <th className="text-left font-medium text-muted-foreground px-4 py-3 hidden md:table-cell">
                              Programme
                            </th>
                            <th className="text-left font-medium text-muted-foreground px-4 py-3 hidden md:table-cell">
                              Year
                            </th>
                            <th className="text-left font-medium text-muted-foreground px-4 py-3 hidden lg:table-cell">
                              GPA
                            </th>
                          </>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredStudents.length === 0 ? (
                        <tr>
                          <td
                            colSpan={selectedStudent ? 2 : 6}
                            className="text-center py-8 text-muted-foreground text-sm"
                          >
                            {searchQuery || filterFaculty || filterProgramme || filterYear
                              ? 'No students match the selected filters'
                              : 'No students'}
                          </td>
                        </tr>
                      ) : (
                        paginatedStudents.map((student) => (
                          <tr
                            key={student.docId}
                            className={`border-b last:border-0 cursor-pointer transition-colors border-l-4 ${
                              getAcademicStanding(student.gpa).label === 'Academic Probation'
                                ? 'border-l-red-500'
                                : getAcademicStanding(student.gpa).label === 'Academic Warning'
                                ? 'border-l-amber-400'
                                : 'border-l-transparent'
                            } ${
                              selectedStudent?.docId === student.docId
                                ? 'bg-blue-50 hover:bg-blue-50'
                                : 'hover:bg-gray-50'
                            }`}
                            onClick={() => handleSelectStudent(student)}
                          >
                            <td className="px-4 py-3 font-mono text-xs">{student.studentId}</td>
                            <td className="px-4 py-3 font-medium">{student.name}</td>
                            {!selectedStudent && (
                              <>
                                <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">
                                  {student.programme || '—'}
                                </td>
                                <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">
                                  {(LEVEL_TO_YEAR[student.level] ?? student.level) || '—'}
                                </td>
                                <td className="px-4 py-3 hidden lg:table-cell">
                                  {student.gpa?.toFixed(2) ?? '—'}
                                </td>
                              </>
                            )}
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Pagination */}
              {!loadingStudents && filteredStudents.length > STUDENTS_PER_PAGE && (
                <div className="flex items-center justify-between mt-4 px-1">
                  <p className="text-sm text-muted-foreground">
                    Showing {Math.min((currentPage - 1) * STUDENTS_PER_PAGE + 1, filteredStudents.length)}–{Math.min(currentPage * STUDENTS_PER_PAGE, filteredStudents.length)} of {filteredStudents.length} students
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={currentPage === 1}
                      onClick={() => setCurrentPage((p) => p - 1)}
                    >
                      Previous
                    </Button>
                    <span className="text-sm flex items-center px-2">
                      Page {currentPage} of {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={currentPage === totalPages || totalPages === 0}
                      onClick={() => setCurrentPage((p) => p + 1)}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right: Academic Profile Panel */}
        {selectedStudent && (
          <div className="flex-1 min-w-0">
            <Card>
              <CardHeader className="pb-0">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <CardTitle className="text-base flex items-center gap-2">
                      <User className="h-4 w-4" />
                      {selectedStudent.name}
                    </CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">
                      {selectedStudent.studentId}
                      {selectedStudent.programme ? ` · ${selectedStudent.programme}` : ''}
                      {selectedStudent.level ? ` · ${selectedStudent.level}` : ''}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 shrink-0"
                    onClick={() => {
                      setSelectedStudent(null);
                      setEnrollments([]);
                      setResults([]);
                    }}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>

                {/* Tab bar */}
                <div className="flex gap-0 mt-4 border-b -mx-6 px-6">
                  {(
                    [
                      { key: 'modules', label: 'Enrolled Modules', icon: BookOpen },
                      { key: 'marks', label: 'Marks', icon: BarChart2 },
                      { key: 'summary', label: 'Academic Summary', icon: GraduationCap },
                    ] as const
                  ).map(({ key, label, icon: Icon }) => (
                    <button
                      key={key}
                      className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
                        activeTab === key
                          ? 'border-primary text-primary'
                          : 'border-transparent text-muted-foreground hover:text-foreground'
                      }`}
                      onClick={() => setActiveTab(key)}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      {label}
                    </button>
                  ))}
                </div>
              </CardHeader>

              <CardContent className="pt-5">
                {loadingProfile ? (
                  <div className="flex items-center justify-center h-40">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <>
                    {/* ── Tab 1: Enrolled Modules ── */}
                    {activeTab === 'modules' && (
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <p className="text-sm text-muted-foreground">
                            {enrollments.length} module{enrollments.length !== 1 ? 's' : ''}{' '}
                            enrolled
                          </p>
                          <Button size="sm" className="gap-1.5" onClick={openEnrollModal}>
                            <Plus className="h-4 w-4" />
                            Enroll in Module
                          </Button>
                        </div>

                        {enrollments.length === 0 ? (
                          <div className="text-center py-12 text-muted-foreground">
                            <BookOpen className="h-10 w-10 mx-auto mb-3 opacity-30" />
                            <p className="text-sm">No module enrollments yet</p>
                          </div>
                        ) : (
                          <div className="overflow-x-auto rounded-md border">
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="bg-gray-50 border-b">
                                  <th className="text-left font-medium text-muted-foreground px-4 py-3">
                                    Module Code
                                  </th>
                                  <th className="text-left font-medium text-muted-foreground px-4 py-3">
                                    Module Name
                                  </th>
                                  <th className="text-left font-medium text-muted-foreground px-4 py-3 hidden sm:table-cell">
                                    Semester
                                  </th>
                                  <th className="text-left font-medium text-muted-foreground px-4 py-3 hidden sm:table-cell">
                                    Credits
                                  </th>
                                  <th className="text-left font-medium text-muted-foreground px-4 py-3">
                                    Marks Status
                                  </th>
                                  <th className="px-4 py-3 w-10" />
                                </tr>
                              </thead>
                              <tbody>
                                {enrollments.map((enrollment) => {
                                  const mod = allModules.find(
                                    (m) => m.id === enrollment.moduleId || m.moduleCode === enrollment.moduleId
                                  );
                                  const hasMarks = resultsByModule.has(enrollment.moduleId);
                                  return (
                                    <tr
                                      key={enrollment.docId}
                                      className="border-b last:border-0 hover:bg-gray-50"
                                    >
                                      <td className="px-4 py-3 font-mono text-xs">
                                        {enrollment.moduleCode || mod?.moduleCode || '—'}
                                      </td>
                                      <td className="px-4 py-3 font-medium">
                                        {enrollment.moduleName || mod?.moduleName || '—'}
                                      </td>
                                      <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell">
                                        {mod?.semester || '—'}
                                      </td>
                                      <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell">
                                        {mod?.credits || '—'}
                                      </td>
                                      <td className="px-4 py-3">
                                        {hasMarks ? (
                                          <Badge className="bg-green-100 text-green-800 border-green-200 text-xs">
                                            Entered
                                          </Badge>
                                        ) : (
                                          <Badge
                                            variant="outline"
                                            className="text-xs text-muted-foreground"
                                          >
                                            Pending
                                          </Badge>
                                        )}
                                      </td>
                                      <td className="px-4 py-3">
                                        <Button
                                          size="sm"
                                          variant="ghost"
                                          className="h-8 w-8 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                                          disabled={removing === enrollment.docId}
                                          onClick={() => handleRemoveEnrollment(enrollment)}
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
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    )}

                    {/* ── Tab 2: Marks ── */}
                    {activeTab === 'marks' && (
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <p className="text-sm text-muted-foreground">
                            {results.length} mark record{results.length !== 1 ? 's' : ''}
                          </p>
                          <Button
                            size="sm"
                            className="gap-1.5"
                            onClick={openMarksModal}
                            disabled={enrollments.length === 0}
                            title={
                              enrollments.length === 0
                                ? 'Enroll student in a module first'
                                : undefined
                            }
                          >
                            <Plus className="h-4 w-4" />
                            Enter Marks
                          </Button>
                        </div>

                        {results.length === 0 ? (
                          <div className="text-center py-12 text-muted-foreground">
                            <BarChart2 className="h-10 w-10 mx-auto mb-3 opacity-30" />
                            <p className="text-sm">No marks recorded yet</p>
                          </div>
                        ) : (
                          <div className="space-y-4">
                            {Object.entries(groupedResults).map(([termKey, termResults]) => {
                              // Group this term's results by moduleId
                              const grouped = new Map<string, ResultRecord[]>();
                              termResults.forEach((r) => {
                                const arr = grouped.get(r.moduleId) ?? [];
                                arr.push(r);
                                grouped.set(r.moduleId, arr);
                              });

                              const rows: React.ReactNode[] = [];
                              grouped.forEach((components, moduleId) => {
                                const first = components[0];
                                const moduleInfo = allModules.find((m) => m.id === moduleId || m.moduleCode === moduleId);

                                const withWeight = components.map((r) => ({
                                  ...r,
                                  effectiveWeight:
                                    r.weight > 0
                                      ? r.weight
                                      : (moduleInfo?.components.find((c) => c.name === r.assessmentComponent)?.weight ?? 0),
                                }));

                                const totalWeight = withWeight.reduce((s, r) => s + r.effectiveWeight, 0);
                                const weightedMark = totalWeight > 0
                                  ? withWeight.reduce((s, r) => s + (r.mark * r.effectiveWeight) / 100, 0)
                                  : withWeight.reduce((s, r) => s + r.mark, 0) / withWeight.length;
                                const normMark = totalWeight > 0 && totalWeight !== 100
                                  ? (weightedMark / totalWeight) * 100
                                  : weightedMark;
                                const finalGrade = calculateGrade(normMark);
                                const finalStatus = normMark >= 40 ? 'pass' : 'fail';
                                const rowSpan = components.length;

                                withWeight.forEach((result, idx) => {
                                  rows.push(
                                    <tr key={result.id} className="border-b last:border-0 hover:bg-gray-50">
                                      {idx === 0 && (
                                        <td className="px-4 py-3 align-top" rowSpan={rowSpan}>
                                          <p className="font-mono text-xs font-semibold">{first.moduleCode}</p>
                                          <p className="text-muted-foreground text-xs mt-0.5">{first.moduleName}</p>
                                        </td>
                                      )}
                                      <td className="px-4 py-3 text-muted-foreground pl-6">
                                        {result.assessmentComponent}
                                      </td>
                                      <td className="px-4 py-3 font-semibold">{result.mark}</td>
                                      <td className="px-4 py-3 text-muted-foreground">
                                        {result.effectiveWeight > 0 ? `${result.effectiveWeight}%` : '—'}
                                      </td>
                                      <td className="px-4 py-3">
                                        <Badge className={`text-xs ${gradeBadgeClass(result.grade)}`}>
                                          {result.grade}
                                        </Badge>
                                      </td>
                                      <td className="px-4 py-3">
                                        <Badge className={`text-xs ${
                                          result.status === 'pass'
                                            ? 'bg-green-100 text-green-800 border-green-200'
                                            : 'bg-red-100 text-red-800 border-red-200'
                                        }`}>
                                          {result.status === 'pass' ? 'Pass' : 'Fail'}
                                        </Badge>
                                      </td>
                                      {idx === 0 && (
                                        <td className="px-4 py-3 align-top" rowSpan={rowSpan}>
                                          <p className="font-bold text-base">{normMark.toFixed(1)}</p>
                                          <Badge className={`text-xs mt-1 ${gradeBadgeClass(finalGrade)}`}>
                                            {finalGrade}
                                          </Badge>
                                          <Badge className={`text-xs mt-1 ml-1 ${
                                            finalStatus === 'pass'
                                              ? 'bg-green-100 text-green-800 border-green-200'
                                              : 'bg-red-100 text-red-800 border-red-200'
                                          }`}>
                                            {finalStatus === 'pass' ? 'Pass' : 'Fail'}
                                          </Badge>
                                        </td>
                                      )}
                                      <td className="px-4 py-3">
                                        <button
                                          onClick={() => setConfirmDeleteMarkId(result.id)}
                                          disabled={deletingMarkId === result.id}
                                          className="p-1 rounded text-muted-foreground hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-40"
                                          title="Delete mark"
                                        >
                                          {deletingMarkId === result.id
                                            ? <Loader2 className="h-4 w-4 animate-spin" />
                                            : <Trash2 className="h-4 w-4" />}
                                        </button>
                                      </td>
                                    </tr>
                                  );
                                });
                              });

                              return (
                                <div key={termKey}>
                                  <h4 className="text-sm font-semibold text-muted-foreground mb-2 px-1 border-b pb-1">{termKey}</h4>
                                  <div className="overflow-x-auto rounded-md border">
                                    <table className="w-full text-sm">
                                      <thead>
                                        <tr className="bg-gray-50 border-b">
                                          <th className="text-left font-medium text-muted-foreground px-4 py-3">Module</th>
                                          <th className="text-left font-medium text-muted-foreground px-4 py-3">Assessment</th>
                                          <th className="text-left font-medium text-muted-foreground px-4 py-3">Mark</th>
                                          <th className="text-left font-medium text-muted-foreground px-4 py-3">Weight</th>
                                          <th className="text-left font-medium text-muted-foreground px-4 py-3">Grade</th>
                                          <th className="text-left font-medium text-muted-foreground px-4 py-3">Status</th>
                                          <th className="text-left font-medium text-muted-foreground px-4 py-3">Final Mark</th>
                                          <th className="px-4 py-3"></th>
                                        </tr>
                                      </thead>
                                      <tbody>{rows}</tbody>
                                    </table>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}

                    {/* ── Tab 3: Academic Summary ── */}
                    {activeTab === 'summary' && (
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                        <div className="rounded-lg border p-4">
                          <p className="text-xs text-muted-foreground">GPA</p>
                          <p className="text-2xl font-bold mt-1">
                            {selectedStudent.gpa?.toFixed(2) ?? '0.00'}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">out of 4.00</p>
                        </div>
                        <div className="rounded-lg border p-4">
                          <p className="text-xs text-muted-foreground">Academic Standing</p>
                          <div className="mt-2">{standingBadge(selectedStudent.gpa)}</div>
                        </div>
                        <div className="rounded-lg border p-4">
                          <p className="text-xs text-muted-foreground">Total Enrolled</p>
                          <p className="text-2xl font-bold mt-1">{enrollments.length}</p>
                          <p className="text-xs text-muted-foreground mt-1">modules</p>
                        </div>
                        <div className="rounded-lg border p-4">
                          <p className="text-xs text-muted-foreground">Passed Modules</p>
                          <p className="text-2xl font-bold mt-1 text-green-600">
                            {passedModulesCount}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">at least one pass</p>
                        </div>
                        <div className="rounded-lg border p-4">
                          <p className="text-xs text-muted-foreground">Failed Modules</p>
                          <p className="text-2xl font-bold mt-1 text-red-600">
                            {failedModulesCount}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">no passing mark</p>
                        </div>
                        <div className="rounded-lg border p-4 col-span-2 sm:col-span-1">
                          <p className="text-xs text-muted-foreground">Missing Submissions</p>
                          <p className="text-2xl font-bold mt-1 text-amber-600">
                            {missingSubmissions}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            enrolled, no marks entered
                          </p>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {/* ── Enroll in Module Modal ── */}
      <Dialog open={showEnrollModal} onOpenChange={setShowEnrollModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Enroll in Module</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {/* Student info (read-only) */}
            <div className="rounded-lg bg-gray-50 border px-4 py-3 text-sm">
              <p className="font-medium">Enrolling: {selectedStudent?.name}</p>
              <p className="text-muted-foreground mt-0.5">
                {selectedStudent?.programme} — {selectedStudent?.level}
              </p>
            </div>

            <div className="space-y-1.5">
              <Label>Semester</Label>
              <Select
                value={enrollSemester}
                onValueChange={(v) => {
                  setEnrollSemester(v);
                  setEnrollModuleId('');
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="— Select semester —" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Semester 1">Semester 1</SelectItem>
                  <SelectItem value="Semester 2">Semester 2</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Module</Label>
              <Select
                value={enrollModuleId}
                onValueChange={setEnrollModuleId}
                disabled={!enrollSemester}
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={
                      !enrollSemester
                        ? 'Select a semester first'
                        : filteredModuleList.length === 0
                        ? 'No modules available'
                        : '— Select module —'
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {filteredModuleList.map((m) => (
                    <SelectItem
                      key={m.id}
                      value={m.id}
                      disabled={enrolledModuleIds.has(m.id)}
                    >
                      {m.moduleCode} — {m.moduleName}
                      {enrolledModuleIds.has(m.id) ? ' (already enrolled)' : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEnrollModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleEnroll} disabled={!enrollModuleId || enrolling}>
              {enrolling ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Enrolling…
                </>
              ) : (
                'Enroll'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Enter Marks Modal ── */}
      <Dialog open={showMarksModal} onOpenChange={setShowMarksModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {marksModuleId && marksAssessment
                ? `Enter Mark — ${selectedMarksModule?.moduleCode}: ${marksAssessmentName}`
                : 'Enter Mark'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {/* Step 1: Select Module */}
            <div className="space-y-1.5">
              <Label>Module</Label>
              <Select
                value={marksModuleId}
                onValueChange={(v) => {
                  setMarksModuleId(v);
                  setMarksAssessment('');
                  const mod = allModules.find((m) => m.id === v);
                  if (mod) setMarksSemester(mod.semester);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="— Select module —" />
                </SelectTrigger>
                <SelectContent>
                  {marksEnrolledModules.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.moduleCode} — {m.moduleName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Step 2: Select Component */}
            <div className="space-y-1.5">
              <Label>Assessment Component</Label>
              <Select
                value={marksAssessment}
                onValueChange={setMarksAssessment}
                disabled={!marksModuleId}
              >
                <SelectTrigger>
                  <SelectValue placeholder={!marksModuleId ? 'Select module first' : '— Select component —'} />
                </SelectTrigger>
                <SelectContent>
                  {marksComponentOptions.length > 0 ? (
                    marksComponentOptions.map((comp, idx) => (
                      <SelectItem key={idx} value={`${comp.name}__${idx}`}>
                        {comp.name}{comp.weight > 0 ? ` (${comp.weight}%)` : ''}
                      </SelectItem>
                    ))
                  ) : (
                    <SelectItem value="_none" disabled>No components defined</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>

            {/* Auto-filled info (shown once module + component selected) */}
            {marksModuleId && marksAssessment && (
              <div className="rounded-lg border bg-gray-50 p-3 space-y-1.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Academic Year</span>
                  <span className="font-medium">{marksAcademicYear}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Semester</span>
                  <span className="font-medium">{marksSemester || '—'}</span>
                </div>
                {selectedComponentWeight > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Component Weight</span>
                    <span className="font-medium">{selectedComponentWeight}%</span>
                  </div>
                )}
              </div>
            )}

            {/* Step 3: Enter mark */}
            <div className="space-y-1.5">
              <Label>Mark (0–100)</Label>
              <Input
                type="number"
                min={0}
                max={100}
                placeholder="Enter mark"
                value={marksValue}
                onChange={(e) => setMarksValue(e.target.value)}
                autoFocus={!!marksAssessment}
              />
            </div>

            {/* Live preview */}
            {computedGrade && (
              <div className="space-y-2">
                <div className="flex items-center gap-3 rounded-lg bg-gray-50 border p-3">
                  <span className="text-sm text-muted-foreground">This component:</span>
                  <Badge className={`${gradeBadgeClass(computedGrade)} text-sm font-bold`}>
                    {computedGrade}
                  </Badge>
                  <Badge className={`text-xs ${markNum >= 40 ? 'bg-green-100 text-green-800 border-green-200' : 'bg-red-100 text-red-800 border-red-200'}`}>
                    {markNum >= 40 ? 'Pass' : 'Fail'}
                  </Badge>
                  <span className="text-sm font-semibold ml-auto">{markNum}</span>
                </div>

                {weightedFinalPreview && weightedFinalPreview.enteredComponents > 1 && (
                  <div className="flex items-center gap-3 rounded-lg border border-blue-200 bg-blue-50 p-3">
                    <span className="text-sm text-blue-700">
                      Weighted final ({weightedFinalPreview.enteredComponents}/{weightedFinalPreview.allComponents} components):
                    </span>
                    <Badge className={`${gradeBadgeClass(weightedFinalPreview.grade)} text-sm font-bold`}>
                      {weightedFinalPreview.grade}
                    </Badge>
                    <Badge className={`text-xs ${weightedFinalPreview.pass ? 'bg-green-100 text-green-800 border-green-200' : 'bg-red-100 text-red-800 border-red-200'}`}>
                      {weightedFinalPreview.pass ? 'Pass' : 'Fail'}
                    </Badge>
                    <span className="text-sm font-semibold ml-auto">{weightedFinalPreview.mark.toFixed(1)}</span>
                  </div>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowMarksModal(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSaveMark}
              disabled={savingMark || !marksModuleId || !marksAssessment || !marksValue}
            >
              {savingMark ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving…
                </>
              ) : (
                'Save Mark'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete Mark Confirmation ── */}
      {(() => {
        const target = results.find((r) => r.id === confirmDeleteMarkId);
        return (
          <Dialog open={!!confirmDeleteMarkId} onOpenChange={(open) => { if (!open) setConfirmDeleteMarkId(null); }}>
            <DialogContent className="max-w-sm">
              <DialogHeader>
                <DialogTitle>Delete Mark</DialogTitle>
              </DialogHeader>
              <div className="py-2 space-y-2 text-sm">
                <p>Are you sure you want to delete this mark?</p>
                {target && (
                  <div className="rounded-md border bg-gray-50 p-3 space-y-1">
                    <p><span className="text-muted-foreground">Module:</span> <span className="font-medium">{target.moduleCode}</span></p>
                    <p><span className="text-muted-foreground">Assessment:</span> <span className="font-medium">{target.assessmentComponent}</span></p>
                    <p><span className="text-muted-foreground">Mark:</span> <span className="font-medium">{target.mark}</span></p>
                  </div>
                )}
                <p className="text-muted-foreground text-xs">This will recalculate the student's GPA.</p>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setConfirmDeleteMarkId(null)} disabled={!!deletingMarkId}>
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => confirmDeleteMarkId && handleDeleteMark(confirmDeleteMarkId)}
                  disabled={!!deletingMarkId}
                >
                  {deletingMarkId ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Deleting…</>
                  ) : 'Delete Mark'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        );
      })()}
    </div>
  );
}
