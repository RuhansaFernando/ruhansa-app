// ============================================================
// WhatIfSimulator.tsx  —  Novelty 2
// Interactive slider-based simulator for SSAs.
// Shows how changing attendance/GPA/engagement changes risk score.
// Pure frontend calculation — no API call needed.
// ============================================================

import { useState, useCallback } from 'react';
import { simulateRiskScore, getRiskLevelFromScore, getRiskColour } from '../services/riskScoreService';
import { RiskScoreBadge } from './RiskScoreBadge';

interface WhatIfSimulatorProps {
  baseAttendance: number;
  baseGpa: number;
  baseEngagement: number;
  baseScore: number;
}

export function WhatIfSimulator({
  baseAttendance,
  baseGpa,
  baseEngagement,
  baseScore,
}: WhatIfSimulatorProps) {
  const [attendance,  setAttendance]  = useState(baseAttendance);
  const [gpa,         setGpa]         = useState(Math.round(baseGpa * 10));  // store as int 0–40
  const [engagement,  setEngagement]  = useState(baseEngagement);

  const simScore = simulateRiskScore(attendance, gpa / 10, engagement);
  const delta    = baseScore - simScore;
  const colour   = getRiskColour(getRiskLevelFromScore(simScore));

  const reset = useCallback(() => {
    setAttendance(baseAttendance);
    setGpa(Math.round(baseGpa * 10));
    setEngagement(baseEngagement);
  }, [baseAttendance, baseGpa, baseEngagement]);

  const getInsight = () => {
    if (delta <= 0) return "Adjust the sliders above to model how an intervention would reduce this student's risk score.";
    if (attendance > baseAttendance && delta >= 15)
      return `Improving attendance from ${baseAttendance}% → ${attendance}% is the most impactful change — it alone could reduce the risk score by approximately ${delta} points.`;
    if (gpa / 10 > baseGpa && delta >= 10)
      return `Raising GPA from ${baseGpa.toFixed(1)} → ${(gpa / 10).toFixed(1)} combined with other improvements reduces risk to ${simScore} — moving closer to a manageable range.`;
    return `These combined changes would reduce the dropout risk score by ${delta} points (${baseScore} → ${simScore}).`;
  };

  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-gray-400 mb-1">
        What-If Intervention Simulator
      </p>
      <p className="text-xs text-gray-500 mb-4 leading-relaxed">
        Drag the sliders to model how targeted interventions would change this student's predicted dropout risk.
      </p>

      {/* Sliders */}
      <div className="space-y-4">
        {/* Attendance */}
        <div>
          <div className="flex justify-between items-center mb-1">
            <label className="text-xs text-gray-600">Attendance target</label>
            <span className="text-xs font-semibold text-gray-800">{attendance}%</span>
          </div>
          <input
            type="range" min={baseAttendance} max={100} value={attendance} step={1}
            onChange={(e) => setAttendance(Number(e.target.value))}
            className="w-full accent-blue-600 h-1.5 cursor-pointer"
          />
          <div className="flex justify-between text-[10px] text-gray-400 mt-0.5">
            <span>Current: {baseAttendance}%</span><span>Target: 75%+</span>
          </div>
        </div>

        {/* GPA */}
        <div>
          <div className="flex justify-between items-center mb-1">
            <label className="text-xs text-gray-600">GPA target</label>
            <span className="text-xs font-semibold text-gray-800">{(gpa / 10).toFixed(1)}</span>
          </div>
          <input
            type="range" min={Math.round(baseGpa * 10)} max={40} value={gpa} step={1}
            onChange={(e) => setGpa(Number(e.target.value))}
            className="w-full accent-blue-600 h-1.5 cursor-pointer"
          />
          <div className="flex justify-between text-[10px] text-gray-400 mt-0.5">
            <span>Current: {baseGpa.toFixed(1)}</span><span>Target: 2.5+</span>
          </div>
        </div>

        {/* Engagement */}
        <div>
          <div className="flex justify-between items-center mb-1">
            <label className="text-xs text-gray-600">Engagement target</label>
            <span className="text-xs font-semibold text-gray-800">{engagement}%</span>
          </div>
          <input
            type="range" min={baseEngagement} max={100} value={engagement} step={1}
            onChange={(e) => setEngagement(Number(e.target.value))}
            className="w-full accent-blue-600 h-1.5 cursor-pointer"
          />
          <div className="flex justify-between text-[10px] text-gray-400 mt-0.5">
            <span>Current: {baseEngagement}%</span><span>Target: 60%+</span>
          </div>
        </div>
      </div>

      {/* Simulated result */}
      <div className="mt-4 bg-gray-50 rounded-xl p-4 text-center border border-gray-100">
        <p className="text-xs text-gray-500 mb-1">Simulated risk score</p>
        <p className="text-3xl font-bold mb-2" style={{ color: colour }}>{simScore}</p>
        <RiskScoreBadge score={simScore} showLabel />
        {delta > 0 && (
          <p className="text-xs text-green-700 font-medium mt-2">
            ↓ {delta} point reduction from current score of {baseScore}
          </p>
        )}
      </div>

      {/* Insight */}
      <div className="mt-3 bg-blue-50 rounded-lg px-4 py-3 text-xs text-blue-800 leading-relaxed border border-blue-100">
        <span className="font-semibold">Insight: </span>{getInsight()}
      </div>

      <button
        onClick={reset}
        className="mt-3 text-xs text-gray-400 hover:text-gray-600 underline underline-offset-2"
      >
        Reset to current values
      </button>
    </div>
  );
}
