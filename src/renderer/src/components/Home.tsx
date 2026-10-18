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

function MacHero({ score }: { score: string }) {
  const { color, glow } = HEALTH[score] ?? HEALTH.Excellent
  // Expose raw tilt values so we can build a custom transform with tighter perspective + lift
  const { tilt, isResting, onMouseMove, onMouseLeave, tiltTransition } = useTilt(32)
  const transform = isResting
    ? 'perspective(450px) rotateX(0deg) rotateY(0deg) translateZ(0px)'
    : `perspective(450px) rotateX(${tilt.x}deg) rotateY(${tilt.y}deg) translateZ(10px)`

  return (
    <div
      onMouseMove={onMouseMove} onMouseLeave={onMouseLeave}
      style={{
        display: 'flex', justifyContent: 'center', alignItems: 'center',
        transform, transition: tiltTransition, cursor: 'default', willChange: 'transform',
        filter: `drop-shadow(0 20px 40px ${glow}) drop-shadow(0 6px 16px rgba(0,0,0,0.45))`,
      }}>
      <svg width="260" height="220" viewBox="0 0 260 220" fill="none">
        <defs>
          {/* White-glass gradients — lit from top-left */}
          <linearGradient id="macLid" x1="0" y1="0" x2="0.3" y2="1">
            <stop offset="0%"   stopColor="rgba(255,255,255,0.22)"/>
            <stop offset="100%" stopColor="rgba(255,255,255,0.08)"/>
          </linearGradient>
          <linearGradient id="macBase" x1="0" y1="0" x2="0.2" y2="1">
            <stop offset="0%"   stopColor="rgba(255,255,255,0.18)"/>
            <stop offset="100%" stopColor="rgba(255,255,255,0.07)"/>
          </linearGradient>
          <linearGradient id="macScreen" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#070e20"/>
            <stop offset="100%" stopColor="#020810"/>
          </linearGradient>
          <radialGradient id="macScreenGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%"   stopColor={color} stopOpacity="0.25"/>
            <stop offset="100%" stopColor={color} stopOpacity="0"/>
          </radialGradient>
          <filter id="macIndicatorGlow" x="-80%" y="-80%" width="260%" height="260%">
            <feGaussianBlur stdDeviation="4" result="b"/>
            <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
        </defs>

        {/* Ground shadow */}
        <ellipse cx="130" cy="214" rx="96" ry="6" fill="rgba(0,0,0,0.28)"/>

        {/* ── BASE / KEYBOARD ── */}
        <rect x="8" y="158" width="244" height="46" rx="10" fill="url(#macBase)"
          stroke="rgba(255,255,255,0.22)" strokeWidth="1"/>
        {/* Top-edge highlight (brightest) */}
        <rect x="8" y="158" width="244" height="2.5" rx="1.5" fill="rgba(255,255,255,0.50)"/>
        {/* Left-edge highlight */}
        <rect x="8" y="158" width="2" height="46" rx="1" fill="rgba(255,255,255,0.30)"/>
        {/* Bottom shadow line */}
        <rect x="14" y="200" width="232" height="3" rx="1.5" fill="rgba(0,0,0,0.18)"/>

        {/* Keyboard row hints */}
        <rect x="26" y="170" width="208" height="2.5" rx="1.5" fill="rgba(255,255,255,0.09)"/>
        <rect x="26" y="177" width="208" height="2.5" rx="1.5" fill="rgba(255,255,255,0.07)"/>
        <rect x="26" y="184" width="208" height="2.5" rx="1.5" fill="rgba(255,255,255,0.06)"/>

        {/* Trackpad */}
        <rect x="96" y="168" width="68" height="26" rx="5"
          fill="rgba(255,255,255,0.07)" stroke="rgba(255,255,255,0.16)" strokeWidth="0.8"/>
        {/* Trackpad sheen */}
        <rect x="96" y="168" width="68" height="6" rx="3" fill="rgba(255,255,255,0.06)"/>

        {/* ── HINGE ── */}
        <rect x="16" y="152" width="228" height="8" rx="3"
          fill="rgba(255,255,255,0.10)" stroke="rgba(255,255,255,0.14)" strokeWidth="0.5"/>
        <rect x="16" y="152" width="228" height="2" rx="1" fill="rgba(255,255,255,0.22)"/>

        {/* ── LID ── */}
        <rect x="14" y="10" width="232" height="144" rx="14" fill="url(#macLid)"
          stroke="rgba(255,255,255,0.28)" strokeWidth="1.5"/>
        {/* Top-edge highlight (primary specular) */}
        <rect x="14" y="10" width="232" height="3.5" rx="2" fill="rgba(255,255,255,0.55)"/>
        {/* Left-edge highlight */}
        <rect x="14" y="10" width="2" height="144" rx="1" fill="rgba(255,255,255,0.30)"/>
        {/* Inner specular — subtle sheen across lid face */}
        <rect x="20" y="16" width="220" height="40" rx="4"
          fill="rgba(255,255,255,0.05)"/>

        {/* Screen bezel */}
        <rect x="22" y="18" width="216" height="128" rx="8" fill="rgba(0,0,0,0.55)"/>
        {/* Screen panel */}
        <rect x="27" y="23" width="206" height="118" rx="5" fill="url(#macScreen)"/>
        {/* Screen health glow overlay */}
        <rect x="27" y="23" width="206" height="118" rx="5" fill="url(#macScreenGlow)"/>
        {/* Screen top sheen */}
        <rect x="27" y="23" width="206" height="20" rx="4"
          fill="rgba(255,255,255,0.03)"/>

        {/* Notch */}
        <rect x="112" y="10" width="36" height="9" rx="4.5" fill="rgba(0,0,0,0.55)"/>
        {/* Camera */}
        <circle cx="130" cy="14.5" r="3.2" fill="rgba(0,0,0,0.7)"
          stroke="rgba(255,255,255,0.10)" strokeWidth="0.5"/>
        <circle cx="130" cy="14.5" r="1.6" fill="rgba(60,60,80,0.9)"/>
        <circle cx="129.2" cy="13.7" r="0.6" fill="rgba(255,255,255,0.35)"/>

        {/* ── HEALTH INDICATOR on screen ── */}
        {/* Outer pulse ring */}
        <circle cx="130" cy="82" r="28" fill="none"
          stroke={color} strokeWidth="0.8" opacity="0.25"/>
        {/* Main ring */}
        <circle cx="130" cy="82" r="18" fill="none"
          stroke={color} strokeWidth="1.8" opacity="0.75" filter="url(#macIndicatorGlow)"/>
        {/* Inner fill halo */}
        <circle cx="130" cy="82" r="12" fill={color} opacity="0.10"/>
        {/* Center dot */}
        <circle cx="130" cy="82" r="6" fill={color} opacity="0.90" filter="url(#macIndicatorGlow)"/>
        {/* Specular on center dot */}
        <circle cx="128.5" cy="80.5" r="2" fill="rgba(255,255,255,0.70)"/>
      </svg>
    </div>
  )
}

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

// invert=true: bar is red when value is LOW (used for battery — high % is good)
function Bar({ pct, warn = 70, danger = 85, invert = false, accent }: {
  pct: number; warn?: number; danger?: number; invert?: boolean; accent: string
}) {
  const isBad  = invert ? pct <= danger : pct >= danger
  const isWarn = invert ? pct <= warn   : pct >= warn
  const color = isBad
    ? 'linear-gradient(90deg,#ef4444,#dc2626)'
    : isWarn
    ? 'linear-gradient(90deg,#f97316,#ea580c)'
    : `linear-gradient(90deg,${accent}99,${accent})`
  return (
    <div style={{ height: 5, background: 'rgba(255,255,255,0.09)', borderRadius: 3, overflow: 'hidden' }}>
      <div style={{ height: '100%', width: `${Math.min(100, pct)}%`, background: color,
        borderRadius: 3, transition: 'width 0.8s ease' }}/>
    </div>
  )
}

// Color helpers — value text only, no bars
function pressureColor(pct: number) {
  return pct >= 80 ? '#f87171' : pct >= 60 ? '#fb923c' : 'rgba(255,255,255,0.90)'
}
function loadColor(pct: number) {
  return pct >= 80 ? '#f87171' : pct >= 60 ? '#fb923c' : 'rgba(255,255,255,0.90)'
}
function batteryColor(pct: number, charging: boolean) {
  if (charging) return '#4ade80'
  return pct <= 10 ? '#f87171' : pct <= 25 ? '#fb923c' : 'rgba(255,255,255,0.90)'
}

// Icon-row tile: no bars, just icon + label + value (CleanMyMac style)
function MetricTile({ icon, label, value, sub, valueColor, action, onAction }: {
  icon: React.ReactNode; label: string; value: string
  sub?: string; valueColor?: string; action?: string; onAction?: () => void
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <div style={{
        width: 34, height: 34, borderRadius: 9, flexShrink: 0,
        background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.08)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: 'rgba(255,255,255,0.55)',
      }}>
        {icon}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', fontWeight: 500 }}>{label}</div>
        {sub && <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.28)', marginTop: 1 }}>{sub}</div>}
      </div>
      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        <div style={{
          fontSize: 16, fontWeight: 700, fontVariantNumeric: 'tabular-nums',
          color: valueColor ?? 'rgba(255,255,255,0.90)',
          transition: 'color 0.4s',
        }}>{value}</div>
        {action && (
          <button onClick={onAction} style={{
            fontSize: 10, fontWeight: 700, color: '#818cf8',
            background: 'none', border: 'none', padding: 0, cursor: 'pointer',
            letterSpacing: '0.02em',
          }}>{action}</button>
        )}
      </div>
    </div>
  )
}

interface Props {
  snap: SystemSnapshot | null
  totalFreed: number
  fdaGranted: boolean | null
  onNavigate: (page: Page) => void
  theme: PageTheme
}

// Pure display — all data arrives as props from App. No self-polling.
export default function Home({ snap, totalFreed, fdaGranted, onNavigate, theme }: Props) {
  const score = snap?.healthScore ?? 'Excellent'
  const { color: healthColor } = HEALTH[score] ?? HEALTH.Excellent
  const diskUsedPct = snap && snap.disk.totalBytes > 0
    ? (snap.disk.usedBytes / snap.disk.totalBytes) * 100 : 0
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

      <div>
        <h1 style={{ margin: 0, fontSize: 32, fontWeight: 800, letterSpacing: '-0.03em' }}>
          Mac Health
        </h1>
        <p style={{ margin: '4px 0 0', fontSize: 13, color: 'rgba(255,255,255,0.40)' }}>
          Real-time system overview
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, flex: 1, minHeight: 0 }}>

        {/* LEFT: Health hero */}
        <Card style={{ display: 'flex', flexDirection: 'column', gap: 16, position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: -40, right: -40, width: 250, height: 250,
            borderRadius: '50%', background: `${healthColor}0E`, pointerEvents: 'none',
            transition: 'background 0.6s ease' }} />

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

          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <MacHero score={score} />
          </div>

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 600 }}>Macintosh HD</span>
              <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)' }}>
                {snap ? `${fmtBytes(snap.disk.usedBytes)} of ${fmtBytes(snap.disk.totalBytes)} used` : ''}
              </span>
            </div>
            <Bar pct={diskUsedPct} warn={80} danger={90} accent={healthColor} />
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

        {/* RIGHT column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

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

          <Card style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em',
              textTransform: 'uppercase', color: 'rgba(255,255,255,0.40)' }}>
              Live Metrics
            </div>
            {snap ? (
              <>
                <MetricTile
                  icon={<svg width="15" height="15" viewBox="0 0 15 15" fill="none"><rect x="1" y="4.5" width="13" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.3"/><rect x="3.5" y="6.5" width="1.5" height="2" rx="0.5" fill="currentColor"/><rect x="6.5" y="6.5" width="1.5" height="2" rx="0.5" fill="currentColor"/><rect x="9.5" y="6.5" width="1.5" height="2" rx="0.5" fill="currentColor"/><rect x="0" y="7" width="1" height="1.5" fill="currentColor"/><rect x="14" y="7" width="1" height="1.5" fill="currentColor"/></svg>}
                  label="Memory" value={`${snap.memory.pressurePercent}%`}
                  sub="pressure" valueColor={pressureColor(snap.memory.pressurePercent)}
                  action="Free Up" onAction={() => onNavigate('junk')}
                />
                <MetricTile
                  icon={<svg width="15" height="15" viewBox="0 0 15 15" fill="none"><rect x="2" y="2" width="11" height="11" rx="2.5" stroke="currentColor" strokeWidth="1.3"/><rect x="5" y="5" width="5" height="5" rx="1" fill="currentColor" opacity="0.6"/></svg>}
                  label="CPU" value={`${snap.cpu.loadPercent}%`}
                  sub="load" valueColor={loadColor(snap.cpu.loadPercent)}
                />
                <MetricTile
                  icon={<svg width="15" height="15" viewBox="0 0 15 15" fill="none"><rect x="1.5" y="3.5" width="11" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.3"/><rect x="12.5" y="6" width="1.5" height="3" rx="0.75" fill="currentColor" opacity="0.5"/><rect x="3" y="5" width={`${Math.round(snap.battery.percent / 14)}`} height="4" rx="0.8" fill="currentColor"/></svg>}
                  label="Battery" value={`${snap.battery.percent}%`}
                  sub={snap.battery.fullyCharged ? 'Fully charged' : snap.battery.charging ? 'Charging' : 'On battery'}
                  valueColor={batteryColor(snap.battery.percent, snap.battery.charging)}
                />
                <div style={{ height: 1, background: 'rgba(255,255,255,0.07)' }} />
                <MetricTile
                  icon={<svg width="15" height="15" viewBox="0 0 15 15" fill="none"><path d="M1 5.5C3.5 2.5 11.5 2.5 14 5.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/><path d="M3 8C4.8 6 10.2 6 12 8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/><path d="M5.5 10.5C6.5 9.5 8.5 9.5 9.5 10.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/><circle cx="7.5" cy="13" r="1" fill="currentColor"/></svg>}
                  label={snap.network.ssid || 'Wi-Fi'}
                  value={`↑ ${fmtRate(snap.network.upKBps)}`}
                  sub={`↓ ${fmtRate(snap.network.downKBps)}`}
                />
                {snap.connectedDevices.length > 0 && (
                  <>
                    <div style={{ height: 1, background: 'rgba(255,255,255,0.07)' }} />
                    {snap.connectedDevices.map(d => (
                      <MetricTile key={d.path}
                        icon={<svg width="15" height="15" viewBox="0 0 15 15" fill="none"><rect x="4" y="1" width="7" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.3"/><path d="M2 11h11" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/><ellipse cx="7.5" cy="13.5" rx="3" ry="1" stroke="currentColor" strokeWidth="1"/></svg>}
                        label={d.name} value="External" valueColor="rgba(255,255,255,0.50)"
                      />
                    ))}
                  </>
                )}
              </>
            ) : (
              <div style={{ color: 'rgba(255,255,255,0.25)', fontSize: 13 }}>Loading...</div>
            )}
          </Card>
        </div>
      </div>

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
