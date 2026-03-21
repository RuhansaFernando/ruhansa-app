// ============================================================
// riskScoreService.ts  —  Novelty 1
// Mock ML risk score service. When Flask is ready, swap the
// getMockScore() call for: fetch('http://localhost:5000/api/predict', ...)
// ============================================================

export interface RiskFactors {
  attendance: number;   // % contribution to risk score  e.g. 42
  academic: number;     // % contribution                e.g. 35
  engagement: number;   // % contribution                e.g. 23
}

export interface RiskScoreResult {
  score: number;                          // 0–100
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  factors: RiskFactors;
  explanation: string;
  recommendedInterventions: string[];
  lastUpdated: string;
}

// ── Dummy data keyed by studentId ──────────────────────────
const MOCK_SCORES: Record<string, RiskScoreResult> = {
  default: {
    score: 0,
    riskLevel: 'low',
    factors: { attendance: 33, academic: 34, engagement: 33 },
    explanation: 'Student is performing within acceptable thresholds across all measured factors.',
    recommendedInterventions: ['Continue regular attendance', 'Maintain current study habits'],
    lastUpdated: new Date().toISOString(),
  },
};

function buildMockScore(
  attendancePct: number,
  gpa: number,
  engagementPct: number
): RiskScoreResult {
  // Weighted risk contribution (inverse — low values = high risk)
  const attendRisk = Math.max(0, Math.min(100, ((80 - attendancePct) / 80) * 100));
  const gpaRisk     = Math.max(0, Math.min(100, ((2.5 - gpa) / 2.5) * 100));
  const engageRisk  = Math.max(0, Math.min(100, ((60 - engagementPct) / 60) * 100));

  const score = Math.round(attendRisk * 0.42 + gpaRisk * 0.35 + engageRisk * 0.23);
  const clampedScore = Math.max(0, Math.min(100, score));

  const riskLevel =
    clampedScore >= 80 ? 'critical' :
    clampedScore >= 60 ? 'high' :
    clampedScore >= 40 ? 'medium' : 'low';

  // Factor contributions as % of total score
  const total = attendRisk * 0.42 + gpaRisk * 0.35 + engageRisk * 0.23 || 1;
  const factors: RiskFactors = {
    attendance:  Math.round((attendRisk * 0.42 / total) * 100),
    academic:    Math.round((gpaRisk    * 0.35 / total) * 100),
    engagement:  Math.round((engageRisk * 0.23 / total) * 100),
  };

  const explanation =
    clampedScore >= 80
      ? `Attendance is the primary driver (${factors.attendance}% contribution). Even if GPA improves, the attendance pattern alone would keep risk elevated. Prioritise resolving attendance barriers first.`
      : clampedScore >= 60
      ? `Academic performance is a significant concern alongside attendance. Both factors need to be addressed through targeted intervention.`
      : clampedScore >= 40
      ? `Student shows moderate risk indicators. Early monitoring and a proactive check-in is recommended to prevent escalation.`
      : `Student is performing within acceptable thresholds. Continue standard monitoring.`;

  const recommendedInterventions =
    clampedScore >= 80
      ? ['Urgent attendance support meeting', 'Refer to academic tutoring', 'Re-activate LMS engagement', 'Escalate to Academic Mentor']
      : clampedScore >= 60
      ? ['Schedule academic support session', 'Review module performance', 'Encourage regular LMS logins']
      : clampedScore >= 40
      ? ['Book a check-in appointment', 'Monitor attendance over next 2 weeks']
      : ['Continue regular attendance', 'Maintain current study habits'];

  return {
    score: clampedScore,
    riskLevel,
    factors,
    explanation,
    recommendedInterventions,
    lastUpdated: new Date().toISOString(),
  };
}

// ── Public API ─────────────────────────────────────────────

/**
 * Get risk score for a student.
 * Currently uses local calculation from Firestore data.
 * TODO (ML phase): replace with → fetch(`${ML_API}/api/predict`, { method:'POST', body: JSON.stringify({studentId, attendancePct, gpa, engagementPct}) })
 */
export async function getRiskScore(
  studentId: string,
  attendancePct: number,
  gpa: number,
  engagementPct = 50
): Promise<RiskScoreResult> {
  // Simulate async API call (remove artificial delay when real API is connected)
  await new Promise((r) => setTimeout(r, 120));

  if (MOCK_SCORES[studentId]) return MOCK_SCORES[studentId];
  return buildMockScore(attendancePct, gpa, engagementPct);
}

/**
 * Get SHAP-style factor explanation for a student.
 * TODO (ML phase): replace with → fetch(`${ML_API}/api/explain/${studentId}`)
 */
export async function getFactorExplanation(
  studentId: string,
  attendancePct: number,
  gpa: number,
  engagementPct = 50
): Promise<RiskFactors> {
  const result = await getRiskScore(studentId, attendancePct, gpa, engagementPct);
  return result.factors;
}

/**
 * Simulate what-if scenario: how would changing inputs affect the score?
 * Pure frontend calculation — no API call needed.
 */
export function simulateRiskScore(
  newAttendancePct: number,
  newGpa: number,
  newEngagementPct: number
): number {
  const result = buildMockScore(newAttendancePct, newGpa, newEngagementPct);
  return result.score;
}

export function getRiskLevelFromScore(score: number): 'low' | 'medium' | 'high' | 'critical' {
  if (score >= 80) return 'critical';
  if (score >= 60) return 'high';
  if (score >= 40) return 'medium';
  return 'low';
}

export function getRiskColour(level: string): string {
  switch (level) {
    case 'critical': return '#E24B4A';
    case 'high':     return '#BA7517';
    case 'medium':   return '#185FA5';
    default:         return '#3B6D11';
  }
}
