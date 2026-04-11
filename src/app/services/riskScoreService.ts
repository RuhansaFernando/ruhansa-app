// NOTE: Rule-based risk calculation has been removed from all write paths.
// riskScore and riskLevel will be populated by the ML model once connected.
// Until then, treat any existing riskLevel/riskScore fields in Firestore as stale.
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

function mapEthnicity(_ethnicity: string | undefined): string {
  // Model was trained on: Asian, Black, Hispanic, White, Other
  // All students in this system are Sri Lankan → Asian
  return 'Asian';
}

function mapMajor(programme: string | undefined): string {
  if (!programme) return 'Computer Science';
  const p = programme.toLowerCase();
  if (p.includes('computer') || p.includes('software') || p.includes('cyber') ||
      p.includes('data') || p.includes('information')) return 'Computer Science';
  if (p.includes('business') || p.includes('accounting') || p.includes('finance')) return 'Business';
  if (p.includes('engineering') || p.includes('civil')) return 'Electrical Engineering';
  if (p.includes('psychology')) return 'Psychology';
  if (p.includes('biology')) return 'Biology';
  return 'Computer Science';
}

export async function callMLModel(features: MLFeatures, extraData?: {
  age?: number;
  gender?: string;
  major?: string;
  ethnicity?: string;
  advisorMeetingCount?: number;
  hasCounseling?: number;
  financialAid?: number;
  enrollmentGapMonths?: number;
  attendanceBySemester?: number[];
  gpaBySemester?: number[];
  dropoutRisk?: number;
}): Promise<RiskResult> {
  const ML_API_URL = import.meta.env.VITE_ML_API_URL || 'http://127.0.0.1:5000/predict';

  // ── Derive GPA fields from per-semester array ─────────────────────────────
  const gpaSemesters = extraData?.gpaBySemester ?? [];
  const gpaLast  = gpaSemesters.length > 0
    ? gpaSemesters[gpaSemesters.length - 1]
    : features.gpaCurrent;
  const gpaTrend = gpaSemesters.length >= 2
    ? gpaSemesters[gpaSemesters.length - 1] - gpaSemesters[0]
    : 0;
  const gpaMin   = gpaSemesters.length > 0
    ? Math.min(...gpaSemesters)
    : features.gpaCurrent;

  // ── Derive attendance fields from per-semester array ──────────────────────
  const attSemesters = extraData?.attendanceBySemester ?? [];
  const attLast  = attSemesters.length > 0
    ? attSemesters[attSemesters.length - 1]
    : features.attendanceRate;
  const attTrend = attSemesters.length >= 2
    ? attSemesters[attSemesters.length - 1] - attSemesters[0]
    : 0;

  const payload = {
    dropout_risk:           extraData?.dropoutRisk ?? 0,
    age:                    extraData?.age ?? 20,
    gender:                 extraData?.gender ?? 'Unknown',
    ethnicity:              mapEthnicity(extraData?.ethnicity),
    major:                  mapMajor(extraData?.major),
    gpa_current:            features.gpaCurrent,
    gpa_history:            features.gpaHistory,
    credits_completed:      features.creditsCompleted,
    academic_warning_count: features.academicWarningCount,
    gpa_last:               gpaLast,
    gpa_trend:              gpaTrend,
    gpa_min:                gpaMin,
    attendance_rate:        features.attendanceRate,
    att_last:               attLast,
    att_trend:              attTrend,
    enrollment_gap_months:  extraData?.enrollmentGapMonths ?? 0,
    advisor_meeting_count:  extraData?.advisorMeetingCount ?? 0,
    has_counseling:         extraData?.hasCounseling ?? 0,
    financial_aid:          extraData?.financialAid ?? 0,
  };
  console.log('[ML API] Payload:', payload);

  try {
    const response = await fetch(ML_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) throw new Error(`API error: ${response.status}`);

    const data = await response.json();

    // API returns: dropout_probability (0–1), will_dropout (bool), risk_level ('Low'|'Medium'|'High')
    const score = Math.round((data.dropout_probability ?? 0) * 100);

    const rawLevel = (data.risk_level ?? '').toLowerCase();
    const level: 'low' | 'medium' | 'high' | 'critical' =
      rawLevel === 'high'   ? 'high'
      : rawLevel === 'medium' ? 'medium'
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
