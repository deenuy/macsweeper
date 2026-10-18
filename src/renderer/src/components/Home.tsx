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
  const { tilt, isResting, onMouseMove, onMouseLeave, tiltTransition } = useTilt(10)

  // perspective is a CSS *property* on the parent — not inside transform —
  // so the child's rotateY actually renders in 3D context.
  const tiltTransform = `rotateX(${tilt.x * 0.4}deg) rotateY(${tilt.y * 0.4}deg)`

  return (
    <>
      <style>{`
        @keyframes iMacFloat {
          0%,100% { transform: translateY(0px) rotateY(-4deg); }
          50%      { transform: translateY(-10px) rotateY(4deg); }
        }
      `}</style>
      {/* perspective on the parent gives children a real 3D rendering context */}
      <div
        onMouseMove={onMouseMove} onMouseLeave={onMouseLeave}
        style={{
          display: 'flex', justifyContent: 'center', alignItems: 'center',
          perspective: '1000px',
          cursor: 'default',
        }}>
        <div style={{
          transform: isResting ? undefined : tiltTransform,
          transition: tiltTransition,
          animation: isResting ? 'iMacFloat 4.2s ease-in-out infinite' : 'none',
          filter: `drop-shadow(-10px 28px 50px ${glow}) drop-shadow(-3px 10px 20px rgba(0,0,0,0.60))`,
          willChange: 'transform',
        }}>
          {/*
            ┌─────────────────────────────────────────────────────────────────┐
            │  iMAC G3-STYLE: viewed from upper-left                          │
            │  Depth axis goes upper-right: (+0.48, -0.28) per unit back      │
            │  LEFT side panel is the near face (correctly facing viewer)      │
            │                                                                  │
            │  Key paths:                                                      │
            │    Left panel:  (8,46)→(8,182)→(80,200)→(80,22)                 │
            │    Front face:  (80,22)→(242,34)→(242,204)→(80,200)             │
            │    Top strip:   (80,22)→(242,34)→(246,27)→(84,15)              │
            │    Stand:       foot below body                                  │
            └─────────────────────────────────────────────────────────────────┘
          */}
          <svg width="275" height="218" viewBox="0 0 275 218" fill="none">
            <defs>
              {/* LEFT PANEL — richest purple, primary 3D face, lit upper-left */}
              <radialGradient id="igLeft" cx="30%" cy="20%" r="70%">
                <stop offset="0%"   stopColor="rgba(198,165,255,0.75)"/>
                <stop offset="38%"  stopColor="rgba(140,102,238,0.52)"/>
                <stop offset="100%" stopColor="rgba(48,22,128,0.30)"/>
              </radialGradient>
              {/* Left panel specular — top-left bright lobe (suggests curved glass) */}
              <radialGradient id="igLeftSpec" cx="26%" cy="16%" r="48%">
                <stop offset="0%"   stopColor="rgba(255,255,255,0.50)"/>
                <stop offset="60%"  stopColor="rgba(255,255,255,0.08)"/>
                <stop offset="100%" stopColor="rgba(255,255,255,0)"/>
              </radialGradient>
              {/* FRONT FACE — lighter glass (slightly more face-on, less saturated) */}
              <radialGradient id="igFront" cx="16%" cy="13%" r="76%">
                <stop offset="0%"   stopColor="rgba(228,208,255,0.54)"/>
                <stop offset="44%"  stopColor="rgba(168,138,248,0.22)"/>
                <stop offset="100%" stopColor="rgba(68,40,158,0.09)"/>
              </radialGradient>
              <radialGradient id="igFrontSpec" cx="18%" cy="10%" r="52%">
                <stop offset="0%"   stopColor="rgba(255,255,255,0.58)"/>
                <stop offset="34%"  stopColor="rgba(255,255,255,0.12)"/>
                <stop offset="100%" stopColor="rgba(255,255,255,0)"/>
              </radialGradient>
              {/* Health color spills from screen onto front face */}
              <radialGradient id="igFrontGlow" cx="53%" cy="53%" r="42%">
                <stop offset="0%"   stopColor={color} stopOpacity="0.22"/>
                <stop offset="100%" stopColor={color} stopOpacity="0"/>
              </radialGradient>
              {/* TOP STRIP — brightest (lit from above) */}
              <linearGradient id="igTop" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%"   stopColor="rgba(222,206,255,0.75)"/>
                <stop offset="100%" stopColor="rgba(148,118,238,0.38)"/>
              </linearGradient>
              {/* SCREEN */}
              <radialGradient id="igScreen" cx="50%" cy="52%" r="56%">
                <stop offset="0%"   stopColor="#0d1020"/>
                <stop offset="100%" stopColor="#030508"/>
              </radialGradient>
              <radialGradient id="igBloom" cx="50%" cy="50%" r="52%">
                <stop offset="0%"   stopColor={color} stopOpacity="0.72"/>
                <stop offset="46%"  stopColor={color} stopOpacity="0.22"/>
                <stop offset="100%" stopColor={color} stopOpacity="0"/>
              </radialGradient>
              <linearGradient id="igSheen" x1="0" y1="0" x2="0.18" y2="1">
                <stop offset="0%"   stopColor="rgba(255,255,255,0.15)"/>
                <stop offset="36%"  stopColor="rgba(255,255,255,0.03)"/>
                <stop offset="100%" stopColor="rgba(255,255,255,0)"/>
              </linearGradient>
              {/* STAND */}
              <linearGradient id="igStand" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%"   stopColor="rgba(168,135,252,0.48)"/>
                <stop offset="100%" stopColor="rgba(58,32,145,0.22)"/>
              </linearGradient>
              <filter id="igGlow" x="-100%" y="-100%" width="300%" height="300%">
                <feGaussianBlur stdDeviation="5" result="b"/>
                <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
              </filter>
              <filter id="igBlur" x="-40%" y="-40%" width="180%" height="180%">
                <feGaussianBlur stdDeviation="4"/>
              </filter>
              <clipPath id="igScreenClip">
                <polygon points="98,43 232,50 232,189 98,182"/>
              </clipPath>
            </defs>

            {/* Ground shadow — centred under body */}
            <ellipse cx="148" cy="215" rx="112" ry="7" fill="rgba(0,0,0,0.42)" filter="url(#igBlur)"/>

            {/* ══ TOP STRIP (facing up, lit from above) ═══════════════════ */}
            <path d="M 80,22 L 242,34 L 246,27 L 84,15 Z" fill="url(#igTop)"/>
            <line x1="80" y1="22" x2="242" y2="34" stroke="rgba(255,255,255,0.52)" strokeWidth="1.6"/>
            <line x1="80" y1="22" x2="84" y2="15"  stroke="rgba(255,255,255,0.36)" strokeWidth="1.2"/>

            {/* ══ LEFT PANEL (the near side face — key 3D depth cue) ══════ */}
            {/* Rounded body shape: left edge has curved corners */}
            <path d="M 80,22
                     L 16,30 C 8,32 6,40 6,48
                     L 6,178 C 6,188 10,194 18,196
                     L 80,200 Z"
              fill="url(#igLeft)"/>
            <path d="M 80,22
                     L 16,30 C 8,32 6,40 6,48
                     L 6,178 C 6,188 10,194 18,196
                     L 80,200 Z"
              fill="url(#igLeftSpec)"/>
            {/* Diagonal gloss sweep — characteristic iMac G3 reflection */}
            <path d="M 14,36 L 44,26 L 80,58 L 50,68 Z"
              fill="rgba(255,255,255,0.13)" style={{ mixBlendMode: 'screen' }}/>
            {/* Left outer edge highlight */}
            <path d="M 16,30 C 8,32 6,40 6,48 L 6,165"
              stroke="rgba(255,255,255,0.44)" strokeWidth="2" fill="none" strokeLinecap="round"/>
            {/* Top edge of left panel */}
            <line x1="16" y1="30" x2="80" y2="22" stroke="rgba(255,255,255,0.46)" strokeWidth="1.6"/>

            {/* ══ FRONT FACE (screen side) ════════════════════════════════ */}
            <path d="M 80,22
                     L 242,34 C 248,35 252,40 252,47
                     L 252,196 C 252,203 248,207 242,205
                     L 80,200 Z"
              fill="url(#igFront)"/>
            <path d="M 80,22
                     L 242,34 C 248,35 252,40 252,47
                     L 252,196 C 252,203 248,207 242,205
                     L 80,200 Z"
              fill="url(#igFrontGlow)"/>
            <path d="M 80,22
                     L 242,34 C 248,35 252,40 252,47
                     L 252,196 C 252,203 248,207 242,205
                     L 80,200 Z"
              fill="url(#igFrontSpec)"/>
            {/* Left rim — seam between left panel and front face */}
            <line x1="80" y1="22" x2="80" y2="200" stroke="rgba(255,255,255,0.32)" strokeWidth="2"/>
            {/* Bottom seam */}
            <line x1="84" y1="200" x2="238" y2="205" stroke="rgba(0,0,0,0.20)" strokeWidth="1.8"/>

            {/* ── SCREEN BEZEL ─────────────────────────────────────────── */}
            <polygon points="92,36 238,44 238,196 92,188" fill="rgba(0,0,0,0.70)"/>

            {/* ── SCREEN PANEL ─────────────────────────────────────────── */}
            <polygon points="98,43 232,50 232,189 98,182" fill="url(#igScreen)"/>
            <polygon points="98,43 232,50 232,189 98,182" fill="url(#igBloom)"/>
            <polygon points="98,43 232,50 232,189 98,182" fill="url(#igSheen)"/>

            {/* ── CAMERA (top center of front bezel) ───────────────────── */}
            <circle cx="162" cy="29" r="3.4" fill="rgba(5,5,18,0.88)"
              stroke="rgba(255,255,255,0.08)" strokeWidth="0.5"/>
            <circle cx="162" cy="29" r="1.7" fill="rgba(22,16,52,0.95)"/>
            <circle cx="160.8" cy="27.8" r="0.65" fill="rgba(255,255,255,0.46)"/>

            {/* ── HEALTH INDICATOR (clipped to screen panel) ───────────── */}
            {/* Screen center: x=(98+232)/2=165, y=(43+189)/2=116 */}
            <g clipPath="url(#igScreenClip)">
              <circle cx="165" cy="116" r="44" fill={color} opacity="0.09" filter="url(#igBlur)"/>
              <circle cx="165" cy="116" r="32" fill="none" stroke={color} strokeWidth="0.7" opacity="0.30"/>
              <circle cx="165" cy="116" r="21" fill="none" stroke={color} strokeWidth="1.5" opacity="0.68" filter="url(#igGlow)"/>
              <circle cx="165" cy="116" r="13" fill={color} opacity="0.13"/>
              <circle cx="165" cy="116" r="7"  fill={color} opacity="0.96" filter="url(#igGlow)"/>
              <circle cx="163.2" cy="114.2" r="2.4" fill="rgba(255,255,255,0.84)"/>
            </g>

            {/* ══ STAND / FOOT ════════════════════════════════════════════ */}
            {/* Left side of stand */}
            <path d="M 80,200 L 106,206 L 102,216 L 80,208 Z"
              fill="rgba(82,50,182,0.58)"/>
            {/* Front of stand */}
            <path d="M 106,206 L 214,212 L 210,220 L 102,216 Z"
              fill="url(#igStand)"/>
            {/* Stand top rim */}
            <line x1="80" y1="200" x2="214" y2="212"
              stroke="rgba(202,180,255,0.36)" strokeWidth="1.2"/>
          </svg>
        </div>
      </div>
    </>
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
