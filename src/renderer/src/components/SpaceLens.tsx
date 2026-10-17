import { useState, useCallback, useRef, useEffect } from 'react'
import type { TreeNode, FileMeta } from '../../../shared/types'

// ─── Formatting helpers ───────────────────────────────────────────────────────

function fmtBytes(n: number): string {
  if (n >= 1e9) return (n / 1e9).toFixed(2) + ' GB'
  if (n >= 1e6) return (n / 1e6).toFixed(1) + ' MB'
  if (n >= 1e3) return (n / 1e3).toFixed(0) + ' KB'
  return n + ' bytes'
}

function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString('en-US', {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit'
    })
  } catch { return iso }
}

function kindIcon(node: TreeNode): string {
  if (node.isDir) return '📁'
  if (node.isSymlink) return '🔗'
  const e = node.ext.toLowerCase().replace(/^\./, '')
  if (['png','jpg','jpeg','gif','webp','heic','tiff','psd','svg'].includes(e)) return '🖼️'
  if (['mp4','mov','avi','mkv','m4v'].includes(e)) return '🎬'
  if (['mp3','aac','flac','wav','m4a','aiff'].includes(e)) return '🎵'
  if (['pdf'].includes(e)) return '📕'
  if (['docx','doc','rtf'].includes(e)) return '📝'
  if (['xlsx','xls','csv'].includes(e)) return '📊'
  if (['pptx','ppt'].includes(e)) return '📊'
  if (['zip','tar','gz','bz2','xz','7z'].includes(e)) return '🗜️'
  if (['dmg','iso','pkg'].includes(e)) return '💿'
  if (['app'].includes(e)) return '📦'
  if (['sh','bash','zsh','py','rb'].includes(e)) return '⚙️'
  if (['ts','tsx','js','jsx','swift','kt','java','go','rs','c','cpp'].includes(e)) return '📄'
  if (['json','xml','yaml','yml','toml'].includes(e)) return '📋'
  if (['log'].includes(e)) return '🗒️'
  if (['db','sqlite'].includes(e)) return '🗄️'
  return '📄'
}

// ─── Tree node row ────────────────────────────────────────────────────────────

interface RowProps {
  node: TreeNode
  depth: number
  isExpanded: boolean
  isSelected: boolean
  isLoading: boolean
  isChecked: boolean
  maxSize: number
  onToggle: (path: string) => void
  onSelect: (node: TreeNode) => void
  onCheck: (path: string, checked: boolean) => void
}

function TreeRow({
  node, depth, isExpanded, isSelected, isLoading, isChecked, maxSize,
  onToggle, onSelect, onCheck
}: RowProps) {
  const barWidth = maxSize > 0 ? Math.max(2, (node.size / maxSize) * 100) : 0

  return (
    <div
      onClick={() => onSelect(node)}
      style={{
        display: 'flex',
        alignItems: 'center',
        padding: '3px 12px 3px 0',
        paddingLeft: 12 + depth * 20,
        cursor: 'pointer',
        background: isSelected ? 'rgba(168,85,247,0.18)' : 'transparent',
        borderRadius: 6,
        userSelect: 'none',
        gap: 6,
        minHeight: 28,
        transition: 'background 0.1s',
      }}
      onMouseEnter={e => {
        if (!isSelected) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.05)'
      }}
      onMouseLeave={e => {
        if (!isSelected) (e.currentTarget as HTMLElement).style.background = 'transparent'
      }}
    >
      {/* Expand arrow */}
      <span
        onClick={e => { e.stopPropagation(); if (node.hasChildren) onToggle(node.path) }}
        style={{
          width: 16, textAlign: 'center', flexShrink: 0,
          color: node.hasChildren ? 'rgba(255,255,255,0.5)' : 'transparent',
          fontSize: 10, cursor: node.hasChildren ? 'pointer' : 'default',
          transform: isExpanded ? 'rotate(90deg)' : 'none',
          display: 'inline-block',
          transition: 'transform 0.15s',
        }}
      >
        {isLoading ? '◌' : '▶'}
      </span>

      {/* Checkbox */}
      <input
        type="checkbox"
        checked={isChecked}
        onChange={e => { e.stopPropagation(); onCheck(node.path, e.target.checked) }}
        onClick={e => e.stopPropagation()}
        style={{ flexShrink: 0, accentColor: '#a855f7', cursor: 'pointer' }}
      />

      {/* Icon */}
      <span style={{ fontSize: 14, flexShrink: 0 }}>{kindIcon(node)}</span>

      {/* Name */}
      <span style={{
        flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        fontSize: 13, color: isSelected ? '#e9d5ff' : 'rgba(255,255,255,0.88)',
        fontWeight: node.isDir ? 500 : 400,
      }}>
        {node.name}
      </span>

      {/* Size bar + label */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        <div style={{ width: 80, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.1)' }}>
          <div style={{
            width: `${barWidth}%`, height: '100%', borderRadius: 2,
            background: node.isDir
              ? 'linear-gradient(90deg,#a855f7,#6366f1)'
              : 'rgba(255,255,255,0.35)',
          }} />
        </div>
        <span style={{
          fontSize: 12, color: 'rgba(255,255,255,0.55)', width: 68,
          textAlign: 'right', fontVariantNumeric: 'tabular-nums',
        }}>
          {fmtBytes(node.size)}
        </span>
      </div>
    </div>
  )
}

// ─── Properties panel ─────────────────────────────────────────────────────────

function PropRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', gap: 12, padding: '5px 0', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
      <span style={{ width: 110, flexShrink: 0, fontSize: 12, color: 'rgba(255,255,255,0.45)', textAlign: 'right' }}>
        {label}
      </span>
      <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.85)', wordBreak: 'break-all' }}>
        {value}
      </span>
    </div>
  )
}

function PropertiesPanel({ node, meta, onTrash }: {
  node: TreeNode | null
  meta: FileMeta | null
  onTrash: () => void
}) {
  if (!node) {
    return (
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', color: 'rgba(255,255,255,0.2)', gap: 12, padding: 24
      }}>
        <span style={{ fontSize: 40 }}>◎</span>
        <span style={{ fontSize: 13 }}>Select a file or folder</span>
      </div>
    )
  }

  const displayMeta = meta ?? node

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '24px 20px 16px',
        borderBottom: '1px solid rgba(255,255,255,0.08)', flexShrink: 0,
      }}>
        <span style={{ fontSize: 48, marginBottom: 10, lineHeight: 1 }}>{kindIcon(node)}</span>
        <div style={{
          fontSize: 14, fontWeight: 600, color: 'rgba(255,255,255,0.92)',
          textAlign: 'center', wordBreak: 'break-all', maxWidth: '100%',
          lineHeight: 1.3, marginBottom: 4,
        }}>
          {node.name}
        </div>
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>{node.kind}</div>
      </div>

      {/* Properties */}
      <div style={{ flex: 1, overflow: 'auto', padding: '12px 20px' }}>
        <PropRow label="Size" value={fmtBytes(displayMeta.size)} />
        <PropRow label="Size on Disk" value={fmtBytes(displayMeta.sizeOnDisk)} />
        {node.isDir && <PropRow label="Contains" value={`${node.childCount} items`} />}
        <PropRow label="Kind" value={node.kind} />
        <PropRow label="Location" value={
          meta ? meta.parentPath : node.path.slice(0, node.path.lastIndexOf('/')) || '/'
        } />
        <PropRow label="Created"  value={fmtDate(displayMeta.createdAt)} />
        <PropRow label="Modified" value={fmtDate(displayMeta.modifiedAt)} />
        <PropRow label="Last Opened" value={fmtDate(displayMeta.accessedAt)} />
        {!node.isDir && node.ext && <PropRow label="Extension" value={node.ext} />}
        <PropRow label="Permissions" value={displayMeta.permissions} />
        {meta && <PropRow label="Inode" value={String(meta.inode)} />}
      </div>

      {/* Actions */}
      <div style={{ padding: '12px 20px', borderTop: '1px solid rgba(255,255,255,0.08)', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <button
          onClick={() => window.electron.openInFinder(node.path)}
          style={{
            background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: 8, padding: '8px 14px', color: 'rgba(255,255,255,0.85)',
            fontSize: 12, cursor: 'pointer', textAlign: 'center',
          }}
        >
          Show in Finder
        </button>
        <button
          onClick={onTrash}
          style={{
            background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.35)',
            borderRadius: 8, padding: '8px 14px', color: '#fca5a5',
            fontSize: 12, cursor: 'pointer', textAlign: 'center',
          }}
        >
          Move to Trash
        </button>
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

interface TreeState {
  children: Map<string, TreeNode[]>  // path → loaded children
  expanded:  Set<string>
  loading:   Set<string>
}

export default function SpaceLens() {
  const [rootPath,  setRootPath]  = useState<string | null>(null)
  const [rootNodes, setRootNodes] = useState<TreeNode[]>([])
  const [scanning,  setScanning]  = useState(false)
  const [tree, setTree] = useState<TreeState>({
    children: new Map(),
    expanded:  new Set(),
    loading:   new Set(),
  })
  const [checked,  setChecked]  = useState<Set<string>>(new Set())
  const [selected, setSelected] = useState<TreeNode | null>(null)
  const [meta,     setMeta]     = useState<FileMeta | null>(null)

  // Fetch meta whenever selection changes
  useEffect(() => {
    if (!selected) { setMeta(null); return }
    window.electron.fileMeta(selected.path).then(m => setMeta(m)).catch(() => setMeta(null))
  }, [selected])

  const pickFolder = async () => {
    const p = await window.electron.pickFolder()
    if (!p) return
    setRootPath(p)
    setScanning(true)
    setRootNodes([])
    setTree({ children: new Map(), expanded: new Set(), loading: new Set() })
    setChecked(new Set())
    setSelected(null)
    try {
      const nodes = await window.electron.scanDir(p)
      setRootNodes(nodes)
    } finally {
      setScanning(false)
    }
  }

  // Use a ref to check cache without stale closure
  const treeRef = useRef(tree)
  treeRef.current = tree

  const handleToggle = useCallback(async (path: string) => {
    const alreadyCached = treeRef.current.children.has(path)
    const isOpen = treeRef.current.expanded.has(path)

    setTree(prev => {
      const next = {
        children: new Map(prev.children),
        expanded: new Set(prev.expanded),
        loading:  new Set(prev.loading),
      }
      if (isOpen) {
        next.expanded.delete(path)
      } else {
        next.expanded.add(path)
        if (!alreadyCached) next.loading.add(path)
      }
      return next
    })

    if (!isOpen && !alreadyCached) {
      const nodes = await window.electron.scanDir(path)
      setTree(prev => {
        const next = {
          children: new Map(prev.children),
          expanded: new Set(prev.expanded),
          loading:  new Set(prev.loading),
        }
        next.children.set(path, nodes)
        next.loading.delete(path)
        return next
      })
    }
  }, [])

  const handleSelect = useCallback((node: TreeNode) => {
    setSelected(node)
  }, [])

  const handleCheck = useCallback((path: string, on: boolean) => {
    setChecked(prev => {
      const next = new Set(prev)
      if (on) next.add(path); else next.delete(path)
      return next
    })
  }, [])

  const handleTrashSelected = async () => {
    if (!selected) return
    const items = [{
      path: selected.path,
      name: selected.name,
      size: selected.size,
      category: 'large-files' as const,
      modifiedAt: selected.modifiedAt,
    }]
    await window.electron.cleanItems(items)
    // Remove from view after trash
    if (rootPath) {
      setScanning(true)
      const refreshed = await window.electron.scanDir(rootPath)
      setRootNodes(refreshed)
      setTree({ children: new Map(), expanded: new Set(), loading: new Set() })
      setSelected(null)
      setScanning(false)
    }
  }

  const handleTrashChecked = async () => {
    if (checked.size === 0) return
    const allNodes = flatVisibleNodes()
    const items = allNodes
      .filter(({ node }) => checked.has(node.path))
      .map(({ node }) => ({
        path: node.path,
        name: node.name,
        size: node.size,
        category: 'large-files' as const,
        modifiedAt: node.modifiedAt,
      }))
    if (items.length === 0) return
    await window.electron.cleanItems(items)
    if (rootPath) {
      setScanning(true)
      const refreshed = await window.electron.scanDir(rootPath)
      setRootNodes(refreshed)
      setTree({ children: new Map(), expanded: new Set(), loading: new Set() })
      setChecked(new Set())
      setSelected(null)
      setScanning(false)
    }
  }

  // Build flat ordered list of visible rows (depth-first)
  function flatVisibleNodes(): { node: TreeNode; depth: number }[] {
    const result: { node: TreeNode; depth: number }[] = []
    function walk(nodes: TreeNode[], depth: number) {
      for (const n of nodes) {
        result.push({ node: n, depth })
        if (n.isDir && tree.expanded.has(n.path)) {
          const kids = tree.children.get(n.path) ?? []
          walk(kids, depth + 1)
        }
      }
    }
    walk(rootNodes, 0)
    return result
  }

  const visibleRows = flatVisibleNodes()
  const rootMaxSize = rootNodes[0]?.size ?? 1  // largest item = 100% bar width

  const checkedCount = checked.size

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexShrink: 0 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-0.02em' }}>Space Lens</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 4 }}>
            {rootPath ? rootPath : 'Select a folder to explore disk usage'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {checkedCount > 0 && (
            <button
              className="btn-danger"
              onClick={handleTrashChecked}
              style={{
                background: 'rgba(239,68,68,0.2)', border: '1px solid rgba(239,68,68,0.5)',
                borderRadius: 10, padding: '8px 16px', color: '#fca5a5',
                fontSize: 13, cursor: 'pointer', fontWeight: 600,
              }}
            >
              Trash {checkedCount} items
            </button>
          )}
          <button className="btn-primary" onClick={pickFolder} disabled={scanning}>
            {scanning ? (
              <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ display: 'inline-block', animation: 'spin 1s linear infinite' }}>⟳</span>
                Scanning...
              </span>
            ) : rootPath ? 'Change Folder' : 'Choose Folder'}
          </button>
        </div>
      </div>

      {/* Two-panel body */}
      <div style={{ flex: 1, display: 'flex', gap: 12, minHeight: 0 }}>

        {/* Left: tree */}
        <div style={{
          flex: 1, minWidth: 0,
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 16,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}>
          {/* Column header */}
          {rootPath && (
            <div style={{
              display: 'flex', padding: '8px 12px', borderBottom: '1px solid rgba(255,255,255,0.07)',
              fontSize: 11, color: 'rgba(255,255,255,0.35)', flexShrink: 0,
            }}>
              <span style={{ flex: 1, paddingLeft: 42 }}>Name</span>
              <span style={{ width: 80, textAlign: 'right', marginRight: 80 }}>Size</span>
            </div>
          )}

          {/* Tree rows */}
          <div style={{ flex: 1, overflow: 'auto', padding: '4px 4px' }}>
            {!rootPath && !scanning && (
              <div style={{
                height: '100%', display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center',
                color: 'rgba(255,255,255,0.2)', gap: 14,
              }}>
                <span style={{ fontSize: 48 }}>📂</span>
                <span style={{ fontSize: 14 }}>Choose a folder to start exploring</span>
              </div>
            )}

            {scanning && (
              <div style={{
                height: '100%', display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center',
                color: 'rgba(255,255,255,0.35)', gap: 14,
              }}>
                <span style={{ fontSize: 32, display: 'inline-block', animation: 'spin 1s linear infinite' }}>⟳</span>
                <span style={{ fontSize: 14 }}>Computing sizes...</span>
              </div>
            )}

            {!scanning && visibleRows.map(({ node, depth }) => (
              <TreeRow
                key={node.path}
                node={node}
                depth={depth}
                isExpanded={tree.expanded.has(node.path)}
                isSelected={selected?.path === node.path}
                isLoading={tree.loading.has(node.path)}
                isChecked={checked.has(node.path)}
                maxSize={rootMaxSize}
                onToggle={handleToggle}
                onSelect={handleSelect}
                onCheck={handleCheck}
              />
            ))}
          </div>
        </div>

        {/* Right: properties */}
        <div style={{
          width: 260, flexShrink: 0,
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 16,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}>
          <PropertiesPanel
            node={selected}
            meta={meta}
            onTrash={handleTrashSelected}
          />
        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}
