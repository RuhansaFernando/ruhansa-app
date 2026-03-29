export interface RiskFactors {
  attendancePercentage: number;
  consecutiveAbsences: number;
  gpa: number;
  failedModules: number;
  missingAssignments: number;
  poorExamScores: number;
  repeatingModules: number;
}

export interface RiskResult {
  score: number;
  level: 'low' | 'medium' | 'high' | 'critical';
  confidence: number;
  factors: {
    name: string;
    value: number;
    contribution: number;
    status: 'good' | 'warning' | 'critical';
  }[];
  pending?: boolean;
}

const PENDING_RESULT: RiskResult = {
  score: 0,
  level: 'low',
  confidence: 0,
  factors: [],
  pending: true,
};

export function getRiskScore(_studentData: {
  attendancePercentage?: number;
  consecutiveAbsences?: number;
  gpa?: number;
  failedModules?: number;
  missingAssignments?: number;
  poorExamScores?: number;
  repeatingModules?: number;
}): RiskResult {
  return { ...PENDING_RESULT };
}

export function getRiskLevelFromScore(score: number): 'low' | 'medium' | 'high' | 'critical' {
  return score >= 80 ? 'critical' : score >= 60 ? 'high' : score >= 40 ? 'medium' : 'low';
}

export function getRiskColour(level: string): string {
  switch (level) {
    case 'critical': return '#E24B4A';
    case 'high':     return '#BA7517';
    case 'medium':   return '#185FA5';
    default:         return '#3B6D11';
  }
}

export function simulateRiskScore(_base: RiskFactors, _changes: Partial<RiskFactors>): RiskResult {
  return { ...PENDING_RESULT };
}

export interface MLFeatures {
  attendanceRate: number;
  gpaCurrent: number;
  gpaHistory: number;
  academicWarningCount: number;
  creditsCompleted: number;
  failedModules: number;
}

export function prepareMLFeatures(studentData: {
  attendancePercentage?: number;
  gpa?: number;
  interventionCount?: number;
  creditsCompleted?: number;
  failedModules?: number;
  gpaHistory?: number[];
}): MLFeatures {
  return {
    attendanceRate: (studentData.attendancePercentage ?? 0) / 100,
    gpaCurrent: studentData.gpa ?? 0,
    gpaHistory: studentData.gpaHistory
      ? studentData.gpaHistory.reduce((a, b) => a + b, 0) / studentData.gpaHistory.length
      : studentData.gpa ?? 0,
    academicWarningCount: studentData.interventionCount ?? 0,
    creditsCompleted: studentData.creditsCompleted ?? 0,
    failedModules: studentData.failedModules ?? 0,
  };
}

export async function callMLModel(features: MLFeatures, extraData?: {
  age?: number;
  gender?: string;
  major?: string;
  advisorMeetingCount?: number;
  hasCounseling?: number;
  financialAid?: number;
  enrollmentGapMonths?: number;
  gpaLast?: number;
  gpaTrend?: number;
  gpaMin?: number;
  attLast?: number;
  attTrend?: number;
  ethnicity?: string;
  attendanceBySemester?: number[];
}): Promise<RiskResult> {
  const ML_API_URL = import.meta.env.VITE_ML_API_URL || 'http://localhost:5000/predict';

  try {
    const response = await fetch(ML_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        gpa_current: features.gpaCurrent,
        gpa_history: features.gpaHistory,
        gpa_last: extraData?.gpaLast ?? features.gpaCurrent,
        gpa_trend: extraData?.gpaTrend ?? 0,
        gpa_min: extraData?.gpaMin ?? features.gpaCurrent,
        attendance_rate: features.attendanceRate,
        att_last: extraData?.attLast ?? features.attendanceRate,
        att_trend: extraData?.attTrend ?? 0,
        credits_completed: features.creditsCompleted,
        academic_warning_count: features.academicWarningCount,
        advisor_meeting_count: extraData?.advisorMeetingCount ?? 0,
        enrollment_gap_months: extraData?.enrollmentGapMonths ?? 0,
        has_counseling: extraData?.hasCounseling ?? 0,
        financial_aid: extraData?.financialAid ?? 0,
        age: extraData?.age ?? 20,
        gender: extraData?.gender ?? 'Unknown',
        major: extraData?.major ?? 'Unknown',
        ethnicity: extraData?.ethnicity ?? 'Unknown',
        attendance_by_semester: extraData?.attendanceBySemester ?? [],
      }),
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) throw new Error(`API error: ${response.status}`);

    const data = await response.json();

    const score = Math.round((data.dropout_probability ?? 0) * 100);
    const level: 'low' | 'medium' | 'high' | 'critical' =
      data.risk_level?.toLowerCase() === 'critical' ? 'critical'
      : data.risk_level?.toLowerCase() === 'high' ? 'high'
      : data.risk_level?.toLowerCase() === 'medium' ? 'medium'
      : 'low';

    return {
      score,
      level,
      confidence: Math.round((data.dropout_probability ?? 0) * 100),
      factors: [
        {
          name: 'Attendance',
          value: Math.round(features.attendanceRate * 100),
          contribution: features.attendanceRate < 0.75 ? 60 : 10,
          status: features.attendanceRate < 0.6 ? 'critical'
            : features.attendanceRate < 0.75 ? 'warning' : 'good',
        },
        {
          name: 'GPA',
          value: features.gpaCurrent,
          contribution: features.gpaCurrent < 2.0 ? 30 : 10,
          status: features.gpaCurrent < 1.5 ? 'critical'
            : features.gpaCurrent < 2.0 ? 'warning' : 'good',
        },
        {
          name: 'Academic Warnings',
          value: features.academicWarningCount,
          contribution: features.academicWarningCount > 0 ? 10 : 0,
          status: features.academicWarningCount > 2 ? 'critical'
            : features.academicWarningCount > 0 ? 'warning' : 'good',
        },
      ],
      pending: false,
    };
  } catch {
    return {
      score: 0,
      level: 'low',
      confidence: 0,
      factors: [],
      pending: true,
    };
  }
}
