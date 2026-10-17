import { useState, useCallback, useRef, useEffect } from 'react'
import type { DuplicateGroup } from '../../../shared/types'
import type { PageTheme } from '../App'
import HeroScanScreen from './ui/HeroScanScreen'

function formatBytes(n: number): string {
  if (n >= 1e9) return (n / 1e9).toFixed(1) + ' GB'
  if (n >= 1e6) return (n / 1e6).toFixed(1) + ' MB'
  if (n >= 1e3) return (n / 1e3).toFixed(0) + ' KB'
  return n + ' B'
}

type SortKey = 'size' | 'name' | 'count'

const DEFAULT_FOLDERS = ['Documents', 'Downloads', 'Desktop', 'Pictures']

interface Props { theme: PageTheme }

export default function DuplicateFinder({ theme }: Props) {
  const [groups, setGroups] = useState<DuplicateGroup[]>([])
  const [scanning, setScanning] = useState(false)
  const [hasScanned, setHasScanned] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [activeGroup, setActiveGroup] = useState<DuplicateGroup | null>(null)
  const [sortKey, setSortKey] = useState<SortKey>('size')
  const [sortDesc] = useState(true)
  const [cleaning, setCleaning] = useState(false)
  const [cleanResult, setCleanResult] = useState<{ cleaned: number; size: number } | null>(null)
  const [folders, setFolders] = useState<string[]>(DEFAULT_FOLDERS)
  const [scanFile, setScanFile] = useState('')
  const scanFileCleanupRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    if (scanning) {
      scanFileCleanupRef.current = window.electron.onScanFile(setScanFile)
    } else {
      scanFileCleanupRef.current?.()
      scanFileCleanupRef.current = null
      setScanFile('')
    }
  }, [scanning])

  const homeDir = window.electron.homeDir

  const removeFolder = (folder: string) => {
    setFolders(prev => prev.filter(f => f !== folder))
  }

  const addFolder = async () => {
    const p = await window.electron.pickFolder()
    if (!p) return
    const rel = p.startsWith(homeDir + '/') ? p.slice(homeDir.length + 1) : p
    if (!folders.includes(rel)) setFolders(prev => [...prev, rel])
  }

  const scan = async () => {
    if (folders.length === 0) return
    setScanning(true)
    setGroups([])
    setSelected(new Set())
    setActiveGroup(null)
    setCleanResult(null)
    const paths = folders.map(f => f.startsWith('/') ? f : `${homeDir}/${f}`)
    try {
      const result = await window.electron.scanDuplicates(paths)
      setGroups(result)
      setHasScanned(true)
      if (result.length > 0) setActiveGroup(result[0])
    } catch (err) {
      console.error(err)
    } finally {
      setScanning(false)
    }
  }

  const autoSelect = () => {
    const newSelected = new Set<string>()
    for (const group of groups) {
      const sorted = [...group.files].sort(
        (a, b) => new Date(a.modifiedAt).getTime() - new Date(b.modifiedAt).getTime()
      )
      for (let i = 1; i < sorted.length; i++) newSelected.add(sorted[i].path)
    }
    setSelected(newSelected)
  }

  const toggle = useCallback((path: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })
  }, [])

  const clean = async () => {
    const allFiles = groups.flatMap(g => g.files)
    const toClean = allFiles.filter(f => selected.has(f.path))
    if (toClean.length === 0) return
    setCleaning(true)
    const result = await window.electron.cleanItems(toClean)
    if (!result.cancelled) {
      setCleanResult({ cleaned: result.cleaned, size: result.totalSize })
      const cleanedPaths = new Set(toClean.map(f => f.path))
      const remaining = groups
        .map(g => ({ ...g, files: g.files.filter(f => !cleanedPaths.has(f.path)) }))
        .filter(g => g.files.length >= 2)
      setGroups(remaining)
      setSelected(new Set())
      setActiveGroup(remaining[0] ?? null)
    }
    setCleaning(false)
  }

  const sortedGroups = [...groups].sort((a, b) => {
    let diff = 0
    if (sortKey === 'size')  diff = a.totalWaste - b.totalWaste
    else if (sortKey === 'count') diff = a.count - b.count
    else if (sortKey === 'name')  diff = a.files[0].name.localeCompare(b.files[0].name)
    return sortDesc ? -diff : diff
  })

  const totalWaste = groups.reduce((a, g) => a + g.totalWaste, 0)
  const selectedItems = groups.flatMap(g => g.files).filter(f => selected.has(f.path))
  const selectedSize = selectedItems.reduce((a, f) => a + f.size, 0)

  if (scanning) {
    return (
      <HeroScanScreen
        hero={
          <div style={{
            width: 240, height: 240,
            borderRadius: '62% 38% 46% 54% / 60% 44% 56% 40%',
            background: `radial-gradient(ellipse at 32% 28%, rgba(215,165,255,0.94) 0%, ${theme.accent}EE 32%, rgba(80,30,170,0.94) 65%, rgba(18,5,55,0.97) 100%)`,
            boxShadow: `0 30px 80px ${theme.accent}66, 0 0 0 1.5px rgba(220,180,255,0.20) inset`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            position: 'relative', overflow: 'hidden',
            animation: 'blob-morph 6s ease-in-out infinite',
          }}>
            <div style={{ position: 'absolute', top: '12%', left: '18%', width: '40%', height: '28%', borderRadius: '50%', background: 'radial-gradient(ellipse, rgba(255,255,255,0.30) 0%, transparent 80%)' }} />
            <svg width="80" height="80" viewBox="0 0 64 64" fill="none" style={{ position: 'relative', zIndex: 1 }}>
              <rect x="18" y="10" width="32" height="38" rx="4" fill="rgba(255,255,255,0.30)" stroke="rgba(255,255,255,0.55)" strokeWidth="2"/>
              <rect x="14" y="16" width="32" height="38" rx="4" fill="rgba(255,255,255,0.55)" stroke="rgba(255,255,255,0.80)" strokeWidth="2"/>
              <path d="M22 28h18M22 34h12" stroke="rgba(0,0,0,0.35)" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </div>
        }
        title="Scanning for duplicates…"
        currentFile={scanFile}
        onStop={() => setScanning(false)}
      />
    )
  }

  // Pre-scan: scope selection + hero
  if (!hasScanned && !scanning) {
    return (
      <div style={{
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        gap: 0
      }}>
        {/* Left: visual */}
        <div style={{
          flex: '0 0 48%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <div style={{
            width: 220,
            height: 220,
            borderRadius: 48,
            background: `radial-gradient(ellipse at 32% 28%, ${theme.accent}EE 0%, ${theme.accent}88 45%, rgba(16,4,34,0.95) 100%)`,
            boxShadow: `0 40px 100px ${theme.accent}55, 0 0 0 1.5px rgba(255,255,255,0.15) inset`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
            overflow: 'hidden',
            animation: 'float 4s ease-in-out infinite'
          }}>
            <div style={{
              position: 'absolute', top: '10%', left: '14%',
              width: '42%', height: '28%',
              borderRadius: '50%',
              background: 'radial-gradient(ellipse, rgba(255,255,255,0.28) 0%, transparent 80%)'
            }} />
            <div style={{ position: 'relative', zIndex: 1 }}>
              {/* Two overlapping file icons */}
              <div style={{ position: 'relative', width: 100, height: 100 }}>
                <div style={{
                  position: 'absolute', top: 12, right: 0,
                  width: 70, height: 84, borderRadius: 8,
                  background: 'rgba(255,255,255,0.25)',
                  border: '2px solid rgba(255,255,255,0.5)'
                }} />
                <div style={{
                  position: 'absolute', top: 0, left: 0,
                  width: 70, height: 84, borderRadius: 8,
                  background: 'rgba(255,255,255,0.45)',
                  border: '2px solid rgba(255,255,255,0.7)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                  <div style={{ width: 32, height: 4, background: 'rgba(0,0,0,0.3)', borderRadius: 2, marginBottom: 6 }} />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right: scope config */}
        <div style={{ flex: '0 0 52%', paddingRight: 12 }}>
          <h1 style={{ fontSize: 38, fontWeight: 700, letterSpacing: '-0.03em', lineHeight: 1.1, marginBottom: 8 }}>
            Duplicate Finder
          </h1>
          <p style={{ fontSize: 15, color: 'rgba(255,255,255,0.55)', marginBottom: 28, maxWidth: 320 }}>
            Find identical files using content hashing. Nothing is removed during scanning.
          </p>

          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.40)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 10 }}>
              Folders to scan
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
              {folders.map(folder => (
                <div key={folder} style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 7,
                  padding: '6px 12px',
                  background: 'rgba(0,0,0,0.28)',
                  border: '1px solid rgba(255,255,255,0.14)',
                  borderRadius: 20,
                  fontSize: 12
                }}>
                  <span style={{ color: 'rgba(255,255,255,0.75)' }}>{folder}</span>
                  <button
                    onClick={() => removeFolder(folder)}
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer',
                      color: 'rgba(255,255,255,0.40)', fontSize: 14, padding: 0, lineHeight: 1,
                      display: 'flex', alignItems: 'center'
                    }}
                  >×</button>
                </div>
              ))}
              <button
                onClick={addFolder}
                style={{
                  display: 'flex', alignItems: 'center', gap: 5,
                  padding: '6px 12px',
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px dashed rgba(255,255,255,0.18)',
                  borderRadius: 20, fontSize: 12, cursor: 'pointer',
                  color: 'rgba(255,255,255,0.50)',
                  transition: 'background 0.15s'
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.10)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.06)')}
              >
                + Add folder
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'center', marginTop: 8 }}>
            <button
              className="scan-orb"
              onClick={scan}
              disabled={folders.length === 0}
              aria-label="Scan for duplicates"
            >
              Scan
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Post-scan results
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-0.025em' }}>Duplicate Finder</h1>
          <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: 13, marginTop: 3 }}>
            {groups.length > 0
              ? `${groups.length} groups · ${formatBytes(totalWaste)} recoverable`
              : 'No duplicates found'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          {groups.length > 0 && (
            <button className="btn-secondary" onClick={autoSelect} style={{ fontSize: 12 }}>
              Smart Select
            </button>
          )}
          {selectedItems.length > 0 && (
            <button className="btn-danger" onClick={clean} disabled={cleaning}>
              Remove {selectedItems.length} ({formatBytes(selectedSize)})
            </button>
          )}
          <button
            className="btn-primary"
            onClick={() => { setHasScanned(false); setGroups([]) }}
            style={{ background: `linear-gradient(135deg, ${theme.accent}, ${theme.accent}AA)` }}
          >
            New Scan
          </button>
        </div>
      </div>

      {cleanResult && (
        <div style={{
          marginBottom: 14,
          padding: '10px 16px',
          background: 'rgba(48,209,88,0.12)',
          border: '1px solid rgba(48,209,88,0.28)',
          borderRadius: 10, fontSize: 13
        }}>
          ✓ {cleanResult.cleaned} files ({formatBytes(cleanResult.size)}) moved to Trash
        </div>
      )}

      <div style={{ flex: 1, display: 'flex', gap: 14, overflow: 'hidden' }}>
        {/* Group list */}
        <div style={{
          width: 280, flexShrink: 0,
          background: 'rgba(0,0,0,0.22)',
          border: '1px solid rgba(255,255,255,0.10)',
          borderRadius: 14,
          display: 'flex', flexDirection: 'column', overflow: 'hidden'
        }}>
          <div style={{
            padding: '10px 14px',
            borderBottom: '1px solid rgba(255,255,255,0.08)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0
          }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.45)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Groups</span>
            <select
              value={sortKey}
              onChange={e => setSortKey(e.target.value as SortKey)}
              style={{
                background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: 6, color: 'var(--text)', fontSize: 11, padding: '3px 8px', cursor: 'pointer'
              }}
            >
              <option value="size">By size</option>
              <option value="name">By name</option>
              <option value="count">By count</option>
            </select>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: '6px' }}>
            {groups.length === 0 && (
              <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.35)', fontSize: 13 }}>
                No duplicates found
              </div>
            )}
            {sortedGroups.map(group => {
              const isActive = activeGroup?.hash === group.hash
              const selCount = group.files.filter(f => selected.has(f.path)).length
              return (
                <div
                  key={group.hash}
                  onClick={() => setActiveGroup(group)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '9px 11px',
                    borderRadius: 9, cursor: 'pointer',
                    background: isActive ? `${theme.accent}1A` : 'transparent',
                    border: isActive ? `1px solid ${theme.accent}30` : '1px solid transparent',
                    marginBottom: 2, transition: 'all 0.1s'
                  }}
                  onMouseEnter={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.05)' }}
                  onMouseLeave={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = 'transparent' }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {group.files[0].name}
                    </div>
                    <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.40)', marginTop: 2, fontVariantNumeric: 'tabular-nums' }}>
                      {formatBytes(group.totalWaste)} wasted · {group.count} copies
                    </div>
                  </div>
                  <div style={{
                    fontSize: 10, fontWeight: 700, flexShrink: 0,
                    color: selCount > 0 ? theme.accent : 'rgba(255,255,255,0.30)'
                  }}>
                    {selCount}/{group.count}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* File detail panel */}
        <div style={{
          flex: 1,
          background: 'rgba(0,0,0,0.22)',
          border: '1px solid rgba(255,255,255,0.10)',
          borderRadius: 14,
          display: 'flex', flexDirection: 'column', overflow: 'hidden'
        }}>
          {activeGroup ? (
            <>
              <div style={{
                padding: '12px 18px',
                borderBottom: '1px solid rgba(255,255,255,0.08)',
                flexShrink: 0
              }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{activeGroup.files[0].name}</div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', marginTop: 2, fontVariantNumeric: 'tabular-nums' }}>
                  {activeGroup.count} copies · {formatBytes(activeGroup.size)} each ·{' '}
                  <span style={{ color: theme.accent }}>{formatBytes(activeGroup.totalWaste)} wasted</span>
                </div>
              </div>
              <div style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
                {activeGroup.files.map((file, i) => (
                  <div
                    key={file.path}
                    onClick={() => toggle(file.path)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 12,
                      padding: '9px 14px', borderRadius: 9, cursor: 'pointer',
                      background: selected.has(file.path) ? `${theme.accent}18` : 'transparent',
                      border: selected.has(file.path) ? `1px solid ${theme.accent}28` : '1px solid transparent',
                      marginBottom: 3, transition: 'all 0.1s'
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={selected.has(file.path)}
                      onChange={() => toggle(file.path)}
                      onClick={e => e.stopPropagation()}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        color: i === 0 ? 'rgba(255,255,255,0.50)' : 'var(--text)'
                      }}>
                        {file.path.replace(homeDir, '~')}
                      </div>
                      <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', marginTop: 2 }}>
                        {i === 0 && <span style={{ color: 'rgba(48,209,88,0.7)', marginRight: 6 }}>Keep</span>}
                        Modified {new Date(file.modifiedAt).toLocaleDateString()}
                      </div>
                    </div>
                    <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.40)', fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>
                      {formatBytes(file.size)}
                    </span>
                    <button
                      onClick={e => { e.stopPropagation(); window.electron.openInFinder(file.path) }}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, opacity: 0.4, color: 'var(--text)', padding: '2px 4px' }}
                    >↗</button>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.30)', fontSize: 13 }}>
              Select a group to see its files
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
