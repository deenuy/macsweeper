import { useState, useEffect } from 'react'
import type { SystemSnapshot } from '../../../shared/types'
import type { Page, PageTheme } from '../App'
import { useTilt } from '../hooks/useTilt'

function fmtBytes(n: number): string {
  if (n >= 1e12) return (n / 1e12).toFixed(2) + ' TB'
  if (n >= 1e9) return (n / 1e9).toFixed(1) + ' GB'
  if (n >= 1e6) return (n / 1e6).toFixed(0) + ' MB'
  return (n / 1e3).toFixed(0) + ' KB'
}

function fmtRate(kbps: number): string {
  if (kbps >= 1024) return (kbps / 1024).toFixed(1) + ' MB/s'
  return kbps.toFixed(0) + ' KB/s'
}

const HEALTH: Record<string, { color: string; glow: string }> = {
  Excellent: { color: '#22d3ee', glow: 'rgba(34,211,238,0.35)' },
  Good:      { color: '#22c55e', glow: 'rgba(34,197,94,0.30)' },
  Fair:      { color: '#f97316', glow: 'rgba(249,115,22,0.30)' },
  Poor:      { color: '#ef4444', glow: 'rgba(239,68,68,0.30)' },
}

// ── MacBook hero illustration ──────────────────────────────────────────────
function MacHero({ score }: { score: string }) {
  const { color, glow } = HEALTH[score] ?? HEALTH.Excellent
  const { onMouseMove, onMouseLeave, tiltTransform, tiltTransition } = useTilt(22)

  return (
    <div
      onMouseMove={onMouseMove} onMouseLeave={onMouseLeave}
      style={{ display: 'flex', justifyContent: 'center', alignItems: 'center',
        transform: tiltTransform, transition: tiltTransition, cursor: 'default' }}>
      <div style={{ position: 'relative', width: 240, height: 210 }}>
        {/* Outer ambient glow */}
        <div style={{ position: 'absolute', inset: -24, borderRadius: '50%',
          background: `radial-gradient(circle, ${glow} 0%, transparent 65%)`,
          transition: 'background 0.6s ease' }} />

        <svg width="240" height="210" viewBox="0 0 240 210" fill="none" style={{ position: 'relative', zIndex: 1 }}>
          <defs>
            <radialGradient id="hRing" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor={color} stopOpacity="0"/>
              <stop offset="70%" stopColor={color} stopOpacity="0.5"/>
              <stop offset="100%" stopColor={color} stopOpacity="0"/>
            </radialGradient>
            <linearGradient id="hLid" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#1e2d4e"/>
              <stop offset="100%" stopColor="#0a1628"/>
            </linearGradient>
            <linearGradient id="hScreen" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#1e3a6e" stopOpacity="0.9"/>
              <stop offset="100%" stopColor="#0e4a5e" stopOpacity="0.7"/>
            </linearGradient>
            <linearGradient id="hBase" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#1a2540"/>
              <stop offset="100%" stopColor="#0e1a30"/>
            </linearGradient>
            <filter id="hGlow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="4" result="b"/>
              <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
            </filter>
          </defs>

          {/* Glowing ring */}
          <ellipse cx="120" cy="112" rx="82" ry="72" fill="none"
            stroke={color} strokeWidth="1.5" opacity="0.45" filter="url(#hGlow)"/>
          <ellipse cx="120" cy="112" rx="66" ry="56" fill="none"
            stroke={color} strokeWidth="0.8" opacity="0.25"/>

          {/* Screen lid */}
          <rect x="32" y="22" width="176" height="118" rx="10"
            fill="url(#hLid)" stroke="rgba(255,255,255,0.10)" strokeWidth="1"/>
          {/* Screen */}
          <rect x="40" y="30" width="160" height="102" rx="5" fill="#050c1e"/>
          {/* Screen content glow */}
          <rect x="46" y="36" width="148" height="90" rx="3" fill="url(#hScreen)"/>
          {/* Screen highlight */}
          <rect x="46" y="36" width="148" height="16" rx="3"
            fill="rgba(255,255,255,0.04)"/>
          {/* Notch */}
          <rect x="104" y="22" width="32" height="6" rx="3" fill="#050c1e"/>
          {/* Camera */}
          <circle cx="120" cy="25" r="2.5" fill="rgba(255,255,255,0.12)"/>

          {/* Screen icon */}
          <circle cx="120" cy="83" r="18" fill={color} opacity="0.12"/>
          <circle cx="120" cy="83" r="10" fill="none"
            stroke={color} strokeWidth="2.5" opacity="0.8"/>
          <circle cx="120" cy="83" r="3.5" fill={color} opacity="0.9"/>

          {/* Hinge line */}
          <rect x="32" y="140" width="176" height="4" rx="2"
            fill="rgba(255,255,255,0.04)"/>
          {/* Base/keyboard */}
          <rect x="20" y="144" width="200" height="34" rx="6"
            fill="url(#hBase)" stroke="rgba(255,255,255,0.08)" strokeWidth="1"/>
          {/* Keyboard hint */}
          <rect x="36" y="152" width="56" height="4" rx="2" fill="rgba(255,255,255,0.05)"/>
          <rect x="100" y="152" width="40" height="4" rx="2" fill="rgba(255,255,255,0.04)"/>
          <rect x="148" y="152" width="56" height="4" rx="2" fill="rgba(255,255,255,0.05)"/>
          <rect x="36" y="160" width="168" height="4" rx="2" fill="rgba(255,255,255,0.04)"/>
          {/* Trackpad */}
          <rect x="90" y="166" width="60" height="8" rx="2.5"
            fill="rgba(255,255,255,0.05)" stroke="rgba(255,255,255,0.07)" strokeWidth="0.5"/>
          {/* Bottom edge */}
          <rect x="20" y="178" width="200" height="4" rx="2"
            fill="rgba(0,0,0,0.35)"/>
        </svg>
      </div>
    </div>
  )
}

// ── Shared card wrapper ────────────────────────────────────────────────────
function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{
      background: 'rgba(0,0,0,0.22)',
      backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
      border: '1px solid rgba(255,255,255,0.10)',
      borderRadius: 16, padding: '20px 22px',
      ...style,
    }}>
      {children}
    </div>
  )
}

// ── Gradient bar ───────────────────────────────────────────────────────────
function Bar({ pct, warn = 70, danger = 85 }: { pct: number; warn?: number; danger?: number }) {
  const color = pct >= danger
    ? 'linear-gradient(90deg,#ef4444,#dc2626)'
    : pct >= warn
    ? 'linear-gradient(90deg,#f97316,#ea580c)'
    : 'linear-gradient(90deg,#6366f1,#8b5cf6)'
  return (
    <div style={{ height: 5, background: 'rgba(255,255,255,0.09)', borderRadius: 3, overflow: 'hidden' }}>
      <div style={{ height: '100%', width: `${Math.min(100, pct)}%`, background: color,
        borderRadius: 3, transition: 'width 0.8s ease' }}/>
    </div>
  )
}

// ── Metric row ─────────────────────────────────────────────────────────────
function MetricRow({ label, value, sub, pct, warn, danger }: {
  label: string; value: string; sub?: string; pct?: number; warn?: number; danger?: number
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', fontWeight: 500 }}>{label}</span>
        <span style={{ fontSize: 15, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{value}</span>
      </div>
      {pct !== undefined && <Bar pct={pct} warn={warn} danger={danger} />}
      {sub && <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.30)' }}>{sub}</span>}
    </div>
  )
}

interface Props {
  onNavigate: (page: Page) => void
  theme: PageTheme
}

export default function Home({ onNavigate, theme }: Props) {
  const [snap, setSnap] = useState<SystemSnapshot | null>(null)
  const [totalFreed, setTotalFreed] = useState(0)
  const [fdaGranted, setFdaGranted] = useState<boolean | null>(null)

  useEffect(() => {
    window.electron.checkFDA().then(setFdaGranted).catch(() => setFdaGranted(true))
    window.electron.getTotalFreed().then(setTotalFreed).catch(() => {})
    const load = () => window.electron.getSystemSnapshot().then(setSnap).catch(() => {})
    load()
    const id = setInterval(load, 4000)
    return () => clearInterval(id)
  }, [])

  const score = snap?.healthScore ?? 'Excellent'
  const { color: healthColor } = HEALTH[score] ?? HEALTH.Excellent
  const diskUsedPct = snap && snap.disk.totalBytes > 0
    ? (snap.disk.usedBytes / snap.disk.totalBytes) * 100 : 0

  // Contextual recommendation
  const diskFreePct = snap && snap.disk.totalBytes > 0
    ? (snap.disk.freeBytes / snap.disk.totalBytes) * 100 : 50
  const rec = snap
    ? diskFreePct < 10
      ? { icon: '💽', title: 'Storage running low',
          body: `Only ${fmtBytes(snap.disk.freeBytes)} free.`,
          action: 'Clean Now', nav: 'junk' as Page }
      : snap.memory.pressurePercent > 75
      ? { icon: '🧠', title: 'High memory pressure',
          body: `Pressure at ${snap.memory.pressurePercent}%.`,
          action: 'Clean Caches', nav: 'junk' as Page }
      : totalFreed === 0
      ? { icon: '✨', title: 'Run your first scan',
          body: 'Find hidden junk and free up space.',
          action: 'Start Scan', nav: 'junk' as Page }
      : { icon: '🔍', title: 'Mac looks healthy',
          body: `${fmtBytes(totalFreed)} freed lifetime.`,
          action: 'Scan Again', nav: 'junk' as Page }
    : null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, height: '100%' }}>

      {/* Page title */}
      <div>
        <h1 style={{ margin: 0, fontSize: 32, fontWeight: 800, letterSpacing: '-0.03em' }}>
          Mac Health
        </h1>
        <p style={{ margin: '4px 0 0', fontSize: 13, color: 'rgba(255,255,255,0.40)' }}>
          Real-time system overview
        </p>
      </div>

      {/* Main two-column grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, flex: 1, minHeight: 0 }}>

        {/* LEFT: Health hero */}
        <Card style={{ display: 'flex', flexDirection: 'column', gap: 16, position: 'relative', overflow: 'hidden' }}>
          {/* Ambient background glow matching health color */}
          <div style={{ position: 'absolute', top: -40, right: -40, width: 250, height: 250,
            borderRadius: '50%', background: `${healthColor}0E`, pointerEvents: 'none',
            transition: 'background 0.6s ease' }} />

          {/* Score */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 2 }}>
              <span style={{ fontSize: 15, color: 'rgba(255,255,255,0.55)', fontWeight: 600 }}>Mac Health:</span>
              <span style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-0.02em',
                color: healthColor, transition: 'color 0.4s' }}>
                {snap ? score : '...'}
              </span>
              <div style={{ width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                background: healthColor, boxShadow: `0 0 8px ${healthColor}`,
                transition: 'all 0.4s' }} />
            </div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)' }}>
              {snap?.macModel ?? 'Mac'}
            </div>
          </div>

          {/* Mac illustration - hero element */}
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <MacHero score={score} />
          </div>

          {/* Disk bar */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 600 }}>Macintosh HD</span>
              <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)' }}>
                {snap ? `${fmtBytes(snap.disk.usedBytes)} of ${fmtBytes(snap.disk.totalBytes)} used` : ''}
              </span>
            </div>
            <Bar pct={diskUsedPct} warn={70} danger={85} />
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 7 }}>
              <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.40)' }}>
                {snap ? `${fmtBytes(snap.disk.freeBytes)} free` : ''}
              </span>
              <button onClick={() => onNavigate('space-lens')} style={{
                background: 'none', border: 'none', padding: 0,
                color: healthColor, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                Free Up
              </button>
            </div>
          </div>

          {/* FDA pill */}
          {fdaGranted !== null && (
            <button
              onClick={fdaGranted ? undefined : () => window.electron.openFDASettings()}
              style={{
                display: 'flex', alignItems: 'center', gap: 6, alignSelf: 'flex-start',
                padding: '5px 12px', borderRadius: 20, cursor: fdaGranted ? 'default' : 'pointer',
                background: fdaGranted ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)',
                border: `1px solid ${fdaGranted ? 'rgba(34,197,94,0.30)' : 'rgba(239,68,68,0.30)'}`,
                color: fdaGranted ? '#86efac' : '#fca5a5', fontSize: 12, fontWeight: 600,
              }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%',
                background: fdaGranted ? '#22c55e' : '#ef4444' }} />
              Full Disk Access {fdaGranted ? 'Granted' : 'Required'}
            </button>
          )}
        </Card>

        {/* RIGHT: Metrics + Storage */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Storage cleaned card */}
          <Card style={{ position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', bottom: -30, right: -30, width: 130, height: 130,
              borderRadius: '50%', background: `${theme.accent}10`, pointerEvents: 'none' }} />
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em',
              textTransform: 'uppercase', color: 'rgba(255,255,255,0.40)', marginBottom: 10 }}>
              Local Storage Cleaned
            </div>
            <div style={{ fontSize: 38, fontWeight: 800, letterSpacing: '-0.04em', lineHeight: 1,
              fontVariantNumeric: 'tabular-nums', marginBottom: 4 }}>
              {totalFreed > 0 ? fmtBytes(totalFreed) : '--'}
            </div>
            <div style={{ fontSize: 12, color: totalFreed > 0 ? '#86efac' : 'rgba(255,255,255,0.35)',
              marginBottom: 14 }}>
              {totalFreed > 0 ? 'lifetime total freed' : 'run a scan to start'}
            </div>
            <button onClick={() => onNavigate('junk')} style={{
              padding: '8px 20px', borderRadius: 10, fontSize: 13, fontWeight: 700,
              background: `linear-gradient(135deg, ${theme.accent}, ${theme.accent}BB)`,
              border: 'none', color: 'white', cursor: 'pointer',
              boxShadow: `0 4px 18px ${theme.accent}40` }}>
              Run Cleanup
            </button>
          </Card>

          {/* Live metrics card */}
          <Card style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em',
              textTransform: 'uppercase', color: 'rgba(255,255,255,0.40)' }}>
              Live Metrics
            </div>
            {snap ? (
              <>
                <MetricRow label="Memory Pressure" value={`${snap.memory.pressurePercent}%`}
                  pct={snap.memory.pressurePercent} warn={60} danger={80} />
                <MetricRow label="CPU Load" value={`${snap.cpu.loadPercent}%`}
                  pct={snap.cpu.loadPercent} warn={60} danger={80} />
                <MetricRow label="Battery" value={`${snap.battery.percent}%`}
                  sub={snap.battery.fullyCharged ? 'Fully charged' : snap.battery.charging ? 'Charging' : 'On battery'}
                  pct={snap.battery.percent} warn={25} danger={10} />
                <div style={{ height: 1, background: 'rgba(255,255,255,0.07)', margin: '2px 0' }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.40)', marginBottom: 4 }}>
                      {snap.network.ssid || 'Wi-Fi'}
                    </div>
                    <div style={{ display: 'flex', gap: 14 }}>
                      <span style={{ fontSize: 12 }}><span style={{ color: '#86efac' }}>↑</span> {fmtRate(snap.network.upKBps)}</span>
                      <span style={{ fontSize: 12 }}><span style={{ color: '#67e8f9' }}>↓</span> {fmtRate(snap.network.downKBps)}</span>
                    </div>
                  </div>
                  {snap.connectedDevices.length > 0 && (
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginBottom: 3 }}>External</div>
                      {snap.connectedDevices.map(d => (
                        <div key={d.path} style={{ fontSize: 12, color: 'rgba(255,255,255,0.65)' }}>{d.name}</div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div style={{ color: 'rgba(255,255,255,0.25)', fontSize: 13 }}>Loading...</div>
            )}
          </Card>
        </div>
      </div>

      {/* Recommendation strip */}
      {rec && (
        <Card style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '14px 22px' }}>
          <div style={{
            width: 40, height: 40, borderRadius: 12, flexShrink: 0, fontSize: 20,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: `${theme.accent}18`, border: `1px solid ${theme.accent}28` }}>
            {rec.icon}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 700 }}>{rec.title}</div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', marginTop: 2 }}>{rec.body}</div>
          </div>
          <button onClick={() => onNavigate(rec.nav)} style={{
            flexShrink: 0, padding: '8px 20px', borderRadius: 10, fontSize: 13, fontWeight: 700,
            background: `linear-gradient(135deg, ${theme.accent}, ${theme.accent}BB)`,
            border: 'none', color: 'white', cursor: 'pointer',
            boxShadow: `0 4px 16px ${theme.accent}38` }}>
            {rec.action}
          </button>
        </Card>
      )}
    </div>
  )
}
