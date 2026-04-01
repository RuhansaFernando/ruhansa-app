// ============================================================
// WhatIfSimulator.tsx  —  Novelty 2
// Actionable what-if simulator for SSAs.
// Sends overridden feature values to the ML model and shows
// the predicted reduction in dropout risk.
// ============================================================

import { useState } from 'react';
import { callMLModel } from '../services/riskScoreService';

interface StudentMLData {
  attendance_rate?: number;
  gpa_current?: number;
  advisor_meeting_count?: number;
  academic_warning_count?: number;
}

interface WhatIfSimulatorProps {
  studentData: StudentMLData;
  currentScore: number;
  pending?: boolean;
}

export function WhatIfSimulator({ studentData, currentScore, pending }: WhatIfSimulatorProps) {
  const [simAttendance, setSimAttendance] = useState(Math.round((studentData.attendance_rate ?? 0) * 100));
  const [simGpa, setSimGpa]               = useState(studentData.gpa_current ?? 0);
  const [simMeetings, setSimMeetings]     = useState(studentData.advisor_meeting_count ?? 0);
  const [simWarnings, setSimWarnings]     = useState<'keep' | 'resolve'>('keep');
  const [simResult, setSimResult]         = useState<number | null>(null);
  const [simLoading, setSimLoading]       = useState(false);

  const runSimulation = async () => {
    setSimLoading(true);
    try {
      const modifiedData = {
        ...studentData,
        attendance_rate: simAttendance / 100,
        gpa_current: simGpa,
        advisor_meeting_count: simMeetings,
        academic_warning_count: simWarnings === 'resolve' ? 0 : (studentData.academic_warning_count ?? 0),
      };
      const result = await callMLModel(
        {
          attendanceRate: modifiedData.attendance_rate,
          gpaCurrent: modifiedData.gpa_current,
          gpaHistory: modifiedData.gpa_current,
          academicWarningCount: modifiedData.academic_warning_count ?? 0,
          creditsCompleted: 0,
          failedModules: 0,
        },
        { advisorMeetingCount: modifiedData.advisor_meeting_count },
      );
      if (!result.pending) {
        setSimResult(result.score);
      }
    } catch (err) {
      console.error('Simulation failed:', err);
    } finally {
      setSimLoading(false);
    }
  };

  if (pending) {
    return (
      <div className="text-center py-8">
        <p className="text-sm text-muted-foreground">
          Connect ML model to use the What-If simulator
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Subtitle */}
      <p className="text-sm text-muted-foreground mt-1">
        Simulate how targeted interventions could reduce this student's dropout risk.
        Adjust the values below to see the predicted impact.
      </p>

      {/* Input 1 — Attendance */}
      <div className="space-y-2">
        <div className="flex justify-between">
          <label className="text-sm font-medium">What if attendance improves?</label>
          <span className="text-sm text-muted-foreground">
            Currently {Math.round((studentData.attendance_rate ?? 0) * 100)}%
          </span>
        </div>
        <input
          type="range" min={0} max={100} step={5}
          value={simAttendance}
          onChange={(e) => { setSimAttendance(Number(e.target.value)); setSimResult(null); }}
          className="w-full accent-blue-600"
        />
        <p className="text-xs text-blue-600 text-right">Target: {simAttendance}%</p>
      </div>

      {/* Input 2 — GPA */}
      <div className="space-y-2">
        <div className="flex justify-between">
          <label className="text-sm font-medium">What if GPA improves?</label>
          <span className="text-sm text-muted-foreground">
            Currently {studentData.gpa_current?.toFixed(2) ?? '0.00'}
          </span>
        </div>
        <input
          type="range" min={0} max={4} step={0.1}
          value={simGpa}
          onChange={(e) => { setSimGpa(Number(e.target.value)); setSimResult(null); }}
          className="w-full accent-blue-600"
        />
        <p className="text-xs text-blue-600 text-right">Target: {simGpa.toFixed(2)}</p>
      </div>

      {/* Input 3 — Advisor Meetings */}
      <div className="space-y-2">
        <div className="flex justify-between">
          <label className="text-sm font-medium">What if advisor meetings increase?</label>
          <span className="text-sm text-muted-foreground">
            Currently {studentData.advisor_meeting_count ?? 0} meetings
          </span>
        </div>
        <input
          type="range" min={0} max={10} step={1}
          value={simMeetings}
          onChange={(e) => { setSimMeetings(Number(e.target.value)); setSimResult(null); }}
          className="w-full accent-blue-600"
        />
        <p className="text-xs text-blue-600 text-right">Target: {simMeetings} meetings per semester</p>
      </div>

      {/* Input 4 — Academic Warnings */}
      <div className="space-y-2">
        <div className="flex justify-between">
          <label className="text-sm font-medium">What if academic warnings are resolved?</label>
          <span className="text-sm text-muted-foreground">
            Currently {studentData.academic_warning_count ?? 0} warnings
          </span>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => { setSimWarnings('keep'); setSimResult(null); }}
            className={`flex-1 py-1.5 text-sm rounded-md border transition-colors ${
              simWarnings === 'keep'
                ? 'bg-gray-100 border-gray-300 font-medium'
                : 'border-gray-200 hover:bg-gray-50'
            }`}
          >
            Keep Current ({studentData.academic_warning_count ?? 0})
          </button>
          <button
            onClick={() => { setSimWarnings('resolve'); setSimResult(null); }}
            className={`flex-1 py-1.5 text-sm rounded-md border transition-colors ${
              simWarnings === 'resolve'
                ? 'bg-green-50 border-green-300 text-green-700 font-medium'
                : 'border-gray-200 hover:bg-gray-50'
            }`}
          >
            Resolve All ✓
          </button>
        </div>
      </div>

      {/* Run Simulation */}
      <button
        onClick={runSimulation}
        disabled={simLoading}
        className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-md transition-colors disabled:opacity-50"
      >
        {simLoading ? 'Simulating...' : 'Run Simulation'}
      </button>

      {/* Results */}
      {simResult !== null && (
        <div className="rounded-lg border p-4 bg-gray-50">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Simulation Result</span>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-center">
              <p className="text-xs text-muted-foreground">Current Risk</p>
              <p className="text-2xl font-bold text-red-600">{currentScore}%</p>
            </div>
            <div className="text-2xl text-muted-foreground">→</div>
            <div className="text-center">
              <p className="text-xs text-muted-foreground">Predicted Risk</p>
              <p className={`text-2xl font-bold ${simResult < currentScore ? 'text-green-600' : 'text-red-600'}`}>
                {simResult}%
              </p>
            </div>
            <div className="text-center">
              <p className="text-xs text-muted-foreground">Change</p>
              <p className={`text-lg font-bold ${simResult < currentScore ? 'text-green-600' : 'text-red-600'}`}>
                {simResult < currentScore ? '↓' : '↑'} {Math.abs(simResult - currentScore)}pp
              </p>
            </div>
          </div>
          {simResult < currentScore && (
            <p className="text-sm text-green-700 mt-2 bg-green-50 rounded p-2">
              ✓ These interventions could reduce dropout risk by {currentScore - simResult} percentage points.
            </p>
          )}
          {simResult >= currentScore && (
            <p className="text-sm text-amber-700 mt-2 bg-amber-50 rounded p-2">
              ⚠ These changes show minimal impact. Consider other intervention strategies.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
