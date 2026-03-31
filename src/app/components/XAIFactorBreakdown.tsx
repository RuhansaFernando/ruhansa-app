// ============================================================
// XAIFactorBreakdown.tsx  —  Novelty 2
// Shows SHAP-style factor contribution bars to the SSA.
// Props come from riskScoreService (mock now, Flask later).
// ============================================================

import type { RiskResult } from '../services/riskScoreService';

type FactorItem = RiskResult['factors'][number];

interface XAIFactorBreakdownProps {
  factors: FactorItem[];
  explanation?: string;
}

const STATUS_COLOUR: Record<string, string> = {
  critical: '#E24B4A',
  warning:  '#BA7517',
  good:     '#3B6D11',
};

const STATUS_TAG: Record<string, string> = {
  critical: 'High risk',
  warning:  'Monitor',
  good:     'On track',
};

function FactorBar({ name, value, contribution, status }: FactorItem) {
  const colour = STATUS_COLOUR[status] ?? STATUS_COLOUR.good;
  const tag    = STATUS_TAG[status]    ?? 'On track';

  return (
    <div className="mb-4">
      <div className="flex items-start justify-between mb-1.5">
        <div>
          <p className="text-sm font-medium text-gray-900">{name}</p>
          <p className="text-xs text-gray-500 mt-0.5">Value: {value}</p>
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
      </div>
    </div>
  );
}

export function XAIFactorBreakdown({ factors, explanation }: XAIFactorBreakdownProps) {
  if (factors.length === 0) {
    return null;
  }

  const sorted = [...factors].sort((a, b) => b.contribution - a.contribution);

  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-gray-400 mb-3">
        Risk Factor Contributions
      </p>

      {sorted.map((f) => (
        <FactorBar key={f.name} {...f} />
      ))}

      {explanation && (
        <div className="mt-2 bg-gray-50 rounded-lg px-4 py-3 text-xs text-gray-600 leading-relaxed border border-gray-100">
          <span className="font-semibold text-gray-800">Model explanation: </span>
          {explanation}
        </div>
      )}
    </div>
  );
}
