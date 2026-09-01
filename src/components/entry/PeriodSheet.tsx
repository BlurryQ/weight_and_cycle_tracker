import { useState } from 'react'
import { addDays, dayLabel, DAY_NAMES, fullDate, parseDate, today as todayIso } from '../../lib/dates'
import { useApp } from '../../store/AppContext'

/** Bottom sheet for the one cycle input: a period start. Also offers marking a period end and
 * removing mistaken starts. Opened by the contextual FAB on the Cycle screen (sheet === 'period'). */
export function PeriodSheet() {
  const { state, dispatch } = useApp()
  const today = todayIso()
  const [editing, setEditing] = useState(false)
  const [selected, setSelected] = useState(today)

  if (state.sheet !== 'period') return null

  const strip = Array.from({ length: 7 }, (_, i) => addDays(today, i - 6)) // 7 days ending today

  function close() {
    setEditing(false)
    setSelected(today)
    dispatch({ type: 'CLOSE_SHEET' })
  }

  const starts = [...state.cycleLog].sort((a, b) => (a.start < b.start ? 1 : -1))
  const lastStart = starts[0]?.start
  const openCycle = starts.find((c) => !c.end && c.start <= selected)

  function inPeriod(date: string): boolean {
    return state.cycleLog.some((c) => date >= c.start && date <= (c.end ?? addDays(c.start, 4)))
  }

  function logStart() {
    dispatch({ type: 'LOG_PERIOD_START', date: selected })
    dispatch({ type: 'SHOW_TOAST', message: selected === today ? 'Period logged — today' : `Period logged — ${dayLabel(selected)}` })
    close()
  }

  function logEnd() {
    if (!openCycle) return
    dispatch({ type: 'LOG_PERIOD_END', date: selected })
    dispatch({ type: 'SHOW_TOAST', message: `Period end — ${dayLabel(selected)}` })
    close()
  }

  const primaryLabel = selected === today ? 'Period started today' : `Period started ${dayLabel(selected).toLowerCase()}`

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200 }}>
      <div onClick={close} style={{ position: 'absolute', inset: 0, background: 'rgba(6,7,9,0.62)' }} />
      <div
        style={{
          position: 'absolute',
          left: '50%',
          bottom: 0,
          transform: 'translateX(-50%)',
          width: '100%',
          maxWidth: 430,
          background: '#14171c',
          borderRadius: '26px 26px 0 0',
          borderTop: '1px solid #23272e',
          padding: '10px 20px calc(34px + env(safe-area-inset-bottom))',
        }}
      >
        <div style={{ width: 38, height: 4, borderRadius: 999, background: 'var(--chart-marker)', margin: '0 auto' }} />

        <div style={{ marginTop: 18, display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
          <span
            style={{
              font: '700 22px/1 "Barlow Condensed", sans-serif',
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
              color: 'var(--text-primary)',
            }}
          >
            Log period
          </span>
          <span style={{ font: '500 10.5px "IBM Plex Mono", monospace', color: 'var(--text-dim)' }}>
            {lastStart ? `last start ${fullDate(lastStart)}` : 'no periods logged yet'}
          </span>
        </div>

        <div
          style={{
            marginTop: 16,
            font: '600 9.5px/1 "Barlow Condensed", sans-serif',
            letterSpacing: '0.2em',
            textTransform: 'uppercase',
            color: 'var(--text-dim)',
          }}
        >
          Which day did it start?
        </div>

        <div style={{ marginTop: 12, display: 'flex', gap: 6 }}>
          {strip.map((date) => {
            const sel = date === selected
            const marked = inPeriod(date)
            const d = parseDate(date)
            return (
              <button
                key={date}
                type="button"
                onClick={() => setSelected(date)}
                style={{
                  flex: 1,
                  padding: '9px 0 10px',
                  borderRadius: 12,
                  background: sel ? 'oklch(0.66 0.17 12 / .2)' : 'var(--raised)',
                  border: `1px solid ${sel ? 'oklch(0.66 0.17 12 / .55)' : 'transparent'}`,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 5,
                  cursor: 'pointer',
                }}
              >
                <span
                  style={{
                    font: '600 8.5px/1 "Barlow Condensed", sans-serif',
                    letterSpacing: '0.12em',
                    textTransform: 'uppercase',
                    color: sel ? 'oklch(0.78 0.13 12)' : 'var(--text-dim)',
                  }}
                >
                  {DAY_NAMES[(d.getUTCDay() + 6) % 7]}
                </span>
                <span style={{ font: '700 17px/1 "Barlow Condensed", sans-serif', color: sel ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                  {d.getUTCDate()}
                </span>
                <span
                  style={{
                    width: 4,
                    height: 4,
                    borderRadius: '50%',
                    background: marked ? 'var(--menstrual)' : 'transparent',
                  }}
                />
              </button>
            )
          })}
        </div>

        <button
          type="button"
          onClick={logStart}
          style={{
            marginTop: 18,
            width: '100%',
            padding: '16px 0',
            borderRadius: 16,
            background: 'var(--menstrual)',
            color: 'var(--ink-on-accent)',
            font: '700 14px/1 "Barlow Condensed", sans-serif',
            letterSpacing: '0.2em',
            textTransform: 'uppercase',
            cursor: 'pointer',
          }}
        >
          {primaryLabel}
        </button>

        <div style={{ marginTop: 10, display: 'flex', gap: 8 }}>
          <button
            type="button"
            onClick={logEnd}
            disabled={!openCycle}
            style={{
              flex: 1,
              padding: '13px 0',
              borderRadius: 14,
              background: 'var(--raised)',
              color: openCycle ? 'var(--text-secondary)' : 'var(--text-disabled)',
              font: '600 11px/1 "Barlow Condensed", sans-serif',
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
              cursor: openCycle ? 'pointer' : 'default',
            }}
          >
            Period ended
          </button>
          <button
            type="button"
            onClick={() => setEditing((v) => !v)}
            style={{
              flex: 1,
              padding: '13px 0',
              borderRadius: 14,
              background: 'var(--raised)',
              color: editing ? 'var(--text-secondary)' : 'var(--text-muted)',
              font: '600 11px/1 "Barlow Condensed", sans-serif',
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
              cursor: 'pointer',
            }}
          >
            Edit history
          </button>
        </div>

        {editing && (
          <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {starts.length === 0 && (
              <span style={{ font: '500 10.5px "IBM Plex Mono", monospace', color: 'var(--text-dim)' }}>Nothing logged.</span>
            )}
            {starts.slice(0, 6).map((c) => (
              <div
                key={c.start}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '8px 12px',
                  borderRadius: 10,
                  background: 'var(--raised)',
                }}
              >
                <span style={{ font: '500 11px "IBM Plex Mono", monospace', color: 'var(--text-secondary)' }}>
                  {fullDate(c.start)}
                  {c.end ? ` → ${fullDate(c.end)}` : ''}
                </span>
                <button
                  type="button"
                  onClick={() => dispatch({ type: 'DELETE_CYCLE', start: c.start })}
                  style={{ font: '500 10px "IBM Plex Mono", monospace', color: 'oklch(0.62 0.09 12)', cursor: 'pointer' }}
                >
                  remove
                </button>
              </div>
            ))}
          </div>
        )}

        <div
          style={{
            marginTop: 16,
            paddingTop: 14,
            borderTop: '1px solid var(--hairline-strong)',
            font: '500 10.5px/1.6 "IBM Plex Mono", monospace',
            color: 'var(--text-muted)',
          }}
        >
          Logging a start is all that's needed — phase lengths come from your own median cycle and shift as more
          cycles are logged. A period end is optional and only tunes the menstrual-phase length.
        </div>
      </div>
    </div>
  )
}
