interface FabProps {
  onClick: () => void
  /** 'weight' → cyan plus, opens the weigh-in sheet. 'period' → rose droplet, opens the period sheet. */
  variant?: 'weight' | 'period'
}

export function Fab({ onClick, variant = 'weight' }: FabProps) {
  const period = variant === 'period'
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={period ? 'Log a period' : "Log today's weight"}
      style={{
        width: 54,
        height: 54,
        borderRadius: '50%',
        background: period ? 'var(--menstrual)' : 'var(--cyan)',
        boxShadow: period ? '0 6px 18px oklch(0.66 0.17 12 / .35)' : '0 6px 18px oklch(0.82 0.11 208 / .3)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        flexShrink: 0,
      }}
    >
      {period ? (
        <svg width="18" height="22" viewBox="0 0 18 22">
          <path d="M9 1.5C9 1.5 2 9.4 2 13.8A7 7 0 0 0 16 13.8C16 9.4 9 1.5 9 1.5Z" fill="var(--ink-on-accent)" />
        </svg>
      ) : (
        <svg width="20" height="20" viewBox="0 0 20 20">
          <rect x="9" y="2" width="2" height="16" rx="1" fill="var(--ink-on-accent)" />
          <rect x="2" y="9" width="16" height="2" rx="1" fill="var(--ink-on-accent)" />
        </svg>
      )}
    </button>
  )
}
