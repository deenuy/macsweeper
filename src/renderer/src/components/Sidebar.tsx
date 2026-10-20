import type { Page, PageTheme } from '../App'
import type { DiskStats } from '../../../shared/types'
import { IconSmartCare, IconCleanup, IconDuplicates, IconSpaceLens, IconCloud, IconMail, IconApplications } from './icons'

interface NavItem {
  id: Page
  label: string
  Icon: React.FC<{ size?: number }>
}

const NAV: NavItem[] = [
  { id: 'dashboard',    label: 'Mac Health',    Icon: IconSmartCare },
  { id: 'junk',         label: 'Cleanup',       Icon: IconCleanup },
  { id: 'duplicates',   label: 'Duplicates',    Icon: IconDuplicates },
  { id: 'applications', label: 'Applications',  Icon: IconApplications },
  { id: 'space-lens',   label: 'Space Lens',    Icon: IconSpaceLens },
  { id: 'cloud',        label: 'Cloud Cleanup', Icon: IconCloud },
  { id: 'mail',         label: 'Mail Cleaner',  Icon: IconMail }
]

function formatBytes(bytes: number): string {
  if (bytes >= 1e9) return (bytes / 1e9).toFixed(1) + ' GB'
  if (bytes >= 1e6) return (bytes / 1e6).toFixed(0) + ' MB'
  return (bytes / 1e3).toFixed(0) + ' KB'
}

interface Props {
  current: Page
  onNavigate: (page: Page) => void
  diskStats: DiskStats | null
  theme: PageTheme
}

export default function Sidebar({ current, onNavigate, diskStats, theme }: Props) {
  const usedPct = diskStats?.usedPercent ?? 0

  return (
    <nav style={{
      width: 'var(--sidebar-w)',
      flexShrink: 0,
      background: 'rgba(0,0,0,0.18)',
      borderRight: '1px solid rgba(255,255,255,0.08)',
      display: 'flex',
      flexDirection: 'column',
      paddingTop: 8,
      paddingBottom: 16,
      backdropFilter: 'blur(12px)',
      WebkitBackdropFilter: 'blur(12px)'
    } as React.CSSProperties}>

      {/* Nav items */}
      <div style={{ flex: 1, padding: '0 12px' }}>
        {NAV.map(({ id, label, Icon }) => {
          const active = current === id
          return (
            <button
              key={id}
              onClick={() => onNavigate(id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                width: '100%',
                padding: '10px 14px',
                borderRadius: 11,
                border: 'none',
                cursor: 'pointer',
                marginBottom: 2,
                background: active ? theme.navSelected : 'transparent',
                color: active ? '#fff' : 'rgba(255,255,255,0.6)',
                fontSize: 14,
                fontWeight: active ? 600 : 400,
                textAlign: 'left',
                transition: 'background 0.2s ease, color 0.2s ease',
                WebkitAppRegion: 'no-drag'
              } as React.CSSProperties}
              onMouseEnter={e => {
                if (!active) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.08)'
              }}
              onMouseLeave={e => {
                if (!active) (e.currentTarget as HTMLElement).style.background = 'transparent'
              }}
            >
              <span style={{
                width: 28,
                height: 28,
                borderRadius: 7,
                background: active ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.07)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                transition: 'background 0.2s ease'
              }}>
                <Icon size={15} />
              </span>
              <span style={{ letterSpacing: '0.01em' }}>{label}</span>
            </button>
          )
        })}
      </div>

      {/* Disk usage widget */}
      {diskStats && (
        <div style={{
          margin: '8px 12px 0',
          padding: '12px 14px',
          background: 'rgba(255,255,255,0.07)',
          border: '1px solid rgba(255,255,255,0.10)',
          borderRadius: 12
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'baseline',
            marginBottom: 8
          }}>
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', fontWeight: 500 }}>
              Macintosh HD
            </span>
            <span style={{
              fontSize: 11,
              fontWeight: 700,
              color: usedPct >= 85 ? '#ff453a' : usedPct >= 70 ? '#ff9f0a' : 'rgba(255,255,255,0.6)',
              fontVariantNumeric: 'tabular-nums'
            }}>
              {usedPct}%
            </span>
          </div>
          <div style={{
            height: 3,
            background: 'rgba(255,255,255,0.12)',
            borderRadius: 2,
            overflow: 'hidden',
            marginBottom: 7
          }}>
            <div style={{
              height: '100%',
              width: `${usedPct}%`,
              background: usedPct >= 85
                ? 'linear-gradient(90deg, #ff6b6b, #ff453a)'
                : `linear-gradient(90deg, ${theme.accent}99, ${theme.accent})`,
              borderRadius: 2,
              transition: 'width 0.6s ease'
            }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.38)' }}>
              {formatBytes(diskStats.usedBytes)} used
            </span>
            <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.38)' }}>
              {formatBytes(diskStats.freeBytes)} free
            </span>
          </div>
        </div>
      )}
    </nav>
  )
}
