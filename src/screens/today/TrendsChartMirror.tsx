import { periodDaysInRange, type CycleLogEntry } from '../../lib/cycle'
import { WeightChart } from '../../components/chart/WeightChart'
import type { TrendsChart } from './trendsChartGeometry'

// Same dimensions Trends renders at — the mirror is the same chart, not a shrunk-down cue.
const DIMS = { W: 316, H: 184, gutter: 32 }

interface TrendsChartMirrorProps {
  chart: TrendsChart
  cycleLog: CycleLogEntry[]
  onOpen: () => void
}

/** A read-only copy of the Trends chart on the home screen: identical geometry (same store
 * state, same `buildTrendsChart` helper, same dims as Trends) with none of the window / anchor
 * controls. Tapping anywhere on it opens the Trends screen. Editing the Reach target below
 * moves this projection and the Trends one together, since both read the one helper. */
export function TrendsChartMirror({ chart, cycleLog, onOpen }: TrendsChartMirrorProps) {
  if (!chart.geometry.line) return null

  const periodDays = periodDaysInRange(cycleLog, chart.from, chart.to)

  return (
    <div style={{ marginTop: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span
          style={{
            font: '600 9.5px/1 "Barlow Condensed", sans-serif',
            letterSpacing: '0.2em',
            textTransform: 'uppercase',
            color: 'var(--text-dim)',
          }}
        >
          Weekly average
        </span>
        <span className="accent-el" style={{ font: '500 10.5px "IBM Plex Mono", monospace', color: 'var(--accent)' }}>
          trends →
        </span>
      </div>
      <button
        type="button"
        onClick={onOpen}
        aria-label="Open Trends"
        style={{ marginTop: 14, display: 'block', width: '100%', textAlign: 'left', cursor: 'pointer' }}
      >
        <WeightChart
          geometry={chart.geometry}
          W={DIMS.W}
          H={DIMS.H}
          gutter={DIMS.gutter}
          variant="trends"
          periodDays={periodDays}
        />
      </button>
    </div>
  )
}
