// ============================================================
// StudentFactorBars.tsx  —  Novelty 3
// Student-friendly factor bars. Plain English language,
// no scary "dropout risk" framing. Based on MyLA standard.
// Shows only factors backed by real Firestore data.
// ============================================================

interface StudentFactorBarsProps {
  attendancePct: number;
  gpa: number;
  failedModules: number;
  advisorMeetings: number;
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

export function StudentFactorBars({ attendancePct, gpa, failedModules, advisorMeetings }: StudentFactorBarsProps) {
  const factors: FactorConfig[] = [
    {
      label: 'Attendance',
      description: `You've attended ${attendancePct}% of your sessions this semester`,
      value: attendancePct,
      targetLabel: 'Target: 80%+',
      statusLabel: attendancePct >= 80 ? 'On track' : attendancePct >= 60 ? 'Watch out' : 'Needs work',
      barColour: attendancePct >= 80 ? '#3B6D11' : attendancePct >= 60 ? '#BA7517' : '#E24B4A',
      badgeClass: attendancePct >= 80 ? 'bg-green-100 text-green-800 border-green-200' : attendancePct >= 60 ? 'bg-amber-100 text-amber-800 border-amber-200' : 'bg-red-100 text-red-800 border-red-200',
      note: attendancePct >= 80 ? 'Great work keeping up with your sessions.' : 'Attendance is your biggest impact area this semester.',
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
      label: 'Failed Modules',
      description: failedModules === 0
        ? 'You have no failed modules this semester'
        : `You have ${failedModules} failed module${failedModules > 1 ? 's' : ''}`,
      value: failedModules === 0 ? 100 : Math.max(0, 100 - (failedModules * 25)),
      targetLabel: 'Target: 0 failed',
      statusLabel: failedModules === 0 ? 'On track' : failedModules === 1 ? 'At risk' : 'Needs work',
      barColour: failedModules === 0 ? '#3B6D11' : failedModules === 1 ? '#BA7517' : '#E24B4A',
      badgeClass: failedModules === 0
        ? 'bg-green-100 text-green-800 border-green-200'
        : failedModules === 1
        ? 'bg-amber-100 text-amber-800 border-amber-200'
        : 'bg-red-100 text-red-800 border-red-200',
      note: failedModules === 0
        ? 'Keep up the good work.'
        : 'Speak to your Academic Mentor for support.',
    },
    {
      label: 'Advisor Engagement',
      description: advisorMeetings === 0
        ? 'You have not met with your advisor yet'
        : `You have met your advisor ${advisorMeetings} time${advisorMeetings > 1 ? 's' : ''}`,
      value: Math.min(advisorMeetings * 25, 100),
      targetLabel: 'Target: 2+ meetings',
      statusLabel: advisorMeetings === 0 ? 'Needs work' : advisorMeetings === 1 ? 'On track' : 'Good',
      barColour: advisorMeetings === 0 ? '#E24B4A' : advisorMeetings === 1 ? '#BA7517' : '#3B6D11',
      badgeClass: advisorMeetings === 0
        ? 'bg-red-100 text-red-800 border-red-200'
        : advisorMeetings === 1
        ? 'bg-amber-100 text-amber-800 border-amber-200'
        : 'bg-green-100 text-green-800 border-green-200',
      note: advisorMeetings === 0
        ? 'Book a session with your SSA or Mentor for support.'
        : 'Keep engaging with your support team.',
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
