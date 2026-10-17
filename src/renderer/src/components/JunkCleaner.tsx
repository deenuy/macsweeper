import { useState, useEffect, useCallback } from 'react'
import FileRow from './ui/FileRow'
import type { FileItem, ScanCategory, ScanProgress } from '../../../shared/types'
import { CATEGORIES } from '../../../shared/types'

function formatBytes(n: number): string {
  if (n >= 1e9) return (n / 1e9).toFixed(1) + ' GB'
  if (n >= 1e6) return (n / 1e6).toFixed(1) + ' MB'
  if (n >= 1e3) return (n / 1e3).toFixed(0) + ' KB'
  return n + ' B'
}

type ScanState = 'idle' | 'scanning' | 'done' | 'cleaning'

interface CategoryState {
  items: FileItem[]
  size: number
  found: number
  status: 'pending' | 'scanning' | 'done'
}

export default function JunkCleaner() {
  const [scanState, setScanState] = useState<ScanState>('idle')
  const [categories, setCategories] = useState<Record<ScanCategory, CategoryState>>(
    Object.fromEntries(
      CATEGORIES.map(c => [c.id, { items: [], size: 0, found: 0, status: 'pending' }])
    ) as Record<ScanCategory, CategoryState>
  )
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [activeCategory, setActiveCategory] = useState<ScanCategory>('user-cache')
  const [cleanDone, setCleanDone] = useState<{ cleaned: number; size: number } | null>(null)

  useEffect(() => {
    const unsub = window.electron.onScanProgress((p: ScanProgress) => {
      if (p.category === 'duplicates') return
      setCategories(prev => ({
        ...prev,
        [p.category]: {
          ...prev[p.category as ScanCategory],
          found: p.found,
          size: p.size,
          status: p.status === 'done' ? 'done' : 'scanning'
        }
      }))
    })
    return unsub
  }, [])

  const runScan = async () => {
    setScanState('scanning')
    setSelected(new Set())
    setCleanDone(null)

    setCategories(
      Object.fromEntries(
        CATEGORIES.map(c => [c.id, { items: [], size: 0, found: 0, status: 'scanning' }])
      ) as Record<ScanCategory, CategoryState>
    )

    try {
      const result = await window.electron.scanAll()
      const newCats = { ...categories }
      for (const [catId, items] of Object.entries(result)) {
        const cat = catId as ScanCategory
        newCats[cat] = {
          items: items as FileItem[],
          size: (items as FileItem[]).reduce((a, f) => a + f.size, 0),
          found: (items as FileItem[]).length,
          status: 'done'
        }
      }
      setCategories(newCats)

      // Auto-select all
      const allPaths = new Set(Object.values(result).flat().map((f: unknown) => (f as FileItem).path))
      setSelected(allPaths)
      setScanState('done')
    } catch (err) {
      console.error(err)
      setScanState('idle')
    }
  }

  const clean = async () => {
    const allItems = Object.values(categories).flatMap(c => c.items)
    const toClean = allItems.filter(f => selected.has(f.path))
    if (toClean.length === 0) return

    setScanState('cleaning')
    const result = await window.electron.cleanItems(toClean)
    if (!result.cancelled) {
      setCleanDone({ cleaned: result.cleaned, size: result.totalSize })
      // Remove cleaned items
      setCategories(prev => {
        const next = { ...prev }
        const cleanedPaths = new Set(toClean.map(f => f.path))
        for (const cat of Object.keys(next) as ScanCategory[]) {
          next[cat] = {
            ...next[cat],
            items: next[cat].items.filter(f => !cleanedPaths.has(f.path)),
            size: next[cat].items.filter(f => !cleanedPaths.has(f.path)).reduce((a, f) => a + f.size, 0),
            found: next[cat].items.filter(f => !cleanedPaths.has(f.path)).length
          }
        }
        return next
      })
      setSelected(new Set())
    }
    setScanState('done')
  }

  const toggleFile = useCallback((path: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })
  }, [])

  const activeItems = categories[activeCategory]?.items ?? []
  const activeSelected = activeItems.filter(f => selected.has(f.path))

  const totalSelected = Object.values(categories)
    .flatMap(c => c.items)
    .filter(f => selected.has(f.path))
  const totalSelectedSize = totalSelected.reduce((a, f) => a + f.size, 0)

  const toggleCategory = () => {
    const allSelected = activeItems.every(f => selected.has(f.path))
    setSelected(prev => {
      const next = new Set(prev)
      for (const f of activeItems) {
        if (allSelected) next.delete(f.path)
        else next.add(f.path)
      }
      return next
    })
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 24
      }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-0.02em' }}>Cleanup</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 4 }}>
            {scanState === 'idle' && 'Scan for junk files to free up space'}
            {scanState === 'scanning' && 'Scanning your Mac...'}
            {scanState === 'done' && `${totalSelected.length} items selected · ${formatBytes(totalSelectedSize)} to free`}
            {scanState === 'cleaning' && 'Moving files to Trash...'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          {scanState === 'done' && totalSelected.length > 0 && (
            <button className="btn-danger" onClick={clean}>
              Move to Trash ({formatBytes(totalSelectedSize)})
            </button>
          )}
          <button
            className="btn-primary"
            onClick={runScan}
            disabled={scanState === 'scanning' || scanState === 'cleaning'}
          >
            {scanState === 'scanning' ? (
              <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className="animate-spin" style={{ display: 'inline-block' }}>⟳</span>
                Scanning...
              </span>
            ) : scanState === 'idle' ? 'Scan' : 'Rescan'}
          </button>
        </div>
      </div>

      {/* Success banner */}
      {cleanDone && (
        <div style={{
          marginBottom: 20,
          padding: '14px 18px',
          background: 'rgba(34,197,94,0.12)',
          border: '1px solid rgba(34,197,94,0.3)',
          borderRadius: 14,
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          animation: 'slide-up 0.3s ease-out'
        }}>
          <span style={{ fontSize: 20 }}>✅</span>
          <div>
            <div style={{ fontWeight: 600, fontSize: 14 }}>Cleanup complete!</div>
            <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>
              {cleanDone.cleaned} items ({formatBytes(cleanDone.size)}) moved to Trash
            </div>
          </div>
        </div>
      )}

      {/* Two-panel layout */}
      <div style={{
        flex: 1,
        display: 'flex',
        gap: 16,
        overflow: 'hidden',
        minHeight: 0
      }}>
        {/* Category sidebar */}
        <div style={{
          width: 220,
          flexShrink: 0,
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
          overflowY: 'auto'
        }}>
          {CATEGORIES.map(cat => {
            const state = categories[cat.id]
            const isActive = activeCategory === cat.id
            const hasSomething = state.found > 0
            return (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  padding: '12px 14px',
                  borderRadius: 12,
                  border: isActive ? `1px solid ${cat.color}44` : '1px solid transparent',
                  background: isActive ? `${cat.color}18` : 'rgba(255,255,255,0.04)',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.15s',
                  position: 'relative'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 4 }}>
                  <span style={{ fontSize: 15 }}>{cat.icon}</span>
                  <span style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: isActive ? 'var(--text)' : 'var(--text-muted)'
                  }}>{cat.label}</span>
                </div>
                <div style={{
                  fontSize: 11,
                  color: hasSomething ? cat.color : 'var(--text-muted)',
                  fontWeight: hasSomething ? 600 : 400
                }}>
                  {state.status === 'scanning' ? (
                    <span className="animate-spin" style={{ display: 'inline-block' }}>⟳</span>
                  ) : state.status === 'done' ? (
                    hasSomething ? `${formatBytes(state.size)}` : '✓ Clean'
                  ) : '—'}
                </div>
              </button>
            )
          })}
        </div>

        {/* File list */}
        <div style={{
          flex: 1,
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 16,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}>
          {/* Category header */}
          <div style={{
            padding: '14px 18px',
            borderBottom: '1px solid rgba(255,255,255,0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexShrink: 0
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 18 }}>
                {CATEGORIES.find(c => c.id === activeCategory)?.icon}
              </span>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600 }}>
                  {CATEGORIES.find(c => c.id === activeCategory)?.label}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  {CATEGORIES.find(c => c.id === activeCategory)?.description}
                </div>
              </div>
            </div>
            {activeItems.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  {activeSelected.length}/{activeItems.length} selected
                </span>
                <button className="btn-secondary" style={{ fontSize: 11, padding: '5px 12px' }} onClick={toggleCategory}>
                  {activeItems.every(f => selected.has(f.path)) ? 'Deselect All' : 'Select All'}
                </button>
              </div>
            )}
          </div>

          {/* Files */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
            {scanState === 'idle' && (
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100%',
                color: 'var(--text-muted)',
                gap: 12
              }}>
                <span style={{ fontSize: 40 }}>🔍</span>
                <span style={{ fontSize: 14 }}>Run a scan to see files</span>
              </div>
            )}
            {scanState === 'scanning' && categories[activeCategory].status === 'scanning' && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100%',
                gap: 12,
                color: 'var(--text-muted)'
              }}>
                <span className="animate-spin" style={{ fontSize: 20, display: 'inline-block' }}>⟳</span>
                <span>Scanning...</span>
              </div>
            )}
            {activeItems.length === 0 && categories[activeCategory].status === 'done' && (
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100%',
                color: 'var(--text-muted)',
                gap: 12
              }}>
                <span style={{ fontSize: 40 }}>✅</span>
                <span style={{ fontSize: 14 }}>Nothing found — this category is clean!</span>
              </div>
            )}
            {activeItems.map(file => (
              <FileRow
                key={file.path}
                file={file}
                selected={selected.has(file.path)}
                onToggle={() => toggleFile(file.path)}
                onOpenInFinder={() => window.electron.openInFinder(file.path)}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
