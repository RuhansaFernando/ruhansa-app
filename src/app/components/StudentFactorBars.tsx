// ============================================================
// StudentFactorBars.tsx  —  Novelty 3
// Student-friendly factor bars. Plain English language,
// no scary "dropout risk" framing. Based on MyLA standard.
// ============================================================

interface StudentFactorBarsProps {
  attendancePct: number;
  gpa: number;
  engagementPct: number;
}

interface FactorConfig {
  label: string;
  description: string;
  value: number;
  targetLabel: string;
  statusLabel: string;
  barColour: string;
  badgeClass: string;
  note: string;
}

export function StudentFactorBars({ attendancePct, gpa, engagementPct }: StudentFactorBarsProps) {
  const factors: FactorConfig[] = [
    {
      label: 'Attendance',
      description: `You've attended ${attendancePct}% of your sessions this semester`,
      value: attendancePct,
      targetLabel: 'Target: 75%+',
      statusLabel: attendancePct >= 75 ? 'On track' : attendancePct >= 60 ? 'Watch out' : 'Needs work',
      barColour: attendancePct >= 75 ? '#3B6D11' : attendancePct >= 60 ? '#BA7517' : '#E24B4A',
      badgeClass: attendancePct >= 75 ? 'bg-green-100 text-green-800 border-green-200' : attendancePct >= 60 ? 'bg-amber-100 text-amber-800 border-amber-200' : 'bg-red-100 text-red-800 border-red-200',
      note: attendancePct >= 75 ? 'Great work keeping up with your sessions.' : 'Attendance is your biggest impact area this semester.',
    },
    {
      label: 'Academic Performance',
      description: `Your current GPA is ${gpa.toFixed(1)}`,
      value: Math.min((gpa / 4.0) * 100, 100),
      targetLabel: 'Target: GPA 2.5+',
      statusLabel: gpa >= 2.5 ? 'On track' : gpa >= 2.0 ? 'Watch out' : 'Needs work',
      barColour: gpa >= 2.5 ? '#3B6D11' : gpa >= 2.0 ? '#BA7517' : '#E24B4A',
      badgeClass: gpa >= 2.5 ? 'bg-green-100 text-green-800 border-green-200' : gpa >= 2.0 ? 'bg-amber-100 text-amber-800 border-amber-200' : 'bg-red-100 text-red-800 border-red-200',
      note: gpa >= 2.5 ? 'Your grades are within the expected range.' : 'Consider reaching out to your Academic Mentor for support.',
    },
    {
      label: 'Engagement',
      description: `Your online learning activity is at ${engagementPct}% of expected level`,
      value: engagementPct,
      targetLabel: 'Target: 60%+',
      statusLabel: engagementPct >= 60 ? 'On track' : engagementPct >= 40 ? 'Declining' : 'Low',
      barColour: engagementPct >= 60 ? '#3B6D11' : engagementPct >= 40 ? '#BA7517' : '#E24B4A',
      badgeClass: engagementPct >= 60 ? 'bg-green-100 text-green-800 border-green-200' : engagementPct >= 40 ? 'bg-amber-100 text-amber-800 border-amber-200' : 'bg-red-100 text-red-800 border-red-200',
      note: engagementPct >= 60 ? 'You are staying active on the learning platform.' : 'Logging in regularly — even for 20 minutes — helps your score recover.',
    },
  ];

  return (
    <div className="space-y-4">
      <p className="text-xs font-medium uppercase tracking-wide text-gray-400 mb-2">
        What's affecting your score
      </p>
      {factors.map((f) => (
        <div key={f.label}>
          <div className="flex items-start justify-between mb-1.5">
            <div>
              <p className="text-sm font-medium text-gray-900">{f.label}</p>
              <p className="text-xs text-gray-500 mt-0.5">{f.description}</p>
            </div>
            <span className={`inline-flex items-center text-[10px] font-medium px-2 py-0.5 rounded-full border flex-shrink-0 ml-3 ${f.badgeClass}`}>
              {f.statusLabel}
            </span>
          </div>
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{ width: `${f.value}%`, background: f.barColour }}
            />
          </div>
          <div className="flex justify-between mt-1">
            <p className="text-[10px] text-gray-400">{f.note}</p>
            <span className="text-[10px] text-gray-400">{f.targetLabel}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
