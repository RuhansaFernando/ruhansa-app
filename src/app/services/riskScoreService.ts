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

export async function callMLModel(_features: MLFeatures): Promise<RiskResult> {
  // TODO: Replace with actual Flask API call when ML model is ready
  // const response = await fetch('http://localhost:5000/predict', {
  //   method: 'POST',
  //   headers: { 'Content-Type': 'application/json' },
  //   body: JSON.stringify(_features)
  // });
  // const data = await response.json();
  // return {
  //   score: data.risk_score,
  //   level: data.risk_level,
  //   confidence: data.confidence,
  //   factors: data.factors,
  //   pending: false
  // };

  return {
    score: 0,
    level: 'low',
    confidence: 0,
    factors: [],
    pending: true,
  };
}
