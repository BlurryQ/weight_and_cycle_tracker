import { useId } from 'react'
import { diffDays } from '../../lib/dates'
import type { ChartGeometry } from '../../lib/chartGeometry'

interface WeightChartProps {
  geometry: ChartGeometry
  W: number
  H: number
  gutter: number
  variant: 'today' | 'trends'
  /** Optional set of ISO dates that fall inside a logged period (see
   * `cycle.periodDaysInRange`). When present, each in-range day gets a small --menstrual tick
   * on the chart baseline — a faint calendar of "when the bleed was" under the weight line, so
   * a luteal-phase water bump lines up visually with the period that follows it. Purely
   * decorative; it never shifts the line, bands, or domain. */
  periodDays?: Set<string>
}

const CUT_FILL = 'var(--band-cut-fill)'
const CUT_EDGE = 'var(--band-cut-edge)'
const CUT_LABEL = 'var(--band-cut-label)'
const BULK_FILL = 'var(--band-bulk-fill)'
const BULK_EDGE = 'var(--band-bulk-edge)'
const BULK_LABEL = 'var(--band-bulk-label)'

/** Renders the weekly-average chart shared by Today (compact) and Trends (full). Geometry
 * comes from lib/chartGeometry.ts — this component only draws it, back to front: bands,
 * gridlines, area, trend line (faint past + dashed forward), data line, target reference,
 * period ticks, dots. */
export function WeightChart({ geometry: g, W, H, gutter, variant, periodDays }: WeightChartProps) {
  const gradId = useId()
  const isTrends = variant === 'trends'

  if (!g.line) return null

  // Map each period day to an x on the same axis the weekly points sit on. The shown weekly
  // points span indices 0..(weeks-1), and X(i) = i * lastX / (weeks-1) holds for fractional i
  // too, so a mid-week day lands between its neighbouring dots — by interpolating between that
  // day's own week and the *next* week's point. The last shown week has no next point to
  // interpolate toward, so any day in it past its own Monday (today included) computes past
  // span; clamp those to the chart's rightmost x instead of dropping them, or a period logged
  // this week never shows a tick until next week's average lands. Days genuinely before the
  // drawn window (idx < 0) are still dropped — periodDays is already bounded to the shown
  // range by its callers, so that's the only other out-of-bounds case.
  const periodTicks: number[] = []
  if (periodDays && periodDays.size && g.weeks > 1) {
    const span = g.weeks - 1
    for (const iso of periodDays) {
      const raw = span - diffDays(iso, g.lastMonday) / 7
      if (raw < 0) continue
      const idx = Math.min(span, raw)
      periodTicks.push((idx / span) * g.lastX)
    }
  }

  return (
    <div style={{ position: 'relative', paddingLeft: gutter }}>
      {g.bands.map((b, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            left: gutter + b.x + 4,
            top: H + 4,
            font: '600 8.5px/1 "Barlow Condensed", sans-serif',
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            color: b.cut ? CUT_LABEL : BULK_LABEL,
            whiteSpace: 'nowrap',
          }}
        >
          {b.label}
        </div>
      ))}
      {g.grid.map((line, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            left: 0,
            top: line.y - 5,
            font: '500 9px "IBM Plex Mono", monospace',
            color: 'var(--text-dim)',
            width: gutter - 6,
            textAlign: 'right',
          }}
        >
          {line.value}
        </div>
      ))}
      {/* The goal-pace line is the one thing that needs naming — the trend line grows out of
          the data. Right-aligned to the chart edge, just below its endpoint. */}
      {g.targetProj && (
        <div
          style={{
            position: 'absolute',
            left: 0,
            width: gutter + g.projX - 2,
            top: g.targetProjY + 3,
            textAlign: 'right',
            font: '500 8.5px "IBM Plex Mono", monospace',
            color: 'var(--text-muted)',
          }}
        >
          target
        </div>
      )}
      <svg width={W} height={H} style={{ overflow: 'visible', display: 'block' }}>
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--accent)" stopOpacity={isTrends ? 0.15 : 0.16} />
            <stop offset="100%" stopColor="var(--accent)" stopOpacity={0} />
          </linearGradient>
        </defs>

        {g.bands.map((b, i) => (
          <rect
            key={i}
            x={b.x}
            y={0}
            width={b.width}
            height={H}
            fill={b.cut ? CUT_FILL : BULK_FILL}
          />
        ))}
        {g.bands.map((b, i) => (
          <line
            key={'edge' + i}
            x1={b.x}
            x2={b.x}
            y1={0}
            y2={H}
            stroke={b.cut ? CUT_EDGE : BULK_EDGE}
            strokeWidth={1}
          />
        ))}

        {g.markers.map((x, i) => (
          <line key={i} x1={x} x2={x} y1={0} y2={H} stroke="var(--band-marker)" strokeWidth={1} />
        ))}

        {g.grid.map((line, i) => (
          <line key={i} x1={0} x2={W} y1={line.y} y2={line.y} stroke="var(--hairline-strong)" strokeWidth={1} />
        ))}

        <path className="accent-el" d={g.area} fill={`url(#${gradId})`} stroke="none" />

        {/* Trend line, one object: a faint solid connector back into the data … */}
        <path className="accent-el" d={g.trendPast} fill="none" stroke="var(--accent)" strokeWidth={1.4} strokeLinecap="round" opacity={0.4} />

        <path className="accent-el" d={g.line} fill="none" stroke="var(--accent)" strokeWidth={2.1} strokeLinejoin="round" />

        {/* … continued forward as the dashed projection. */}
        <path
          className="accent-el"
          d={g.proj}
          fill="none"
          stroke="var(--accent)"
          strokeWidth={1.8}
          strokeDasharray="5 4"
          strokeLinecap="round"
          opacity={0.72}
        />

        {/* Goal-pace reference: forward only, muted grey, still clearly below the cyan
            projection — subordinate by colour and a sparser dash, not by near-invisibility.
            The gap to the projection is the goal-vs-projected read. */}
        {g.targetProj && (
          <>
            <path
              d={g.targetProj}
              fill="none"
              stroke="var(--text-muted)"
              strokeWidth={1.4}
              strokeDasharray="2 4"
              strokeLinecap="round"
              opacity={0.85}
            />
            <line
              x1={g.targetProjX}
              x2={g.targetProjX}
              y1={g.targetProjY - 4}
              y2={g.targetProjY + 4}
              stroke="var(--text-muted)"
              strokeWidth={1.4}
              opacity={0.9}
            />
          </>
        )}

        {/* Period days: 4px --menstrual ticks flush to the baseline. Subtle — they read as a
            texture along the bottom edge, not another data series. Tune the height / opacity
            here if they compete with the weight line. */}
        {periodTicks.map((x, i) => (
          <line key={'period' + i} x1={x} x2={x} y1={H - 4} y2={H} stroke="var(--menstrual)" strokeWidth={1.5} opacity={0.9} />
        ))}

        {isTrends &&
          g.dots.map((d, i) => (
            <circle className="accent-el" key={i} cx={d.x} cy={d.y} r={2.4} fill="var(--bg)" stroke="var(--accent)" strokeWidth={1.2} />
          ))}

        <circle className="accent-el" cx={g.lastX} cy={g.lastY} r={4.5} fill="var(--accent)" />
        <circle
          className="accent-el"
          cx={g.projX}
          cy={g.projY}
          r={3.5}
          fill={isTrends ? 'var(--accent)' : 'var(--bg)'}
          stroke="var(--accent)"
          strokeWidth={1.6}
        />
      </svg>
    </div>
  )
}
