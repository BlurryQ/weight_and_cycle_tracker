import { addDays, diffDays, parseDate } from './dates'
import { leastSquaresFit, type Entry } from './math'

// ── Types ──────────────────────────────────────────────────────────────

export interface CycleLogEntry {
  start: string // ISO yyyy-mm-dd — first day of a period
  end?: string // optional; only refines menstrual-phase length
}

export type CyclePhase = 'Menstrual' | 'Follicular' | 'Ovulation' | 'Luteal'

export const CYCLE_PHASES: CyclePhase[] = ['Menstrual', 'Follicular', 'Ovulation', 'Luteal']

export interface CycleSpan {
  name: CyclePhase
  start: string // inclusive ISO date
  end: string // inclusive ISO date
  predicted: boolean // true when the span begins after today (drawn faded)
}

/** One cycle: a start date, its length in days (gap to the next logged start, or the median
 * for the current / projected cycle), and an optional logged end date for the period itself. */
export interface Cycle {
  start: string
  len: number
  end?: string
  projected: boolean // true for cycles synthesised past the last logged start
}

const DEFAULT_LEN = 28
const MIN_LEN = 21
const MAX_LEN = 40
const FORWARD_DAYS = 14 // how far past today the prediction is drawn

// ── Median cycle length ────────────────────────────────────────────────

function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

/** Median of the last six start-to-start gaps, clamped to [21, 40]. Defaults to 28 when there
 * are fewer than two starts to measure. */
export function medianCycleLength(log: CycleLogEntry[]): number {
  const starts = sortedStarts(log)
  if (starts.length < 2) return DEFAULT_LEN
  const gaps: number[] = []
  for (let i = 1; i < starts.length; i++) gaps.push(diffDays(starts[i - 1], starts[i]))
  const recent = gaps.slice(-6)
  return Math.round(Math.min(MAX_LEN, Math.max(MIN_LEN, median(recent))))
}

function sortedStarts(log: CycleLogEntry[]): string[] {
  return log.map((l) => l.start).sort()
}

// ── Phase boundaries within a cycle ────────────────────────────────────

interface DayRange {
  name: CyclePhase
  from: number // inclusive day index, 0 = start day
  to: number // inclusive day index
}

/** Day-indexed phase ranges for a cycle of length `len`. Canonical shape (matching the brief):
 *
 *   Menstrual  0 … 4            (or 0 … endOffset when a period end is logged)
 *   Follicular 5 … len-16
 *   Ovulation  len-15 … len-13  (≈ 14 days before the next period)
 *   Luteal     len-12 … len-1
 *
 * For short cycles the canonical follicular range can invert; we then fall back to a
 * proportional split that still gives every phase at least one day, ordered
 * menstrual → follicular → ovulation → luteal. */
export function phaseRanges(len: number, endOffset?: number): DayRange[] {
  const L = Math.max(4, Math.round(len))
  const mEnd = clamp(endOffset ?? 4, 0, L - 4)

  const canonicalFollicularStart = mEnd + 1
  const ovStart = L - 15
  const ovEnd = L - 13
  const lutStart = L - 12

  if (ovStart - 1 >= canonicalFollicularStart && ovStart >= 1 && lutStart <= L - 1 && ovEnd >= ovStart) {
    return [
      { name: 'Menstrual', from: 0, to: mEnd },
      { name: 'Follicular', from: canonicalFollicularStart, to: ovStart - 1 },
      { name: 'Ovulation', from: ovStart, to: ovEnd },
      { name: 'Luteal', from: lutStart, to: L - 1 },
    ]
  }

  // Short / irregular cycle — distribute L days as 18% / 32% / 11% / 39% with a ≥1 floor.
  let m = Math.max(1, Math.min(mEnd + 1, Math.round(L * 0.18)))
  let o = Math.max(1, Math.round(L * 0.11))
  let f = Math.max(1, Math.round(L * 0.32))
  let lut = L - m - f - o
  while (lut < 1) {
    if (f > 1) f--
    else if (m > 1) m--
    else o--
    lut = L - m - f - o
  }
  const mTo = m - 1
  const fTo = mTo + f
  const oTo = fTo + o
  return [
    { name: 'Menstrual', from: 0, to: mTo },
    { name: 'Follicular', from: mTo + 1, to: fTo },
    { name: 'Ovulation', from: fTo + 1, to: oTo },
    { name: 'Luteal', from: oTo + 1, to: L - 1 },
  ]
}

/** Which phase a given 0-indexed day of a cycle falls in. */
export function phaseForDay(day: number, len: number, endOffset?: number): CyclePhase {
  const d = clamp(day, 0, Math.max(0, Math.round(len) - 1))
  for (const r of phaseRanges(len, endOffset)) if (d >= r.from && d <= r.to) return r.name
  return 'Luteal'
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v))
}

// ── Building the ordered list of cycles across a date range ────────────

/** Walks the logged starts, back-fills earlier cycles to cover `from`, and projects forward
 * past the last logged start using `medianLen`. Lengths between two logged starts are the real
 * gap; everything else is `medianLen`. */
export function buildCycles(log: CycleLogEntry[], from: string, to: string, medianLen: number): Cycle[] {
  const starts = sortedStarts(log)
  const endByStart = new Map(log.map((l) => [l.start, l.end]))
  const cycles: Cycle[] = []

  if (starts.length === 0) {
    let s = from
    while (s <= to) {
      cycles.push({ start: s, len: medianLen, projected: true })
      s = addDays(s, medianLen)
    }
    return cycles
  }

  // Back-fill cycles before the first logged start so bands reach the left edge.
  const pre: Cycle[] = []
  let anchor = starts[0]
  while (anchor > from) {
    anchor = addDays(anchor, -medianLen)
    pre.push({ start: anchor, len: medianLen, projected: true })
  }
  pre.reverse()
  for (let i = 0; i < pre.length; i++) {
    const nextStart = i + 1 < pre.length ? pre[i + 1].start : starts[0]
    pre[i].len = diffDays(pre[i].start, nextStart)
  }
  cycles.push(...pre)

  // Logged cycles.
  for (let i = 0; i < starts.length; i++) {
    const s = starts[i]
    const len = i + 1 < starts.length ? diffDays(s, starts[i + 1]) : medianLen
    cycles.push({ start: s, len, end: endByStart.get(s) ?? undefined, projected: i + 1 >= starts.length })
  }

  // Project forward past the last logged start.
  let s = addDays(starts[starts.length - 1], medianLen)
  while (s <= to) {
    cycles.push({ start: s, len: medianLen, projected: true })
    s = addDays(s, medianLen)
  }

  return cycles
}

// ── Phase spans (what the chart shades) ───────────────────────────────

/** Phase-coloured spans between `from` and `to`, clipped so the forward prediction never runs
 * more than 14 days past `today`. A span is `predicted` when it begins after today. */
export function buildCycleSpans(
  log: CycleLogEntry[],
  from: string,
  to: string,
  today: string,
  medianLen = medianCycleLength(log),
): CycleSpan[] {
  const cap = minDate(to, addDays(today, FORWARD_DAYS))
  const cycles = buildCycles(log, from, cap, medianLen)
  const spans: CycleSpan[] = []

  for (const c of cycles) {
    const endOffset = c.end ? diffDays(c.start, c.end) : undefined
    for (const r of phaseRanges(c.len, endOffset)) {
      const spanStart = addDays(c.start, r.from)
      const spanEnd = addDays(c.start, r.to)
      if (spanEnd < from || spanStart > cap) continue
      spans.push({
        name: r.name,
        start: maxDate(spanStart, from),
        end: minDate(spanEnd, cap),
        predicted: spanStart > today,
      })
    }
  }

  return spans.sort((a, b) => (a.start < b.start ? -1 : 1))
}

function minDate(a: string, b: string): string {
  return a < b ? a : b
}
function maxDate(a: string, b: string): string {
  return a > b ? a : b
}

// ── Where she is right now ────────────────────────────────────────────

export interface CycleToday {
  day: number // 1-indexed cycle day
  of: number // current cycle length estimate
  phase: CyclePhase
  nextStart: string
  daysToNext: number
}

/** Current cycle day / phase / countdown, derived from the most recent logged start and the
 * median length. Returns null when nothing has been logged yet. */
export function cycleDayToday(log: CycleLogEntry[], today: string, medianLen = medianCycleLength(log)): CycleToday | null {
  const starts = sortedStarts(log).filter((s) => s <= today)
  if (starts.length === 0) return null
  const cur = starts[starts.length - 1]
  const endOffset = log.find((l) => l.start === cur)?.end
    ? diffDays(cur, log.find((l) => l.start === cur)!.end!)
    : undefined
  const dayIndex = diffDays(cur, today)
  const nextStart = addDays(cur, medianLen)
  return {
    day: dayIndex + 1,
    of: medianLen,
    phase: phaseForDay(dayIndex, medianLen, endOffset),
    nextStart,
    daysToNext: diffDays(today, nextStart),
  }
}

// ── Regularity ───────────────────────────────────────────────────────

export interface Regularity {
  mean: number
  min: number
  max: number
  stdev: number
  label: 'regular' | 'irregular' | 'not enough data'
}

export function regularity(log: CycleLogEntry[]): Regularity {
  const starts = sortedStarts(log)
  if (starts.length < 3) return { mean: 0, min: 0, max: 0, stdev: 0, label: 'not enough data' }
  const gaps: number[] = []
  for (let i = 1; i < starts.length; i++) gaps.push(diffDays(starts[i - 1], starts[i]))
  const recent = gaps.slice(-6)
  const mean = recent.reduce((a, b) => a + b, 0) / recent.length
  const variance = recent.reduce((a, b) => a + (b - mean) ** 2, 0) / recent.length
  const stdev = Math.sqrt(variance)
  return {
    mean,
    min: Math.min(...recent),
    max: Math.max(...recent),
    stdev,
    label: stdev <= 2 ? 'regular' : 'irregular',
  }
}

// ── Daily 7-day rolling average (finer than weeklyAverages) ───────────

export interface DailyPoint {
  date: string
  value: number
}

/** One point per calendar day in [from, to] that has at least one weigh-in inside its trailing
 * 7-day window; the value is the mean of those weigh-ins. Days with no data in-window are
 * omitted so the line can bridge small gaps but break across long ones. */
export function dailyRollingAverage(entries: Entry[], from: string, to: string): DailyPoint[] {
  if (!entries.length) return []
  const byDate = new Map(entries.map((e) => [e.date, e.lbs]))
  const out: DailyPoint[] = []
  for (let d = from; d <= to; d = addDays(d, 1)) {
    const win: number[] = []
    for (let k = 0; k < 7; k++) {
      const v = byDate.get(addDays(d, -k))
      if (v != null) win.push(v)
    }
    if (win.length) out.push({ date: d, value: win.reduce((a, b) => a + b, 0) / win.length })
  }
  return out
}

// ── Weight × phase deviation ─────────────────────────────────────────

/** Average within-cycle weight deviation per phase, over the last six completed cycles.
 *
 * Each completed cycle is linearly de-trended by its own least-squares fit (so a steady cut
 * contributes nothing), then the residual on each day is bucketed by phase and averaged.
 * The result is a water-weight signature like `{ Luteal: +1.4, Menstrual: -0.9, … }`. */
export function phaseDeltas(entries: Entry[], cycles: Cycle[]): Record<CyclePhase, number> {
  const completed = cycles.filter((c) => !c.projected).slice(-6)
  const sums: Record<CyclePhase, number> = { Menstrual: 0, Follicular: 0, Ovulation: 0, Luteal: 0 }
  const counts: Record<CyclePhase, number> = { Menstrual: 0, Follicular: 0, Ovulation: 0, Luteal: 0 }

  for (const c of completed) {
    const end = addDays(c.start, c.len - 1)
    const daily = dailyRollingAverage(entries, c.start, end)
    if (daily.length < Math.max(4, Math.round(c.len * 0.5))) continue // too sparse to trust

    const fit = leastSquaresFit(daily.map((p) => ({ x: dayIndexOf(c.start, p.date), y: p.value })))
    const endOffset = c.end ? diffDays(c.start, c.end) : undefined
    for (const p of daily) {
      const day = dayIndexOf(c.start, p.date)
      const residual = p.value - (fit.intercept + fit.slope * day)
      const phase = phaseForDay(day, c.len, endOffset)
      sums[phase] += residual
      counts[phase] += 1
    }
  }

  const out: Record<CyclePhase, number> = { Menstrual: 0, Follicular: 0, Ovulation: 0, Luteal: 0 }
  for (const phase of CYCLE_PHASES) out[phase] = counts[phase] ? sums[phase] / counts[phase] : 0
  return out
}

function dayIndexOf(start: string, date: string): number {
  return Math.round((parseDate(date).getTime() - parseDate(start).getTime()) / 86400000)
}
