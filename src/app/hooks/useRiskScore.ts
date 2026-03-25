// ============================================================
// useRiskScore.ts  —  Novelty 1
// React hook that computes the ML risk score for a student.
// Collects 6 academic features from Firestore and calls the
// ML model (currently a pending stub until Flask is ready).
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
}

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
        // Fetch intervention count
        const intSnap = await getDocs(
          query(
            collection(db, 'interventions'),
            where('studentId', '==', studentData.studentId)
          )
        );
        const interventionCount = intSnap.size;

        // Fetch results for failed modules and credits
        const resultsSnap = await getDocs(
          query(
            collection(db, 'results'),
            where('studentId', '==', studentData.studentId)
          )
        );

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

        const riskResult = await callMLModel(features);
        setResult(riskResult);
      } catch (err) {
        console.error('Risk calculation error:', err);
      }
    };

    compute();
  }, [studentData.studentId, studentData.attendancePercentage, studentData.gpa]);

  return result;
}
