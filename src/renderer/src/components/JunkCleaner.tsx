import { useState, useEffect, useCallback } from 'react'
import FileRow from './ui/FileRow'
import CategoryIcon from './ui/CategoryIcon'
import type { FileItem, ScanCategory, ScanProgress } from '../../../shared/types'
import { CATEGORIES } from '../../../shared/types'
import type { PageTheme } from '../App'

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

interface Props { theme: PageTheme }

export default function JunkCleaner({ theme }: Props) {
  const [scanState, setScanState] = useState<ScanState>('idle')
  const [categories, setCategories] = useState<Record<ScanCategory, CategoryState>>(
    Object.fromEntries(
      CATEGORIES.map(c => [c.id, { items: [], size: 0, found: 0, status: 'pending' }])
    ) as unknown as Record<ScanCategory, CategoryState>
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
      ) as unknown as Record<ScanCategory, CategoryState>
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
      setCategories(prev => {
        const next = { ...prev }
        const cleanedPaths = new Set(toClean.map(f => f.path))
        for (const cat of Object.keys(next) as ScanCategory[]) {
          const remaining = next[cat].items.filter(f => !cleanedPaths.has(f.path))
          next[cat] = { ...next[cat], items: remaining, size: remaining.reduce((a,f)=>a+f.size,0), found: remaining.length }
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
  const totalSelected = Object.values(categories).flatMap(c => c.items).filter(f => selected.has(f.path))
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
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 30, fontWeight: 700, letterSpacing: '-0.025em' }}>Cleanup</h1>
          <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: 13, marginTop: 3 }}>
            {scanState === 'idle'     && 'Scan to find junk files and free up space'}
            {scanState === 'scanning' && 'Scanning your Mac…'}
            {scanState === 'done'     && `${totalSelected.length} items selected · ${formatBytes(totalSelectedSize)}`}
            {scanState === 'cleaning' && 'Moving files to Trash…'}
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
            style={{ background: `linear-gradient(135deg, ${theme.accent}, ${theme.accent}AA)` }}
          >
            {scanState === 'scanning' ? (
              <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none" className="animate-spin" style={{ display: 'inline-block' }}><circle cx="9" cy="9" r="6" stroke="rgba(255,255,255,0.2)" strokeWidth="2"/><path d="M9 3a6 6 0 0 1 6 6" stroke="white" strokeWidth="2" strokeLinecap="round"/></svg>
                Scanning…
              </span>
            ) : scanState === 'idle' ? 'Scan' : 'Rescan'}
          </button>
        </div>
      </div>

      {cleanDone && (
        <div style={{
          marginBottom: 16,
          padding: '12px 16px',
          background: 'rgba(48, 209, 88, 0.12)',
          border: '1px solid rgba(48, 209, 88, 0.28)',
          borderRadius: 12,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          fontSize: 13
        }}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ display: 'inline-block' }}><path d="M3 8l4 4 6-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
          <span><strong>{cleanDone.cleaned} items</strong> ({formatBytes(cleanDone.size)}) moved to Trash</span>
        </div>
      )}

      {/* Two-panel */}
      <div style={{ flex: 1, display: 'flex', gap: 14, overflow: 'hidden', minHeight: 0 }}>

        {/* Category list */}
        <div style={{
          width: 212,
          flexShrink: 0,
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
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
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '9px 12px',
                  borderRadius: 10,
                  border: 'none',
                  background: isActive ? `rgba(0,0,0,0.30)` : 'rgba(0,0,0,0.12)',
                  cursor: 'pointer',
                  textAlign: 'left',
                  outline: isActive ? `1px solid rgba(255,255,255,0.14)` : '1px solid transparent',
                  transition: 'all 0.12s'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                  <CategoryIcon categoryId={cat.id} size={14} color={isActive ? theme.accent : 'rgba(255,255,255,0.45)'} />
                  <span style={{
                    fontSize: 12,
                    fontWeight: isActive ? 600 : 400,
                    color: isActive ? 'var(--text)' : 'rgba(255,255,255,0.60)'
                  }}>
                    {cat.label}
                  </span>
                </div>
                <span style={{
                  fontSize: 10,
                  fontWeight: 600,
                  color: hasSomething ? theme.accent : 'rgba(255,255,255,0.30)',
                  fontVariantNumeric: 'tabular-nums',
                  minWidth: 32,
                  textAlign: 'right'
                }}>
                  {state.status === 'scanning'
                    ? <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="animate-spin" style={{ display: 'inline-block' }}><circle cx="6" cy="6" r="4" stroke="rgba(255,255,255,0.2)" strokeWidth="1.5"/><path d="M6 2a4 4 0 0 1 4 4" stroke="white" strokeWidth="1.5" strokeLinecap="round"/></svg>
                    : state.status === 'done'
                      ? hasSomething ? formatBytes(state.size) : '—'
                      : ''}
                </span>
              </button>
            )
          })}
        </div>

        {/* File list panel */}
        <div style={{
          flex: 1,
          background: 'rgba(0,0,0,0.22)',
          border: '1px solid rgba(255,255,255,0.10)',
          borderRadius: 16,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}>
          {/* Panel header */}
          <div style={{
            padding: '12px 18px',
            borderBottom: '1px solid rgba(255,255,255,0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexShrink: 0
          }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600 }}>
                {CATEGORIES.find(c => c.id === activeCategory)?.label}
              </div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', marginTop: 1 }}>
                {CATEGORIES.find(c => c.id === activeCategory)?.description}
              </div>
            </div>
            {activeItems.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)' }}>
                  {activeSelected.length}/{activeItems.length}
                </span>
                <button className="btn-secondary" style={{ fontSize: 11, padding: '5px 12px' }} onClick={toggleCategory}>
                  {activeItems.every(f => selected.has(f.path)) ? 'Deselect all' : 'Select all'}
                </button>
              </div>
            )}
          </div>

          {/* Files */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '6px' }}>
            {scanState === 'idle' && (
              <div style={{
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'rgba(255,255,255,0.28)',
                gap: 10
              }}>
                <span style={{ fontSize: 36 }}>🔍</span>
                <span style={{ fontSize: 13 }}>Run a scan to see files</span>
              </div>
            )}
            {scanState === 'scanning' && categories[activeCategory].status === 'scanning' && (
              <div style={{
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 10,
                color: 'rgba(255,255,255,0.45)'
              }}>
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none" className="animate-spin" style={{ display: 'inline-block' }}><circle cx="9" cy="9" r="6" stroke="rgba(255,255,255,0.2)" strokeWidth="2"/><path d="M9 3a6 6 0 0 1 6 6" stroke="white" strokeWidth="2" strokeLinecap="round"/></svg>
                <span style={{ fontSize: 13 }}>Scanning…</span>
              </div>
            )}
            {activeItems.length === 0 && categories[activeCategory].status === 'done' && (
              <div style={{
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'rgba(255,255,255,0.35)',
                gap: 10
              }}>
                <svg width="30" height="30" viewBox="0 0 30 30" fill="none" style={{ display: 'inline-block' }}><path d="M5 15l8 8 12-13" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                <span style={{ fontSize: 13 }}>This category is clean</span>
              </div>
            )}
            {activeItems.map(file => (
              <FileRow
                key={file.path}
                file={file}
                selected={selected.has(file.path)}
                onToggle={() => toggleFile(file.path)}
                onOpenInFinder={() => window.electron.openInFinder(file.path)}
                accent={theme.accent}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
