'use client';

import { POOL, type Position } from '@/lib/poolLayout';

export type AssignedInfo = { initials: string; name: string };

export default function PoolMap({
  positions,
  laneCount,
  title,
  assigned,
  onPick,
}: {
  positions: Position[];
  laneCount: number;
  title: string;
  assigned?: Record<string, AssignedInfo>;
  onPick?: (p: Position) => void;
}) {
  const r = laneCount > 10 ? 15 : 18;
  return (
    <div className="mapwrap">
      <svg viewBox="0 0 1000 780" xmlns="http://www.w3.org/2000/svg" role="img" aria-label={title}>
        <rect className="mp-pool" x={POOL.x} y={POOL.y} width={POOL.w} height={POOL.h} rx={6} />
        {Array.from({ length: laneCount - 1 }).map((_, i) => {
          const y = POOL.y + ((i + 1) * POOL.h) / laneCount;
          return <line key={i} className="mp-lane" x1={POOL.x} x2={POOL.x + POOL.w} y1={y} y2={y} />;
        })}
        <text className="mp-title" x={POOL.x + POOL.w / 2} y={26}>
          {title}
        </text>
        <text className="mp-side" x={160} y={POOL.y + POOL.h / 2}>צד א׳</text>
        <text className="mp-side" x={905} y={POOL.y + POOL.h / 2}>צד ב׳</text>
        {positions.map((p) => {
          const a = assigned?.[p.id];
          return (
            <g key={p.id} className={`jud-map-marker ${onPick ? '' : 'ro'}`} onClick={onPick ? () => onPick(p) : undefined}>
              <title>{a ? `${p.label} — ${a.name}` : p.label}</title>
              <circle className={`mp-dot ${a ? 'f' : ''}`} cx={p.x} cy={p.y} r={r} />
              <text className={`mp-txt ${a ? 'f' : ''}`} x={p.x} y={p.y + 4.5}>
                {a ? a.initials : onPick ? '+' : ''}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
