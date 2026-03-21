// ============================================================
// AcademicHealthScore.tsx  —  Novelty 3
// Student-facing health score gauge. Framed positively
// (0–100 health score, NOT "dropout risk") per MyLA standard.
// ============================================================

interface AcademicHealthScoreProps {
  score: number;       // 0–100 health score (100 - riskScore)
  lastUpdated?: string;
}

export function AcademicHealthScore({ score, lastUpdated }: AcademicHealthScoreProps) {
  const colour =
    score >= 75 ? '#3B6D11' :
    score >= 50 ? '#185FA5' :
    score >= 25 ? '#BA7517' : '#E24B4A';

  const label =
    score >= 75 ? 'Good standing' :
    score >= 50 ? 'Needs monitoring' :
    score >= 25 ? 'Needs attention' : 'Urgent attention needed';

  const labelColour =
    score >= 75 ? 'text-green-700 bg-green-50 border-green-200' :
    score >= 50 ? 'text-blue-700 bg-blue-50 border-blue-200' :
    score >= 25 ? 'text-amber-700 bg-amber-50 border-amber-200' :
    'text-red-700 bg-red-50 border-red-200';

  // Arc: 0 = left end, 100 = right end
  const arcLen = 204;
  const filled = (score / 100) * arcLen;

  const angle = (score / 100) * 180 - 90;
  const rad   = (angle * Math.PI) / 180;
  const r     = 62, cx = 80, cy = 80;
  const nx    = cx + r * 0.72 * Math.cos(rad);
  const ny    = cy + r * 0.72 * Math.sin(rad);

  return (
    <div className="flex flex-col items-center">
      <p className="text-xs font-medium uppercase tracking-wide text-gray-400 mb-3 text-center">
        Your Academic Health Score
      </p>

      <svg width="180" height="108" viewBox="0 0 160 96">
        <defs>
          <linearGradient id="hs-grad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%"   stopColor="#A32D2D" />
            <stop offset="30%"  stopColor="#E24B4A" />
            <stop offset="60%"  stopColor="#BA7517" />
            <stop offset="100%" stopColor="#3B6D11" />
          </linearGradient>
          <clipPath id="hs-clip">
            <rect x={160 * ((100 - score) / 100)} y="0" width="160" height="120" />
          </clipPath>
        </defs>
        {/* Track */}
        <path d="M15 80 A65 65 0 0 1 145 80" fill="none" stroke="#f3f4f6" strokeWidth="12" strokeLinecap="round"/>
        {/* Filled */}
        <path d="M15 80 A65 65 0 0 1 145 80" fill="none" stroke="url(#hs-grad)"
          strokeWidth="12" strokeLinecap="round"
          strokeDasharray={`${arcLen} ${arcLen}`}
          strokeDashoffset={arcLen - filled}
          clipPath="url(#hs-clip)"
        />
        {/* Needle */}
        <line x1={cx} y1={cy} x2={nx} y2={ny} stroke={colour} strokeWidth="2.5" strokeLinecap="round"/>
        <circle cx={cx} cy={cy} r="5" fill={colour}/>
        {/* Score */}
        <text x={cx} y={cy - 8} textAnchor="middle" fontSize="24" fontWeight="600" fill={colour}>{score}</text>
        <text x={cx} y={cy + 6} textAnchor="middle" fontSize="9" fill="#9ca3af">out of 100</text>
        {/* Labels */}
        <text x="10" y="94" fontSize="8" fill="#9ca3af" textAnchor="middle">Needs help</text>
        <text x="150" y="94" fontSize="8" fill="#9ca3af" textAnchor="middle">Excellent</text>
      </svg>

      <span className={`inline-flex items-center text-xs font-medium px-3 py-1 rounded-full border mt-1 ${labelColour}`}>
        {label}
      </span>

      <p className="text-[10px] text-gray-400 mt-2 text-center">
        {lastUpdated ? `Updated ${lastUpdated}` : 'Updated today'} · Shared with your SSA
      </p>
    </div>
  );
}
