// ============================================================
// alertService.ts
// Alerts are now driven exclusively by the ML model.
// Students are automatically flagged when their ML dropout
// risk score >= 60% (handled in useRiskScore.ts).
// This file is kept for the collectAcademicFeatures utility.
// ============================================================

import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../../firebase';

export interface AcademicFeatures {
  attendanceRate: number;
  gpaCurrent: number;
  failedModules: number;
  academicWarningCount: number;
  creditsCompleted: number;
  gpaHistory: number[];
}

export async function collectAcademicFeatures(studentId: string): Promise<AcademicFeatures> {
  // Fetch student base data
  const studentSnap = await getDocs(
    query(collection(db, 'students'), where('studentId', '==', studentId))
  );
  const studentData = studentSnap.empty ? {} : studentSnap.docs[0].data();

  // Fetch intervention count
  const intSnap = await getDocs(
    query(collection(db, 'interventions'), where('studentId', '==', studentId))
  );
  const academicWarningCount = intSnap.size;

  // Fetch results for failed modules, credits, and GPA history
  const resultsSnap = await getDocs(
    query(collection(db, 'results'), where('studentId', '==', studentId))
  );
  const results = resultsSnap.docs.map((d) => d.data());
  const failedModules = results.filter((r) => (r.finalMark ?? r.mark ?? 0) < 40).length;
  const creditsCompleted = results.filter((r) => (r.finalMark ?? r.mark ?? 0) >= 40).length;

  const bySemester: Record<string, number[]> = {};
  results.forEach((r) => {
    const key = `${r.academicYear}-${r.semester}`;
    if (!bySemester[key]) bySemester[key] = [];
    bySemester[key].push(r.finalMark ?? r.mark ?? 0);
  });
  const gpaHistory = Object.values(bySemester).map((marks) => {
    const avg = marks.reduce((a, b) => a + b, 0) / marks.length;
    return avg / 25; // convert marks to 0-4 GPA scale
  });

  return {
    attendanceRate: (studentData.attendancePercentage ?? 0) / 100,
    gpaCurrent: studentData.gpa ?? 0,
    failedModules,
    academicWarningCount,
    creditsCompleted,
    gpaHistory,
  };
}
