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

function today(): string {
  return new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}

const HEALTH_COLOR: Record<string, string> = {
  Excellent: '#22d3ee',
  Good:      '#22c55e',
  Fair:      '#f97316',
  Poor:      '#ef4444',
}

// ── Mac laptop illustration with glowing ring ──────────────────────────────
function MacIllustration({ health }: { health: string }) {
  const glowColor = HEALTH_COLOR[health] ?? '#22d3ee'
  return (
    <div style={{ position: 'relative', width: 160, height: 140, flexShrink: 0 }}>
      {/* Outer glow ring */}
      <div style={{
        position: 'absolute', inset: 0, borderRadius: '50%',
        background: `radial-gradient(circle, ${glowColor}22 0%, transparent 70%)`,
        transform: 'scale(1.2)',
      }} />
      <svg width="160" height="140" viewBox="0 0 160 140" fill="none" style={{ position: 'relative', zIndex: 1 }}>
        <defs>
          <radialGradient id="ringGrad" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={glowColor} stopOpacity="0.5"/>
            <stop offset="100%" stopColor={glowColor} stopOpacity="0"/>
          </radialGradient>
          <linearGradient id="screenGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#1e40af" stopOpacity="0.8"/>
            <stop offset="100%" stopColor="#0e7490" stopOpacity="0.6"/>
          </linearGradient>
          <linearGradient id="lidGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#1e293b"/>
            <stop offset="100%" stopColor="#0f172a"/>
          </linearGradient>
          <filter id="glow">
            <feGaussianBlur stdDeviation="3" result="blur"/>
            <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
        </defs>

        {/* Glow halo */}
        <ellipse cx="80" cy="78" rx="58" ry="52" fill="none"
          stroke={glowColor} strokeWidth="1.5" opacity="0.35" filter="url(#glow)"/>
        <ellipse cx="80" cy="78" rx="46" ry="40" fill="none"
          stroke={glowColor} strokeWidth="1" opacity="0.25"/>

        {/* Screen lid */}
        <rect x="22" y="14" width="116" height="82" rx="8" fill="url(#lidGrad)"
          stroke="rgba(255,255,255,0.12)" strokeWidth="1"/>
        {/* Screen bezel */}
        <rect x="28" y="20" width="104" height="70" rx="4" fill="#060d1f"/>
        {/* Screen glow content */}
        <rect x="32" y="24" width="96" height="62" rx="3" fill="url(#screenGrad)" opacity="0.6"/>
        {/* Screen shine */}
        <rect x="32" y="24" width="96" height="10" rx="3" fill="rgba(255,255,255,0.05)"/>
        {/* Notch */}
        <rect x="70" y="14" width="20" height="5" rx="2.5" fill="#060d1f"/>
        {/* Camera dot */}
        <circle cx="80" cy="17" r="1.5" fill="rgba(255,255,255,0.15)"/>

        {/* MacBook icon on screen */}
        <circle cx="80" cy="56" r="12" fill={glowColor} opacity="0.2"/>
        <path d="M74 56 L80 50 L86 56 L80 62 Z" fill={glowColor} opacity="0.7"/>

        {/* Hinge */}
        <rect x="22" y="96" width="116" height="3" rx="1.5" fill="rgba(255,255,255,0.06)"/>
        {/* Base / keyboard deck */}
        <rect x="14" y="99" width="132" height="22" rx="4" fill="url(#lidGrad)"
          stroke="rgba(255,255,255,0.08)" strokeWidth="1"/>
        {/* Trackpad */}
        <rect x="60" y="106" width="40" height="8" rx="2" fill="rgba(255,255,255,0.06)"
          stroke="rgba(255,255,255,0.08)" strokeWidth="0.5"/>
        {/* Bottom feet area */}
        <rect x="14" y="121" width="132" height="3" rx="1.5" fill="rgba(0,0,0,0.3)"/>
      </svg>
    </div>
  )
}

// ── Gradient progress bar ──────────────────────────────────────────────────
function GradBar({ value, max = 100, warn = 75, danger = 90 }: { value: number; max?: number; warn?: number; danger?: number }) {
  const pct = Math.min(100, (value / max) * 100)
  const color = pct >= danger ? 'linear-gradient(90deg,#ef4444,#dc2626)'
    : pct >= warn ? 'linear-gradient(90deg,#f97316,#ea580c)'
    : 'linear-gradient(90deg,#22d3ee,#6366f1)'
  return (
    <div style={{ height: 6, background: 'rgba(255,255,255,0.08)', borderRadius: 4, overflow: 'hidden' }}>
      <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 4, transition: 'width 0.8s ease' }}/>
    </div>
  )
}

// ── Compact metric row item ────────────────────────────────────────────────
function MetricRow({ label, value, sub, pct, warn, danger }: {
  label: string; value: string; sub?: string; pct?: number; warn?: number; danger?: number
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.50)', fontWeight: 500 }}>{label}</span>
        <span style={{ fontSize: 14, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{value}</span>
      </div>
      {pct !== undefined && <GradBar value={pct} warn={warn} danger={danger} />}
      {sub && <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>{sub}</span>}
    </div>
  )
}

function getRecommendation(snap: SystemSnapshot, totalFreed: number, onNavigate: (p: Page) => void) {
  const diskFreePct = snap.disk.totalBytes > 0 ? (snap.disk.freeBytes / snap.disk.totalBytes) * 100 : 50
  if (diskFreePct < 10) return {
    icon: '💽', color: '#f97316',
    title: 'Storage running low',
    body: `Only ${fmtBytes(snap.disk.freeBytes)} free. Scan and remove junk to reclaim space.`,
    action: 'Clean Now', onAction: () => onNavigate('junk'),
  }
  if (snap.memory.pressurePercent > 75) return {
    icon: '🧠', color: '#a78bfa',
    title: 'High memory pressure',
    body: `Memory is at ${snap.memory.pressurePercent}%. Clearing caches can free up RAM.`,
    action: 'Clean Caches', onAction: () => onNavigate('junk'),
  }
  if (totalFreed === 0) return {
    icon: '✨', color: '#22d3ee',
    title: 'Run your first scan',
    body: 'Scan for junk, duplicates, and large files to see how much you can free up.',
    action: 'Start Scan', onAction: () => onNavigate('junk'),
  }
  return {
    icon: '🔍', color: '#22c55e',
    title: 'Your Mac looks healthy',
    body: `You've freed ${fmtBytes(totalFreed)} total. Run a scan to check for new junk.`,
    action: 'Scan Again', onAction: () => onNavigate('junk'),
  }
}

interface Props {
  onNavigate: (page: Page) => void
  theme: PageTheme
}

export default function Home({ onNavigate, theme }: Props) {
  const [snap, setSnap] = useState<SystemSnapshot | null>(null)
  const [totalFreed, setTotalFreed] = useState(0)
  const [fdaGranted, setFdaGranted] = useState<boolean | null>(null)
  const { onMouseMove, onMouseLeave, tiltTransform, tiltTransition } = useTilt(18)

  useEffect(() => {
    window.electron.checkFDA().then(setFdaGranted).catch(() => setFdaGranted(true))
    window.electron.getTotalFreed().then(setTotalFreed).catch(() => {})

    const load = () => window.electron.getSystemSnapshot().then(setSnap).catch(() => {})
    load()
    const id = setInterval(load, 4000)
    return () => clearInterval(id)
  }, [])

  const health = snap?.healthScore ?? 'Excellent'
  const healthColor = HEALTH_COLOR[health] ?? '#22d3ee'
  const diskUsedPct = snap && snap.disk.totalBytes > 0 ? (snap.disk.usedBytes / snap.disk.totalBytes) * 100 : 0
  const rec = snap ? getRecommendation(snap, totalFreed, onNavigate) : null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, height: '100%' }}>

      {/* Page header */}
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
        <h1 style={{ margin: 0, fontSize: 26, fontWeight: 800, letterSpacing: '-0.03em' }}>
          My Mac Activity
        </h1>
        <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)' }}>Updated {today()}</span>
      </div>

      {/* Main row: hero + right column */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, flex: 1, minHeight: 0 }}>

        {/* LEFT: Mac Health hero card */}
        <div
          onMouseMove={onMouseMove} onMouseLeave={onMouseLeave}
          style={{
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.10)',
            borderRadius: 20, padding: '22px 24px',
            display: 'flex', flexDirection: 'column', gap: 14,
            transform: tiltTransform, transition: tiltTransition,
            cursor: 'default', overflow: 'hidden', position: 'relative',
          }}>
          {/* Background glow blob */}
          <div style={{
            position: 'absolute', top: -20, right: -20, width: 200, height: 200,
            borderRadius: '50%', background: `${healthColor}15`, pointerEvents: 'none',
          }}/>

          {/* Health + model row */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
              <span style={{ fontSize: 15, fontWeight: 600, color: 'rgba(255,255,255,0.65)' }}>Mac Health:</span>
              <span style={{ fontSize: 22, fontWeight: 800, color: healthColor, letterSpacing: '-0.02em', transition: 'color 0.4s' }}>
                {snap ? health : '...'}
              </span>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: healthColor,
                boxShadow: `0 0 8px ${healthColor}`, transition: 'all 0.4s', flexShrink: 0 }}/>
            </div>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.40)' }}>{snap?.macModel ?? 'Mac'}</div>
          </div>

          {/* Mac illustration -- centered */}
          <div style={{ display: 'flex', justifyContent: 'center', marginBlock: 4 }}>
            <MacIllustration health={health} />
          </div>

          {/* Disk usage */}
          <div style={{ marginTop: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 600 }}>Macintosh HD</span>
              {snap && (
                <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.50)' }}>
                  {fmtBytes(snap.disk.usedBytes)} of {fmtBytes(snap.disk.totalBytes)} used
                </span>
              )}
            </div>
            <GradBar value={diskUsedPct} warn={70} danger={85} />
            {snap && (
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
                <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.40)' }}>
                  {fmtBytes(snap.disk.freeBytes)} free
                </span>
                <button onClick={() => onNavigate('space-lens')} style={{
                  background: 'none', border: 'none', padding: 0,
                  color: healthColor, fontSize: 12, fontWeight: 700, cursor: 'pointer',
                }}>Free Up</button>
              </div>
            )}
          </div>

          {/* FDA badge (compact) */}
          {fdaGranted !== null && (
            <div onClick={fdaGranted ? undefined : () => window.electron.openFDASettings()}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '6px 12px', borderRadius: 8, cursor: fdaGranted ? 'default' : 'pointer',
                background: fdaGranted ? 'rgba(34,197,94,0.10)' : 'rgba(239,68,68,0.10)',
                border: `1px solid ${fdaGranted ? 'rgba(34,197,94,0.25)' : 'rgba(239,68,68,0.25)'}`,
              }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%',
                background: fdaGranted ? '#22c55e' : '#ef4444',
                boxShadow: `0 0 5px ${fdaGranted ? '#22c55e' : '#ef4444'}` }}/>
              <span style={{ fontSize: 12, color: fdaGranted ? '#86efac' : '#fca5a5', fontWeight: 600 }}>
                Full Disk Access {fdaGranted ? 'Granted' : '-- Tap to Enable'}
              </span>
            </div>
          )}
        </div>

        {/* RIGHT column: Stats + Metrics stacked */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* Total freed stat card */}
          <div style={{
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.10)',
            borderRadius: 20, padding: '20px 24px',
            display: 'flex', flexDirection: 'column', gap: 10, position: 'relative', overflow: 'hidden',
          }}>
            <div style={{ position: 'absolute', bottom: -20, right: -20, width: 120, height: 120,
              borderRadius: '50%', background: 'rgba(34,211,238,0.08)', pointerEvents: 'none' }}/>
            <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
              Local Storage Cleaned
            </span>
            <div>
              <div style={{ fontSize: 36, fontWeight: 800, letterSpacing: '-0.04em', fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>
                {totalFreed > 0 ? fmtBytes(totalFreed) : '--'}
              </div>
              <div style={{ fontSize: 12, color: '#22c55e', marginTop: 4 }}>
                {totalFreed > 0 ? 'lifetime total freed' : 'run a scan to start'}
              </div>
            </div>
            <button onClick={() => onNavigate('junk')} style={{
              alignSelf: 'flex-start', padding: '7px 16px', borderRadius: 10, fontSize: 13, fontWeight: 700,
              background: `linear-gradient(135deg, ${theme.accent}, ${theme.accent}99)`,
              border: 'none', color: 'white', cursor: 'pointer',
              boxShadow: `0 4px 16px ${theme.accent}33`, marginTop: 4,
            }}>
              Run Cleanup
            </button>
          </div>

          {/* Live metrics card */}
          <div style={{
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.10)',
            borderRadius: 20, padding: '20px 24px',
            display: 'flex', flexDirection: 'column', gap: 14, flex: 1,
          }}>
            <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
              Live Metrics
            </span>
            {snap ? (
              <>
                <MetricRow label="Memory Pressure"
                  value={`${snap.memory.pressurePercent}%`}
                  pct={snap.memory.pressurePercent} warn={60} danger={80} />
                <MetricRow label="CPU Load"
                  value={`${snap.cpu.loadPercent}%`}
                  pct={snap.cpu.loadPercent} warn={60} danger={80} />
                <MetricRow label="Battery"
                  value={`${snap.battery.percent}%`}
                  sub={snap.battery.fullyCharged ? 'Fully charged' : snap.battery.charging ? 'Charging' : 'On battery'}
                  pct={snap.battery.percent} warn={20} danger={10} />
                <div style={{ height: 1, background: 'rgba(255,255,255,0.07)' }}/>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.50)', fontWeight: 500, marginBottom: 3 }}>
                      {snap.network.ssid || 'Wi-Fi'}
                    </div>
                    <div style={{ display: 'flex', gap: 12 }}>
                      <span style={{ fontSize: 12 }}>
                        <span style={{ color: '#86efac' }}>↑</span> {fmtRate(snap.network.upKBps)}
                      </span>
                      <span style={{ fontSize: 12 }}>
                        <span style={{ color: '#67e8f9' }}>↓</span> {fmtRate(snap.network.downKBps)}
                      </span>
                    </div>
                  </div>
                  {snap.connectedDevices.length > 0 && (
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginBottom: 3 }}>External</div>
                      {snap.connectedDevices.slice(0, 2).map(d => (
                        <div key={d.path} style={{ fontSize: 12, color: 'rgba(255,255,255,0.65)' }}>{d.name}</div>
                      ))}
                      {snap.connectedDevices.length > 2 && (
                        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>+{snap.connectedDevices.length - 2} more</div>
                      )}
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div style={{ color: 'rgba(255,255,255,0.30)', fontSize: 13 }}>Loading...</div>
            )}
          </div>
        </div>
      </div>

      {/* Recommendation card */}
      {rec && (
        <div style={{
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.10)',
          borderRadius: 20, padding: '16px 24px',
          display: 'flex', alignItems: 'center', gap: 16,
        }}>
          <div style={{
            width: 44, height: 44, borderRadius: 14, flexShrink: 0,
            background: `${rec.color}20`, border: `1px solid ${rec.color}30`,
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22,
          }}>
            {rec.icon}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 2 }}>{rec.title}</div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.50)', lineHeight: 1.5 }}>{rec.body}</div>
          </div>
          <button onClick={rec.onAction} style={{
            flexShrink: 0, padding: '8px 20px', borderRadius: 10, fontSize: 13, fontWeight: 700,
            background: `linear-gradient(135deg, ${theme.accent}, ${theme.accent}99)`,
            border: 'none', color: 'white', cursor: 'pointer',
            boxShadow: `0 4px 16px ${theme.accent}33`,
          }}>
            {rec.action}
          </button>
        </div>
      )}
    </div>
  )
}
