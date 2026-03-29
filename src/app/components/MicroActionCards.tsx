// ============================================================
// MicroActionCards.tsx  —  Novelty 3
// Supportive status cards. Framed as "the system is aware"
// not "you must do X". Student should feel monitored supportively.
// ============================================================

interface MicroActionCardsProps {
  attendancePct: number;
  gpa: number;
  riskScore: number;
  riskLevel?: string;
  riskPending?: boolean;
}

export function MicroActionCards({ attendancePct, gpa, riskScore, riskLevel, riskPending }: MicroActionCardsProps) {
  return null;
}
