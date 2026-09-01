import { addDays, fullDate, today as todayIso } from '../lib/dates'
import { sgn, toDisplay, unitLabel } from '../lib/format'
import { leastSquaresFit, type Entry } from '../lib/math'
import {
  buildCycles,
  buildCycleSpans,
  CYCLE_PHASES,
  cycleDayToday,
  dailyRollingAverage,
  medianCycleLength,
  phaseDeltas,
  regularity,
  type CyclePhase,
} from '../lib/cycle'
import { useApp } from '../store/AppContext'
import type { CycleWindow } from '../store/types'
import { SegmentedControl } from '../components/ui/SegmentedControl'
import { CycleChart } from '../components/chart/CycleChart'

const PHASE_VAR: Record<CyclePhase, string> = {
  Menstrual: '--menstrual',
  Follicular: '--follicular',
  Ovulation: '--ovulation',
  Luteal: '--luteal',
}

const WINDOW_OPTIONS: { value: CycleWindow; label: string }[] = [
  { value: 8, label: '8W' },
  { value: 13, label: '3M' },
  { value: 26, label: '6M' },
]

function sectionLabel(text: string) {
  return (
    <span
      style={{
        font: '600 9.5px/1 "Barlow Condensed", sans-serif',
        letterSpacing: '0.2em',
        textTransform: 'uppercase',
        color: 'var(--text-dim)',
      }}
    >
      {text}
    </span>
  )
}

function StatCard({ label, value, note, accent }: { label: string; value: string; note: string; accent?: string }) {
  return (
    <div style={{ flex: 1, padding: '12px 12px 13px', borderRadius: 14, background: 'var(--surface)' }}>
      <div
        style={{
          font: '600 9px/1 "Barlow Condensed", sans-serif',
          letterSpacing: '0.16em',
          textTransform: 'uppercase',
          color: 'var(--text-dim)',
        }}
      >
        {label}
      </div>
      <div style={{ marginTop: 7, font: '700 25px/1 "Barlow Condensed", sans-serif', color: accent ?? 'var(--text-secondary)' }}>
        {value}
      </div>
      <div style={{ marginTop: 3, font: '500 9px "IBM Plex Mono", monospace', color: 'var(--text-dim)' }}>{note}</div>
    </div>
  )
}

/** Recent within-trend deviation: today's 7-day rolling average minus the last-28-day linear fit
 * evaluated at today. Positive = currently above your own trend line. */
function currentDeviationLbs(entries: Entry[], today: string): number | null {
  const daily = dailyRollingAverage(entries, addDays(today, -34), today)
  if (daily.length < 5) return null
  const base = daily[0].date
  const idx = (d: string) => Math.round((Date.parse(d) - Date.parse(base)) / 86400000)
  const fit = leastSquaresFit(daily.map((p) => ({ x: idx(p.date), y: p.value })))
  const last = daily[daily.length - 1]
  return last.value - (fit.intercept + fit.slope * idx(last.date))
}

export function Cycle() {
  const { state, dispatch } = useApp()
  const { entries, cycleLog, unit, cycleWindow } = state
  const today = todayIso()
  const U = unitLabel(unit)

  const medianLen = medianCycleLength(cycleLog)
  const ct = cycleDayToday(cycleLog, today, medianLen)

  if (!ct) {
    return (
      <div style={{ padding: '20px 20px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, marginTop: 120 }}>
        <div style={{ font: '500 12px "IBM Plex Mono", monospace', color: 'var(--text-dim)', textAlign: 'center', maxWidth: 260 }}>
          No periods logged yet. Tap the button below to log your last period start — everything else is worked out from
          that.
        </div>
        <button
          type="button"
          onClick={() => dispatch({ type: 'OPEN_SHEET', sheet: 'period' })}
          style={{
            padding: '13px 20px',
            borderRadius: 999,
            background: 'var(--menstrual)',
            color: 'var(--ink-on-accent)',
            font: '700 13px/1 "Barlow Condensed", sans-serif',
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            cursor: 'pointer',
          }}
        >
          Log a period
        </button>
      </div>
    )
  }

  const from = addDays(today, -(cycleWindow * 7))
  const to = addDays(today, 14)
  const spans = buildCycleSpans(cycleLog, from, to, today, medianLen)
  const firstStart = cycleLog.map((c) => c.start).sort()[0] ?? from
  const cycles = buildCycles(cycleLog, firstStart, today, medianLen)
  const deltas = phaseDeltas(entries, cycles)
  const reg = regularity(cycleLog)
  const haveDeltas = Object.values(deltas).some((v) => Math.abs(v) > 0.01)

  const currentDev = currentDeviationLbs(entries, today)
  const phaseVar = PHASE_VAR[ct.phase]

  let interpretation: string
  if (currentDev == null || !haveDeltas) {
    interpretation =
      'Log another period or two and keep weighing in — this will start showing how your weight typically moves through each phase.'
  } else {
    const devDisp = toDisplay(currentDev, unit)
    const typDisp = toDisplay(deltas[ct.phase], unit)
    const water =
      Math.sign(typDisp) === Math.sign(devDisp) && Math.abs(typDisp) >= 0.3 && devDisp > 0 ? ' — likely water, not gain' : ''
    interpretation = `You sit ${sgn(devDisp)} ${U} ${devDisp >= 0 ? 'over' : 'under'} your recent trend. ${ct.phase} usually runs ${sgn(typDisp)} ${U} for you${water}.`
  }

  const maxDelta = Math.max(0.1, ...CYCLE_PHASES.map((p) => Math.abs(deltas[p])))

  return (
    <div style={{ padding: '0 20px' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
        <span
          style={{
            font: '700 25px/1 "Barlow Condensed", sans-serif',
            letterSpacing: '0.02em',
            textTransform: 'uppercase',
            color: 'var(--text-primary)',
          }}
        >
          Cycle
        </span>
        <span style={{ font: '500 10.5px "IBM Plex Mono", monospace', color: 'var(--text-dim)' }}>{cycleWindow} weeks shown</span>
      </div>

      {/* Status card */}
      <div
        style={{
          marginTop: 14,
          padding: '14px 16px 15px',
          borderRadius: 16,
          background: `linear-gradient(135deg, color-mix(in oklch, var(${phaseVar}) 22%, transparent), color-mix(in oklch, var(${phaseVar}) 6%, transparent))`,
          border: `1px solid color-mix(in oklch, var(${phaseVar}) 30%, transparent)`,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
          <div>
            <div
              style={{
                font: '600 9.5px/1 "Barlow Condensed", sans-serif',
                letterSpacing: '0.2em',
                textTransform: 'uppercase',
                color: `color-mix(in oklch, var(${phaseVar}) 78%, white)`,
              }}
            >
              {ct.phase} · day {ct.day}
            </div>
            <div style={{ marginTop: 6, display: 'flex', alignItems: 'baseline', gap: 7 }}>
              <span style={{ font: '700 46px/0.85 "Barlow Condensed", sans-serif', color: 'var(--text-primary)' }}>
                {Math.max(0, ct.daysToNext)}
              </span>
              <span style={{ font: '500 11px "IBM Plex Mono", monospace', color: 'var(--text-muted)' }}>days to next period</span>
            </div>
          </div>
          <span style={{ font: '500 10px "IBM Plex Mono", monospace', color: 'var(--text-dim)', textAlign: 'right' }}>
            expected
            <br />
            {fullDate(ct.nextStart)}
          </span>
        </div>
        <div
          style={{
            marginTop: 13,
            paddingTop: 12,
            borderTop: `1px solid color-mix(in oklch, var(${phaseVar}) 25%, transparent)`,
            font: '500 10.5px/1.55 "IBM Plex Mono", monospace',
            color: 'var(--text-muted)',
          }}
        >
          {interpretation}
        </div>
      </div>

      {/* Chart */}
      <div style={{ marginTop: 18 }}>
        <CycleChart
          entries={entries}
          spans={spans}
          starts={cycleLog.map((c) => c.start)}
          nextStart={ct.nextStart}
          from={from}
          to={to}
          today={today}
          fmt={(lbs) => toDisplay(lbs, unit)}
        />
      </div>

      {/* Legend + range control */}
      <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 10px' }}>
          {CYCLE_PHASES.map((p) => (
            <div key={p} style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              <span style={{ width: 7, height: 7, borderRadius: 2, background: `var(${PHASE_VAR[p]})` }} />
              <span
                style={{
                  font: '600 9px/1 "Barlow Condensed", sans-serif',
                  letterSpacing: '0.12em',
                  textTransform: 'uppercase',
                  color: 'var(--text-muted)',
                }}
              >
                {p}
              </span>
            </div>
          ))}
        </div>
        <SegmentedControl
          value={cycleWindow}
          onChange={(window) => dispatch({ type: 'SET_CYCLE_WINDOW', window })}
          options={WINDOW_OPTIONS}
          accent="var(--ovulation)"
        />
      </div>

      {/* Weight by phase */}
      <div style={{ marginTop: 12, padding: '13px 15px 14px', borderRadius: 14, background: 'var(--surface)' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
          {sectionLabel('Weight by phase')}
          <span style={{ font: '500 9px "IBM Plex Mono", monospace', color: 'var(--text-faint)' }}>within-cycle deviation</span>
        </div>
        {haveDeltas ? (
          <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 11 }}>
            {CYCLE_PHASES.map((p) => {
              const v = toDisplay(deltas[p], unit)
              const frac = Math.min(1, Math.abs(deltas[p]) / maxDelta)
              const left = v >= 0 ? 50 : 50 - frac * 50
              const width = frac * 50
              return (
                <div key={p} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ width: 7, height: 7, borderRadius: 2, background: `var(${PHASE_VAR[p]})`, flexShrink: 0 }} />
                  <span
                    style={{
                      width: 74,
                      flexShrink: 0,
                      font: '600 11px/1 "Barlow Condensed", sans-serif',
                      letterSpacing: '0.12em',
                      textTransform: 'uppercase',
                      color: 'var(--text-secondary)',
                    }}
                  >
                    {p}
                  </span>
                  <span style={{ flex: 1, height: 6, borderRadius: 3, background: 'var(--raised)', position: 'relative' }}>
                    <span
                      style={{
                        position: 'absolute',
                        top: 0,
                        bottom: 0,
                        left: `${left}%`,
                        width: `${width}%`,
                        borderRadius: 3,
                        background: `var(${PHASE_VAR[p]})`,
                      }}
                    />
                    <span style={{ position: 'absolute', top: -3, bottom: -3, left: '50%', width: 1, background: 'var(--chart-marker)' }} />
                  </span>
                  <span
                    style={{
                      width: 46,
                      textAlign: 'right',
                      flexShrink: 0,
                      font: '500 11px "IBM Plex Mono", monospace',
                      color: v > 0 ? 'var(--text-secondary)' : 'var(--cyan)',
                    }}
                  >
                    {sgn(v)}
                  </span>
                </div>
              )
            })}
          </div>
        ) : (
          <div style={{ marginTop: 10, font: '500 10px/1.5 "IBM Plex Mono", monospace', color: 'var(--text-dim)' }}>
            Needs a couple of completed cycles with weigh-ins before the phase averages mean anything.
          </div>
        )}
      </div>

      {/* Stats */}
      <div style={{ marginTop: 10, marginBottom: 20, display: 'flex', gap: 8 }}>
        <StatCard
          label="Cycle length"
          value={medianLen.toFixed(0)}
          note={reg.label === 'not enough data' ? 'median' : `${reg.min.toFixed(0)}–${reg.max.toFixed(0)} days`}
        />
        <StatCard
          label="Variation"
          value={reg.label === 'not enough data' ? '—' : `±${reg.stdev.toFixed(1)}`}
          note={reg.label}
          accent={reg.label === 'regular' ? 'var(--cyan)' : undefined}
        />
        <StatCard label="Logged" value={cycleLog.length.toFixed(0)} note={cycleLog.length === 1 ? 'cycle' : 'cycles'} />
      </div>
    </div>
  )
}
