import type { Screen } from '../../store/types'
import { Fab } from './Fab'

const TABS: { id: Screen; label: string }[] = [
  { id: 'today', label: 'Today' },
  { id: 'trends', label: 'Trends' },
  { id: 'cycle', label: 'Cycle' },
  { id: 'history', label: 'History' },
  { id: 'setup', label: 'Setup' },
]

interface TabBarProps {
  active: Screen
  onSelect: (screen: Screen) => void
  onFab: () => void
}

export function TabBar({ active, onSelect, onFab }: TabBarProps) {
  const onCycle = active === 'cycle'
  return (
    <div
      style={{
        position: 'sticky',
        bottom: 0,
        left: 0,
        right: 0,
        background: 'linear-gradient(to bottom, transparent 0%, var(--bg) 34%)',
        paddingTop: 24,
      }}
    >
      {/* Bottom padding clears the Android gesture / 3-button nav bar (the app runs edge-to-edge
          on Android 15+, so content otherwise renders underneath it). */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '8px 6px calc(30px + env(safe-area-inset-bottom))' }}>
        {TABS.map((tab) => {
          const isActive = tab.id === active
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onSelect(tab.id)}
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 6,
                minHeight: 44,
                justifyContent: 'center',
                cursor: 'pointer',
              }}
            >
              <span
                style={{
                  width: 16,
                  height: 3,
                  borderRadius: 999,
                  background: isActive ? (tab.id === 'cycle' ? 'var(--ovulation)' : 'var(--cyan)') : 'transparent',
                }}
              />
              <span
                style={{
                  font: '600 10px/1 "Barlow Condensed", sans-serif',
                  letterSpacing: '0.12em',
                  textTransform: 'uppercase',
                  color: isActive ? 'var(--text-primary)' : 'var(--text-dim)',
                }}
              >
                {tab.label}
              </span>
            </button>
          )
        })}
        <Fab variant={onCycle ? 'period' : 'weight'} onClick={onFab} />
      </div>
    </div>
  )
}
