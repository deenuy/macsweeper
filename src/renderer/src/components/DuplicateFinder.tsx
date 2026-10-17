import { useState, useCallback } from 'react'
import type { DuplicateGroup, FileItem } from '../../../shared/types'

function formatBytes(n: number): string {
  if (n >= 1e9) return (n / 1e9).toFixed(1) + ' GB'
  if (n >= 1e6) return (n / 1e6).toFixed(1) + ' MB'
  if (n >= 1e3) return (n / 1e3).toFixed(0) + ' KB'
  return n + ' B'
}

type SortKey = 'size' | 'name' | 'count' | 'selected-count'

export default function DuplicateFinder() {
  const [groups, setGroups] = useState<DuplicateGroup[]>([])
  const [scanning, setScanning] = useState(false)
  const [hasScanned, setHasScanned] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [activeGroup, setActiveGroup] = useState<DuplicateGroup | null>(null)
  const [sortKey, setSortKey] = useState<SortKey>('size')
  const [sortDesc, setSortDesc] = useState(true)
  const [cleaning, setCleaning] = useState(false)
  const [cleanResult, setCleanResult] = useState<{ cleaned: number; size: number } | null>(null)

  const scan = async () => {
    setScanning(true)
    setGroups([])
    setSelected(new Set())
    setActiveGroup(null)
    setCleanResult(null)

    const home = window.electron.homeDir
    const paths = [
      `${home}/Documents`,
      `${home}/Downloads`,
      `${home}/Desktop`,
      `${home}/Pictures`
    ]

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
      // Keep the oldest file (lowest mtime = original), select the rest
      const sorted = [...group.files].sort(
        (a, b) => new Date(a.modifiedAt).getTime() - new Date(b.modifiedAt).getTime()
      )
      for (let i = 1; i < sorted.length; i++) {
        newSelected.add(sorted[i].path)
      }
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
    if (sortKey === 'size') diff = a.totalWaste - b.totalWaste
    else if (sortKey === 'count') diff = a.count - b.count
    else if (sortKey === 'name') diff = a.files[0].name.localeCompare(b.files[0].name)
    return sortDesc ? -diff : diff
  })

  const totalWaste = groups.reduce((a, g) => a + g.totalWaste, 0)
  const selectedItems = groups.flatMap(g => g.files).filter(f => selected.has(f.path))
  const selectedSize = selectedItems.reduce((a, f) => a + f.size, 0)

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
          <h1 style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-0.02em' }}>
            Duplicate Finder
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 4 }}>
            {hasScanned
              ? `${groups.length} groups found · ${formatBytes(totalWaste)} wasted`
              : 'Find and remove duplicate files from Documents, Downloads, Desktop'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          {hasScanned && groups.length > 0 && (
            <>
              <button className="btn-secondary" onClick={autoSelect} style={{ fontSize: 12 }}>
                Smart Select
              </button>
              {selectedItems.length > 0 && (
                <button
                  className="btn-danger"
                  onClick={clean}
                  disabled={cleaning}
                >
                  Remove {selectedItems.length} items ({formatBytes(selectedSize)})
                </button>
              )}
            </>
          )}
          <button
            className="btn-primary"
            onClick={scan}
            disabled={scanning}
          >
            {scanning ? (
              <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className="animate-spin" style={{ display: 'inline-block' }}>⟳</span>
                Scanning...
              </span>
            ) : hasScanned ? 'Rescan' : 'Find Duplicates'}
          </button>
        </div>
      </div>

      {cleanResult && (
        <div style={{
          marginBottom: 16,
          padding: '12px 16px',
          background: 'rgba(34,197,94,0.12)',
          border: '1px solid rgba(34,197,94,0.3)',
          borderRadius: 12,
          fontSize: 13
        }}>
          ✅ {cleanResult.cleaned} files ({formatBytes(cleanResult.size)}) moved to Trash
        </div>
      )}

      {!hasScanned && !scanning && (
        <div style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 16,
          color: 'var(--text-muted)'
        }}>
          <span style={{ fontSize: 56 }}>⊞</span>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)', marginBottom: 6 }}>
              Find duplicate files
            </div>
            <div style={{ fontSize: 13, maxWidth: 360 }}>
              Scans your Documents, Downloads, Desktop and Pictures folders for exact file duplicates using content hashing.
            </div>
          </div>
        </div>
      )}

      {scanning && (
        <div style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 16,
          color: 'var(--text-muted)'
        }}>
          <span className="animate-spin" style={{ fontSize: 36, display: 'inline-block' }}>⟳</span>
          <div style={{ fontSize: 14 }}>Scanning for duplicates (this may take a while)...</div>
        </div>
      )}

      {hasScanned && !scanning && (
        <div style={{ flex: 1, display: 'flex', gap: 16, overflow: 'hidden' }}>
          {/* Left panel: group list */}
          <div style={{
            width: 300,
            flexShrink: 0,
            display: 'flex',
            flexDirection: 'column',
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 16,
            overflow: 'hidden'
          }}>
            {/* Sort controls */}
            <div style={{
              padding: '12px 14px',
              borderBottom: '1px solid rgba(255,255,255,0.08)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexShrink: 0
            }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>
                Select Duplicates
              </span>
              <select
                value={sortKey}
                onChange={e => setSortKey(e.target.value as SortKey)}
                style={{
                  background: 'rgba(255,255,255,0.08)',
                  border: '1px solid rgba(255,255,255,0.12)',
                  borderRadius: 7,
                  color: 'var(--text)',
                  fontSize: 11,
                  padding: '4px 8px',
                  cursor: 'pointer'
                }}
              >
                <option value="size">Sort by Size</option>
                <option value="name">Sort by Name</option>
                <option value="count">Sort by Count</option>
              </select>
            </div>

            {/* Group rows */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '6px' }}>
              {groups.length === 0 && (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  height: '100%',
                  color: 'var(--text-muted)',
                  fontSize: 13
                }}>
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
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      padding: '10px 12px',
                      borderRadius: 10,
                      cursor: 'pointer',
                      background: isActive ? 'rgba(168,85,247,0.15)' : 'transparent',
                      border: isActive ? '1px solid rgba(168,85,247,0.25)' : '1px solid transparent',
                      marginBottom: 2,
                      transition: 'all 0.1s'
                    }}
                  >
                    <span style={{ fontSize: 16, flexShrink: 0 }}>
                      {group.files[0].name.endsWith('.pdf') ? '📄' :
                       group.files[0].name.match(/\.(jpg|jpeg|png|gif|webp)$/i) ? '🖼️' :
                       group.files[0].name.match(/\.(mp4|mov|avi)$/i) ? '🎬' : '📁'}
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontSize: 12,
                        fontWeight: 500,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }}>
                        {group.files[0].name}
                      </div>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>
                        {formatBytes(group.totalWaste)} wasted · {group.count} copies
                      </div>
                    </div>
                    <div style={{
                      fontSize: 10,
                      fontWeight: 700,
                      color: selCount > 0 ? '#a855f7' : 'var(--text-muted)',
                      flexShrink: 0
                    }}>
                      {selCount} | {group.count}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Right panel: files in selected group */}
          <div style={{
            flex: 1,
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 16,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden'
          }}>
            {activeGroup ? (
              <>
                <div style={{
                  padding: '14px 18px',
                  borderBottom: '1px solid rgba(255,255,255,0.08)',
                  flexShrink: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>
                      {activeGroup.files[0].name}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>
                      {activeGroup.count} copies · {formatBytes(activeGroup.size)} each ·{' '}
                      <span style={{ color: '#a855f7' }}>
                        {activeGroup.count - 1 > 0
                          ? `${formatBytes(activeGroup.totalWaste)} wasted`
                          : 'no waste if 1 kept'}
                      </span>
                    </div>
                  </div>
                  <div style={{
                    fontSize: 11,
                    color: 'var(--text-muted)',
                    display: 'flex',
                    gap: 6
                  }}>
                    <span style={{
                      padding: '3px 8px',
                      background: 'rgba(255,255,255,0.06)',
                      borderRadius: 6,
                      color: '#a855f7'
                    }}>
                      {activeGroup.files.filter(f => selected.has(f.path)).length} selected
                    </span>
                    <span style={{
                      padding: '3px 8px',
                      background: 'rgba(255,255,255,0.06)',
                      borderRadius: 6
                    }}>
                      {activeGroup.count - activeGroup.files.filter(f => selected.has(f.path)).length} remaining
                    </span>
                  </div>
                </div>
                <div style={{ flex: 1, overflowY: 'auto', padding: '10px' }}>
                  {activeGroup.files.map(file => (
                    <div
                      key={file.path}
                      onClick={() => toggle(file.path)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                        padding: '10px 14px',
                        borderRadius: 10,
                        cursor: 'pointer',
                        background: selected.has(file.path) ? 'rgba(168,85,247,0.12)' : 'transparent',
                        border: selected.has(file.path) ? '1px solid rgba(168,85,247,0.2)' : '1px solid transparent',
                        marginBottom: 4,
                        transition: 'all 0.1s'
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
                          fontSize: 13,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap'
                        }}>
                          {file.path.replace(window.electron.homeDir, '~')}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                          Modified: {new Date(file.modifiedAt).toLocaleDateString()}
                        </div>
                      </div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', flexShrink: 0 }}>
                        {formatBytes(file.size)}
                      </div>
                      <button
                        onClick={e => { e.stopPropagation(); window.electron.openInFinder(file.path) }}
                        style={{
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          fontSize: 13,
                          opacity: 0.5,
                          color: 'var(--text)',
                          padding: '2px 4px'
                        }}
                      >↗</button>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--text-muted)',
                fontSize: 13
              }}>
                Select a group on the left to see its files
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
