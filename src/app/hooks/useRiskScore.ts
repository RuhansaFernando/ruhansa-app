// ============================================================
// useRiskScore.ts  —  Novelty 1
// React hook that computes the ML risk score for a student.
// Collects academic features from Firestore and calls the
// ML model API; falls back to pending:true if unavailable.
// ============================================================

import { useState, useEffect } from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../../firebase';
import { prepareMLFeatures, callMLModel, type RiskResult } from '../services/riskScoreService';

interface StudentRiskData {
  attendancePercentage?: number;
  gpa?: number;
  studentId?: string;
  consecutiveAbsences?: number;
  age?: number;
  gender?: string;
  major?: string;
  enrollmentDate?: string;
  nationality?: string;
  attendanceBySemester?: number[];
}

const calcEnrollmentGap = (enrollmentDate: string): number => {
  if (!enrollmentDate) return 0;
  const start = new Date(enrollmentDate);
  const now = new Date();
  return Math.max(0,
    (now.getFullYear() - start.getFullYear()) * 12 +
    (now.getMonth() - start.getMonth())
  );
};

export function useRiskScore(studentData: StudentRiskData): RiskResult {
  const [result, setResult] = useState<RiskResult>({
    score: 0,
    level: 'low',
    confidence: 0,
    factors: [],
    pending: true,
  });

  useEffect(() => {
    const compute = async () => {
      if (!studentData.studentId) return;

      try {
        // Fetch academic warning count, meeting count, and results in parallel
        const [warningSnap, meetingSnap, resultsSnap] = await Promise.all([
          getDocs(query(collection(db, 'interventions'), where('studentId', '==', studentData.studentId), where('isAcademicWarning', '==', true))),
          getDocs(query(collection(db, 'interventions'), where('studentId', '==', studentData.studentId), where('interventionType', '==', 'Meeting'))),
          getDocs(query(collection(db, 'results'), where('studentId', '==', studentData.studentId))),
        ]);

        const interventionCount = warningSnap.size;
        const appointmentCount = meetingSnap.size;

        const results = resultsSnap.docs.map((d) => d.data());
        const failedModules = results.filter(
          (r) => (r.finalMark ?? r.mark ?? 0) < 40
        ).length;
        const creditsCompleted = results.filter(
          (r) => (r.finalMark ?? r.mark ?? 0) >= 40
        ).length;

        // Calculate GPA history per semester
        const bySemester: Record<string, number[]> = {};
        results.forEach((r) => {
          const key = `${r.academicYear}-${r.semester}`;
          if (!bySemester[key]) bySemester[key] = [];
          bySemester[key].push(r.finalMark ?? r.mark ?? 0);
        });
        const semesterGPAs = Object.values(bySemester).map((marks) => {
          const avg = marks.reduce((a, b) => a + b, 0) / marks.length;
          return avg / 25; // convert marks to 0-4 GPA scale
        });

        const features = prepareMLFeatures({
          attendancePercentage: studentData.attendancePercentage,
          gpa: studentData.gpa,
          interventionCount,
          creditsCompleted,
          failedModules,
          gpaHistory: semesterGPAs,
        });

        const attendancePercentage = studentData.attendancePercentage ?? 0;
        const attendanceBySemester = studentData.attendanceBySemester && studentData.attendanceBySemester.length > 0
          ? studentData.attendanceBySemester
          : [attendancePercentage];

        const riskResult = await callMLModel(features, {
          age: studentData.age,
          gender: studentData.gender,
          major: studentData.major,
          advisorMeetingCount: appointmentCount,
          hasCounseling: interventionCount > 0 ? 1 : 0,
          enrollmentGapMonths: calcEnrollmentGap(studentData.enrollmentDate ?? ''),
          ethnicity: studentData.nationality ?? 'Unknown',
          attendanceBySemester,
        });
        setResult(riskResult);
      } catch (err) {
        console.error('Risk calculation error:', err);
      }
    };

    compute();
  }, [studentData.studentId, studentData.attendancePercentage, studentData.gpa]);

  return result;
}
