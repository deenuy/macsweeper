import type { Page } from '../App'
import type { DiskStats } from '../../../shared/types'

interface NavItem {
  id: Page
  label: string
  icon: string
  sublabel?: string
}

const NAV: NavItem[] = [
  { id: 'dashboard', label: 'Smart Care', icon: '✦' },
  { id: 'junk', label: 'Cleanup', icon: '🗑️' },
  { id: 'duplicates', label: 'Duplicates', icon: '⊞' },
  { id: 'space-lens', label: 'Space Lens', icon: '◎' },
  { id: 'cloud', label: 'Cloud Cleanup', icon: '☁️' }
]

function formatBytes(bytes: number): string {
  if (bytes >= 1e9) return (bytes / 1e9).toFixed(0) + ' GB'
  if (bytes >= 1e6) return (bytes / 1e6).toFixed(0) + ' MB'
  return (bytes / 1e3).toFixed(0) + ' KB'
}

interface Props {
  current: Page
  onNavigate: (page: Page) => void
  diskStats: DiskStats | null
}

export default function Sidebar({ current, onNavigate, diskStats }: Props) {
  const usedPct = diskStats?.usedPercent ?? 0
  const ringColor = usedPct >= 85 ? '#ef4444' : usedPct >= 70 ? '#f59e0b' : '#22c55e'

  return (
    <nav style={{
      width: 'var(--sidebar-w)',
      flexShrink: 0,
      background: 'rgba(8,8,20,0.85)',
      borderRight: '1px solid rgba(255,255,255,0.07)',
      display: 'flex',
      flexDirection: 'column',
      padding: '12px 0',
      backdropFilter: 'blur(20px)'
    }}>
      {/* Nav items */}
      <div style={{ flex: 1, padding: '0 10px' }}>
        {NAV.map((item) => {
          const active = current === item.id
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 11,
                width: '100%',
                padding: '10px 12px',
                borderRadius: 10,
                border: 'none',
                cursor: 'pointer',
                marginBottom: 2,
                background: active
                  ? 'linear-gradient(135deg, rgba(168,85,247,0.25), rgba(99,102,241,0.2))'
                  : 'transparent',
                color: active ? '#fff' : 'rgba(240,240,255,0.6)',
                fontSize: 13,
                fontWeight: active ? 600 : 400,
                textAlign: 'left',
                transition: 'all 0.15s ease',
                boxShadow: active ? 'inset 0 0 0 1px rgba(168,85,247,0.3)' : 'none',
                WebkitAppRegion: 'no-drag'
              } as React.CSSProperties}
            >
              <span style={{ fontSize: 15, width: 20, textAlign: 'center' }}>{item.icon}</span>
              <span>{item.label}</span>
              {active && (
                <span style={{
                  marginLeft: 'auto',
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  background: 'var(--accent)',
                  boxShadow: '0 0 6px var(--accent)'
                }} />
              )}
            </button>
          )
        })}
      </div>

      {/* Disk usage mini-widget */}
      {diskStats && (
        <div style={{
          margin: '12px 10px 8px',
          padding: '14px',
          background: 'rgba(255,255,255,0.05)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 14
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 10
          }}>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Macintosh HD</span>
            <span style={{
              fontSize: 12,
              fontWeight: 700,
              color: ringColor
            }}>{usedPct}%</span>
          </div>
          {/* Progress bar */}
          <div style={{
            height: 4,
            background: 'rgba(255,255,255,0.1)',
            borderRadius: 4,
            overflow: 'hidden',
            marginBottom: 8
          }}>
            <div style={{
              height: '100%',
              width: `${usedPct}%`,
              background: `linear-gradient(90deg, ${ringColor}88, ${ringColor})`,
              borderRadius: 4,
              transition: 'width 0.5s ease'
            }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
              {formatBytes(diskStats.usedBytes)} used
            </span>
            <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
              {formatBytes(diskStats.freeBytes)} free
            </span>
          </div>
          {usedPct >= 90 && (
            <div style={{
              marginTop: 8,
              padding: '5px 8px',
              background: 'rgba(239,68,68,0.15)',
              border: '1px solid rgba(239,68,68,0.3)',
              borderRadius: 7,
              fontSize: 10,
              color: '#fca5a5',
              textAlign: 'center'
            }}>
              ⚠️ Critical: disk almost full
            </div>
          )}
        </div>
      )}
    </nav>
  )
}
