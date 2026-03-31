// ============================================================
// WhatIfSimulator.tsx  —  Novelty 2
// Interactive slider-based simulator for SSAs.
// Shows how changing attendance/GPA/consecutive absences changes risk.
// Pure frontend calculation — no API call needed.
// ============================================================

import { useState, useCallback } from 'react';
import { simulateRiskScore, getRiskLevelFromScore, getRiskColour } from '../services/riskScoreService';
import type { RiskFactors } from '../services/riskScoreService';
import { RiskScoreBadge } from './RiskScoreBadge';

interface WhatIfSimulatorProps {
  baseAttendance: number;
  baseGpa: number;
  baseConsecutiveAbsences: number;
  baseScore: number;
  pending?: boolean;
}

export function WhatIfSimulator({
  baseAttendance,
  baseGpa,
  baseConsecutiveAbsences,
  baseScore,
  pending,
}: WhatIfSimulatorProps) {
  const [attendance,   setAttendance]   = useState(baseAttendance);
  const [gpa,          setGpa]          = useState(Math.round(baseGpa * 10));  // store as int 0–40
  const [absences,     setAbsences]     = useState(baseConsecutiveAbsences);

  const baseFactors: RiskFactors = {
    attendancePercentage: baseAttendance,
    gpa: baseGpa,
    consecutiveAbsences: baseConsecutiveAbsences,
    failedModules: 0,
    missingAssignments: 0,
    poorExamScores: 0,
    repeatingModules: 0,
  };

  const simResult = simulateRiskScore(baseFactors, {
    attendancePercentage: attendance,
    gpa: gpa / 10,
    consecutiveAbsences: absences,
  });
  const simScore = simResult.score;
  const delta    = baseScore - simScore;
  const colour   = getRiskColour(getRiskLevelFromScore(simScore));

  const reset = useCallback(() => {
    setAttendance(baseAttendance);
    setGpa(Math.round(baseGpa * 10));
    setAbsences(baseConsecutiveAbsences);
  }, [baseAttendance, baseGpa, baseConsecutiveAbsences]);

  const getInsight = () => {
    if (delta <= 0) return "Adjust the sliders above to model how an intervention would reduce this student's risk score.";
    if (attendance > baseAttendance && delta >= 15)
      return `Improving attendance from ${baseAttendance}% → ${attendance}% is the most impactful change — it alone could reduce the risk score by approximately ${delta} points.`;
    if (gpa / 10 > baseGpa && delta >= 10)
      return `Raising GPA from ${baseGpa.toFixed(1)} → ${(gpa / 10).toFixed(1)} combined with other improvements reduces risk to ${simScore} — moving closer to a manageable range.`;
    return `These combined changes would reduce the dropout risk score by ${delta} points (${baseScore} → ${simScore}).`;
  };

  return (
    <div className="relative">
      {pending && (
        <div className="absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-white/80 backdrop-blur-[2px]">
          <span className="text-xs font-medium text-gray-500 bg-gray-100 border border-gray-200 px-3 py-1.5 rounded-full">
            Connect ML model to enable
          </span>
        </div>
      )}
      <div className={pending ? 'pointer-events-none select-none opacity-40' : ''}>
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

        {/* Consecutive Absences */}
        <div>
          <div className="flex justify-between items-center mb-1">
            <label className="text-xs text-gray-600">Consecutive absences target</label>
            <span className="text-xs font-semibold text-gray-800">{absences}</span>
          </div>
          <input
            type="range" min={0} max={baseConsecutiveAbsences} value={absences} step={1}
            onChange={(e) => setAbsences(Number(e.target.value))}
            className="w-full accent-blue-600 h-1.5 cursor-pointer"
          />
          <div className="flex justify-between text-[10px] text-gray-400 mt-0.5">
            <span>Current: {baseConsecutiveAbsences}</span><span>Target: 0</span>
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
    </div>
  );
}
