import { diffDays, mondayOf, shortDate, today as todayIso } from '../lib/dates'
import { formatWeight, sgn, toDisplay, toLbs, unitLabel } from '../lib/format'
import {
  avg,
  currentDir,
  currentStreak,
  fitSlope,
  lastCompletedWeek,
  signColor,
  weeklyAverages,
} from '../lib/math'
import { cycleDayToday, medianCycleLength, type CyclePhase } from '../lib/cycle'
import { deadLetterCount } from '../data/queue'
import { useApp } from '../store/AppContext'
import { Chip } from '../components/ui/Chip'
import { ReachCard } from '../components/entry/ReachCard'
import { RateBar } from './today/RateBar'
import { DayStrip } from './today/DayStrip'
import { EnergyCard } from './today/EnergyCard'
import { StatCards } from './today/StatCards'
import { TrendsChartMirror } from './today/TrendsChartMirror'
import { buildTrendsChart } from './today/trendsChartGeometry'

const SIGN_COLOR = { lime: 'var(--sign-good)', red: 'var(--sign-bad)', grey: 'var(--text-muted)' } as const

// The fork keeps its two-chip header. The training-phase chip is coloured per chart direction
// (Cut/Bulk) — a static map, NOT the live --accent; this fork has no [data-phase] accent
// switching. The second chip, shown only when a cycle is logged, is the menstrual-phase chip.
const CHIP_COLORS = {
  Cut: {
    bg: 'oklch(0.82 0.11 208 / .13)',
    border: 'oklch(0.82 0.11 208 / .3)',
    dot: 'var(--cyan)',
    text: 'var(--cyan-text)',
  },
  Bulk: {
    bg: 'oklch(0.76 0.13 235 / .14)',
    border: 'oklch(0.76 0.13 235 / .35)',
    dot: 'var(--blue)',
    text: 'var(--blue)',
  },
}

const PHASE_VAR: Record<CyclePhase, string> = {
  Menstrual: '--menstrual',
  Follicular: '--follicular',
  Ovulation: '--ovulation',
  Luteal: '--luteal',
}

export function Today() {
  const { state, dispatch } = useApp()
  const {
    entries,
    nutrition,
    phase,
    phaseStart,
    phaseLog,
    cycleLog,
    weeklyTarget,
    unit,
    solveMode,
    targetLbs,
    targetWeeks,
    syncFailed,
    pullFailed,
  } = state
  const today = todayIso()
  const stuck = deadLetterCount()
  const syncBad = syncFailed || pullFailed || stuck > 0
  const syncMessage = pullFailed
    ? "Couldn't load from the server — showing this device's copy"
    : stuck > 0
      ? `${stuck} change${stuck === 1 ? '' : 's'} rejected by the server`
      : syncFailed
        ? 'Changes saved on this device, not yet synced'
        : 'Synced'
  const cyc = cycleDayToday(cycleLog, today, medianCycleLength(cycleLog))

  if (entries.length === 0) {
    return (
      <div style={{ padding: '20px 20px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, marginTop: 120 }}>
        <div style={{ font: '500 12px "IBM Plex Mono", monospace', color: 'var(--text-dim)', textAlign: 'center' }}>
          No weigh-ins yet.
        </div>
        <button
          type="button"
          onClick={() => dispatch({ type: 'OPEN_SHEET', sheet: today })}
          style={{
            padding: '13px 20px',
            borderRadius: 999,
            background: 'var(--cyan)',
            color: 'var(--ink-on-accent)',
            font: '700 13px/1 "Barlow Condensed", sans-serif',
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            cursor: 'pointer',
          }}
        >
          Log your first weigh-in
        </button>
      </div>
    )
  }

  const a7 = avg(entries, 7, today)
  const a7prev = avg(entries, 7, today, 7)
  const a14 = avg(entries, 14, today)
  const wowLbs = a7 != null && a7prev != null ? a7 - a7prev : 0

  const weekly = weeklyAverages(entries)
  const fit4 = fitSlope(weekly, 4)
  const dir = currentDir(phase, phaseLog)
  const lastWeek = lastCompletedWeek(weekly, today)

  const phaseWeek = Math.floor(diffDays(mondayOf(phaseStart), today) / 7) + 1
  const streak = currentStreak(entries, today)
  const chipColors = CHIP_COLORS[dir]

  // Today's Reach card and the mirrored Trends chart both read from the one shared builder, so
  // editing the target here moves this chart's projection, the Reach output, and the Trends
  // screen identically. Dims match Trends exactly — this is the same chart, not a reduction.
  const chart = buildTrendsChart(state, today, { W: 316, H: 184, gutter: 32, gridN: 5 })

  return (
    <div style={{ padding: '0 20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Chip
          label={`${phase} · week ${phaseWeek}`}
          bg={chipColors.bg}
          border={chipColors.border}
          dotColor={chipColors.dot}
          textColor={chipColors.text}
          onClick={() => dispatch({ type: 'SET_SCREEN', screen: 'setup' })}
        />
        {cyc && (
          <Chip
            label={`Day ${cyc.day} · ${cyc.phase}`}
            bg={`color-mix(in oklch, var(${PHASE_VAR[cyc.phase]}) 16%, transparent)`}
            border={`color-mix(in oklch, var(${PHASE_VAR[cyc.phase]}) 38%, transparent)`}
            dotColor={`color-mix(in oklch, var(${PHASE_VAR[cyc.phase]}) 82%, white)`}
            textColor={`color-mix(in oklch, var(${PHASE_VAR[cyc.phase]}) 84%, white)`}
            onClick={() => dispatch({ type: 'SET_SCREEN', screen: 'cycle' })}
          />
        )}
        <span style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <button
            type="button"
            aria-label={syncMessage}
            title={syncMessage}
            onClick={() => dispatch({ type: 'SHOW_TOAST', message: syncMessage })}
            style={{ padding: 4, margin: -4, background: 'none', border: 0, cursor: 'pointer', display: 'inline-flex' }}
          >
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: syncBad ? 'var(--sign-bad)' : 'var(--sign-good)',
                display: 'inline-block',
              }}
            />
          </button>
          <span style={{ font: '500 11px "IBM Plex Mono", monospace', color: 'var(--text-faint)' }}>{shortDate(today)}</span>
        </span>
      </div>

      <div style={{ marginTop: 20 }}>
        <div
          style={{
            font: '600 9.5px/1 "Barlow Condensed", sans-serif',
            letterSpacing: '0.2em',
            textTransform: 'uppercase',
            color: 'var(--text-dim)',
          }}
        >
          7-day average
        </div>
        <div style={{ marginTop: 4, display: 'flex', alignItems: 'baseline', gap: 8 }}>
          <span style={{ font: '700 78px/0.8 "Barlow Condensed", sans-serif', letterSpacing: '-0.01em', color: 'var(--text-primary)' }}>
            {formatWeight(a7, unit)}
          </span>
          <span
            style={{
              font: '600 13px/1 "Barlow Condensed", sans-serif',
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: 'var(--text-dim)',
            }}
          >
            {unitLabel(unit)}
          </span>
        </div>
        <div style={{ marginTop: 8, font: '500 11.5px "IBM Plex Mono", monospace', color: SIGN_COLOR[signColor(wowLbs, dir)] }}>
          {sgn(toDisplay(wowLbs, unit))} on the week
        </div>
      </div>

      <div style={{ marginTop: 8, font: '500 10px "IBM Plex Mono", monospace', color: 'var(--text-dim)' }}>
        <span className="accent-el" style={{ color: 'var(--accent-text)', fontWeight: 600 }}>{streak}</span> day{streak === 1 ? '' : 's'} streak
      </div>

      <div style={{ marginTop: 18, padding: '14px 15px', borderRadius: 14, background: 'var(--surface)' }}>
        <RateBar slopeLbs={fit4.slope} weeklyTarget={weeklyTarget} unit={unit} />
      </div>

      <div style={{ marginTop: 16 }}>
        <DayStrip entries={entries} today={today} unit={unit} />
      </div>

      <div style={{ marginTop: 16 }}>
        <StatCards
          a14={formatWeight(a14, unit)}
          lastWeek={lastWeek ? formatWeight(lastWeek.lbs, unit) : '—'}
          lastWeekDelta={lastWeek?.deltaLbs != null ? sgn(toDisplay(lastWeek.deltaLbs, unit)) : undefined}
          lastWeekDeltaColor={lastWeek?.deltaLbs != null ? signColor(lastWeek.deltaLbs, dir) : undefined}
          rateLbs={fit4.slope}
          rateColor={signColor(fit4.slope, dir)}
          unit={unit}
        />
      </div>

      <TrendsChartMirror
        chart={chart}
        cycleLog={cycleLog}
        onOpen={() => dispatch({ type: 'SET_SCREEN', screen: 'trends' })}
      />

      <EnergyCard
        entries={entries}
        nutrition={nutrition}
        phaseLog={phaseLog}
        weeklyTargetLbs={weeklyTarget}
        today={today}
      />

      <ReachCard
        unit={unit}
        solveMode={solveMode}
        onSolveModeChange={(mode) => dispatch({ type: 'SET_SOLVE_MODE', mode })}
        targetLbs={targetLbs}
        targetWeeks={targetWeeks}
        onEditTarget={() => dispatch({ type: 'OPEN_SHEET', sheet: 'target' })}
        onWeeksChange={(weeks) => dispatch({ type: 'SET_TARGET_WEEKS', value: weeks })}
        current={chart.current}
        slopeLbs={toLbs(chart.geometry.slope, unit)}
        weightResult={chart.weightResult}
        dateResult={chart.dateResult}
      />

      <button
        type="button"
        onClick={() => dispatch({ type: 'SET_SCREEN', screen: 'trends' })}
        className="accent-el"
        style={{
          marginTop: 12,
          marginBottom: 8,
          width: '100%',
          textAlign: 'center',
          cursor: 'pointer',
          font: '500 10.5px "IBM Plex Mono", monospace',
          color: 'var(--accent)',
        }}
      >
        see where this lands, plotted → Trends
      </button>
    </div>
  )
}
