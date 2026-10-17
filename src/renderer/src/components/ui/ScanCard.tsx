interface Props {
  icon: string
  label: string
  value: string
  sublabel?: string
  color?: string
  loading?: boolean
  onClick?: () => void
  style?: React.CSSProperties
  badge?: string
}

export default function ScanCard({
  icon, label, value, sublabel, color = '#a855f7',
  loading, onClick, style, badge
}: Props) {
  return (
    <div
      onClick={onClick}
      style={{
        background: 'rgba(255,255,255,0.05)',
        border: `1px solid rgba(255,255,255,0.09)`,
        borderRadius: 20,
        padding: '22px 24px',
        cursor: onClick ? 'pointer' : 'default',
        transition: 'all 0.2s ease',
        position: 'relative',
        overflow: 'hidden',
        ...style
      }}
      onMouseEnter={e => {
        if (onClick) {
          (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.08)'
          ;(e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)'
          ;(e.currentTarget as HTMLElement).style.borderColor = `${color}44`
        }
      }}
      onMouseLeave={e => {
        if (onClick) {
          (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.05)'
          ;(e.currentTarget as HTMLElement).style.transform = 'translateY(0)'
          ;(e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.09)'
        }
      }}
    >
      {/* Glow accent */}
      <div style={{
        position: 'absolute',
        top: -30,
        right: -30,
        width: 80,
        height: 80,
        borderRadius: '50%',
        background: color,
        opacity: 0.08,
        filter: 'blur(20px)',
        pointerEvents: 'none'
      }} />

      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
        <div style={{
          width: 44,
          height: 44,
          borderRadius: 12,
          background: `linear-gradient(135deg, ${color}33, ${color}11)`,
          border: `1px solid ${color}33`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 20,
          flexShrink: 0
        }}>
          {icon}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 4 }}>{label}</div>
          {loading ? (
            <div style={{
              height: 24,
              width: '60%',
              borderRadius: 6,
              background: 'rgba(255,255,255,0.08)',
              animation: 'shimmer 1.5s infinite',
              backgroundSize: '200% 100%',
              backgroundImage: 'linear-gradient(90deg, rgba(255,255,255,0.05) 25%, rgba(255,255,255,0.12) 50%, rgba(255,255,255,0.05) 75%)'
            }} />
          ) : (
            <div style={{
              fontSize: 22,
              fontWeight: 700,
              color: 'var(--text)',
              letterSpacing: '-0.02em'
            }}>
              {value}
            </div>
          )}
          {sublabel && (
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>
              {sublabel}
            </div>
          )}
        </div>
        {badge && (
          <div style={{
            fontSize: 10,
            fontWeight: 700,
            padding: '3px 7px',
            borderRadius: 20,
            background: `${color}22`,
            color,
            border: `1px solid ${color}44`,
            flexShrink: 0
          }}>
            {badge}
          </div>
        )}
      </div>
    </div>
  )
}
