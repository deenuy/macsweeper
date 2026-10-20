import type { SystemSnapshot } from '../../../shared/types'
import type { Page, PageTheme } from '../App'
import { memo, useEffect, useId, useRef } from 'react'

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

// Small, bounded-angle 3D illustration. Coordinates are in model space;
// perspective projection is applied to every surface, including screen graphics.
type HeroPoint = readonly [number, number, number]
type HeroPath = { key: string; d: string; fill: string; stroke?: string; opacity?: number }
const HERO_BASE = { yaw: 0.60, pitch: 0.20 }

function heroRect(w: number, h: number, r: number, z: number, x = 0, y = 0): HeroPoint[] {
  const points: HeroPoint[] = []
  const corners = [[w / 2 - r, h / 2 - r], [-w / 2 + r, h / 2 - r],
    [-w / 2 + r, -h / 2 + r], [w / 2 - r, -h / 2 + r]]
  corners.forEach(([cx, cy], corner) => {
    for (let step = 0; step <= 6; step++) {
      const a = (corner + step / 6) * Math.PI / 2
      points.push([x + cx + Math.cos(a) * r, y + cy + Math.sin(a) * r, z])
    }
  })
  return points
}

function heroCircle(x: number, y: number, r: number, z: number): HeroPoint[] {
  return Array.from({ length: 40 }, (_, i) => {
    const a = i * Math.PI / 20
    return [x + Math.cos(a) * r, y + Math.sin(a) * r, z] as HeroPoint
  })
}

// Successive rounded cross-sections make the deep, curved CRT enclosure.
const HERO_RINGS = [
  heroRect(2.84, 2.48, 0.34, 0.94),
  heroRect(2.92, 2.52, 0.42, 0.66),
  heroRect(2.84, 2.46, 0.53, 0.12),
  heroRect(2.52, 2.20, 0.65, -0.58),
  heroRect(1.98, 1.80, 0.66, -1.10),
  heroRect(1.54, 1.40, 0.59, -1.30),
]
const HERO_SHELL = HERO_RINGS.slice(0, -1).flatMap((ring, row) =>
  ring.map((p, i) => [p, HERO_RINGS[row + 1][i],
    HERO_RINGS[row + 1][(i + 1) % ring.length], ring[(i + 1) % ring.length]]))

function heroFrame(yaw: number, pitch: number, lift: number, id: string): HeroPath[] {
  const cy = Math.cos(yaw), sy = Math.sin(yaw)
  const cx = Math.cos(pitch), sx = Math.sin(pitch)
  const rotate = ([x, y, z]: HeroPoint): HeroPoint => {
    const rx = x * 1.20 * cy + z * sy, rz = -x * 1.20 * sy + z * cy
    return [rx, y * cx - rz * sx, y * sx + rz * cx]
  }
  const path = (points: readonly HeroPoint[], close = true) => points.map((p, i) => {
    const [x, y, z] = rotate(p)
    const scale = 65 * 8 / (8 - z)
    return `${i ? 'L' : 'M'}${(170 + x * scale).toFixed(2)},${(136 - y * scale + lift).toFixed(2)}`
  }).join(' ') + (close ? ' Z' : '')
  const gradient = (name: string) => `url(#${id}-${name})`
  const paths: HeroPath[] = []
  const add = (key: string, points: readonly HeroPoint[], fill: string,
    stroke?: string, opacity?: number) => paths.push({ key, d: path(points), fill, stroke, opacity })

  // Low kickstand, behind the CRT case. It follows the same camera as the case.
  add('foot', [[-0.92,-1.17,0.48],[0.92,-1.17,0.48],[1.02,-1.48,0.80],[-1.02,-1.48,0.80]], gradient('foot'))
  add('foot-lip', [[-1.02,-1.48,0.80],[1.02,-1.48,0.80],[1.02,-1.56,0.77],[-1.02,-1.56,0.77]], '#62508e')

  // Opaque tinted surfaces simulate plastic; avoid incorrect alpha sorting.
  // Backface culling + depth sorting is sufficient for this convex shell.
  const faces = HERO_SHELL.map((points, i) => {
    const p = points.map(rotate)
    const u = p[1].map((v, j) => v - p[0][j])
    const v = p[2].map((n, j) => n - p[0][j])
    const n = [u[1]*v[2]-u[2]*v[1], u[2]*v[0]-u[0]*v[2], u[0]*v[1]-u[1]*v[0]]
    const length = Math.hypot(...n) || 1
    const normal = n.map(value => value / length)
    const facing = normal[0] * -p[0][0] + normal[1] * -p[0][1] + normal[2] * (8 - p[0][2])
    const light = Math.max(0, normal[0] * -0.45 + normal[1] * 0.78 + normal[2] * 0.43)
    return { points, i, facing, depth: p.reduce((sum, point) => sum + point[2], 0) / p.length,
      fill: `hsl(263, ${44 + light * 9}%, ${27 + light * 35}%)` }
  }).filter(face => face.facing > 0).sort((a, b) => a.depth - b.depth)
  faces.forEach(face => add(`shell-${face.i}`, face.points, face.fill, face.fill))

  // A single front plane: rounded rim, inset CRT, chin and all screen graphics.
  add('rim', heroRect(2.84, 2.48, 0.34, 0.955), gradient('rim'), '#c4afe7')
  add('bezel', heroRect(2.66, 2.30, 0.29, 0.966), gradient('bezel'))
  add('recess', heroRect(2.38, 1.82, 0.23, 0.977, 0, 0.14), '#51465e')
  add('screen', heroRect(2.22, 1.66, 0.21, 0.989, 0, 0.14), gradient('screen'), '#201d30')
  add('bloom', heroRect(2.20, 1.64, 0.20, 0.991, 0, 0.14), gradient('bloom'))
  add('outer-ring', heroCircle(0, 0.14, 0.43, 1.002), 'none', 'var(--hero-health)', 0.23)
  add('inner-ring', heroCircle(0, 0.14, 0.28, 1.004), 'none', 'var(--hero-health)', 0.75)
  add('orb', heroCircle(0, 0.14, 0.16, 1.006), gradient('orb'))
  add('orb-core', heroCircle(-0.015, 0.16, 0.053, 1.008), '#e5fdff')
  add('reflection', heroRect(2.20, 1.64, 0.20, 1.011, 0, 0.14), gradient('sheen'))
  add('drive', heroRect(0.80, 0.035, 0.017, 0.985, -0.18, -0.91), '#6e627c')
  add('power', heroCircle(0.91, -0.91, 0.047, 0.986), 'var(--hero-health)', '#f2ecff')
  // Subtle speaker perforations on the lower bezel.
  for (const side of [-1, 1]) for (let i = 0; i < 4; i++) {
    add(`vent-${side}-${i}`, heroRect(0.025, 0.095, 0.012, 0.984,
      side * (0.61 + i * 0.045), -0.91), '#9585a6')
  }
  return paths
}

const MacHero = memo(function MacHero({ score }: { score: string }) {
  const { color } = HEALTH[score] ?? HEALTH.Excellent
  // Every instance owns its gradient IDs (including multiple Home previews).
  const id = `mac-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`
  const host = useRef<HTMLDivElement>(null)
  const drawing = useRef<SVGGElement>(null)
  const shadow = useRef<SVGEllipseElement>(null)

  useEffect(() => {
    const element = host.current, group = drawing.current, ground = shadow.current
    if (!element || !group || !ground) return
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)')
    const nodes = new Map<string, SVGPathElement>()
    let frame = 0, previous = 0, phase = 0, inView = true, disposed = false
    let pointerX = 0, pointerY = 0, hover = 0, hoverTarget = 0
    let yaw = HERO_BASE.yaw, pitch = HERO_BASE.pitch, lift = 0
    const clamp = (n: number) => Math.max(-1, Math.min(1, n))

    const draw = () => {
      const visible = new Set<string>()
      const paths = heroFrame(yaw, pitch, lift, id)
      paths.forEach((spec, index) => {
        visible.add(spec.key)
        let node = nodes.get(spec.key)
        if (!node) {
          node = document.createElementNS('http://www.w3.org/2000/svg', 'path')
          node.setAttribute('stroke-linejoin', 'round')
          node.setAttribute('stroke-width', spec.key.startsWith('shell-') ? '0.7' : '1')
          nodes.set(spec.key, node)
        }
        node.removeAttribute('display')
        node.setAttribute('d', spec.d)
        node.setAttribute('fill', spec.fill)
        node.setAttribute('stroke', spec.stroke ?? 'none')
        node.setAttribute('opacity', String(spec.opacity ?? 1))
        // Reorder only when visibility/depth order actually changes.
        if (group.children[index] !== node) group.insertBefore(node, group.children[index] ?? null)
      })
      nodes.forEach((node, key) => { if (!visible.has(key)) node.setAttribute('display', 'none') })
      ground.setAttribute('rx', String(91 + lift * 0.7))
      ground.setAttribute('opacity', String(0.30 + lift * 0.009))
    }
    const stop = () => { cancelAnimationFrame(frame); frame = 0; previous = 0 }
    const tick = (time: number) => {
      frame = 0
      if (disposed || document.hidden || !inView || media.matches) return
      const dt = previous ? Math.min((time - previous) / 1000, 0.05) : 0
      previous = time
      phase += dt
      // One continuous clock and eased target: enter/leave never resets the pose.
      const ease = 1 - Math.exp(-8 * dt)
      hover += (hoverTarget - hover) * ease
      const wave = phase * Math.PI * 2 / 5.8
      const targetYaw = HERO_BASE.yaw + Math.sin(wave) * 0.055 * (1 - hover) + pointerX * 0.14 * hover
      const targetPitch = HERO_BASE.pitch - pointerY * 0.075 * hover
      yaw += (targetYaw - yaw) * ease
      pitch += (targetPitch - pitch) * ease
      lift += (-3.5 * (1 - Math.cos(wave)) - lift) * ease
      draw()
      frame = requestAnimationFrame(tick)
    }
    const sync = () => {
      stop()
      if (media.matches) {
        yaw = HERO_BASE.yaw; pitch = HERO_BASE.pitch; lift = 0; hover = 0
        hoverTarget = 0; pointerX = 0; pointerY = 0
        draw()
      } else if (inView && !document.hidden && !disposed) frame = requestAnimationFrame(tick)
    }
    const move = (event: PointerEvent) => {
      if (!finePointer.matches || event.pointerType === 'touch' || media.matches) return
      const rect = element.getBoundingClientRect()
      if (!rect.width || !rect.height) return
      pointerX = clamp((event.clientX - rect.left) / rect.width * 2 - 1)
      pointerY = clamp((event.clientY - rect.top) / rect.height * 2 - 1)
      hoverTarget = 1
    }
    const leave = () => { hoverTarget = 0 }
    const visibility = () => { if (document.hidden) leave(); sync() }
    const observer = typeof IntersectionObserver !== 'undefined'
      ? new IntersectionObserver(([entry]) => { inView = entry.isIntersecting; if (!inView) leave(); sync() })
      : null
    draw()
    observer?.observe(element)
    element.addEventListener('pointermove', move, { passive: true })
    element.addEventListener('pointerleave', leave)
    element.addEventListener('pointercancel', leave)
    window.addEventListener('blur', leave)
    document.addEventListener('visibilitychange', visibility)
    media.addEventListener('change', sync)
    sync()
    return () => {
      disposed = true; stop(); observer?.disconnect()
      element.removeEventListener('pointermove', move)
      element.removeEventListener('pointerleave', leave)
      element.removeEventListener('pointercancel', leave)
      window.removeEventListener('blur', leave)
      document.removeEventListener('visibilitychange', visibility)
      media.removeEventListener('change', sync)
      group.replaceChildren()
    }
  }, [id])

  return (
    <div ref={host} style={{ width: '100%', maxWidth: 340, minWidth: 0,
      lineHeight: 0, '--hero-health': color } as React.CSSProperties}>
      <svg viewBox="0 0 340 280" role="img" aria-labelledby={`${id}-title`}
        style={{ display: 'block', width: '100%', height: 'auto', overflow: 'visible' }}>
        <title id={`${id}-title`}>iMac G3 inspired computer — health: {score}</title>
        <defs>
          <linearGradient id={`${id}-rim`} x2="0.2" y2="1">
            <stop stopColor="#eee4fa"/><stop offset="0.45" stopColor="#b8a2d4"/>
            <stop offset="1" stopColor="#80669e"/>
          </linearGradient>
          <linearGradient id={`${id}-bezel`} x2="0.15" y2="1">
            <stop stopColor="#d7cee0"/><stop offset="0.5" stopColor="#b8a9c6"/>
            <stop offset="1" stopColor="#9986ae"/>
          </linearGradient>
          <linearGradient id={`${id}-foot`} x2="0" y2="1">
            <stop stopColor="#b9a4d7"/><stop offset="1" stopColor="#776091"/>
          </linearGradient>
          <radialGradient id={`${id}-screen`}>
            <stop stopColor="#14212c"/><stop offset="1" stopColor="#070a12"/>
          </radialGradient>
          <radialGradient id={`${id}-bloom`}>
            <stop stopColor="var(--hero-health)" stopOpacity="0.29"/>
            <stop offset="1" stopColor="var(--hero-health)" stopOpacity="0"/>
          </radialGradient>
          <radialGradient id={`${id}-orb`}>
            <stop stopColor="var(--hero-health)" stopOpacity="0.95"/>
            <stop offset="1" stopColor="var(--hero-health)" stopOpacity="0.03"/>
          </radialGradient>
          <linearGradient id={`${id}-sheen`} x1="0" y1="0" x2="0.4" y2="1">
            <stop stopColor="white" stopOpacity="0.19"/>
            <stop offset="0.48" stopColor="white" stopOpacity="0.02"/>
            <stop offset="1" stopColor="white" stopOpacity="0"/>
          </linearGradient>
          <radialGradient id={`${id}-ground`}>
            <stop stopColor="#05020c" stopOpacity="0.9"/>
            <stop offset="1" stopColor="#05020c" stopOpacity="0"/>
          </radialGradient>
        </defs>
        {/* Ground is outside the animated model. No moving drop-shadow filters. */}
        <ellipse ref={shadow} cx="170" cy="253" rx="91" ry="13" fill={`url(#${id}-ground)`} opacity="0.3"/>
        {/* This group is owned exclusively by the effect, not by React children. */}
        <g ref={drawing}/>
      </svg>
    </div>
  )
})

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
