import { useState, useCallback, useEffect, useMemo, useRef } from 'react'
import type { TreeNode, FileMeta, DiskStats } from '../../../shared/types'
import HeroScanScreen from './ui/HeroScanScreen'

const ACCENT = '#9B5CE8'
// Items below this size threshold are grouped into "Other items"
const BUBBLE_THRESHOLD = 1_000_000_000 // 1 GB
const OTHER_PATH = '__other__'

function fmtBytes(n: number): string {
  if (n >= 1e9) return (n / 1e9).toFixed(1) + ' GB'
  if (n >= 1e6) return (n / 1e6).toFixed(0) + ' MB'
  if (n >= 1e3) return (n / 1e3).toFixed(0) + ' KB'
  return n + ' B'
}

function fmtDate(iso: string): string {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString('en-US', {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit'
    })
  } catch { return iso }
}

function truncateName(name: string, maxLen: number): string {
  if (name.length <= maxLen) return name
  const front = Math.ceil(maxLen / 2) - 1
  const back = Math.floor(maxLen / 2) - 1
  return name.slice(0, front) + '...' + name.slice(-back)
}

function makeOtherNode(nodes: TreeNode[]): TreeNode {
  return {
    name: 'Other items', path: OTHER_PATH,
    size: nodes.reduce((s, n) => s + n.size, 0),
    sizeOnDisk: nodes.reduce((s, n) => s + n.sizeOnDisk, 0),
    isDir: false, childCount: nodes.length, hasChildren: false,
    ext: '', modifiedAt: '', createdAt: '', accessedAt: '',
    isSymlink: false, permissions: '', kind: 'Collection', owner: '',
  }
}

// ─── Icons ─────────────────────────────────────────────────────────────────────

function ListFolderIcon({ node }: { node: { isDir: boolean; path?: string; name?: string } }) {
  if (node.path === OTHER_PATH) return (
    <svg width="18" height="16" viewBox="0 0 18 16" fill="none">
      <circle cx="5" cy="8" r="3.5" fill="rgba(155,92,232,0.55)" stroke="rgba(180,140,255,0.4)" strokeWidth="1"/>
      <circle cx="11" cy="5" r="2.5" fill="rgba(130,70,210,0.50)" stroke="rgba(180,140,255,0.3)" strokeWidth="1"/>
      <circle cx="15.5" cy="10" r="2" fill="rgba(100,50,180,0.50)" stroke="rgba(160,120,230,0.3)" strokeWidth="1"/>
    </svg>
  )
  const isApp = node.name?.endsWith('.app')
  if (isApp) return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <rect x="1" y="3" width="16" height="12" rx="3" fill="rgba(100,120,200,0.55)" stroke="rgba(150,160,220,0.35)" strokeWidth="1"/>
      <rect x="3.5" y="6" width="4" height="4" rx="1" fill="rgba(200,210,255,0.45)"/>
      <path d="M9 7h5M9 9.5h3.5" stroke="rgba(200,210,255,0.40)" strokeWidth="1" strokeLinecap="round"/>
    </svg>
  )
  if (!node.isDir) return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M3,1 L10,1 L14,5 L14,15 L3,15 Z" stroke="rgba(200,200,220,0.35)" strokeWidth="1" fill="none"/>
      <path d="M10,1 L10,5 L14,5" stroke="rgba(200,200,220,0.25)" strokeWidth="1" fill="none"/>
    </svg>
  )
  return (
    <svg width="18" height="16" viewBox="0 0 18 16" fill="none">
      <defs>
        <linearGradient id="lf-body" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#56BCF2"/><stop offset="100%" stopColor="#1E80D8"/>
        </linearGradient>
        <linearGradient id="lf-tab" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#7DD4FC"/><stop offset="100%" stopColor="#38A8EE"/>
        </linearGradient>
      </defs>
      <path d="M0,4.5 L0,2 Q0,0.5 1.5,0.5 L5.5,0.5 Q6.5,0.5 7,1.5 L7.8,2.8 L16.5,2.8 Q18,2.8 18,4.3 L18,13.5 Q18,15 16.5,15 L1.5,15 Q0,15 0,13.5 Z" fill="url(#lf-body)"/>
      <path d="M0,4.5 L0,2 Q0,0.5 1.5,0.5 L5.5,0.5 Q6.5,0.5 7,1.5 L7.8,2.8 L0,2.8 Z" fill="url(#lf-tab)"/>
      <rect x="0.5" y="3" width="17" height="3" fill="rgba(255,255,255,0.12)" rx="0.5"/>
    </svg>
  )
}

function BubbleFolderIcon({ cx, cy, size, node }: { cx: number; cy: number; size: number; node: TreeNode }) {
  if (node.path === OTHER_PATH) {
    const r = size * 0.13
    return (
      <g>
        <circle cx={cx - size * 0.18} cy={cy - size * 0.06} r={r * 1.4} fill="rgba(155,92,232,0.55)"/>
        <circle cx={cx + size * 0.14} cy={cy - size * 0.14} r={r * 1.1} fill="rgba(120,70,200,0.50)"/>
        <circle cx={cx + size * 0.16} cy={cy + size * 0.16} r={r * 0.9} fill="rgba(90,50,170,0.50)"/>
      </g>
    )
  }
  const isApp = node.name.endsWith('.app')
  if (isApp) {
    const w = size * 0.6, h = size * 0.6, x = cx - w/2, y = cy - h/2 - size*0.05
    return (
      <g>
        <rect x={x} y={y} width={w} height={h} rx={w * 0.22} fill="rgba(100,120,200,0.60)" stroke="rgba(180,190,255,0.30)" strokeWidth="1"/>
        <rect x={x + w*0.12} y={y + h*0.22} width={w*0.38} height={h*0.38} rx={w*0.06} fill="rgba(210,220,255,0.40)"/>
      </g>
    )
  }
  const w = size, h = size * 0.82
  const x = cx - w/2, y = cy - h/2 - size*0.04
  const tabW = w * 0.4, bodyTop = h * 0.18, r = w * 0.08
  if (!node.isDir) return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx={r} fill="rgba(150,150,180,0.50)"/>
      <path d={`M${x+w*0.58},${y} L${x+w},${y+h*0.28} L${x+w*0.58},${y+h*0.28} Z`} fill="rgba(0,0,0,0.18)"/>
    </g>
  )
  return (
    <g>
      <path d={`M${x},${y+bodyTop} L${x},${y+bodyTop*0.4} Q${x},${y} ${x+r},${y} L${x+tabW-r},${y} Q${x+tabW+r*1.2},${y} ${x+tabW+r*1.5},${y+bodyTop*0.6} L${x+tabW+r*1.5},${y+bodyTop} Z`} fill="url(#bf-tab)"/>
      <rect x={x} y={y+bodyTop} width={w} height={h-bodyTop} rx={r} fill="url(#bf-body)"/>
      <rect x={x+w*0.04} y={y+bodyTop+1} width={w*0.92} height={(h-bodyTop)*0.32} rx={r*0.5} fill="rgba(255,255,255,0.18)"/>
    </g>
  )
}

// ─── MacSweeper lens art ───────────────────────────────────────────────────────

function MacSweeperLensArt({ size = 220, done = false }: { size?: number; done?: boolean }) {
  const S = size, cx = S/2, cy = S/2, R = S*0.29, ri = S*0.17
  return (
    <svg width={S} height={S} viewBox={`0 0 ${S} ${S}`} style={{ filter: 'drop-shadow(0 12px 32px rgba(0,0,40,0.55))' }}>
      <defs>
        <radialGradient id="art-bg" cx="50%" cy="38%" r="68%">
          <stop offset="0%" stopColor={done ? '#2a2448' : '#3520a8'}/>
          <stop offset="100%" stopColor={done ? '#0d0a20' : '#160858'}/>
        </radialGradient>
        <radialGradient id="art-ring" cx="38%" cy="32%" r="65%">
          <stop offset="0%" stopColor={done ? 'rgba(200,195,220,0.95)' : 'rgba(200,180,255,0.95)'}/>
          <stop offset="70%" stopColor={done ? 'rgba(130,120,165,0.88)' : 'rgba(120,100,220,0.88)'}/>
          <stop offset="100%" stopColor={done ? 'rgba(80,75,115,0.80)' : 'rgba(80,60,180,0.80)'}/>
        </radialGradient>
        <radialGradient id="art-inner" cx="50%" cy="50%" r="55%">
          <stop offset="0%" stopColor={done ? 'rgba(30,25,55,0.9)' : 'rgba(45,20,130,0.9)'}/>
          <stop offset="100%" stopColor={done ? 'rgba(10,8,20,0.95)' : 'rgba(15,6,55,0.95)'}/>
        </radialGradient>
      </defs>
      <rect x="0" y="0" width={S} height={S} rx={S*0.265} fill="url(#art-bg)"/>
      <ellipse cx={cx*0.68} cy={cy*0.55} rx={S*0.28} ry={S*0.15} fill="rgba(255,255,255,0.07)"/>
      <circle cx={cx} cy={cy} r={R} fill="url(#art-ring)"/>
      <path d={`M${cx-R*0.7},${cy-R*0.2} A${R},${R} 0 0,1 ${cx+R*0.2},${cy-R*0.85}`} stroke="rgba(255,255,255,0.45)" strokeWidth={R*0.12} fill="none" strokeLinecap="round"/>
      <circle cx={cx} cy={cy} r={ri} fill="url(#art-inner)"/>
      <circle cx={cx} cy={cy} r={ri} fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth="1.5"/>
      <circle cx={cx+R*0.68} cy={cy+R*0.70} r={S*0.038} fill={done ? 'rgba(180,175,210,0.85)' : 'rgba(200,180,255,0.88)'}/>
      <rect x="1" y="1" width={S-2} height={S-2} rx={S*0.258} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="1.5"/>
    </svg>
  )
}

// ─── Tooltip ──────────────────────────────────────────────────────────────────

interface TooltipData { node: TreeNode; mouseX: number; mouseY: number }

function BubbleTooltip({ data, containerRef }: { data: TooltipData; containerRef: React.RefObject<HTMLDivElement> }) {
  if (!containerRef.current) return null
  const rect = containerRef.current.getBoundingClientRect()
  const isOther = data.node.path === OTHER_PATH
  return (
    <div style={{ position: 'absolute', left: data.mouseX - rect.left, top: data.mouseY - rect.top - 12, transform: 'translate(-50%, -100%)', pointerEvents: 'none', zIndex: 20 }}>
      <div style={{ background: 'rgba(22,14,52,0.92)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', border: '1px solid rgba(155,92,232,0.35)', borderRadius: 10, padding: '9px 14px', minWidth: 180, maxWidth: 260, boxShadow: '0 8px 32px rgba(0,0,30,0.55)' }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'white', marginBottom: 5, wordBreak: 'break-all' }}>{data.node.name}</div>
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.62)', marginBottom: 2 }}>
          Size: {fmtBytes(data.node.size)}
          {isOther && <span style={{ marginLeft: 8, opacity: 0.55 }}>| {data.node.childCount} items</span>}
        </div>
        {!isOther && data.node.modifiedAt && (
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.42)', marginTop: 3 }}>Modified: {fmtDate(data.node.modifiedAt)}</div>
        )}
      </div>
      <div style={{ width: 0, height: 0, margin: '0 auto', borderLeft: '6px solid transparent', borderRight: '6px solid transparent', borderTop: '7px solid rgba(22,14,52,0.92)' }} />
    </div>
  )
}

// ─── Review modal ─────────────────────────────────────────────────────────────

interface ReviewItem { node: TreeNode; pathCrumbs: string[] }

function ReviewModal({ items, onRemove, onClose, removing }: { items: ReviewItem[]; onRemove: () => void; onClose: () => void; removing: boolean }) {
  const totalSize = items.reduce((s, { node }) => s + node.size, 0)
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(5,2,18,0.72)', backdropFilter: 'blur(18px)', WebkitBackdropFilter: 'blur(18px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 820, maxWidth: '90vw', borderRadius: 20, background: 'linear-gradient(145deg, rgba(38,22,90,0.92) 0%, rgba(18,10,45,0.95) 100%)', border: '1px solid rgba(155,92,232,0.28)', boxShadow: '0 40px 100px rgba(0,0,30,0.7)', overflow: 'hidden', position: 'relative', display: 'flex', flexDirection: 'column' }}>
        <button onClick={onClose} disabled={removing} style={{ position: 'absolute', top: 16, left: 16, zIndex: 1, width: 28, height: 28, borderRadius: '50%', background: 'rgba(255,255,255,0.10)', border: '1px solid rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.6)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M2 2l6 6M8 2l-6 6"/></svg>
        </button>
        <div style={{ display: 'flex', padding: '48px 40px 32px' }}>
          <div style={{ flexShrink: 0, marginRight: 36 }}><MacSweeperLensArt size={200} /></div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2 style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.02em', marginBottom: 20, color: 'white' }}>Review files before removal</h2>
            <div style={{ maxHeight: 240, overflow: 'auto', marginBottom: 8 }}>
              {items.map(({ node, pathCrumbs }) => (
                <div key={node.path} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                  <div style={{ width: 18, height: 18, borderRadius: 4, background: ACCENT, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 5l2.5 2.5 4-4" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  </div>
                  <ListFolderIcon node={node}/>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'white', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{node.name}</div>
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.38)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 2 }}>{pathCrumbs.join(' › ')}</div>
                  </div>
                  <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.55)', fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>{fmtBytes(node.size)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '16px 40px 24px', borderTop: '1px solid rgba(255,255,255,0.07)' }}>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.40)', marginRight: 'auto' }}>{items.length} item{items.length !== 1 ? 's' : ''} &nbsp;|&nbsp; {fmtBytes(totalSize)}</div>
          <button onClick={onClose} disabled={removing} style={{ padding: '9px 22px', borderRadius: 10, background: 'rgba(255,255,255,0.09)', border: '1px solid rgba(255,255,255,0.14)', color: 'rgba(255,255,255,0.7)', fontSize: 14, cursor: 'pointer' }}>Cancel</button>
          <button onClick={onRemove} disabled={removing} style={{ padding: '9px 28px', borderRadius: 10, fontSize: 14, fontWeight: 700, background: removing ? 'rgba(200,50,150,0.5)' : 'linear-gradient(135deg, #e03090, #c020a0)', border: 'none', color: 'white', cursor: removing ? 'default' : 'pointer', boxShadow: removing ? 'none' : '0 4px 20px rgba(200,50,150,0.45)', display: 'flex', alignItems: 'center', gap: 8 }}>
            {removing ? <><svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="animate-spin"><circle cx="7" cy="7" r="5" stroke="rgba(255,255,255,0.3)" strokeWidth="2"/><path d="M7 2a5 5 0 0 1 5 5" stroke="white" strokeWidth="2" strokeLinecap="round"/></svg>Removing…</> : 'Remove'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Completion modal ─────────────────────────────────────────────────────────

function CompletionModal({ count, totalSize, onDone }: { count: number; totalSize: number; onDone: () => void }) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(5,2,18,0.72)', backdropFilter: 'blur(18px)', WebkitBackdropFilter: 'blur(18px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 760, maxWidth: '90vw', borderRadius: 20, background: 'linear-gradient(145deg, rgba(28,16,72,0.92) 0%, rgba(14,8,36,0.95) 100%)', border: '1px solid rgba(155,92,232,0.22)', boxShadow: '0 40px 100px rgba(0,0,30,0.7)', display: 'flex', alignItems: 'center', padding: '48px 44px', gap: 40, position: 'relative', paddingBottom: 72 }}>
        <div style={{ flexShrink: 0 }}><MacSweeperLensArt size={210} done /></div>
        <div style={{ flex: 1 }}>
          <h2 style={{ fontSize: 30, fontWeight: 700, letterSpacing: '-0.025em', color: 'white', marginBottom: 16 }}>Removal Complete!</h2>
          <div style={{ fontSize: 18, fontWeight: 700, color: 'white', fontVariantNumeric: 'tabular-nums' }}>{count} item{count !== 1 ? 's' : ''} &nbsp;|&nbsp; {fmtBytes(totalSize)}</div>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)', marginTop: 4 }}>successfully removed</div>
        </div>
        <div style={{ position: 'absolute', bottom: 24, left: 44, right: 44, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <button style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.45)', fontSize: 13, cursor: 'pointer', padding: 0 }}>View Log</button>
          <button onClick={onDone} style={{ padding: '9px 28px', borderRadius: 10, background: 'rgba(255,255,255,0.10)', border: '1px solid rgba(255,255,255,0.18)', color: 'white', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>Done</button>
        </div>
      </div>
    </div>
  )
}

// ─── Bubble chart ─────────────────────────────────────────────────────────────

interface BubbleDatum { node: TreeNode; x: number; y: number; r: number }

function BubbleChart({ nodes, onNavigate, hoveredPath, onHover, onTooltipShow, onTooltipHide, checkedPaths, onCheck, onContextMenu }: {
  nodes: TreeNode[]; onNavigate: (node: TreeNode) => void; hoveredPath: string | null
  onHover: (path: string | null) => void; onTooltipShow: (node: TreeNode, evt: React.MouseEvent) => void
  onTooltipHide: () => void; checkedPaths: Set<string>; onCheck: (path: string, on: boolean) => void
  onContextMenu: (node: TreeNode, x: number, y: number) => void
}) {
  const bubbles = useMemo((): BubbleDatum[] => {
    if (nodes.length === 0) return []
    const sorted = [...nodes].sort((a, b) => b.size - a.size).slice(0, 9)
    const maxSize = sorted[0].size
    const W = 600, H = 580, CX = W/2, CY = H/2 + 10, MAX_R = 148
    const scaleR = (size: number) => Math.max(22, Math.sqrt(size / maxSize) * MAX_R)
    const result: BubbleDatum[] = [{ node: sorted[0], x: CX, y: CY, r: MAX_R }]
    sorted.slice(1).forEach((node, i) => {
      const r = scaleR(node.size)
      const count = sorted.length - 1
      const angle = (i / count) * 2 * Math.PI - Math.PI / 2.2
      const orbit = MAX_R + r + 18
      result.push({
        node, r,
        x: Math.max(r+12, Math.min(W-r-12, CX + Math.cos(angle) * orbit)),
        y: Math.max(r+10, Math.min(H-r-24, CY + Math.sin(angle) * orbit)),
      })
    })
    return result
  }, [nodes])

  return (
    <svg viewBox="0 0 600 580" style={{ width: '100%', height: '100%' }} xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="bf-body" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#64C8FA"/><stop offset="55%" stopColor="#2E90E8"/><stop offset="100%" stopColor="#1A70C8"/>
        </linearGradient>
        <linearGradient id="bf-tab" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#8DDAFE"/><stop offset="100%" stopColor="#48A8F0"/>
        </linearGradient>
        <radialGradient id="bc-center" cx="38%" cy="32%" r="68%">
          <stop offset="0%" stopColor="rgba(115,78,208,0.78)"/><stop offset="100%" stopColor="rgba(22,10,68,0.62)"/>
        </radialGradient>
        <radialGradient id="bc-outer" cx="38%" cy="32%" r="68%">
          <stop offset="0%" stopColor="rgba(85,55,168,0.68)"/><stop offset="100%" stopColor="rgba(18,8,55,0.56)"/>
        </radialGradient>
        <radialGradient id="bc-hover" cx="38%" cy="32%" r="68%">
          <stop offset="0%" stopColor="rgba(140,90,235,0.85)"/><stop offset="100%" stopColor="rgba(35,16,95,0.70)"/>
        </radialGradient>
        <radialGradient id="bc-other" cx="38%" cy="30%" r="72%">
          <stop offset="0%" stopColor="rgba(100,60,200,0.70)"/><stop offset="100%" stopColor="rgba(30,12,80,0.60)"/>
        </radialGradient>
        <filter id="bs" x="-25%" y="-25%" width="150%" height="150%">
          <feDropShadow dx="0" dy="5" stdDeviation="8" floodColor="rgba(0,0,30,0.55)" floodOpacity="1"/>
        </filter>
      </defs>
      {bubbles.map(({ node, x, y, r }, idx) => {
        const hovered = hoveredPath === node.path
        const isOther = node.path === OTHER_PATH
        const isChecked = checkedPaths.has(node.path)
        const isNavigable = node.isDir && !isOther
        const maxNameLen = r > 100 ? 20 : r > 70 ? 14 : r > 45 ? 10 : 7
        const displayName = truncateName(node.name, maxNameLen)
        const fontSize = Math.max(9, Math.min(14, r * 0.16))
        const sizeFont = Math.max(8, Math.min(12, r * 0.13))
        const labelY = y + r * 0.40 + fontSize + (r > 80 ? 2 : 0)
        return (
          <g key={node.path}
            onClick={() => isNavigable ? onNavigate(node) : undefined}
            onMouseEnter={e => { onHover(node.path); onTooltipShow(node, e) }}
            onMouseMove={e => onTooltipShow(node, e)}
            onMouseLeave={() => { onHover(null); onTooltipHide() }}
            onContextMenu={e => { e.preventDefault(); onTooltipHide(); onContextMenu(node, e.clientX, e.clientY) }}
            style={{ cursor: isNavigable ? 'pointer' : 'default' }}
          >
            {hovered && <circle cx={x} cy={y} r={r+9} fill="none" stroke={ACCENT} strokeWidth="2.5" strokeOpacity="0.55"/>}
            <circle cx={x} cy={y} r={r}
              fill={hovered ? 'url(#bc-hover)' : isOther ? 'url(#bc-other)' : idx === 0 ? 'url(#bc-center)' : 'url(#bc-outer)'}
              stroke={hovered ? 'rgba(180,140,255,0.85)' : isOther ? 'rgba(155,92,232,0.38)' : idx === 0 ? 'rgba(160,110,255,0.45)' : 'rgba(140,100,255,0.30)'}
              strokeWidth={hovered ? 2 : 1.5} filter="url(#bs)"/>
            <ellipse cx={x-r*0.20} cy={y-r*0.28} rx={r*0.42} ry={r*0.22} fill="rgba(255,255,255,0.10)"/>
            {/* Checkbox in top-left of bubble */}
            {r >= 50 && (
              <g onClick={e => { e.stopPropagation(); onCheck(node.path, !isChecked) }} style={{ cursor: 'pointer' }}>
                <rect x={x-r-2} y={y-r-2} width={14} height={14} rx={3.5}
                  fill={isChecked ? ACCENT : 'rgba(255,255,255,0.10)'}
                  stroke={isChecked ? ACCENT : 'rgba(255,255,255,0.30)'} strokeWidth="1.2"/>
                {isChecked && <path d={`M${x-r+2} ${y-r+5} l3 3 4.5-4.5`} stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>}
              </g>
            )}
            {r >= 26 && <BubbleFolderIcon cx={x} cy={y-(r>80?r*0.08:0)} size={r*(idx===0?0.48:0.52)} node={node}/>}
            {r >= 20 && <text x={x} y={labelY} textAnchor="middle" fill="white" fontWeight={600} fontSize={fontSize} style={{ pointerEvents: 'none' }}>{displayName}</text>}
            {r >= 36 && <text x={x} y={labelY+sizeFont+2} textAnchor="middle" fill="rgba(255,255,255,0.62)" fontSize={sizeFont} style={{ pointerEvents: 'none' }}>{fmtBytes(node.size)}</text>}
          </g>
        )
      })}
    </svg>
  )
}

// ─── Context menu ─────────────────────────────────────────────────────────────

interface ContextMenuState { node: TreeNode; x: number; y: number }

function ContextMenu({ menu, onSelect, onReveal, onGetInfo, onQuickLook, onClose }: {
  menu: ContextMenuState
  onSelect: (node: TreeNode) => void
  onReveal: (node: TreeNode) => void
  onGetInfo: (node: TreeNode) => void
  onQuickLook: (node: TreeNode) => void
  onClose: () => void
}) {
  const isOther = menu.node.path === OTHER_PATH
  const label = menu.node.name.length > 28 ? menu.node.name.slice(0, 25) + '…' : menu.node.name

  const items = [
    { label: `Select "${label}"`, action: () => onSelect(menu.node) },
    isOther ? null : { label: 'Reveal in Finder', action: () => onReveal(menu.node), accent: true },
    { label: 'Get Info', action: () => onGetInfo(menu.node) },
    isOther ? null : { label: `Quick Look "${label}"`, action: () => onQuickLook(menu.node) },
  ].filter(Boolean) as { label: string; action: () => void; accent?: boolean }[]

  return (
    <>
      <div style={{ position: 'fixed', inset: 0, zIndex: 200 }} onClick={onClose} onContextMenu={e => { e.preventDefault(); onClose() }}/>
      <div style={{
        position: 'fixed', left: menu.x, top: menu.y, zIndex: 201,
        minWidth: 260, padding: '4px 0',
        background: 'rgba(32,24,60,0.97)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
        border: '1px solid rgba(155,92,232,0.30)', borderRadius: 10,
        boxShadow: '0 16px 48px rgba(0,0,30,0.70), 0 1px 0 rgba(255,255,255,0.07) inset',
      }}>
        {items.map((item, i) => (
          <div key={i}
            onClick={() => { item.action(); onClose() }}
            style={{ padding: '7px 16px', fontSize: 13, cursor: 'pointer', borderRadius: 6, margin: '1px 4px', color: item.accent ? '#60a5fa' : 'rgba(255,255,255,0.88)', transition: 'background 0.1s', userSelect: 'none' }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = item.accent ? 'rgba(96,165,250,0.18)' : `${ACCENT}28`}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
          >
            {item.label}
          </div>
        ))}
      </div>
    </>
  )
}

// ─── Folder list row ──────────────────────────────────────────────────────────

function FolderRow({ node, isSelected, isChecked, maxSize, onSelect, onCheck, onDrillDown, isHovered, onHover, onContextMenu }: {
  node: TreeNode; isSelected: boolean; isChecked: boolean; maxSize: number
  onSelect: (n: TreeNode) => void; onCheck: (path: string, on: boolean) => void
  onDrillDown: (n: TreeNode) => void; isHovered: boolean; onHover: (path: string | null) => void
  onContextMenu: (node: TreeNode, x: number, y: number) => void
}) {
  const barPct = maxSize > 0 ? Math.max(2, (node.size / maxSize) * 100) : 0
  const bg = isSelected ? 'rgba(155,92,232,0.18)' : isHovered ? 'rgba(255,255,255,0.06)' : 'transparent'
  return (
    <div onClick={() => onSelect(node)} onDoubleClick={() => node.isDir && onDrillDown(node)}
      onMouseEnter={() => onHover(node.path)} onMouseLeave={() => onHover(null)}
      onContextMenu={e => { e.preventDefault(); onContextMenu(node, e.clientX, e.clientY) }}
      style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '7px 14px', background: bg, cursor: 'pointer', transition: 'background 0.1s', borderRadius: 6, margin: '1px 4px' }}>
      <input type="checkbox" checked={isChecked}
        onChange={e => { e.stopPropagation(); onCheck(node.path, e.target.checked) }}
        onClick={e => e.stopPropagation()}
        style={{ flexShrink: 0, accentColor: ACCENT, cursor: 'pointer', width: 13, height: 13 }}/>
      <div style={{ flexShrink: 0 }}><ListFolderIcon node={node}/></div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: node.isDir ? 500 : 400, color: isSelected ? '#d8b4fe' : 'rgba(255,255,255,0.88)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{node.name}</div>
        <div style={{ height: 2, background: 'rgba(255,255,255,0.08)', borderRadius: 1, marginTop: 3 }}>
          <div style={{ height: '100%', borderRadius: 1, width: `${barPct}%`, background: node.isDir ? `linear-gradient(90deg, ${ACCENT}CC, ${ACCENT}55)` : 'rgba(255,255,255,0.22)' }}/>
        </div>
      </div>
      <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.42)', fontVariantNumeric: 'tabular-nums', flexShrink: 0, minWidth: 56, textAlign: 'right' }}>{fmtBytes(node.size)}</span>
    </div>
  )
}

// ─── Properties panel ─────────────────────────────────────────────────────────

function PropertiesPanel({ node, meta, onTrash }: { node: TreeNode | null; meta: FileMeta | null; onTrash: () => void }) {
  if (!node) return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.16)', gap: 10, padding: 20 }}>
      <svg width="28" height="28" viewBox="0 0 28 28" fill="none" stroke="currentColor" strokeWidth="1.4"><circle cx="14" cy="14" r="10"/><path d="M14 7v7l4 2.5"/></svg>
      <span style={{ fontSize: 12 }}>Select an item</span>
    </div>
  )
  const d = meta ?? node
  const PropRow = ({ label, value }: { label: string; value: string }) => (
    <div style={{ display: 'flex', gap: 12, padding: '5px 0', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
      <span style={{ width: 90, flexShrink: 0, fontSize: 11, color: 'rgba(255,255,255,0.32)', textAlign: 'right' }}>{label}</span>
      <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.78)', wordBreak: 'break-all' }}>{value}</span>
    </div>
  )
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ padding: '16px 14px 12px', borderBottom: '1px solid rgba(255,255,255,0.07)', flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
        <ListFolderIcon node={node}/>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.88)', textAlign: 'center', wordBreak: 'break-all', lineHeight: 1.3 }}>{node.name}</div>
        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.32)' }}>{node.kind}</div>
      </div>
      <div style={{ flex: 1, overflow: 'auto', padding: '8px 14px' }}>
        <PropRow label="Size" value={fmtBytes(d.size)} />
        <PropRow label="On Disk" value={fmtBytes(d.sizeOnDisk)} />
        {node.isDir && <PropRow label="Contains" value={`${node.childCount} items`} />}
        <PropRow label="Kind" value={node.kind} />
        <PropRow label="Modified" value={fmtDate(d.modifiedAt)} />
        <PropRow label="Permissions" value={d.permissions} />
      </div>
      <div style={{ padding: '10px 14px', borderTop: '1px solid rgba(255,255,255,0.07)', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
        <button onClick={() => window.electron.openInFinder(node.path)} style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 7, padding: '6px 10px', color: 'rgba(255,255,255,0.78)', fontSize: 11, cursor: 'pointer' }}>Show in Finder</button>
        <button onClick={onTrash} style={{ background: 'rgba(255,69,58,0.12)', border: '1px solid rgba(255,69,58,0.28)', borderRadius: 7, padding: '6px 10px', color: '#ff7b72', fontSize: 11, cursor: 'pointer' }}>Move to Trash</button>
      </div>
    </div>
  )
}

// ─── Hero landing ─────────────────────────────────────────────────────────────

function SpaceLensHero({ onScan }: { onScan: () => void }) {
  const [scanning, setScanning] = useState(false)
  return (
    <div style={{ height: '100%', display: 'flex', alignItems: 'center' }}>
      <div style={{ flex: '0 0 50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ position: 'relative', width: 300, height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', animation: 'float 4s ease-in-out infinite' }}>
          <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: `radial-gradient(ellipse, ${ACCENT}28 0%, transparent 70%)`, filter: 'blur(28px)' }}/>
          <div style={{ width: 240, height: 240, borderRadius: '55% 45% 50% 50% / 48% 52% 48% 52%', background: 'radial-gradient(ellipse at 38% 30%, rgba(160,120,255,0.92) 0%, rgba(100,70,220,0.88) 35%, rgba(40,20,130,0.94) 70%, rgba(10,4,50,0.96) 100%)', boxShadow: `0 30px 80px ${ACCENT}55, 0 0 0 1.5px rgba(180,140,255,0.18) inset`, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden', animation: 'blob-morph 6s ease-in-out infinite' }}>
            <div style={{ position: 'absolute', top: '10%', left: '16%', width: '42%', height: '28%', borderRadius: '50%', background: 'radial-gradient(ellipse, rgba(220,200,255,0.35) 0%, transparent 80%)' }}/>
            <svg width="96" height="96" viewBox="0 0 96 96" fill="none" style={{ position: 'relative', zIndex: 1, filter: 'drop-shadow(0 6px 20px rgba(0,0,80,0.5))' }}>
              <circle cx="42" cy="42" r="30" stroke="rgba(255,255,255,0.85)" strokeWidth="6" fill="none"/>
              <circle cx="42" cy="42" r="16" stroke="rgba(255,255,255,0.50)" strokeWidth="4" fill="rgba(255,255,255,0.08)"/>
              <line x1="66" y1="66" x2="88" y2="88" stroke="rgba(255,255,255,0.80)" strokeWidth="7" strokeLinecap="round"/>
            </svg>
          </div>
        </div>
      </div>
      <div style={{ flex: '0 0 50%', paddingRight: 16 }}>
        <h1 style={{ fontSize: 42, fontWeight: 700, letterSpacing: '-0.03em', lineHeight: 1.1, marginBottom: 10 }}>Space Lens</h1>
        <p style={{ fontSize: 15, color: 'rgba(255,255,255,0.55)', lineHeight: 1.5, marginBottom: 32, maxWidth: 360 }}>Visualize what's taking up the most disk space and clean up quickly.</p>
        <div style={{ marginBottom: 36 }}>
          {[
            { label: 'Visual Storage Map', icon: <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4"><rect x="1" y="1" width="6" height="6" rx="1"/><rect x="9" y="1" width="6" height="6" rx="1"/><rect x="1" y="9" width="6" height="6" rx="1"/><rect x="9" y="9" width="6" height="6" rx="1"/></svg> },
            { label: '1 GB+ items shown individually', icon: <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4"><circle cx="8" cy="8" r="6"/><circle cx="8" cy="8" r="2.5" fill="currentColor" stroke="none"/></svg> },
            { label: 'Navigate & remove large files', icon: <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"><path d="M2 4h12M2 8h12M2 12h8"/></svg> },
          ].map(f => (
            <div key={f.label} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '11px 0', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
              <div style={{ width: 34, height: 34, borderRadius: 9, background: `${ACCENT}28`, border: `1px solid ${ACCENT}44`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(200,170,255,0.9)', flexShrink: 0 }}>{f.icon}</div>
              <span style={{ fontSize: 15, fontWeight: 500 }}>{f.label}</span>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: 8 }}>
          <button onClick={async () => { setScanning(true); await onScan() }} disabled={scanning}
            className="scan-orb" data-scanning={scanning}>
            {scanning
              ? <svg width="22" height="22" viewBox="0 0 22 22" fill="none" className="animate-spin"><circle cx="11" cy="11" r="7.5" stroke="rgba(255,255,255,0.22)" strokeWidth="2.5"/><path d="M11 3.5a7.5 7.5 0 0 1 7.5 7.5" stroke="white" strokeWidth="2.5" strokeLinecap="round"/></svg>
              : <span style={{ fontSize: 18, fontWeight: 700 }}>Scan</span>}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

interface NavEntry { path: string; nodes: TreeNode[]; label: string }
interface RemoveResult { count: number; totalSize: number }

export default function SpaceLens() {
  const [currentPath,   setCurrentPath]   = useState<string | null>(null)
  const [currentNodes,  setCurrentNodes]  = useState<TreeNode[]>([])
  const [navStack,      setNavStack]      = useState<NavEntry[]>([])
  const [navDir,        setNavDir]        = useState<'forward' | 'backward'>('forward')
  const [animKey,       setAnimKey]       = useState(0)
  const [scanning,      setScanning]      = useState(false)
  const [checked,       setChecked]       = useState<Set<string>>(new Set())
  const [selected,      setSelected]      = useState<TreeNode | null>(null)
  const [meta,          setMeta]          = useState<FileMeta | null>(null)
  const [hoveredPath,   setHoveredPath]   = useState<string | null>(null)
  const [diskStats,     setDiskStats]     = useState<DiskStats | null>(null)
  const [showProps,     setShowProps]     = useState(false)
  const [tooltip,       setTooltip]       = useState<TooltipData | null>(null)
  const [otherExpanded, setOtherExpanded] = useState(false)
  const [reviewItems,   setReviewItems]   = useState<ReviewItem[] | null>(null)
  const [removing,      setRemoving]      = useState(false)
  const [removeResult,  setRemoveResult]  = useState<RemoveResult | null>(null)
  const [contextMenu,   setContextMenu]   = useState<ContextMenuState | null>(null)
  const [scanFile,      setScanFile]      = useState('')
  const chartContainerRef = useRef<HTMLDivElement>(null)

  // Smart grouping: items ≥1 GB get individual bubbles, rest → "Other items"
  const { bigNodes, smallNodes, otherNode, bubbleNodes } = useMemo(() => {
    const big = currentNodes.filter(n => n.size >= BUBBLE_THRESHOLD)
    const small = currentNodes.filter(n => n.size < BUBBLE_THRESHOLD)
    const other = small.length > 0 ? makeOtherNode(small) : null
    return { bigNodes: big, smallNodes: small, otherNode: other, bubbleNodes: other ? [...big, other] : big }
  }, [currentNodes])

  // Resolve "Other" checkbox into actual paths
  const resolvedChecked = useMemo(() => {
    const paths = new Set(checked)
    if (paths.has(OTHER_PATH)) {
      smallNodes.forEach(n => paths.add(n.path))
      paths.delete(OTHER_PATH)
    }
    return paths
  }, [checked, smallNodes])

  const checkedSize = useMemo(() =>
    currentNodes.filter(n => resolvedChecked.has(n.path)).reduce((s, n) => s + n.size, 0),
    [currentNodes, resolvedChecked]
  )

  useEffect(() => {
    window.electron.getDiskStats().then(s => setDiskStats(s)).catch(() => {})
  }, [])

  useEffect(() => {
    if (!selected || selected.path === OTHER_PATH) { setMeta(null); return }
    window.electron.fileMeta(selected.path).then(m => setMeta(m)).catch(() => setMeta(null))
  }, [selected])

  const doScan = useCallback(async (path: string): Promise<TreeNode[]> => {
    const nodes = await window.electron.scanDir(path)
    return [...nodes].sort((a, b) => b.size - a.size)
  }, [])

  const handleInitialScan = async () => {
    const home = window.electron.homeDir
    setScanning(true)
    setScanFile(home)
    try {
      const nodes = await doScan(home)
      setCurrentPath(home); setNavStack([])
      setChecked(new Set()); setSelected(null)
      setCurrentNodes(nodes)
    } finally {
      setScanning(false)
      setScanFile('')
    }
  }

  const handleNavigate = async (node: TreeNode) => {
    if (!node.isDir || node.path === OTHER_PATH) return
    setNavDir('forward')
    setNavStack(prev => [...prev, { path: currentPath!, nodes: currentNodes, label: currentPath!.split('/').pop() || currentPath! }])
    setScanning(true); setCurrentPath(node.path); setChecked(new Set()); setSelected(null); setTooltip(null)
    try { setCurrentNodes(await doScan(node.path)); setAnimKey(k => k + 1) } finally { setScanning(false) }
  }

  const handleBack = async () => {
    if (navStack.length === 0) return
    const prev = navStack[navStack.length - 1]
    setNavDir('backward'); setNavStack(p => p.slice(0, -1))
    setCurrentPath(prev.path); setCurrentNodes(prev.nodes)
    setChecked(new Set()); setSelected(null); setTooltip(null)
    setAnimKey(k => k + 1)
  }

  const handleStartOver = () => {
    setCurrentPath(null); setCurrentNodes([]); setNavStack([])
    setChecked(new Set()); setSelected(null); setTooltip(null)
  }

  const handleCheck = useCallback((path: string, on: boolean) => {
    setChecked(prev => {
      const next = new Set(prev)
      if (on) next.add(path); else next.delete(path)
      return next
    })
  }, [])

  const buildCrumbs = (nodePath: string): string[] => {
    const parts = nodePath.split('/').filter(Boolean)
    return parts.length > 3 ? ['Macintosh HD', '…', parts[parts.length - 2]] : ['Macintosh HD', ...parts.slice(0, -1)]
  }

  const handleReviewAndRemove = () => {
    if (resolvedChecked.size === 0) return
    const items: ReviewItem[] = currentNodes
      .filter(n => resolvedChecked.has(n.path))
      .map(n => ({ node: n, pathCrumbs: buildCrumbs(n.path) }))
    setReviewItems(items)
  }

  // Optimistic delete: update in-memory state without rescanning
  const doRemove = async () => {
    if (!reviewItems) return
    setRemoving(true)
    const items = reviewItems.map(({ node }) => ({
      path: node.path, name: node.name, size: node.size,
      category: 'large-files' as const, modifiedAt: node.modifiedAt,
    }))
    const totalSize = items.reduce((s, i) => s + i.size, 0)
    const removedPaths = new Set(items.map(i => i.path))
    try {
      await window.electron.cleanItems(items)
      // Remove deleted nodes from current level — no rescan needed
      setCurrentNodes(prev => prev.filter(n => !removedPaths.has(n.path)))
      // Propagate size reduction to ancestor nodes in navStack
      setNavStack(prev => prev.map((entry, stackIdx) => {
        const pathAfterEntry = currentPath?.slice(entry.path.length + 1) ?? ''
        const childSegment = pathAfterEntry.split('/')[0]
        return {
          ...entry,
          nodes: entry.nodes.map(n => {
            if (n.name === childSegment || (stackIdx === prev.length - 1 && removedPaths.has(n.path))) {
              return { ...n, size: Math.max(0, n.size - totalSize), sizeOnDisk: Math.max(0, n.sizeOnDisk - totalSize) }
            }
            return n
          })
        }
      }))
      setRemoveResult({ count: items.length, totalSize })
      setReviewItems(null); setChecked(new Set()); setSelected(null)
      // Refresh disk stats after deletion
      window.electron.getDiskStats().then(s => setDiskStats(s)).catch(() => {})
    } finally { setRemoving(false) }
  }

  const handleTooltipShow = useCallback((node: TreeNode, evt: React.MouseEvent) => {
    setTooltip({ node, mouseX: evt.clientX, mouseY: evt.clientY })
  }, [])
  const handleTooltipHide = useCallback(() => setTooltip(null), [])

  const handleContextMenu = useCallback((node: TreeNode, x: number, y: number) => {
    setContextMenu({ node, x, y })
    setTooltip(null)
  }, [])

  const contextMenuSelect = (node: TreeNode) => {
    const path = node.path === OTHER_PATH ? OTHER_PATH : node.path
    setChecked(prev => { const n = new Set(prev); if (n.has(path)) n.delete(path); else n.add(path); return n })
    setContextMenu(null)
  }
  const contextMenuReveal = (node: TreeNode) => {
    if (node.path !== OTHER_PATH) window.electron.openInFinder(node.path)
    setContextMenu(null)
  }
  const contextMenuGetInfo = (node: TreeNode) => {
    setSelected(node); setShowProps(true)
    setContextMenu(null)
  }
  const contextMenuQuickLook = (node: TreeNode) => {
    if (node.path !== OTHER_PATH) window.electron.quickLook(node.path)
    setContextMenu(null)
  }

  if (!currentPath && !scanning) return <SpaceLensHero onScan={handleInitialScan} />

  if (scanning && navStack.length === 0) {
    return (
      <HeroScanScreen
        hero={
          <div style={{ position: 'relative', width: 300, height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', animation: 'float 4s ease-in-out infinite' }}>
            <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: `radial-gradient(ellipse, ${ACCENT}28 0%, transparent 70%)`, filter: 'blur(28px)' }}/>
            <div style={{ width: 240, height: 240, borderRadius: '55% 45% 50% 50% / 48% 52% 48% 52%', background: 'radial-gradient(ellipse at 38% 30%, rgba(160,120,255,0.92) 0%, rgba(100,70,220,0.88) 35%, rgba(40,20,130,0.94) 70%, rgba(10,4,50,0.96) 100%)', boxShadow: `0 30px 80px ${ACCENT}55, 0 0 0 1.5px rgba(180,140,255,0.18) inset`, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden', animation: 'blob-morph 6s ease-in-out infinite' }}>
              <div style={{ position: 'absolute', top: '10%', left: '16%', width: '42%', height: '28%', borderRadius: '50%', background: 'radial-gradient(ellipse, rgba(220,200,255,0.35) 0%, transparent 80%)' }}/>
              <svg width="96" height="96" viewBox="0 0 96 96" fill="none" style={{ position: 'relative', zIndex: 1, filter: 'drop-shadow(0 6px 20px rgba(0,0,80,0.5))' }}>
                <circle cx="42" cy="42" r="30" stroke="rgba(255,255,255,0.85)" strokeWidth="6" fill="none"/>
                <circle cx="42" cy="42" r="16" stroke="rgba(255,255,255,0.50)" strokeWidth="4" fill="rgba(255,255,255,0.08)"/>
                <line x1="66" y1="66" x2="88" y2="88" stroke="rgba(255,255,255,0.80)" strokeWidth="7" strokeLinecap="round"/>
              </svg>
            </div>
          </div>
        }
        title="Visualizing your storage…"
        currentFile={scanFile}
        onStop={() => { setScanning(false); setCurrentPath(null) }}
      />
    )
  }

  const maxSize = currentNodes[0]?.size ?? 1
  const totalSize = currentNodes.reduce((s, n) => s + n.size, 0)
  const folderName = currentPath?.split('/').pop() || 'Volume'
  const diskPct = diskStats ? (diskStats.usedBytes / diskStats.totalBytes) * 100 : 0
  const volName = diskStats?.volumeName || 'Macintosh HD'
  const crumbSegments = [
    { label: 'Macintosh HD' },
    ...navStack.map(e => ({ label: e.label })),
    { label: folderName },
  ]
  const animClass = navDir === 'forward' ? 'nav-enter-forward' : 'nav-enter-backward'
  const totalCheckedCount = resolvedChecked.size
  const otherAllChecked = checked.has(OTHER_PATH)
  const otherSomeChecked = otherAllChecked || smallNodes.some(n => checked.has(n.path))

  return (
    <>
      {reviewItems && <ReviewModal items={reviewItems} onRemove={doRemove} onClose={() => setReviewItems(null)} removing={removing}/>}
      {removeResult && <CompletionModal count={removeResult.count} totalSize={removeResult.totalSize} onDone={() => setRemoveResult(null)}/>}
      {contextMenu && <ContextMenu menu={contextMenu} onClose={() => setContextMenu(null)}
        onSelect={contextMenuSelect} onReveal={contextMenuReveal}
        onGetInfo={contextMenuGetInfo} onQuickLook={contextMenuQuickLook}/>}

      <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>

        {/* Top bar */}
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 10, flexShrink: 0 }}>
          <button onClick={handleStartOver}
            style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, padding: '6px 12px', color: 'rgba(255,255,255,0.75)', fontSize: 12, fontWeight: 500, cursor: 'pointer' }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.13)'}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.08)'}>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M10 6H3M6 3L3 6l3 3"/></svg>
            Start Over
          </button>
          <div style={{ flex: 1, textAlign: 'center' }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: 'rgba(255,255,255,0.75)' }}>Space Lens</span>
          </div>
          <button onClick={() => setShowProps(v => !v)}
            style={{ background: showProps ? `${ACCENT}33` : 'rgba(255,255,255,0.08)', border: `1px solid ${showProps ? ACCENT+'66' : 'rgba(255,255,255,0.12)'}`, borderRadius: 8, padding: '6px 12px', color: showProps ? '#d8b4fe' : 'rgba(255,255,255,0.6)', fontSize: 12, cursor: 'pointer' }}>
            Info
          </button>
        </div>

        {/* Breadcrumb nav bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 14px', background: 'rgba(0,0,0,0.22)', border: '1px solid rgba(255,255,255,0.10)', borderRadius: 10, marginBottom: 12, flexShrink: 0 }}>
          <button onClick={handleBack} disabled={navStack.length === 0}
            style={{ width: 26, height: 26, borderRadius: 6, border: '1px solid rgba(255,255,255,0.12)', background: navStack.length > 0 ? 'rgba(255,255,255,0.08)' : 'transparent', color: navStack.length > 0 ? 'rgba(255,255,255,0.75)' : 'rgba(255,255,255,0.2)', cursor: navStack.length > 0 ? 'pointer' : 'default', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M7 2L4 5l3 3"/></svg>
          </button>
          <button disabled style={{ width: 26, height: 26, borderRadius: 6, border: '1px solid rgba(255,255,255,0.07)', background: 'transparent', color: 'rgba(255,255,255,0.2)', cursor: 'default', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M3 2l3 3-3 3"/></svg>
          </button>
          <div style={{ width: 1, height: 16, background: 'rgba(255,255,255,0.10)', flexShrink: 0 }}/>
          <div style={{ display: 'flex', alignItems: 'center', gap: 2, overflow: 'hidden', flex: 1 }}>
            {crumbSegments.map((seg, i) => {
              const isLast = i === crumbSegments.length - 1
              return (
                <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 2, minWidth: 0 }}>
                  <button onClick={isLast ? undefined : () => { const back = crumbSegments.length-1-i; for (let s=0;s<back;s++) handleBack() }}
                    style={{ background: 'none', border: 'none', padding: '0 2px', fontSize: 12, fontWeight: isLast ? 600 : 400, color: isLast ? 'rgba(255,255,255,0.88)' : 'rgba(255,255,255,0.50)', cursor: isLast ? 'default' : 'pointer', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: isLast ? 180 : 80 }}>
                    {seg.label}
                  </button>
                  {!isLast && <span style={{ color: 'rgba(255,255,255,0.28)', fontSize: 11, flexShrink: 0 }}>›</span>}
                </span>
              )
            })}
          </div>
        </div>

        {/* Two-panel content */}
        <div key={animKey} className={animClass} style={{ flex: 1, display: 'flex', minHeight: 0, overflow: 'hidden', borderRadius: 14, border: '1px solid rgba(255,255,255,0.10)' }}>

          {/* Left: folder list */}
          <div style={{ width: 320, flexShrink: 0, display: 'flex', flexDirection: 'column', background: 'rgba(0,0,0,0.28)', borderRight: '1px solid rgba(255,255,255,0.08)' }}>
            <div style={{ padding: '14px 16px 10px', borderBottom: '1px solid rgba(255,255,255,0.07)', flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 36, height: 36, borderRadius: 8, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <ListFolderIcon node={{ isDir: true, name: folderName }}/>
                </div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'rgba(255,255,255,0.90)' }}>{folderName}</div>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.38)', marginTop: 1 }}>{fmtBytes(totalSize)} · {currentNodes.length} items</div>
                </div>
              </div>
            </div>
            <div style={{ padding: '7px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)' }}>Select:</span>
              <button onClick={() => setChecked(new Set())} style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 6px', borderRadius: 4 }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.07)'}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'none'}>None</button>
              <button onClick={() => setChecked(new Set(currentNodes.map(n => n.path)))} style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 6px', borderRadius: 4 }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.07)'}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'none'}>All</button>
            </div>
            {/* Scrollable list: big items + Other items collapsible */}
            <div style={{ flex: 1, overflow: 'auto', padding: '4px 0' }}>
              {scanning ? (
                <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, color: 'rgba(255,255,255,0.28)' }}>
                  <svg width="22" height="22" viewBox="0 0 22 22" fill="none" className="animate-spin"><circle cx="11" cy="11" r="7.5" stroke="rgba(255,255,255,0.2)" strokeWidth="2"/><path d="M11 3.5a7.5 7.5 0 0 1 7.5 7.5" stroke="white" strokeWidth="2" strokeLinecap="round"/></svg>
                  <span style={{ fontSize: 12 }}>Scanning…</span>
                </div>
              ) : (
                <>
                  {bigNodes.map(node => (
                    <FolderRow key={node.path} node={node}
                      isSelected={selected?.path === node.path} isChecked={checked.has(node.path)}
                      maxSize={maxSize} isHovered={hoveredPath === node.path}
                      onSelect={setSelected} onCheck={handleCheck} onDrillDown={handleNavigate} onHover={setHoveredPath}
                      onContextMenu={handleContextMenu}/>
                  ))}
                  {otherNode && smallNodes.length > 0 && (
                    <>
                      {/* Other items section header */}
                      <div onClick={() => setOtherExpanded(v => !v)}
                        style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px 6px', margin: '4px 4px 0', cursor: 'pointer', borderRadius: 6, transition: 'background 0.1s' }}
                        onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.05)'}
                        onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}>
                        <input type="checkbox" checked={otherAllChecked}
                          ref={el => { if (el) el.indeterminate = !otherAllChecked && otherSomeChecked }}
                          onChange={e => { e.stopPropagation(); handleCheck(OTHER_PATH, e.target.checked) }}
                          onClick={e => e.stopPropagation()}
                          style={{ flexShrink: 0, accentColor: ACCENT, cursor: 'pointer', width: 13, height: 13 }}/>
                        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="rgba(255,255,255,0.45)" strokeWidth="1.5"
                          style={{ transform: otherExpanded ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.18s', flexShrink: 0 }}>
                          <path d="M3 2l4 3-4 3"/>
                        </svg>
                        <ListFolderIcon node={{ isDir: false, path: OTHER_PATH }}/>
                        <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)', fontWeight: 500, flex: 1 }}>Other items</span>
                        <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.38)', fontVariantNumeric: 'tabular-nums' }}>{fmtBytes(otherNode.size)}</span>
                      </div>
                      {otherExpanded && (
                        <div style={{ paddingLeft: 14, overflow: 'hidden' }}>
                          {smallNodes.map(node => (
                            <FolderRow key={node.path} node={node}
                              isSelected={selected?.path === node.path}
                              isChecked={checked.has(node.path) || otherAllChecked}
                              maxSize={maxSize} isHovered={hoveredPath === node.path}
                              onSelect={setSelected} onCheck={handleCheck} onDrillDown={handleNavigate} onHover={setHoveredPath}
                              onContextMenu={handleContextMenu}/>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </>
              )}
            </div>
            <div style={{ padding: '9px 16px', borderTop: '1px solid rgba(255,255,255,0.07)', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 14, height: 14, borderRadius: '50%', background: 'rgba(155,92,232,0.25)', border: `1px solid ${ACCENT}44`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <span style={{ fontSize: 8, color: `${ACCENT}CC`, fontStyle: 'italic' }}>i</span>
              </div>
              <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.42)', flex: 1 }}>Purgeable Space</span>
              {diskStats && <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', fontVariantNumeric: 'tabular-nums' }}>{fmtBytes(diskStats.freeBytes)}</span>}
            </div>
          </div>

          {/* Center: bubble chart */}
          <div ref={chartContainerRef} style={{ flex: 1, minWidth: 0, background: 'linear-gradient(160deg, rgba(30,14,75,0.5) 0%, rgba(15,6,40,0.4) 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', width: 300, height: 300, borderRadius: '50%', left: '50%', top: '50%', transform: 'translate(-50%,-50%)', background: `radial-gradient(ellipse, ${ACCENT}12 0%, transparent 70%)`, filter: 'blur(40px)', pointerEvents: 'none' }}/>
            {scanning ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, color: 'rgba(255,255,255,0.30)' }}>
                <svg width="32" height="32" viewBox="0 0 32 32" fill="none" className="animate-spin"><circle cx="16" cy="16" r="11" stroke="rgba(255,255,255,0.2)" strokeWidth="2.5"/><path d="M16 5a11 11 0 0 1 11 11" stroke="white" strokeWidth="2.5" strokeLinecap="round"/></svg>
                <span style={{ fontSize: 13 }}>Computing sizes…</span>
              </div>
            ) : (
              <BubbleChart nodes={bubbleNodes} onNavigate={handleNavigate}
                hoveredPath={hoveredPath} onHover={setHoveredPath}
                onTooltipShow={handleTooltipShow} onTooltipHide={handleTooltipHide}
                checkedPaths={checked} onCheck={handleCheck}
                onContextMenu={handleContextMenu}/>
            )}
            {tooltip && <BubbleTooltip data={tooltip} containerRef={chartContainerRef}/>}
          </div>

          {/* Right: properties */}
          {showProps && (
            <div style={{ width: 220, flexShrink: 0, background: 'rgba(0,0,0,0.28)', borderLeft: '1px solid rgba(255,255,255,0.08)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
              <PropertiesPanel node={selected} meta={meta} onTrash={() => selected && setReviewItems([{ node: selected, pathCrumbs: buildCrumbs(selected.path) }])}/>
            </div>
          )}
        </div>

        {/* Bottom status bar */}
        <div style={{ flexShrink: 0, paddingTop: 10, display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.70)' }}>{volName}</span>
              {diskStats && <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.38)' }}>{fmtBytes(diskStats.usedBytes)} of {fmtBytes(diskStats.totalBytes)} used</span>}
            </div>
            <div style={{ height: 4, background: 'rgba(255,255,255,0.10)', borderRadius: 3 }}>
              <div style={{ height: '100%', borderRadius: 3, width: `${Math.min(100, diskPct)}%`, background: `linear-gradient(90deg, ${ACCENT}, #7040D0)`, transition: 'width 0.4s ease' }}/>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'rgba(255,255,255,0.40)', fontSize: 12 }}>
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.3"><circle cx="6" cy="6" r="5"/><path d="M6 3v3l2 1.5"/></svg>
              {totalCheckedCount === 0
                ? <span>No items selected &nbsp; 0 KB</span>
                : <span>{totalCheckedCount} item{totalCheckedCount !== 1 ? 's' : ''} selected &nbsp;|&nbsp; {fmtBytes(checkedSize)}</span>}
            </div>
            <button onClick={handleReviewAndRemove} disabled={totalCheckedCount === 0}
              style={{ padding: '8px 18px', borderRadius: 10, fontSize: 13, fontWeight: 600, border: 'none', cursor: totalCheckedCount > 0 ? 'pointer' : 'not-allowed', background: totalCheckedCount > 0 ? `linear-gradient(135deg, ${ACCENT}, #7040D0)` : 'rgba(255,255,255,0.08)', color: totalCheckedCount > 0 ? 'white' : 'rgba(255,255,255,0.28)', boxShadow: totalCheckedCount > 0 ? `0 4px 16px ${ACCENT}44` : 'none', transition: 'all 0.15s' }}>
              Review and Remove
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
