import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { collection, getDocs, getDoc, doc, query, where } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../AuthContext';

export interface ModuleAttendance {
  moduleCode: string;
  moduleName: string;
  total: number;
  present: number;
  absent: number;
  percentage: number;
}

export interface SSAMessage {
  id: string;
  date: string;
  notes: string;
  recordedBy: string;
  interventionType: string;
}

export interface StudentResult {
  moduleCode: string;
  moduleName: string;
  overall: number;
  grade: string;
  semester: string;
  academicYear: string;
  assessmentComponent: string;
  weight: number;
  components: { name: string; mark: number }[];
}

export interface StudentData {
  studentId: string;
  firestoreId: string;
  name: string;
  email: string;
  programme: string;
  faculty: string;
  level: string;
  academicYear: string;
  enrollmentStatus: string;
  phone: string;
  attendancePercentage: number;
  consecutiveAbsences: number;
  gpa: number;
  uid: string;
  academicMentor: string;
  riskLevel: string;
  engagementScore: number;
  enrollmentDate: string;
  nationality: string;
  gender: string;
  flagged: boolean;
  academic_warning_count: number;
  advisorMeetingCount: number;
  attendanceBySemester: number[];

  moduleAttendance: ModuleAttendance[];
  results: StudentResult[];
  ssaMessages: SSAMessage[];
  appointments: any[];
  mentor: { name: string; department: string } | null;
}

interface StudentDataContextType {
  studentData: StudentData | null;
  loading: boolean;
  refresh: () => void;
}

const StudentDataContext = createContext<StudentDataContextType>({
  studentData: null,
  loading: true,
  refresh: () => {},
});

export function StudentDataProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [studentData, setStudentData] = useState<StudentData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchAll = async () => {
    if (!user?.id && !user?.email) { setLoading(false); return; }
    setLoading(true);
    try {
      // 1. Resolve student doc — direct fetch first (user.id IS the Firestore doc ID)
      let docId: string = '';
      let d: any = null;

      if (user?.id) {
        const directRef = await getDoc(doc(db, 'students', user.id));
        if (directRef.exists()) {
          docId = directRef.id;
          d = directRef.data();
        }
      }

      // Fallback: search by email
      if (!d && user?.email) {
        const emailSnap = await getDocs(
          query(collection(db, 'students'), where('email', '==', user.email))
        );
        if (!emailSnap.empty) {
          docId = emailSnap.docs[0].id;
          d = emailSnap.docs[0].data();
        }
      }

      if (!d) { setLoading(false); return; }
      const studentId = d.studentId ?? docId;
      const mentorName: string = d.academicMentor ?? d.mentorName ?? '';

      // 2. Fetch everything in parallel
      const [
        mentorSnap,
        attendanceSnap,
        modulesSnap,
        resultsSnap,
        intSnap,
        appointmentsSnap,
      ] = await Promise.all([
        mentorName
          ? getDocs(query(collection(db, 'academic_mentors'), where('name', '==', mentorName)))
          : Promise.resolve(null),
        getDocs(query(collection(db, 'attendance'), where('studentId', '==', docId))),
        getDocs(collection(db, 'modules')),
        studentId
          ? getDocs(query(collection(db, 'results'), where('studentId', '==', studentId)))
          : Promise.resolve(null),
        studentId
          ? getDocs(query(
              collection(db, 'interventions'),
              where('studentId', '==', studentId)
            ))
          : Promise.resolve(null),
        getDocs(query(collection(db, 'appointments'), where('studentId', '==', user?.id ?? ''))),
      ]);

      // 3. Build module lookup maps
      const moduleByCode = new Map<string, string>();
      const moduleById = new Map<string, { code: string; name: string }>();
      modulesSnap.forEach((m) => {
        const code = m.data().moduleCode ?? '';
        const name = m.data().moduleName ?? '';
        if (code) moduleByCode.set(code, name);
        moduleById.set(m.id, { code, name });
      });

      // 4. Process attendance — fallback to studentId field if docId query returned nothing
      let attDocs = attendanceSnap.docs;
      if (attDocs.length === 0) {
        const fallback = await getDocs(
          query(collection(db, 'attendance'), where('studentId', '==', d.studentId ?? docId))
        );
        attDocs = fallback.docs;
      }

      type ModAgg = { moduleCode: string; moduleName: string; total: number; present: number; absent: number };
      const moduleMap = new Map<string, ModAgg>();

      attDocs.forEach((attDoc) => {
        const data = attDoc.data();
        const rawKey = data.moduleCode || data.moduleId || 'unknown';
        let resolvedCode = data.moduleCode ?? '';
        let resolvedName = data.moduleName ?? '';
        if (!resolvedCode && data.moduleId && moduleById.has(data.moduleId)) {
          const mod = moduleById.get(data.moduleId)!;
          resolvedCode = mod.code;
          resolvedName = resolvedName || mod.name;
        }
        if (!resolvedName && resolvedCode) resolvedName = moduleByCode.get(resolvedCode) ?? '';

        const existing = moduleMap.get(rawKey) ?? {
          moduleCode: resolvedCode || rawKey,
          moduleName: resolvedName,
          total: 0,
          present: 0,
          absent: 0,
        };
        if (!existing.moduleName && resolvedName) existing.moduleName = resolvedName;
        if (!existing.moduleCode && resolvedCode) existing.moduleCode = resolvedCode;

        if (data.totalSessions !== undefined || data.sessions !== undefined) {
          const total = data.totalSessions ?? data.sessions ?? 0;
          const present = data.attended ?? data.presentCount ?? data.present ?? 0;
          const absent = data.absent ?? data.absentCount ?? Math.max(0, total - present);
          existing.total = total;
          existing.present = present;
          existing.absent = absent;
        } else {
          existing.total += 1;
          const isPresent =
            data.present === true || data.attended === true ||
            data.status === 'present' || data.status === 'Present';
          if (isPresent) existing.present += 1;
          else existing.absent += 1;
        }
        moduleMap.set(rawKey, existing);
      });

      const moduleAttendance: ModuleAttendance[] = Array.from(moduleMap.values())
        .map((m) => ({
          ...m,
          percentage: m.total > 0 ? Math.round((m.present / m.total) * 100) : 0,
        }))
        .sort((a, b) => a.moduleCode.localeCompare(b.moduleCode));

      // 4b. Attendance by semester
      const semesterAttendance: Record<string, { present: number; total: number }> = {};
      attDocs.forEach((attDoc) => {
        const data = attDoc.data();
        const semKey = data.academicYear && data.semester
          ? `${data.academicYear} ${data.semester}`
          : 'Unknown';
        if (!semesterAttendance[semKey]) semesterAttendance[semKey] = { present: 0, total: 0 };
        if (data.totalSessions !== undefined) {
          semesterAttendance[semKey].total += data.totalSessions ?? 0;
          semesterAttendance[semKey].present += data.attended ?? data.present ?? 0;
        } else {
          semesterAttendance[semKey].total += 1;
          const isPresent = data.present === true || data.attended === true ||
            data.status === 'present' || data.status === 'Present';
          if (isPresent) semesterAttendance[semKey].present += 1;
        }
      });
      const attendanceBySemester = Object.values(semesterAttendance).map((s) =>
        s.total > 0 ? Math.round((s.present / s.total) * 10000) / 10000 : 0
      );

      // 5. Process results
      const results: StudentResult[] = (resultsSnap?.docs ?? []).map((r) => {
        const rd = r.data();
        const overall = rd.overall ?? rd.overallMark ?? rd.finalMark ?? rd.mark ?? 0;
        const grade =
          overall >= 70 ? 'A' :
          overall >= 60 ? 'B' :
          overall >= 50 ? 'C' :
          overall >= 40 ? 'D' : 'F';
        return {
          moduleCode: rd.moduleCode ?? '',
          moduleName: rd.moduleName ?? rd.module ?? '',
          overall,
          grade,
          semester: rd.semester ?? '',
          academicYear: rd.academicYear ?? '',
          assessmentComponent: rd.assessmentComponent ?? '',
          weight: rd.weight ?? 0,
          components: rd.components ?? [],
        };
      });

      // 6. Process SSA messages — sort by createdAt in JS (no composite index needed)
      const ssaMessages: SSAMessage[] = (intSnap?.docs ?? [])
        .map((m) => ({
          id: m.id,
          date: m.data().date ?? '',
          notes: m.data().notes ?? '',
          recordedBy: m.data().recordedBy ?? 'Student Support Advisor',
          interventionType: m.data().interventionType ?? m.data().type ?? '',
          createdAt: m.data().createdAt?.toMillis?.() ?? 0,
        }))
        .filter((m) => m.notes.trim() !== '')
        .sort((a, b) => b.createdAt - a.createdAt)
        .slice(0, 10)
        .map(({ createdAt, ...rest }) => rest);

      // 7. Mentor
      const mentor =
        mentorSnap && !mentorSnap.empty
          ? {
              name: mentorSnap.docs[0].data().name ?? mentorName,
              department: mentorSnap.docs[0].data().department ?? '',
            }
          : mentorName
          ? { name: mentorName, department: '' }
          : null;

      // 8. Appointments
      const appointments = (appointmentsSnap?.docs ?? []).map((a) => ({ id: a.id, ...a.data() }));

      setStudentData({
        studentId,
        firestoreId: docId,
        name: d.name ?? user?.name ?? '',
        email: d.email ?? user?.email ?? '',
        programme: d.programme ?? d.programName ?? '',
        faculty: d.faculty ?? d.facultyName ?? '',
        level: d.level ?? d.yearOfStudy ?? '',
        academicYear: d.academicYear ?? d.year ?? d.intake ?? '',
        enrollmentStatus: d.status ?? d.enrollmentStatus ?? 'Active',
        phone: d.contactNumber ?? d.phone ?? d.phoneNumber ?? '',
        attendancePercentage: d.attendancePercentage ?? 0,
        consecutiveAbsences: d.consecutiveAbsences ?? 0,
        gpa: d.gpa ?? 0,
        uid: d.uid ?? '',
        academicMentor: mentorName,
        riskLevel: d.riskLevel ?? 'low',
        engagementScore: d.engagementScore ?? 50,
        enrollmentDate: d.enrollmentDate ?? '',
        nationality: d.nationality ?? '',
        gender: d.gender ?? '',
        flagged: d.flagged ?? false,
        academic_warning_count: d.academic_warning_count ?? 0,
        advisorMeetingCount: d.advisor_meeting_count ?? d.advisorMeetingCount ?? 0,
        attendanceBySemester: attendanceBySemester.length > 0
          ? attendanceBySemester
          : [moduleAttendance.length > 0 ? Math.round(moduleAttendance.reduce((s, m) => s + m.percentage, 0) / moduleAttendance.length) / 100 : 0],
        moduleAttendance,
        results,
        ssaMessages,
        appointments,
        mentor,
      });
    } catch (e) {
      console.error('StudentDataContext error:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user?.role === 'student') {
      fetchAll();
    } else {
      setLoading(false);
    }
  }, [user?.id, user?.email]);

  return (
    <StudentDataContext.Provider value={{ studentData, loading, refresh: fetchAll }}>
      {children}
    </StudentDataContext.Provider>
  );
}

export const useStudentData = () => useContext(StudentDataContext);
