import { useState, useEffect } from 'react'
import type { SystemSnapshot } from '../../../shared/types'
import type { Page, PageTheme } from '../App'

function fmtBytes(n: number): string {
  if (n >= 1e12) return (n / 1e12).toFixed(2) + ' TB'
  if (n >= 1e9) return (n / 1e9).toFixed(2) + ' GB'
  if (n >= 1e6) return (n / 1e6).toFixed(0) + ' MB'
  return (n / 1e3).toFixed(0) + ' KB'
}

function fmtRate(kbps: number): string {
  if (kbps >= 1024) return (kbps / 1024).toFixed(1) + ' MB/s'
  return kbps.toFixed(0) + ' KB/s'
}

const HEALTH_COLOR: Record<string, string> = {
  Excellent: '#22c55e',
  Good: '#86efac',
  Fair: '#f97316',
  Poor: '#ef4444',
}

function MacIcon() {
  return (
    <svg width="52" height="52" viewBox="0 0 52 52" fill="none">
      <rect x="4" y="6" width="44" height="32" rx="4" fill="rgba(100,140,200,0.35)" stroke="rgba(150,190,255,0.50)" strokeWidth="1.5"/>
      <rect x="8" y="10" width="36" height="24" rx="2" fill="rgba(30,50,120,0.45)"/>
      <rect x="4" y="10" width="44" height="2" rx="1" fill="rgba(180,210,255,0.10)"/>
      <rect x="16" y="39" width="20" height="3" rx="1" fill="rgba(150,190,255,0.35)"/>
      <rect x="10" y="42" width="32" height="2.5" rx="1.25" fill="rgba(150,190,255,0.28)"/>
      <rect x="14" y="14" width="24" height="15" rx="1" fill="rgba(60,90,180,0.30)"/>
      <circle cx="26" cy="21" r="3" fill="rgba(140,180,255,0.45)"/>
    </svg>
  )
}

function StorageIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
      <rect x="2" y="6" width="18" height="12" rx="2.5" fill="rgba(130,160,220,0.40)" stroke="rgba(160,190,255,0.40)" strokeWidth="1.2"/>
      <rect x="2" y="12" width="18" height="6" rx="1.5" fill="rgba(100,130,190,0.30)"/>
      <circle cx="5" cy="15" r="1.3" fill="rgba(160,190,255,0.70)"/>
      <circle cx="17" cy="15" r="1" fill="rgba(160,190,255,0.50)"/>
      <rect x="5" y="8.5" width="8" height="2" rx="1" fill="rgba(190,210,255,0.30)"/>
    </svg>
  )
}

function MemoryIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
      <rect x="1" y="7" width="20" height="10" rx="2" fill="rgba(155,92,232,0.35)" stroke="rgba(180,140,255,0.40)" strokeWidth="1.2"/>
      <rect x="4" y="10" width="3" height="4" rx="0.5" fill="rgba(180,140,255,0.60)"/>
      <rect x="9" y="10" width="3" height="4" rx="0.5" fill="rgba(180,140,255,0.50)"/>
      <rect x="14" y="10" width="3" height="4" rx="0.5" fill="rgba(180,140,255,0.60)"/>
      <rect x="5.5" y="5" width="1" height="2" rx="0.5" fill="rgba(180,140,255,0.45)"/>
      <rect x="10.5" y="5" width="1" height="2" rx="0.5" fill="rgba(180,140,255,0.45)"/>
      <rect x="15" y="5" width="1" height="2" rx="0.5" fill="rgba(180,140,255,0.45)"/>
      <rect x="5.5" y="17" width="1" height="2" rx="0.5" fill="rgba(180,140,255,0.35)"/>
      <rect x="10.5" y="17" width="1" height="2" rx="0.5" fill="rgba(180,140,255,0.35)"/>
      <rect x="15" y="17" width="1" height="2" rx="0.5" fill="rgba(180,140,255,0.35)"/>
    </svg>
  )
}

function BatteryIcon({ pct }: { pct: number }) {
  const fill = pct > 20 ? '#22c55e' : '#ef4444'
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
      <rect x="1" y="6" width="17" height="10" rx="2" fill="none" stroke="rgba(200,200,200,0.45)" strokeWidth="1.3"/>
      <rect x="18" y="9" width="2.5" height="4" rx="1" fill="rgba(200,200,200,0.35)"/>
      <rect x="2.5" y="7.5" width={Math.max(1, (14 * pct) / 100)} height="7" rx="1" fill={fill} opacity="0.75"/>
    </svg>
  )
}

function CpuIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
      <rect x="5" y="5" width="12" height="12" rx="2" fill="rgba(100,180,200,0.35)" stroke="rgba(100,200,220,0.40)" strokeWidth="1.2"/>
      <rect x="7.5" y="7.5" width="7" height="7" rx="1" fill="rgba(80,160,200,0.40)"/>
      <rect x="8.5" y="8.5" width="5" height="5" rx="0.5" fill="rgba(120,200,230,0.30)"/>
      <rect x="7" y="1.5" width="1" height="3" rx="0.5" fill="rgba(100,200,220,0.45)"/>
      <rect x="11" y="1.5" width="1" height="3" rx="0.5" fill="rgba(100,200,220,0.45)"/>
      <rect x="14" y="1.5" width="1" height="3" rx="0.5" fill="rgba(100,200,220,0.45)"/>
      <rect x="7" y="17.5" width="1" height="3" rx="0.5" fill="rgba(100,200,220,0.35)"/>
      <rect x="11" y="17.5" width="1" height="3" rx="0.5" fill="rgba(100,200,220,0.35)"/>
      <rect x="14" y="17.5" width="1" height="3" rx="0.5" fill="rgba(100,200,220,0.35)"/>
      <rect x="1.5" y="7" width="3" height="1" rx="0.5" fill="rgba(100,200,220,0.45)"/>
      <rect x="1.5" y="11" width="3" height="1" rx="0.5" fill="rgba(100,200,220,0.45)"/>
      <rect x="1.5" y="14" width="3" height="1" rx="0.5" fill="rgba(100,200,220,0.45)"/>
      <rect x="17.5" y="7" width="3" height="1" rx="0.5" fill="rgba(100,200,220,0.35)"/>
      <rect x="17.5" y="11" width="3" height="1" rx="0.5" fill="rgba(100,200,220,0.35)"/>
      <rect x="17.5" y="14" width="3" height="1" rx="0.5" fill="rgba(100,200,220,0.35)"/>
    </svg>
  )
}

function WifiIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
      <path d="M11 16.5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3z" fill="rgba(200,200,200,0.75)"/>
      <path d="M7.5 13.5a5 5 0 0 1 7 0" stroke="rgba(200,200,200,0.60)" strokeWidth="1.5" strokeLinecap="round" fill="none"/>
      <path d="M4.5 10.5a9 9 0 0 1 13 0" stroke="rgba(200,200,200,0.40)" strokeWidth="1.5" strokeLinecap="round" fill="none"/>
      <path d="M2 7.5a13 13 0 0 1 18 0" stroke="rgba(200,200,200,0.22)" strokeWidth="1.5" strokeLinecap="round" fill="none"/>
    </svg>
  )
}

function StatBar({ value, max = 100, color }: { value: number; max?: number; color: string }) {
  const pct = Math.min(100, Math.round((value / max) * 100))
  return (
    <div style={{ height: 4, background: 'rgba(255,255,255,0.10)', borderRadius: 3, overflow: 'hidden', marginTop: 6 }}>
      <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 3, transition: 'width 0.6s ease' }} />
    </div>
  )
}

interface WidgetProps { style?: React.CSSProperties; children: React.ReactNode }
function Widget({ style, children }: WidgetProps) {
  return (
    <div style={{
      background: 'rgba(255,255,255,0.05)',
      border: '1px solid rgba(255,255,255,0.10)',
      borderRadius: 16, padding: '16px 18px',
      display: 'flex', flexDirection: 'column', gap: 4,
      ...style,
    }}>
      {children}
    </div>
  )
}

function FreeUpButton({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick} style={{
      marginTop: 8, alignSelf: 'flex-start',
      background: 'none', border: 'none', padding: 0,
      color: '#a78bfa', fontSize: 13, fontWeight: 700,
      cursor: 'pointer', letterSpacing: '0.01em',
    }}
      onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = '#c4b5fd'}
      onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = '#a78bfa'}
    >
      Free Up
    </button>
  )
}

function EjectButton({ path }: { path: string }) {
  const [ejecting, setEjecting] = useState(false)
  const eject = async () => {
    setEjecting(true)
    try {
      await window.electron.ejectDisk(path)
    } catch {}
    setTimeout(() => setEjecting(false), 1500)
  }
  return (
    <button onClick={eject} title="Eject" style={{
      background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)',
      borderRadius: 6, padding: '3px 8px', cursor: 'pointer', color: 'rgba(255,255,255,0.65)', fontSize: 11,
    }}>
      {ejecting ? '...' : '⏏'}
    </button>
  )
}

function getRecommendation(snap: SystemSnapshot, onNavigate: (p: Page) => void) {
  const diskFreePct = snap.disk.totalBytes > 0
    ? (snap.disk.freeBytes / snap.disk.totalBytes) * 100 : 50
  if (diskFreePct < 10) return {
    icon: '💽',
    title: 'Storage is running low',
    body: `Only ${fmtBytes(snap.disk.freeBytes)} free. Scan and remove large files and junk to reclaim space.`,
    action: 'Scan for Junk',
    onAction: () => onNavigate('junk'),
  }
  if (snap.memory.pressurePercent > 80) return {
    icon: '🧠',
    title: 'High memory pressure',
    body: `Memory pressure is at ${snap.memory.pressurePercent}%. Clearing caches can help free up RAM.`,
    action: 'Clean Caches',
    onAction: () => onNavigate('junk'),
  }
  if (snap.connectedDevices.length > 0) return {
    icon: '💽',
    title: 'External drives connected',
    body: `${snap.connectedDevices.map(d => d.name).join(', ')} ${snap.connectedDevices.length === 1 ? 'is' : 'are'} connected. Use Space Lens to scan and manage storage.`,
    action: 'Open Space Lens',
    onAction: () => onNavigate('space-lens'),
  }
  return {
    icon: '✨',
    title: 'Your Mac looks healthy',
    body: 'Run a smart scan to find hidden junk, duplicates, and large files you can safely remove.',
    action: 'Smart Scan',
    onAction: () => onNavigate('junk'),
  }
}

interface Props {
  onNavigate: (page: Page) => void
  theme: PageTheme
}

export default function Home({ onNavigate, theme }: Props) {
  const [snap, setSnap] = useState<SystemSnapshot | null>(null)
  const [loading, setLoading] = useState(true)
  const [fdaGranted, setFdaGranted] = useState<boolean | null>(null)

  const refresh = () => {
    window.electron.getSystemSnapshot().then(s => {
      setSnap(s)
      setLoading(false)
    }).catch(() => setLoading(false))
  }

  useEffect(() => {
    window.electron.checkFDA().then(setFdaGranted).catch(() => setFdaGranted(true))
    refresh()
    const id = setInterval(refresh, 4000)
    return () => clearInterval(id)
  }, [])

  const healthColor = snap ? HEALTH_COLOR[snap.healthScore] ?? '#22c55e' : 'rgba(255,255,255,0.4)'
  const rec = snap ? getRecommendation(snap, onNavigate) : null

  const diskPct = snap && snap.disk.totalBytes > 0
    ? (snap.disk.usedBytes / snap.disk.totalBytes) * 100 : 0
  const memColor = snap && snap.memory.pressurePercent > 80 ? '#f97316'
    : snap && snap.memory.pressurePercent > 60 ? '#eab308' : '#a78bfa'
  const cpuColor = snap && snap.cpu.loadPercent > 80 ? '#ef4444'
    : snap && snap.cpu.loadPercent > 60 ? '#f97316' : '#67e8f9'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, height: '100%' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
            <span style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-0.03em' }}>
              Mac Health:
            </span>
            <span style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-0.03em', color: healthColor, transition: 'color 0.4s ease' }}>
              {loading ? '...' : snap?.healthScore ?? 'Checking'}
            </span>
            {!loading && snap && (
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: healthColor, boxShadow: `0 0 8px ${healthColor}`, marginLeft: 2, transition: 'background 0.4s ease' }} />
            )}
          </div>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)' }}>{snap?.macModel ?? 'Mac'}</div>
        </div>
        <MacIcon />
      </div>

      {/* FDA status */}
      {fdaGranted !== null && (
        <div
          onClick={fdaGranted ? undefined : () => window.electron.openFDASettings()}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '10px 16px', borderRadius: 12, cursor: fdaGranted ? 'default' : 'pointer',
            background: fdaGranted ? 'rgba(34,197,94,0.08)' : 'rgba(239,68,68,0.08)',
            border: `1px solid ${fdaGranted ? 'rgba(34,197,94,0.20)' : 'rgba(239,68,68,0.20)'}`,
          }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 20, height: 20, borderRadius: '50%', background: fdaGranted ? 'rgba(34,197,94,0.25)' : 'rgba(239,68,68,0.20)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {fdaGranted ? (
                <svg width="11" height="11" viewBox="0 0 11 11" fill="none" stroke="#22c55e" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M2 5.5l2.5 2.5 4.5-4.5"/>
                </svg>
              ) : (
                <svg width="11" height="11" viewBox="0 0 11 11" fill="none" stroke="#ef4444" strokeWidth="1.8" strokeLinecap="round">
                  <path d="M5.5 3v3M5.5 8h.01"/>
                </svg>
              )}
            </div>
            <span style={{ fontSize: 13, fontWeight: 500 }}>Full Disk Access</span>
          </div>
          <span style={{ fontSize: 12, color: fdaGranted ? '#86efac' : '#fca5a5', fontWeight: 600 }}>
            {fdaGranted ? 'Granted' : 'Grant Access'}
          </span>
        </div>
      )}

      {/* Disk + Memory row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <Widget>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
            <StorageIcon />
            <span style={{ fontSize: 14, fontWeight: 700 }}>Macintosh HD</span>
          </div>
          <div style={{ fontSize: 12, color: '#a78bfa', fontWeight: 600 }}>
            {snap ? `Available: ${fmtBytes(snap.disk.freeBytes)}` : '---'}
          </div>
          {snap && <StatBar value={diskPct} color={diskPct > 85 ? '#ef4444' : diskPct > 70 ? '#f97316' : `${theme.accent}CC`} />}
          <FreeUpButton onClick={() => onNavigate('space-lens')} />
        </Widget>

        <Widget>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
            <MemoryIcon />
            <span style={{ fontSize: 14, fontWeight: 700 }}>Memory</span>
          </div>
          <div style={{ fontSize: 12, fontWeight: 600, color: memColor }}>
            {snap ? `Pressure: ${snap.memory.pressurePercent}%` : '---'}
          </div>
          {snap && <StatBar value={snap.memory.pressurePercent} color={memColor} />}
          <FreeUpButton onClick={() => onNavigate('junk')} />
        </Widget>
      </div>

      {/* Battery + CPU row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <Widget>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <BatteryIcon pct={snap?.battery.percent ?? 100} />
              <span style={{ fontSize: 14, fontWeight: 700 }}>Battery</span>
            </div>
            <span style={{ fontSize: 18, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
              {snap ? `${snap.battery.percent}%` : '--'}
            </span>
          </div>
          <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)' }}>
            {!snap ? '' : snap.battery.fullyCharged ? 'Fully charged'
              : snap.battery.charging ? 'Charging…'
              : snap.battery.hasBattery ? 'On battery'
              : 'Plugged in'}
          </span>
        </Widget>

        <Widget>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <CpuIcon />
              <span style={{ fontSize: 14, fontWeight: 700 }}>CPU</span>
            </div>
            <span style={{ fontSize: 18, fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: cpuColor }}>
              {snap ? `${snap.cpu.loadPercent}%` : '--'}
            </span>
          </div>
          <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)' }}>
            {snap ? `Load: ${snap.cpu.loadPercent}%` : ''}
          </span>
          {snap && <StatBar value={snap.cpu.loadPercent} color={cpuColor} />}
        </Widget>
      </div>

      {/* Wi-Fi */}
      <Widget style={{ flexDirection: 'row', alignItems: 'center', gap: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginRight: 'auto' }}>
          <WifiIcon />
          <div>
            <div style={{ fontSize: 14, fontWeight: 700 }}>{snap?.network.ssid || 'Wi-Fi'}</div>
            {snap && (
              <div style={{ display: 'flex', gap: 14, marginTop: 3 }}>
                <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)' }}>
                  <span style={{ color: '#86efac' }}>↑</span> {fmtRate(snap.network.upKBps)}
                </span>
                <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)' }}>
                  <span style={{ color: '#67e8f9' }}>↓</span> {fmtRate(snap.network.downKBps)}
                </span>
              </div>
            )}
          </div>
        </div>
        <button style={{
          background: 'none', border: 'none', padding: 0,
          color: '#a78bfa', fontSize: 13, fontWeight: 700, cursor: 'pointer',
        }}>
          Test Speed
        </button>
      </Widget>

      {/* Connected devices */}
      {snap && snap.connectedDevices.length > 0 && (
        <Widget>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'rgba(255,255,255,0.70)', marginBottom: 6 }}>Connected Devices</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {snap.connectedDevices.map(dev => (
              <div key={dev.path} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                  <rect x="1" y="4" width="16" height="11" rx="2" fill="rgba(130,160,220,0.40)" stroke="rgba(160,190,255,0.40)" strokeWidth="1"/>
                  <rect x="1" y="11" width="16" height="4" rx="1" fill="rgba(100,130,190,0.30)"/>
                  <circle cx="3.5" cy="13" r="1.1" fill="rgba(160,190,255,0.65)"/>
                </svg>
                <span style={{ flex: 1, fontSize: 13, fontWeight: 500 }}>{dev.name}</span>
                {dev.path && <EjectButton path={dev.path} />}
              </div>
            ))}
          </div>
        </Widget>
      )}

      {/* Today's Recommendation */}
      {rec && (
        <Widget style={{ background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.18)' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'rgba(255,255,255,0.55)', marginBottom: 8 }}>
            Today's Recommendation
          </div>
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            <div style={{
              width: 40, height: 40, borderRadius: 12, flexShrink: 0,
              background: `${theme.accent}22`, border: `1px solid ${theme.accent}33`,
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20,
            }}>
              {rec.icon}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>{rec.title}</div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)', lineHeight: 1.5, marginBottom: 12 }}>{rec.body}</div>
              <button onClick={rec.onAction} style={{
                padding: '8px 18px', borderRadius: 10, fontSize: 13, fontWeight: 700,
                background: `linear-gradient(135deg, ${theme.accent}, ${theme.accent}AA)`,
                border: 'none', color: 'white', cursor: 'pointer',
                boxShadow: `0 4px 16px ${theme.accent}44`,
              }}>
                {rec.action}
              </button>
            </div>
          </div>
        </Widget>
      )}
    </div>
  )
}
