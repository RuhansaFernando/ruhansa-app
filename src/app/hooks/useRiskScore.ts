// ============================================================
// useRiskScore.ts  —  Novelty 1
// React hook that fetches + caches the ML risk score per student.
// ============================================================

import { useState, useEffect } from 'react';
import { getRiskScore, type RiskScoreResult } from '../services/riskScoreService';

interface UseRiskScoreOptions {
  studentId: string;
  attendancePct: number;
  gpa: number;
  engagementPct?: number;
  skip?: boolean;
}

interface UseRiskScoreReturn {
  data: RiskScoreResult | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useRiskScore({
  studentId,
  attendancePct,
  gpa,
  engagementPct = 50,
  skip = false,
}: UseRiskScoreOptions): UseRiskScoreReturn {
  const [data, setData]       = useState<RiskScoreResult | null>(null);
  const [loading, setLoading] = useState(!skip);
  const [error, setError]     = useState<string | null>(null);
  const [tick, setTick]       = useState(0);

  useEffect(() => {
    if (skip || !studentId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);

    getRiskScore(studentId, attendancePct, gpa, engagementPct)
      .then((result) => {
        if (!cancelled) { setData(result); setLoading(false); }
      })
      .catch((err) => {
        if (!cancelled) { setError(err.message ?? 'Failed to load risk score'); setLoading(false); }
      });

    return () => { cancelled = true; };
  }, [studentId, attendancePct, gpa, engagementPct, skip, tick]);

  return { data, loading, error, refetch: () => setTick((t) => t + 1) };
}
