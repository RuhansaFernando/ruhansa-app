// ============================================================
// useRiskScore.ts  —  Novelty 1
// React hook that computes the ML risk score for a student.
// Collects academic features from Firestore and calls the
// ML model API; falls back to pending:true if unavailable.
// ============================================================

import { useState, useEffect } from 'react';
import { collection, getDocs, query, where, doc, updateDoc } from 'firebase/firestore';
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
  flagged?: boolean;
  counselingNotes?: string;
  financial_aid_status?: string | boolean | number;
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

        const financialAidRaw = studentData.financial_aid_status;
        const financialAid =
          financialAidRaw === 'Yes' || financialAidRaw === true || financialAidRaw === 1 ? 1 : 0;

        const riskResult = await callMLModel(features, {
          age: studentData.age,
          gender: studentData.gender,
          major: studentData.major,
          advisorMeetingCount: appointmentCount,
          hasCounseling: studentData.counselingNotes ? 1 : 0,
          financialAid,
          enrollmentGapMonths: calcEnrollmentGap(studentData.enrollmentDate ?? ''),
          ethnicity: studentData.nationality ?? 'Unknown',
          attendanceBySemester,
          gpaBySemester: semesterGPAs,
          dropoutRisk: studentData.flagged ? 1 : 0,
        });
        setResult(riskResult);

        // Auto-flag / auto-unflag based on ML risk score
        const studentId = studentData.studentId!;
        if (!riskResult.pending) {
          try {
            const studentQuery = await getDocs(
              query(collection(db, 'students'), where('studentId', '==', studentId))
            );

            if (!studentQuery.empty) {
              const studentDoc = studentQuery.docs[0];
              const currentData = studentDoc.data();
              const previousScore = currentData.mlRiskScore ?? 0;
              const currentScore = riskResult.score;

              if (currentScore >= 60 && !currentData.flagged) {
                // Not currently flagged + high risk → flag
                await updateDoc(doc(db, 'students', studentDoc.id), {
                  flagged: true,
                  flaggedAt: new Date().toISOString(),
                  flagReason: 'ML model: high dropout risk',
                  mlRiskScore: currentScore,
                  riskLevel: riskResult.level,
                  riskScore: currentScore,
                });
              } else if (currentScore >= 60 && currentData.flagged === false) {
                // Was acknowledged but risk INCREASED by 10+ points → new alert
                const scoreIncrease = currentScore - previousScore;
                if (scoreIncrease >= 10) {
                  await updateDoc(doc(db, 'students', studentDoc.id), {
                    flagged: true,
                    flaggedAt: new Date().toISOString(),
                    flagReason: 'ML model: risk increased significantly',
                    mlRiskScore: currentScore,
                    riskLevel: riskResult.level,
                    riskScore: currentScore,
                  });
                }
              } else if (currentScore < 60 && currentData.flagged === true &&
                  currentData.flagReason?.includes('ML model')) {
                // Risk dropped below threshold → auto-resolve
                await updateDoc(doc(db, 'students', studentDoc.id), {
                  flagged: false,
                  resolvedAt: new Date().toISOString(),
                  mlRiskScore: currentScore,
                  riskLevel: riskResult.level,
                  riskScore: currentScore,
                });
              } else {
                // Just update the score silently
                await updateDoc(doc(db, 'students', studentDoc.id), {
                  mlRiskScore: currentScore,
                  riskLevel: riskResult.level,
                  riskScore: currentScore,
                });
              }
            }
          } catch (err) {
            console.error('Failed to update student risk:', err);
          }
        }
      } catch (err) {
        console.error('Risk calculation error:', err);
      }
    };

    compute();
  }, [studentData.studentId, studentData.attendancePercentage, studentData.gpa]);

  return result;
}
