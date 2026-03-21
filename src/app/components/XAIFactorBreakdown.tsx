// ============================================================
// XAIFactorBreakdown.tsx  —  Novelty 2
// Shows SHAP-style factor contribution bars to the SSA.
// Props come from riskScoreService (mock now, Flask later).
// ============================================================

import type { RiskFactors } from '../services/riskScoreService';

interface XAIFactorBreakdownProps {
  factors: RiskFactors;
  attendancePct: number;
  gpa: number;
  engagementPct: number;
  explanation: string;
}

function FactorBar({
  label, detail, threshold, contribution, colour, tag,
}: {
  label: string;
  detail: string;
  threshold: string;
  contribution: number;
  value: number;
  maxVal: number;
  colour: string;
  tag: string;
  tagColour: string;
}) {
  return (
    <div className="mb-4">
      <div className="flex items-start justify-between mb-1.5">
        <div>
          <p className="text-sm font-medium text-gray-900">{label}</p>
          <p className="text-xs text-gray-500 mt-0.5">{detail}</p>
        </div>
        <span className="text-sm font-semibold ml-4 flex-shrink-0" style={{ color: colour }}>
          {contribution}%
        </span>
      </div>

      {/* Contribution bar */}
      <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${contribution}%`, background: colour }}
        />
      </div>

      <div className="flex items-center justify-between mt-1.5">
        <span
          className="inline-flex items-center text-[10px] font-medium px-2 py-0.5 rounded-full"
          style={{ background: `${colour}18`, color: colour }}
        >
          {tag}
        </span>
        <span className="text-[10px] text-gray-400">{threshold}</span>
      </div>
    </div>
  );
}

export function XAIFactorBreakdown({
  factors,
  attendancePct,
  gpa,
  engagementPct,
  explanation,
}: XAIFactorBreakdownProps) {
  const factorDetails = [
    {
      label: 'Attendance',
      detail: `${attendancePct}% overall attendance rate`,
      threshold: 'Threshold: ≥ 75%',
      contribution: factors.attendance,
      value: attendancePct,
      maxVal: 100,
      colour: factors.attendance >= 35 ? '#E24B4A' : factors.attendance >= 20 ? '#BA7517' : '#185FA5',
      tag: factors.attendance >= 35 ? 'Highest contributor' : factors.attendance >= 20 ? 'High contributor' : 'Moderate contributor',
      tagColour: '',
    },
    {
      label: 'Academic Performance',
      detail: `GPA ${gpa.toFixed(1)} · Based on module results`,
      threshold: 'Threshold: GPA ≥ 2.5',
      contribution: factors.academic,
      value: gpa,
      maxVal: 4,
      colour: factors.academic >= 35 ? '#E24B4A' : factors.academic >= 20 ? '#BA7517' : '#185FA5',
      tag: factors.academic >= 35 ? 'Highest contributor' : factors.academic >= 20 ? 'High contributor' : 'Moderate contributor',
      tagColour: '',
    },
    {
      label: 'Engagement',
      detail: `${engagementPct}% of expected LMS activity`,
      threshold: 'Threshold: ≥ 60% engagement',
      contribution: factors.engagement,
      value: engagementPct,
      maxVal: 100,
      colour: factors.engagement >= 35 ? '#E24B4A' : factors.engagement >= 20 ? '#BA7517' : '#185FA5',
      tag: factors.engagement >= 35 ? 'Highest contributor' : factors.engagement >= 20 ? 'High contributor' : 'Moderate contributor',
      tagColour: '',
    },
  ].sort((a, b) => b.contribution - a.contribution);

  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-gray-400 mb-3">
        Risk Factor Contributions
      </p>

      {factorDetails.map((f) => (
        <FactorBar key={f.label} {...f} />
      ))}

      {/* Model explanation box */}
      <div className="mt-2 bg-gray-50 rounded-lg px-4 py-3 text-xs text-gray-600 leading-relaxed border border-gray-100">
        <span className="font-semibold text-gray-800">Model explanation: </span>
        {explanation}
      </div>
    </div>
  );
}
