'use client';

import { useRef, useState, type PointerEvent } from 'react';
import { POOL, type Position } from '@/lib/poolLayout';

export type AssignedInfo = { initials: string; name: string };

const VIEW_W = 1000;
const VIEW_H = 780;

export default function PoolMap({
  positions,
  laneCount,
  title,
  assigned,
  onPick,
  onMove,
  activeId,
  onActivate,
}: {
  positions: Position[];
  laneCount: number;
  title: string;
  assigned?: Record<string, AssignedInfo>;
  onPick?: (p: Position) => void;
  // מצב עריכה: גרירת עמדות על המפה. מקבל קואורדינטות במערכת 1000×780
  onMove?: (id: string, x: number, y: number) => void;
  activeId?: string | null;
  onActivate?: (id: string | null) => void;
}) {
  const r = laneCount > 10 ? 15 : 18;
  const svgRef = useRef<SVGSVGElement>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const draggable = !!onMove;

  // מיקום העכבר/האצבע במסך -> קואורדינטות ה-SVG (לא תלוי בגודל התצוגה או בגלילה)
  function toSvg(e: PointerEvent) {
    const svg = svgRef.current;
    const ctm = svg?.getScreenCTM();
    if (!svg || !ctm) return null;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const p = pt.matrixTransform(ctm.inverse());
    return {
      x: Math.round(Math.min(VIEW_W, Math.max(0, p.x))),
      y: Math.round(Math.min(VIEW_H, Math.max(0, p.y))),
    };
  }

  function endDrag() {
    setDragId(null);
  }

  return (
    <div className="mapwrap">
      <svg
        ref={svgRef}
        className={`${draggable ? 'draggable' : ''} ${dragId ? 'dragging' : ''}`}
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        xmlns="http://www.w3.org/2000/svg"
        role="img"
        aria-label={title}
        onPointerMove={
          draggable
            ? (e) => {
                if (!dragId) return;
                const p = toSvg(e);
                if (p) onMove!(dragId, p.x, p.y);
              }
            : undefined
        }
        onPointerUp={draggable ? endDrag : undefined}
        onPointerCancel={draggable ? endDrag : undefined}
      >
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
          const active = draggable && (activeId === p.id || dragId === p.id);
          return (
            <g
              key={p.id}
              className={`jud-map-marker ${draggable ? 'drag' : onPick ? '' : 'ro'} ${active ? 'active' : ''}`}
              onClick={onPick ? () => onPick(p) : undefined}
              onPointerDown={
                draggable
                  ? (e) => {
                      e.preventDefault();
                      // לכידת המצביע על ה-SVG כדי שהגרירה תמשיך גם כשהעכבר יוצא מהעיגול
                      svgRef.current?.setPointerCapture(e.pointerId);
                      setDragId(p.id);
                      onActivate?.(p.id);
                    }
                  : undefined
              }
            >
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
