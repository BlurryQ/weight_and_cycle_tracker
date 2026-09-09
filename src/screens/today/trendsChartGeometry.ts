import { addDays, mondayOf } from '../../lib/dates'
import { toDisplay, toLbs } from '../../lib/format'
import { buildChartGeometry, type ChartGeometry } from '../../lib/chartGeometry'
import {
  currentDir,
  foldedWeeks,
  phaseAnchoredShowN,
  phaseSpans,
  projectionWeeks,
  solveByDate,
  solveByWeight,
  weeklyAverages,
  type Direction,
  type ReachByDateResult,
  type ReachByWeightResult,
  type WeeklyAverage,
} from '../../lib/math'
import type { AppState } from '../../store/types'

export interface TrendsChartDims {
  W: number
  H: number
  gutter: number
  gridN: number
}

export interface TrendsChart {
  geometry: ChartGeometry
  weekly: WeeklyAverage[]
  /** Trailing weekly count actually shown — raw, not the completionRatio "all" sentinel. */
  showN: number
  dir: Direction
  /** Last weekly average in lbs, or 0 when there is no completed week yet. */
  current: number
  /** Monday of the last weekly average, or this week's Monday as a fallback. */
  lastMonday: string
  weightResult: ReachByWeightResult
  dateResult: ReachByDateResult
  /** Weeks the projection runs forward — from the Reach solver, per solveMode. */
  solveWeeks: number
  /** First visible weekly Monday — pass to periodDaysInRange for the chart's period ticks. */
  from: string
  /** Last visible day (last visible weekly Monday + 6) — the other end of the period-tick range. */
  to: string
}

/** The single source of truth for the weekly-average trend chart shown on BOTH Today (a
 * display-only mirror) and Trends. Replicates upstream Trends' two-pass build: a throwaway
 * `fwd: 0` pass yields the window's own fit slope, that slope feeds the Reach solver, and the
 * solver's weeks-out drive the real geometry's forward projection — so the chart's projection
 * and the Reach card can never disagree. Everything here reads from `state`; the window /
 * anchor controls stay in the screens. */
export function buildTrendsChart(state: AppState, today: string, dims: TrendsChartDims): TrendsChart {
  const {
    entries,
    phase,
    phaseLog,
    unit,
    weeklyTarget,
    trendWindow,
    trendWindowMode,
    solveMode,
    targetLbs,
    targetWeeks,
  } = state

  const weekly = weeklyAverages(entries)
  const dir = currentDir(phase, phaseLog)
  const spans = phaseSpans(phaseLog)

  // The chart's window: either the fixed chip count, or a span anchored to a phase-log event
  // (see phaseAnchoredShowN). fitK follows the same halving rule either way, capped at 13 under
  // phase-anchor mode so the fit line stays recent rather than spanning a whole cut/bulk.
  const showN =
    trendWindowMode === 'weeks' ? trendWindow : phaseAnchoredShowN(weekly, phaseLog, trendWindowMode)
  const fitK =
    trendWindowMode === 'weeks'
      ? trendWindow === 99
        ? weekly.length
        : Math.max(4, Math.round(trendWindow / 2))
      : Math.min(13, Math.max(4, Math.round(showN / 2)))

  const marker = foldedWeeks(phaseLog)
  const convert = (lbs: number) => toDisplay(lbs, unit)
  const cfg = (fwd: number) => ({
    W: dims.W,
    H: dims.H,
    gutter: dims.gutter,
    showN,
    fitK,
    fwd,
    gridN: dims.gridN,
  })

  // Pass 1 — just the window's fit slope, so the Reach solver has something to solve against.
  // `fwd` doesn't affect the fit, so this pass is cheap and its projection is thrown away.
  const slopeGeometry = buildChartGeometry(weekly, spans, cfg(0), convert, marker, weeklyTarget)

  const lastWeekly = weekly[weekly.length - 1]
  const current = lastWeekly ? lastWeekly.lbs : 0
  const lastMonday = lastWeekly ? lastWeekly.monday : mondayOf(today)
  const reachCtx = { current, slopeLbs: toLbs(slopeGeometry.slope, unit), lastMonday }
  const weightResult = solveByWeight(reachCtx, targetLbs)
  const dateResult = solveByDate(reachCtx, targetWeeks)
  const solveWeeks = projectionWeeks(solveMode, targetWeeks, weightResult)

  // Pass 2 — the real geometry, projected forward by the solver's weeks-out.
  const geometry = buildChartGeometry(weekly, spans, cfg(solveWeeks), convert, marker, weeklyTarget)

  const shown = weekly.slice(-showN)
  const from = shown.length ? shown[0].monday : mondayOf(today)
  const to = shown.length ? addDays(shown[shown.length - 1].monday, 6) : today

  return {
    geometry,
    weekly,
    showN,
    dir,
    current,
    lastMonday,
    weightResult,
    dateResult,
    solveWeeks,
    from,
    to,
  }
}
