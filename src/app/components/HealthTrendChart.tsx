// ============================================================
// HealthTrendChart.tsx  —  Novelty 3
// Lightweight SVG trend chart showing estimated health score
// trajectory over the past 6 months. Uses current score to
// project a simulated historical trend.
// ============================================================

interface HealthTrendChartProps {
  currentScore: number;
}

export function HealthTrendChart({ currentScore }: HealthTrendChartProps) {
  // Generate simulated historical data points leading up to currentScore
  const months = ['7mo', '6mo', '5mo', '4mo', '3mo', '2mo', '1mo', 'Now'];
  const points = generateTrend(currentScore);

  const minVal = Math.min(...points) - 5;
  const maxVal = Math.max(...points) + 5;
  const range  = maxVal - minVal || 1;

  const w = 220, h = 70;
  const pad = { left: 8, right: 8, top: 8, bottom: 16 };
  const chartW = w - pad.left - pad.right;
  const chartH = h - pad.top - pad.bottom;

  const toX = (i: number) => pad.left + (i / (points.length - 1)) * chartW;
  const toY = (v: number) => pad.top + chartH - ((v - minVal) / range) * chartH;

  const pathD = points
    .map((v, i) => `${i === 0 ? 'M' : 'L'} ${toX(i).toFixed(1)} ${toY(v).toFixed(1)}`)
    .join(' ');

  // Area fill
  const areaD = pathD
    + ` L ${toX(points.length - 1).toFixed(1)} ${(pad.top + chartH).toFixed(1)}`
    + ` L ${toX(0).toFixed(1)} ${(pad.top + chartH).toFixed(1)} Z`;

  const trendColour = currentScore >= 60 ? '#3B6D11' : currentScore >= 40 ? '#BA7517' : '#E24B4A';

  return (
    <div>
      <p className="text-[10px] font-medium uppercase tracking-wide text-gray-400 mb-1">
        Health Trend
      </p>
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="w-full">
        <defs>
          <linearGradient id="ht-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={trendColour} stopOpacity="0.18" />
            <stop offset="100%" stopColor={trendColour} stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Area */}
        <path d={areaD} fill="url(#ht-fill)" />

        {/* Line */}
        <path d={pathD} fill="none" stroke={trendColour} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />

        {/* Current dot */}
        <circle
          cx={toX(points.length - 1)}
          cy={toY(points[points.length - 1])}
          r="3"
          fill={trendColour}
        />

        {/* Month labels */}
        {[0, 3, 7].map((i) => (
          <text
            key={i}
            x={toX(i)}
            y={h - 2}
            fontSize="7"
            fill="#9ca3af"
            textAnchor="middle"
          >
            {months[i]}
          </text>
        ))}
      </svg>
    </div>
  );
}

function generateTrend(currentScore: number): number[] {
  // Simulate 8 data points (7 months ago → now)
  // Trend: gradually approaches currentScore with slight noise
  const seed = currentScore;
  const points: number[] = [];
  // Start from a mid-range value and trend toward currentScore
  const startOffset = currentScore < 50 ? 20 : -15;
  const start = Math.max(5, Math.min(95, currentScore + startOffset));

  for (let i = 0; i < 8; i++) {
    const t = i / 7;
    const base = start + (currentScore - start) * t;
    // Small deterministic noise
    const noise = Math.sin(i * seed * 0.3 + seed) * 4;
    points.push(Math.max(0, Math.min(100, Math.round(base + noise))));
  }
  points[7] = currentScore; // Ensure last point is exact
  return points;
}
