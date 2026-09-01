import { describe, expect, it } from 'vitest'
import {
  buildCycleSpans,
  buildCycles,
  cycleDayToday,
  dailyRollingAverage,
  medianCycleLength,
  phaseDeltas,
  phaseForDay,
  phaseRanges,
  regularity,
  type CycleLogEntry,
} from '../src/lib/cycle'
import { addDays } from '../src/lib/dates'
import type { Entry } from '../src/lib/math'

// A run of regular ~29-day cycles ending mid-luteal, with "today" frozen for determinism.
const TODAY = '2026-08-28'
function startsBack(lengths: number[], lastStart: string): CycleLogEntry[] {
  const out: CycleLogEntry[] = [{ start: lastStart }]
  let s = lastStart
  for (const L of lengths) {
    s = addDays(s, -L)
    out.unshift({ start: s })
  }
  return out
}
const LOG = startsBack([29, 28, 30, 27, 31, 29], '2026-08-11') // last start 17 days before TODAY

describe('medianCycleLength', () => {
  it('defaults to 28 with fewer than two starts', () => {
    expect(medianCycleLength([])).toBe(28)
    expect(medianCycleLength([{ start: '2026-08-01' }])).toBe(28)
  })

  it('is the median of recent gaps', () => {
    expect(medianCycleLength(LOG)).toBe(29)
  })

  it('rejects outliers by using the median, not the mean', () => {
    const log = startsBack([28, 29, 28, 90], '2026-08-01') // one 90-day gap
    expect(medianCycleLength(log)).toBeLessThanOrEqual(31)
  })

  it('clamps to [21, 40]', () => {
    expect(medianCycleLength(startsBack([12, 14, 13], '2026-08-01'))).toBe(21)
    expect(medianCycleLength(startsBack([60, 55, 58], '2026-08-01'))).toBe(40)
  })
})

describe('phaseRanges', () => {
  for (const L of [21, 26, 28, 31, 40]) {
    it(`covers every day exactly once, in order, for L=${L}`, () => {
      const ranges = phaseRanges(L)
      expect(ranges.map((r) => r.name)).toEqual(['Menstrual', 'Follicular', 'Ovulation', 'Luteal'])
      expect(ranges[0].from).toBe(0)
      expect(ranges[ranges.length - 1].to).toBe(L - 1)
      for (let i = 1; i < ranges.length; i++) {
        expect(ranges[i].from).toBe(ranges[i - 1].to + 1) // contiguous, no gaps or overlap
        expect(ranges[i].to).toBeGreaterThanOrEqual(ranges[i].from) // non-empty
      }
    })
  }

  it('keeps every phase non-empty even for an implausibly short cycle', () => {
    const ranges = phaseRanges(15)
    for (const r of ranges) expect(r.to).toBeGreaterThanOrEqual(r.from)
    expect(ranges[ranges.length - 1].to).toBe(14)
  })

  it('honours a logged period end for the menstrual length', () => {
    const [menstrual] = phaseRanges(29, 6)
    expect(menstrual).toEqual({ name: 'Menstrual', from: 0, to: 6 })
  })

  it('puts ovulation roughly 14 days before the next period', () => {
    const ov = phaseRanges(28).find((r) => r.name === 'Ovulation')!
    expect(ov.from).toBe(13)
    expect(ov.to).toBe(15)
  })
})

describe('phaseForDay', () => {
  it('maps day indices to the containing phase', () => {
    expect(phaseForDay(0, 28)).toBe('Menstrual')
    expect(phaseForDay(4, 28)).toBe('Menstrual')
    expect(phaseForDay(8, 28)).toBe('Follicular')
    expect(phaseForDay(14, 28)).toBe('Ovulation')
    expect(phaseForDay(24, 28)).toBe('Luteal')
  })

  it('clamps out-of-range days into the last phase', () => {
    expect(phaseForDay(99, 28)).toBe('Luteal')
  })
})

describe('buildCycles', () => {
  it('uses real gaps between logged starts and the median for the trailing cycle', () => {
    const cycles = buildCycles(LOG, '2026-06-01', TODAY, 29)
    const logged = cycles.filter((c) => !c.projected)
    expect(logged.length).toBe(LOG.length - 1) // every start except the last has a real gap
    expect(logged.every((c) => c.len >= 27 && c.len <= 31)).toBe(true)
  })

  it('tiles synthetic cycles when nothing is logged', () => {
    const cycles = buildCycles([], '2026-01-01', '2026-03-01', 28)
    expect(cycles.length).toBeGreaterThan(1)
    expect(cycles.every((c) => c.projected && c.len === 28)).toBe(true)
  })
})

describe('buildCycleSpans', () => {
  const spans = buildCycleSpans(LOG, '2026-06-01', '2026-12-01', TODAY, 29)

  it('stays within the requested window', () => {
    expect(spans.every((s) => s.start >= '2026-06-01')).toBe(true)
  })

  it('stops the forward prediction exactly 14 days past today', () => {
    const cap = addDays(TODAY, 14)
    expect(spans.every((s) => s.end <= cap)).toBe(true)
    expect(spans.some((s) => s.end === cap)).toBe(true)
  })

  it('marks only post-today spans as predicted', () => {
    for (const s of spans) expect(s.predicted).toBe(s.start > TODAY)
  })

  it('produces contiguous, non-overlapping spans', () => {
    for (let i = 1; i < spans.length; i++) {
      expect(spans[i].start >= spans[i - 1].start).toBe(true)
      expect(spans[i].start).toBe(addDays(spans[i - 1].end, 1))
    }
  })
})

describe('cycleDayToday', () => {
  it('returns null before anything is logged', () => {
    expect(cycleDayToday([], TODAY)).toBeNull()
  })

  it('reports the current day, phase, and countdown', () => {
    const c = cycleDayToday(LOG, TODAY, 29)!
    expect(c.day).toBe(18) // 17 days after the last start, 1-indexed
    expect(c.of).toBe(29)
    expect(c.phase).toBe('Luteal')
    expect(c.nextStart).toBe('2026-09-09')
    expect(c.daysToNext).toBe(12)
  })
})

describe('regularity', () => {
  it('needs at least three starts', () => {
    expect(regularity([{ start: '2026-08-01' }, { start: '2026-08-29' }]).label).toBe('not enough data')
  })

  it('labels a tight spread regular', () => {
    const r = regularity(startsBack([28, 29, 28, 29, 28], '2026-08-01'))
    expect(r.label).toBe('regular')
    expect(r.stdev).toBeLessThanOrEqual(2)
  })

  it('labels a wide spread irregular', () => {
    const r = regularity(startsBack([22, 35, 24, 40, 21], '2026-08-01'))
    expect(r.label).toBe('irregular')
  })
})

describe('dailyRollingAverage', () => {
  it('bridges short gaps and produces one point per covered day', () => {
    const entries: Entry[] = [
      { date: '2026-08-01', lbs: 150 },
      { date: '2026-08-03', lbs: 151 },
      { date: '2026-08-05', lbs: 149 },
    ]
    const daily = dailyRollingAverage(entries, '2026-08-01', '2026-08-07')
    expect(daily[0]).toEqual({ date: '2026-08-01', value: 150 })
    expect(daily.map((p) => p.date)).toContain('2026-08-07') // still within 7 days of 08-05
    expect(daily.every((p) => p.value > 148 && p.value < 152)).toBe(true)
  })
})

describe('phaseDeltas — per-cycle de-trending', () => {
  it('returns ~0 for a pure linear cut with no cycle effect', () => {
    // 180 days of steady -0.05 lb/day, one weigh-in per day, no water-weight signal.
    const entries: Entry[] = []
    for (let i = 0; i < 200; i++) entries.push({ date: addDays('2026-02-01', i), lbs: 170 - i * 0.05 })
    const log = startsBack([28, 28, 28, 28, 28, 28], '2026-08-11')
    const cycles = buildCycles(log, '2026-02-01', TODAY, 28)
    const deltas = phaseDeltas(entries, cycles)
    for (const v of Object.values(deltas)) expect(Math.abs(v)).toBeLessThan(0.05)
  })

  it('surfaces a genuine luteal bump on top of a trend', () => {
    const log = startsBack([28, 28, 28, 28, 28, 28], '2026-08-11')
    const cycles = buildCycles(log, '2026-02-01', TODAY, 28)
    const entries: Entry[] = []
    for (let i = 0; i < 200; i++) {
      const date = addDays('2026-02-01', i)
      // find which cycle/day this is by walking the logged cycles
      let bump = 0
      for (const c of cycles) {
        const day = Math.round(
          (new Date(date + 'T00:00:00Z').getTime() - new Date(c.start + 'T00:00:00Z').getTime()) / 86400000,
        )
        if (day >= 0 && day < c.len) {
          bump = phaseForDay(day, c.len) === 'Luteal' ? 1.5 : 0
          break
        }
      }
      entries.push({ date, lbs: 170 - i * 0.05 + bump })
    }
    const deltas = phaseDeltas(entries, cycles)
    // The 7-day *trailing* average lags, so a raw luteal step also lifts the next cycle's
    // early-menstrual reading — but luteal itself must still come through clearly positive,
    // well above the flat follicular baseline.
    expect(deltas.Luteal).toBeGreaterThan(0.1)
    expect(deltas.Luteal - deltas.Follicular).toBeGreaterThan(0.1)
  })
})
