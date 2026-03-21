// ============================================================
// RiskScoreBadge.tsx  —  Novelty 1
// Reusable score pill used in Students table, Dashboard cards,
// Alerts page, and anywhere else a score needs to be shown.
// ============================================================

import { cn } from './ui/utils';

interface RiskScoreBadgeProps {
  score: number;
  showLabel?: boolean;
  size?: 'sm' | 'md';
  className?: string;
}

export function RiskScoreBadge({
  score,
  showLabel = false,
  size = 'md',
  className,
}: RiskScoreBadgeProps) {
  const level =
    score >= 80 ? 'critical' :
    score >= 60 ? 'high' :
    score >= 40 ? 'medium' : 'low';

  const colours: Record<string, string> = {
    critical: 'bg-red-100 text-red-800 border border-red-200',
    high:     'bg-amber-100 text-amber-800 border border-amber-200',
    medium:   'bg-blue-100 text-blue-800 border border-blue-200',
    low:      'bg-green-100 text-green-800 border border-green-200',
  };

  const labels: Record<string, string> = {
    critical: 'Critical',
    high:     'High',
    medium:   'Medium',
    low:      'Low',
  };

  const sizeClass = size === 'sm'
    ? 'text-[10px] px-1.5 py-0.5 min-w-[28px]'
    : 'text-xs px-2 py-0.5 min-w-[36px]';

  return (
    <span
      className={cn(
        'inline-flex items-center justify-center rounded-full font-medium',
        colours[level],
        sizeClass,
        className
      )}
    >
      {score}{showLabel && ` · ${labels[level]}`}
    </span>
  );
}

// Risk level badge (text only, no number)
interface RiskLevelBadgeProps {
  level: string;
  className?: string;
}

export function RiskLevelBadge({ level, className }: RiskLevelBadgeProps) {
  const colours: Record<string, string> = {
    critical: 'bg-red-100 text-red-800 border border-red-200',
    high:     'bg-amber-100 text-amber-800 border border-amber-200',
    medium:   'bg-blue-100 text-blue-800 border border-blue-200',
    low:      'bg-green-100 text-green-800 border border-green-200',
  };
  const labels: Record<string, string> = {
    critical: 'Critical',
    high:     'High Risk',
    medium:   'Medium Risk',
    low:      'Low Risk',
  };
  return (
    <span
      className={cn(
        'inline-flex items-center justify-center rounded-full text-xs font-medium px-2 py-0.5',
        colours[level] ?? colours.low,
        className
      )}
    >
      {labels[level] ?? level}
    </span>
  );
}
