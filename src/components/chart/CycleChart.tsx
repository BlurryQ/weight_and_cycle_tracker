import { useId, useMemo } from 'react'
import { addDays, diffDays, parseDate } from '../../lib/dates'
import { dailyRollingAverage, type CyclePhase, type CycleSpan } from '../../lib/cycle'
import { leastSquaresFit, type Entry } from '../../lib/math'

const W = 330
const H = 176
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

const PHASE_VAR: Record<CyclePhase, string> = {
  Menstrual: '--menstrual',
  Follicular: '--follicular',
  Ovulation: '--ovulation',
  Luteal: '--luteal',
}
// Solid-phase-token opacities for the shaded bands: confirmed bands vs. predicted (future) bands.
const BAND_ALPHA: Record<CyclePhase, number> = { Menstrual: 17, Follicular: 11, Ovulation: 20, Luteal: 17 }
const PRED_ALPHA: Record<CyclePhase, number> = { Menstrual: 7, Follicular: 4.5, Ovulation: 8, Luteal: 7 }

function bandFill(name: CyclePhase, predicted: boolean): string {
  const pct = predicted ? PRED_ALPHA[name] : BAND_ALPHA[name]
  return `color-mix(in oklch, var(${PHASE_VAR[name]}) ${pct}%, transparent)`
}

interface CycleChartProps {
  entries: Entry[]
  spans: CycleSpan[]
  /** Logged period-start dates within the window. */
  starts: string[]
  /** Predicted next period start (drawn as a dashed rule). */
  nextStart: string
  from: string
  to: string // already capped to today + 14 by the caller
  today: string
  fmt: (lbs: number) => number
}

/** Daily 7-day-rolling weight over one pan of the cycle, shaded by menstrual-cycle phase.
 * Structurally parallel to WeightChart but its own component — the band model and the daily
 * (not weekly) resolution are different enough that sharing would only tangle both. */
export function CycleChart({ entries, spans, starts, nextStart, from, to, today, fmt }: CycleChartProps) {
  const gradId = useId()

  const geo = useMemo(() => {
    const totalDays = Math.max(1, diffDays(from, to))
    const x = (date: string) => (diffDays(from, date) / totalDays) * W

    const daily = dailyRollingAverage(entries, from, to).map((p) => ({ ...p, value: fmt(p.value) }))
    const past = daily.filter((p) => p.date <= today)

    if (past.length < 2) {
      return { empty: true as const, bands: [] as { x: number; w: number; fill: string }[] }
    }

    const values = daily.map((p) => p.value)
    const lo = Math.min(...values) - 0.9
    const hi = Math.max(...values) + 0.9
    const y = (v: number) => H - ((v - lo) / (hi - lo || 1)) * H

    const bands = spans.map((s) => {
      const bx = x(s.start)
      const bw = Math.max(1, x(addDays(s.end, 1)) - bx)
      return { x: bx, w: bw, fill: bandFill(s.name, s.predicted) }
    })

    const grid: { y: number; label: string }[] = []
    for (let k = 0; k <= 4; k++) {
      const v = lo + ((hi - lo) * k) / 4
      grid.push({ y: y(v), label: v.toFixed(0) })
    }

    const toPath = (pts: { date: string; value: number }[]) =>
      pts.map((p, i) => `${i ? 'L' : 'M'}${x(p.date).toFixed(1)} ${y(p.value).toFixed(1)}`).join(' ')

    const line = toPath(past)
    const area = `${line} L${x(past[past.length - 1].date).toFixed(1)} ${H} L${x(past[0].date).toFixed(1)} ${H} Z`

    // Projection: slope of the last 28 days extended forward 14 days.
    const tail = past.filter((p) => diffDays(p.date, today) <= 28)
    const fit = leastSquaresFit(tail.map((p) => ({ x: diffDays(from, p.date), y: p.value })))
    const last = past[past.length - 1]
    const projEndDate = to // caller caps this at today + 14
    const projPts = [
      { d: last.date, v: last.value },
      { d: projEndDate, v: fit.intercept + fit.slope * diffDays(from, projEndDate) },
    ]
    const proj = projPts.map((p, i) => `${i ? 'L' : 'M'}${x(p.d).toFixed(1)} ${y(p.v).toFixed(1)}`).join(' ')

    const startRules = starts.filter((s) => s >= from && s <= to).map((s) => ({ x: x(s) }))
    const nextRule = nextStart >= from && nextStart <= to ? { x: x(nextStart) } : null

    const ticks: { x: number; label: string }[] = []
    for (let d = from; d <= to; d = addDays(d, 1)) {
      if (parseDate(d).getUTCDate() === 1) ticks.push({ x: x(d), label: MONTHS[parseDate(d).getUTCMonth()] })
    }

    return {
      empty: false as const,
      bands,
      grid,
      line,
      area,
      proj,
      startRules,
      nextRule,
      ticks,
      todayX: x(today),
      todayY: y(last.value),
    }
  }, [entries, spans, starts, nextStart, from, to, today, fmt])

  if (geo.empty) {
    return (
      <div
        style={{
          height: H,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          font: '500 11px "IBM Plex Mono", monospace',
          color: 'var(--text-dim)',
        }}
      >
        Not enough weigh-ins in this range yet.
      </div>
    )
  }

  return (
    <svg
      width="100%"
      height={212}
      viewBox="-30 -20 366 232"
      preserveAspectRatio="xMidYMid meet"
      style={{ display: 'block' }}
    >
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--cyan)" stopOpacity={0.18} />
          <stop offset="100%" stopColor="var(--cyan)" stopOpacity={0} />
        </linearGradient>
      </defs>

      {geo.bands.map((b, i) => (
        <rect key={i} x={b.x} y={0} width={b.w} height={H} fill={b.fill} />
      ))}

      {geo.grid.map((g, i) => (
        <g key={i}>
          <line x1={0} x2={W} y1={g.y} y2={g.y} stroke="var(--hairline-strong)" strokeWidth={1} />
          <text x={-8} y={g.y + 3} textAnchor="end" style={{ font: '500 9px "IBM Plex Mono", monospace', fill: 'var(--text-dim)' }}>
            {g.label}
          </text>
        </g>
      ))}

      {geo.startRules.map((r, i) => (
        <line key={i} x1={r.x} x2={r.x} y1={0} y2={H} stroke="color-mix(in oklch, var(--menstrual) 55%, transparent)" strokeWidth={1} />
      ))}
      {geo.nextRule && (
        <line
          x1={geo.nextRule.x}
          x2={geo.nextRule.x}
          y1={0}
          y2={H}
          stroke="color-mix(in oklch, var(--menstrual) 40%, transparent)"
          strokeWidth={1}
          strokeDasharray="3 3"
        />
      )}

      <path d={geo.area} fill={`url(#${gradId})`} stroke="none" />
      <path d={geo.line} fill="none" stroke="var(--cyan)" strokeWidth={2.1} strokeLinejoin="round" strokeLinecap="round" />
      <path d={geo.proj} fill="none" stroke="var(--cyan)" strokeWidth={1.8} strokeDasharray="2 5" strokeLinecap="round" opacity={0.5} />

      <line x1={geo.todayX} x2={geo.todayX} y1={-4} y2={H} stroke="var(--text-primary)" strokeWidth={1} opacity={0.5} />
      <circle cx={geo.todayX} cy={geo.todayY} r={4.5} fill="var(--cyan)" stroke="var(--bg)" strokeWidth={1.5} />
      <text x={geo.todayX} y={-12} textAnchor="middle" style={{ font: '600 8.5px "Barlow Condensed", sans-serif', letterSpacing: '0.16em', fill: 'var(--text-muted)' }}>
        TODAY
      </text>

      {geo.ticks.map((t, i) => (
        <text key={i} x={t.x} y={192} textAnchor="middle" style={{ font: '500 9px "IBM Plex Mono", monospace', fill: 'var(--text-dim)' }}>
          {t.label}
        </text>
      ))}
    </svg>
  )
}
