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

function pctToPoints(mark: number): number {
  if (mark >= 70) return 4.0;
  if (mark >= 60) return 3.0;
  if (mark >= 50) return 2.0;
  if (mark >= 40) return 1.0;
  return 0.0;
}

interface StudentRiskData {
  attendancePercentage?: number;
  gpa?: number;
  studentId?: string;
  consecutiveAbsences?: number;
  age?: number;
  gender?: string;
  major?: string;
  programme?: string;
  enrollmentDate?: string;
  nationality?: string;
  attendanceBySemester?: number[];
  gpaBySemester?: number[];
  flagged?: boolean;
  academic_warning_count?: number;
  academicWarnings?: number;
  counselingNotes?: string;
  financial_aid_status?: string | boolean | number;
  financial_aid?: boolean;
  ethnicity?: string;
  credits_completed?: number;
  deferral_months?: number;
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
        // Fetch academic warning count, meeting count, and results in parallel
        const [warningSnap, meetingSnap, resultsSnap] = await Promise.all([
          getDocs(query(collection(db, 'interventions'), where('studentId', '==', studentData.studentId), where('isAcademicWarning', '==', true))),
          getDocs(query(collection(db, 'interventions'), where('studentId', '==', studentData.studentId), where('interventionType', '==', 'Meeting'))),
          getDocs(query(collection(db, 'results'), where('studentId', '==', studentData.studentId))),
        ]);

        // Prefer stored field on student doc; fall back to live intervention count
        const interventionCount = studentData.academic_warning_count
          ?? studentData.academicWarnings
          ?? warningSnap.size;
        const appointmentCount = meetingSnap.size;

        const results = resultsSnap.docs.map((d) => d.data());
        const failedModules = results.filter(
          (r) => (r.finalMark ?? r.mark ?? 0) < 40
        ).length;
        // credits_completed: count only passed modules (mark >= 40) × 10 credits each.
        // The Firestore field counts all modules including failed ones, which is wrong for
        // the ML model (trained on credits accumulated from passed courses only).
        const passedModulesCount = results.length - failedModules;
        const creditsCompleted = Math.min(passedModulesCount * 10, 90);

        // Calculate GPA history per semester from raw result docs.
        // Sort keys chronologically so that semesterGPAs[0] is always the
        // oldest semester and semesterGPAs[last] is always the most recent.
        const bySemester: Record<string, number[]> = {};
        results.forEach((r) => {
          const key = `${r.academicYear ?? ''}__${r.semester ?? ''}`;
          if (!bySemester[key]) bySemester[key] = [];
          bySemester[key].push(r.finalMark ?? r.mark ?? 0);
        });
        const computedSemesterGPAs = Object.entries(bySemester)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([, marks]) => {
            const avg = marks.reduce((a, b) => a + b, 0) / marks.length;
            return pctToPoints(avg);
          });

        // Prefer the stored gpa_by_semester array (already chronologically sorted
        // by SyncGPASemesters / recalculation tools) over the computed version.
        const gpaBySemester = (studentData.gpaBySemester && studentData.gpaBySemester.length > 0)
          ? studentData.gpaBySemester
          : computedSemesterGPAs;

        // low_gpa_semesters: count of semesters where GPA (0-4 scale) < 2.0
        const low_gpa_semesters = gpaBySemester.filter((g) => g < 2.0).length;

        // gpaLast on 0-4 grade-point scale (used as gpa_current in the ML payload).
        // Must NOT use studentData.gpa which may be stored on a different scale from
        // older import scripts (e.g. avg_mark/25 instead of pctToPoints).
        const gpaLast = gpaBySemester.length > 0
          ? gpaBySemester[gpaBySemester.length - 1]
          : 0;
        const gpaAvg = gpaBySemester.length > 0
          ? gpaBySemester.reduce((a, b) => a + b, 0) / gpaBySemester.length
          : 0;
        // If the most recent semester is 0.0 (all fails), use the overall average
        // so the model still sees the student's typical academic standing.
        const gpaCurrent = gpaLast > 0 ? gpaLast : gpaAvg;

        const features = prepareMLFeatures({
          attendancePercentage: studentData.attendancePercentage,
          gpa: gpaCurrent,
          interventionCount: low_gpa_semesters, // academic_warning_count in ML payload
          creditsCompleted,
          failedModules,
          gpaHistory: gpaBySemester,
        });

        const attendancePercentage = studentData.attendancePercentage ?? 0;
        // attendance_by_semester is stored chronologically (oldest first, newest last)
        const attendanceBySemester = (studentData.attendanceBySemester && studentData.attendanceBySemester.length > 0)
          ? studentData.attendanceBySemester
          : [attendancePercentage / 100];

        const financialAid = studentData.financial_aid ? 1 : 0;

        const gpaFirst = gpaBySemester.length > 0 ? gpaBySemester[0] : 0;
        const gpaTrend = gpaBySemester.length >= 2 ? gpaLast - gpaFirst : 0;
        const attLast  = attendanceBySemester[attendanceBySemester.length - 1];
        const attTrend = attendanceBySemester.length >= 2 ? attLast - attendanceBySemester[0] : 0;

        // dropout_risk flag: 1 = high academic risk signal for the ML model.
        const totalModules = results.length;
        const dropoutRiskFlag = (
          (failedModules / Math.max(totalModules, 1)) > 0.60 ||
          (studentData.attendancePercentage ?? 100) < 30 ||
          attTrend <= -0.50 ||
          (gpaTrend <= -2.5 && gpaLast < 1.5)
        ) ? 1 : 0;

        const riskResult = await callMLModel(features, {
          age: studentData.age,
          gender: studentData.gender,
          major: studentData.programme ?? studentData.major,
          advisorMeetingCount: appointmentCount,
          hasCounseling: interventionCount > 0 ? 1 : 0,
          financialAid,
          enrollmentGapMonths: 0,
          ethnicity: studentData.ethnicity ?? studentData.nationality ?? 'Unknown',
          attendanceBySemester,
          gpaBySemester,
          dropoutRisk: dropoutRiskFlag,
        });
        console.log(`[useRiskScore] ${studentData.studentId} → result:`, riskResult);
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
        console.error('[useRiskScore] Risk calculation error for', studentData.studentId, ':', err);
      }
    };

    compute();
  }, [studentData.studentId, studentData.attendancePercentage, studentData.gpa]);

  return result;
}
