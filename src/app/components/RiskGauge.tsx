// ============================================================
// RiskGauge.tsx  —  Novelty 2
// SVG semicircle gauge showing dropout risk score 0–100.
// ============================================================

interface RiskGaugeProps {
  score: number;
  size?: number;
}

export function RiskGauge({ score, size = 160 }: RiskGaugeProps) {
  const colour =
    score >= 80 ? '#E24B4A' :
    score >= 60 ? '#BA7517' :
    score >= 40 ? '#185FA5' : '#3B6D11';

  // Arc: semicircle from left to right, radius 50, centre 80,60
  // Total arc length ~157px. needle angle: 0% = left, 100% = right
  const angle = (score / 100) * 180 - 90; // degrees, -90 = left, 90 = right
  const rad   = (angle * Math.PI) / 180;
  const r     = 50;
  const cx    = 80, cy = 68;
  const nx    = cx + r * 0.72 * Math.cos(rad);
  const ny    = cy + r * 0.72 * Math.sin(rad);

  const arcLen = 157;
  const filled = (score / 100) * arcLen;

  const label =
    score >= 80 ? 'Critical' :
    score >= 60 ? 'High' :
    score >= 40 ? 'Medium' : 'Low';

  return (
    <svg
      width={size}
      height={size * 0.65}
      viewBox="0 0 160 104"
      aria-label={`Risk score ${score} — ${label}`}
    >
      <defs>
        <linearGradient id="rg-grad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%"   stopColor="#3B6D11" />
          <stop offset="35%"  stopColor="#BA7517" />
          <stop offset="70%"  stopColor="#E24B4A" />
          <stop offset="100%" stopColor="#A32D2D" />
        </linearGradient>
        <clipPath id="rg-clip">
          <rect x="0" y="0" width={160 * (score / 100)} height="140" />
        </clipPath>
      </defs>

      {/* Track */}
      <path
        d="M18 68 A62 62 0 0 1 142 68"
        fill="none"
        stroke="#e5e7eb"
        strokeWidth="10"
        strokeLinecap="round"
      />

      {/* Filled arc — coloured by score */}
      <path
        d="M18 68 A62 62 0 0 1 142 68"
        fill="none"
        stroke="url(#rg-grad)"
        strokeWidth="10"
        strokeLinecap="round"
        strokeDasharray={`${arcLen} ${arcLen}`}
        strokeDashoffset={arcLen - filled}
        clipPath="url(#rg-clip)"
      />

      {/* Needle */}
      <line
        x1={cx} y1={cy}
        x2={nx} y2={ny}
        stroke={colour}
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <circle cx={cx} cy={cy} r="4.5" fill={colour} />

      {/* Score text */}
      <text
        x={cx} y={cy - 10}
        textAnchor="middle"
        fontSize="22"
        fontWeight="600"
        fill={colour}
      >
        {score}
      </text>

      {/* Scale labels */}
      <text x="12" y="90" fontSize="9" fill="#9ca3af" textAnchor="middle">0</text>
      <text x="148" y="90" fontSize="9" fill="#9ca3af" textAnchor="middle">100</text>
    </svg>
  );
}
