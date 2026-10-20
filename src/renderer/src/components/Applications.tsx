import { useState, useCallback } from 'react'
import type { InstalledApp, AppUpdate, LeftoverGroup, FileItem } from '../../../shared/types'
import type { PageTheme } from '../App'

// ── Formatters ────────────────────────────────────────────────────────────────

function fmt(bytes: number): string {
  if (bytes >= 1e9) return (bytes / 1e9).toFixed(1) + ' GB'
  if (bytes >= 1e6) return (bytes / 1e6).toFixed(0) + ' MB'
  if (bytes >= 1e3) return (bytes / 1e3).toFixed(0) + ' KB'
  return bytes + ' B'
}

// ── Sub-tab IDs ───────────────────────────────────────────────────────────────

type Tab = 'uninstaller' | 'updater' | 'leftovers'

interface Props { theme: PageTheme }

// ── Hero section (landing state) ──────────────────────────────────────────────

function HeroLanding({ tab, onScan, scanning, theme }: {
  tab: Tab
  onScan: () => void
  scanning: boolean
  theme: PageTheme
}) {
  const meta: Record<Tab, { title: string; desc: string; icon: string }> = {
    uninstaller: {
      title: 'App Uninstaller',
      desc: 'Fully remove apps and all their associated files — caches, preferences, containers, and launch agents.',
      icon: '⊗'
    },
    updater: {
      title: 'App Updater',
      desc: 'Check for updates across all installed apps — Sparkle-powered and Mac App Store apps alike.',
      icon: '↑'
    },
    leftovers: {
      title: 'File Leftovers',
      desc: 'Find orphaned support files, caches, and preferences left behind by apps you already removed.',
      icon: '◎'
    }
  }
  const m = meta[tab]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 24, padding: '0 40px' }}>
      {/* Icon badge */}
      <div style={{
        width: 96, height: 96, borderRadius: 28,
        background: `linear-gradient(135deg, ${theme.accent}33, ${theme.accent}11)`,
        border: `1.5px solid ${theme.accent}44`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 36, backdropFilter: 'blur(12px)',
        boxShadow: `0 8px 32px ${theme.glow}`
      }}>
        {m.icon}
      </div>
      <div style={{ textAlign: 'center', maxWidth: 440 }}>
        <h2 style={{ margin: '0 0 10px', fontSize: 28, fontWeight: 700, color: '#fff', letterSpacing: '-0.02em' }}>
          {m.title}
        </h2>
        <p style={{ margin: 0, fontSize: 14, color: 'rgba(255,255,255,0.55)', lineHeight: 1.6 }}>
          {m.desc}
        </p>
      </div>
      <button
        onClick={onScan}
        disabled={scanning}
        style={{
          padding: '12px 36px', borderRadius: 50, border: 'none', cursor: scanning ? 'default' : 'pointer',
          background: scanning ? 'rgba(255,255,255,0.1)' : `linear-gradient(135deg, ${theme.accent}, ${theme.accent}cc)`,
          color: '#fff', fontSize: 15, fontWeight: 600,
          boxShadow: scanning ? 'none' : `0 4px 20px ${theme.glow}`,
          transition: 'all 0.2s ease', opacity: scanning ? 0.6 : 1
        }}
      >
        {scanning ? 'Scanning…' : 'Scan'}
      </button>
    </div>
  )
}

// ── App Uninstaller tab ───────────────────────────────────────────────────────

function UninstallerTab({ theme }: { theme: PageTheme }) {
  const [state, setState] = useState<'idle' | 'scanning' | 'done'>('idle')
  const [apps, setApps] = useState<InstalledApp[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [leftovers, setLeftovers] = useState<Map<string, FileItem[]>>(new Map())
  const [loadingLeftovers, setLoadingLeftovers] = useState<Set<string>>(new Set())
  const [removeLeftovers, setRemoveLeftovers] = useState(true)
  const [working, setWorking] = useState(false)
  const [search, setSearch] = useState('')

  const runScan = async () => {
    setState('scanning')
    setApps([])
    setSelected(new Set())
    setLeftovers(new Map())
    try {
      const result = await window.electron.apps.scan()
      setApps(result)
      setState('done')
    } catch {
      setState('idle')
    }
  }

  const loadLeftovers = async (app: InstalledApp) => {
    const key = app.bundleId
    if (leftovers.has(key) || loadingLeftovers.has(key)) return
    setLoadingLeftovers(prev => new Set(prev).add(key))
    try {
      const files = await window.electron.apps.leftovers(app.bundleId, app.name)
      setLeftovers(prev => new Map(prev).set(key, files))
    } catch { /* ok */ }
    setLoadingLeftovers(prev => { const n = new Set(prev); n.delete(key); return n })
  }

  const toggle = (app: InstalledApp) => {
    const s = new Set(selected)
    if (s.has(app.path)) s.delete(app.path)
    else { s.add(app.path); loadLeftovers(app) }
    setSelected(s)
  }

  const uninstall = async () => {
    if (selected.size === 0) return
    setWorking(true)
    const toRemove = apps.filter(a => selected.has(a.path))
    for (const app of toRemove) {
      try {
        const r = await window.electron.apps.uninstall(app.path, app.bundleId, app.name, removeLeftovers)
        if (r.cancelled) continue
        if (r.trashed.length > 0) {
          setApps(prev => prev.filter(a => a.path !== app.path))
          setSelected(prev => { const n = new Set(prev); n.delete(app.path); return n })
        }
      } catch { /* ok */ }
    }
    setWorking(false)
  }

  const filtered = apps.filter(a => a.name.toLowerCase().includes(search.toLowerCase()))
  const selectedApps = apps.filter(a => selected.has(a.path))
  const selectedSize = selectedApps.reduce((t, a) => t + a.size, 0)
  const selectedLeftoverSize = selectedApps.reduce((t, a) => {
    const lf = leftovers.get(a.bundleId) ?? []
    return t + lf.reduce((lt, f) => lt + f.size, 0)
  }, 0)

  if (state === 'idle' || state === 'scanning') {
    return <HeroLanding tab="uninstaller" onScan={runScan} scanning={state === 'scanning'} theme={theme} />
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Search + controls */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search apps…"
          style={{
            flex: 1, padding: '8px 14px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.15)',
            background: 'rgba(255,255,255,0.07)', color: '#fff', fontSize: 13,
            outline: 'none'
          }}
        />
        <button onClick={runScan} style={ghostBtn}>Rescan</button>
      </div>

      {/* App list */}
      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
        {filtered.map(app => {
          const isSelected = selected.has(app.path)
          const lf = leftovers.get(app.bundleId)
          const isLoadingLf = loadingLeftovers.has(app.bundleId)
          const lfSize = lf?.reduce((t, f) => t + f.size, 0) ?? 0

          return (
            <div key={app.path} onClick={() => toggle(app)} style={{
              display: 'flex', alignItems: 'center', gap: 14, padding: '10px 14px',
              borderRadius: 12, cursor: 'pointer',
              background: isSelected ? 'rgba(74,144,226,0.18)' : 'rgba(255,255,255,0.05)',
              border: isSelected ? '1px solid rgba(74,144,226,0.4)' : '1px solid rgba(255,255,255,0.08)',
              transition: 'all 0.15s ease'
            }}>
              <Checkbox checked={isSelected} accent={theme.accent} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                  <span style={{ fontSize: 14, fontWeight: 600, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {app.name}
                  </span>
                  <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', flexShrink: 0 }}>
                    v{app.version}
                  </span>
                  {app.isMAS && (
                    <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 4, background: 'rgba(74,144,226,0.2)', color: '#4A90E2', flexShrink: 0 }}>
                      MAS
                    </span>
                  )}
                </div>
                {isSelected && (
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>
                    {isLoadingLf ? 'Finding leftovers…' :
                      lf ? (lf.length > 0 ? `${lf.length} leftover file${lf.length > 1 ? 's' : ''} · ${fmt(lfSize)}` : 'No leftovers found') :
                      'Loading leftovers…'
                    }
                  </div>
                )}
              </div>
              <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', flexShrink: 0 }}>{fmt(app.size)}</span>
            </div>
          )
        })}
        {filtered.length === 0 && (
          <div style={{ textAlign: 'center', padding: 40, color: 'rgba(255,255,255,0.35)', fontSize: 14 }}>
            No apps found
          </div>
        )}
      </div>

      {/* Footer action bar */}
      {selected.size > 0 && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 16, padding: '14px 16px',
          background: 'rgba(0,0,0,0.3)', borderRadius: 14,
          border: '1px solid rgba(255,255,255,0.1)', backdropFilter: 'blur(12px)'
        }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#fff' }}>
              {selected.size} app{selected.size > 1 ? 's' : ''} selected
            </div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', marginTop: 2 }}>
              {fmt(selectedSize)} app{removeLeftovers && selectedLeftoverSize > 0 ? ` + ${fmt(selectedLeftoverSize)} leftovers` : ''}
            </div>
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 7, cursor: 'pointer', fontSize: 12, color: 'rgba(255,255,255,0.55)' }}>
            <input type="checkbox" checked={removeLeftovers} onChange={e => setRemoveLeftovers(e.target.checked)}
              style={{ accentColor: theme.accent }} />
            Remove leftovers
          </label>
          <button onClick={uninstall} disabled={working} style={{
            padding: '9px 22px', borderRadius: 10, border: 'none', cursor: working ? 'default' : 'pointer',
            background: working ? 'rgba(255,255,255,0.1)' : '#e53e3e',
            color: '#fff', fontSize: 13, fontWeight: 600, opacity: working ? 0.6 : 1,
            transition: 'opacity 0.2s'
          }}>
            {working ? 'Removing…' : 'Uninstall'}
          </button>
        </div>
      )}
    </div>
  )
}

// ── App Updater tab ───────────────────────────────────────────────────────────

function UpdaterTab({ theme }: { theme: PageTheme }) {
  const [state, setState] = useState<'idle' | 'scanning-apps' | 'checking-updates' | 'done'>('idle')
  const [updates, setUpdates] = useState<AppUpdate[]>([])
  const [progress, setProgress] = useState({ checked: 0, total: 0 })
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const runScan = useCallback(async () => {
    setState('scanning-apps')
    setUpdates([])
    setSelected(new Set())
    try {
      const allApps = await window.electron.apps.scan()
      setState('checking-updates')
      setProgress({ checked: 0, total: allApps.length })

      const unsub = window.electron.apps.onUpdateProgress(p => setProgress(p))
      try {
        const found = await window.electron.apps.checkUpdates(allApps)
        setUpdates(found)
      } finally {
        unsub()
      }
      setState('done')
    } catch {
      setState('idle')
    }
  }, [])

  const toggle = (u: AppUpdate) => {
    const s = new Set(selected)
    if (s.has(u.app.path)) s.delete(u.app.path)
    else s.add(u.app.path)
    setSelected(s)
  }

  const openUpdate = (u: AppUpdate) => {
    if (u.updateUrl) window.electron.openPath(u.updateUrl)
  }

  if (state === 'idle') {
    return <HeroLanding tab="updater" onScan={runScan} scanning={false} theme={theme} />
  }

  if (state === 'scanning-apps') {
    return <ScanningIndicator label="Scanning installed apps…" theme={theme} />
  }

  if (state === 'checking-updates') {
    const pct = progress.total > 0 ? Math.round((progress.checked / progress.total) * 100) : 0
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 20 }}>
        <div style={{ fontSize: 40 }}>↑</div>
        <div style={{ fontSize: 16, fontWeight: 600, color: '#fff' }}>Checking for updates…</div>
        <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)' }}>
          {progress.checked} / {progress.total} apps checked
        </div>
        <ProgressBar pct={pct} accent={theme.accent} />
      </div>
    )
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontSize: 15, fontWeight: 600, color: '#fff' }}>
          {updates.length > 0 ? `${updates.length} update${updates.length > 1 ? 's' : ''} available` : 'All apps are up to date'}
        </div>
        <button onClick={runScan} style={ghostBtn}>Recheck</button>
      </div>

      {updates.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, color: 'rgba(255,255,255,0.35)', fontSize: 14 }}>
          ✓ All apps are up to date
        </div>
      ) : (
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
          {updates.map(u => {
            const isSelected = selected.has(u.app.path)
            return (
              <div key={u.app.path} onClick={() => toggle(u)} style={{
                display: 'flex', alignItems: 'center', gap: 14, padding: '10px 14px',
                borderRadius: 12, cursor: 'pointer',
                background: isSelected ? 'rgba(74,144,226,0.18)' : 'rgba(255,255,255,0.05)',
                border: isSelected ? '1px solid rgba(74,144,226,0.4)' : '1px solid rgba(255,255,255,0.08)',
                transition: 'all 0.15s ease'
              }}>
                <Checkbox checked={isSelected} accent={theme.accent} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 14, fontWeight: 600, color: '#fff' }}>{u.app.name}</span>
                    <span style={{ fontSize: 11, color: '#4A90E2', background: 'rgba(74,144,226,0.15)', padding: '1px 7px', borderRadius: 5 }}>
                      {u.app.version} → {u.latestVersion}
                    </span>
                    {u.source === 'mas' && (
                      <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 4, background: 'rgba(74,144,226,0.2)', color: '#4A90E2' }}>MAS</span>
                    )}
                  </div>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>
                    {u.source === 'sparkle' ? 'In-app update available' : 'Mac App Store update available'}
                  </div>
                </div>
                <button onClick={e => { e.stopPropagation(); openUpdate(u) }} style={{
                  padding: '5px 14px', borderRadius: 8, border: `1px solid ${theme.accent}66`,
                  background: 'transparent', color: theme.accent, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                  flexShrink: 0
                }}>
                  {u.source === 'mas' ? 'Open Store' : 'Update'}
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── File Leftovers tab ────────────────────────────────────────────────────────

function LeftoversTab({ theme }: { theme: PageTheme }) {
  const [state, setState] = useState<'idle' | 'scanning' | 'done'>('idle')
  const [groups, setGroups] = useState<LeftoverGroup[]>([])
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [selected, setSelected] = useState<Set<string>>(new Set()) // file paths
  const [working, setWorking] = useState(false)
  const [progress, setProgress] = useState({ scanned: 0, groups: 0 })

  const runScan = async () => {
    setState('scanning')
    setGroups([])
    setSelected(new Set())
    setExpanded(new Set())
    setProgress({ scanned: 0, groups: 0 })
    const unsub = window.electron.apps.onLeftoverProgress(p => setProgress(p))
    try {
      const result = await window.electron.apps.scanLeftovers()
      setGroups(result)
      setState('done')
    } catch {
      setState('idle')
    } finally {
      unsub()
    }
  }

  const toggleGroup = (group: LeftoverGroup) => {
    const s = new Set(selected)
    const allSelected = group.files.every(f => s.has(f.path))
    if (allSelected) {
      group.files.forEach(f => s.delete(f.path))
    } else {
      group.files.forEach(f => s.add(f.path))
    }
    setSelected(s)
  }

  const toggleFile = (f: FileItem) => {
    const s = new Set(selected)
    if (s.has(f.path)) s.delete(f.path)
    else s.add(f.path)
    setSelected(s)
  }

  const toggleExpand = (key: string, e: React.MouseEvent) => {
    e.stopPropagation()
    const s = new Set(expanded)
    if (s.has(key)) s.delete(key)
    else s.add(key)
    setExpanded(s)
  }

  const clean = async () => {
    const allFiles = groups.flatMap(g => g.files).filter(f => selected.has(f.path))
    if (allFiles.length === 0) return
    setWorking(true)
    try {
      const r = await window.electron.apps.cleanLeftovers(allFiles) as { cancelled?: boolean; cleaned: number }
      if (!r.cancelled && r.cleaned > 0) {
        // Remove cleaned files from groups
        const removedPaths = new Set(allFiles.slice(0, r.cleaned).map(f => f.path))
        setGroups(prev => prev.map(g => ({
          ...g,
          files: g.files.filter(f => !removedPaths.has(f.path)),
          totalSize: g.files.filter(f => !removedPaths.has(f.path)).reduce((t, f) => t + f.size, 0)
        })).filter(g => g.files.length > 0))
        setSelected(prev => { const s = new Set(prev); removedPaths.forEach(p => s.delete(p)); return s })
      }
    } catch { /* ok */ }
    setWorking(false)
  }

  if (state === 'idle') {
    return <HeroLanding tab="leftovers" onScan={runScan} scanning={false} theme={theme} />
  }

  if (state === 'scanning') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 16 }}>
        <div style={{ fontSize: 40 }}>◎</div>
        <div style={{ fontSize: 16, fontWeight: 600, color: '#fff' }}>Scanning for leftovers…</div>
        <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)' }}>
          {progress.groups} orphaned group{progress.groups !== 1 ? 's' : ''} found
        </div>
        <Spinner accent={theme.accent} />
      </div>
    )
  }

  const selectedFiles = groups.flatMap(g => g.files).filter(f => selected.has(f.path))
  const selectedSize = selectedFiles.reduce((t, f) => t + f.size, 0)
  const totalSize = groups.reduce((t, g) => t + g.totalSize, 0)

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontSize: 15, fontWeight: 600, color: '#fff' }}>
          {groups.length > 0
            ? `${groups.length} orphaned app${groups.length > 1 ? 's' : ''} · ${fmt(totalSize)}`
            : 'No leftovers found — your Mac is clean'}
        </div>
        <button onClick={runScan} style={ghostBtn}>Rescan</button>
      </div>

      {groups.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, color: 'rgba(255,255,255,0.35)', fontSize: 14 }}>
          ✓ No orphaned files found
        </div>
      ) : (
        <>
          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
            {groups.map(g => {
              const key = g.bundleId
              const isExpanded = expanded.has(key)
              const allSelected = g.files.length > 0 && g.files.every(f => selected.has(f.path))
              const someSelected = g.files.some(f => selected.has(f.path))

              return (
                <div key={key} style={{
                  borderRadius: 12, overflow: 'hidden',
                  border: someSelected ? '1px solid rgba(74,144,226,0.35)' : '1px solid rgba(255,255,255,0.08)',
                  background: someSelected ? 'rgba(74,144,226,0.10)' : 'rgba(255,255,255,0.04)',
                  transition: 'all 0.15s ease'
                }}>
                  {/* Group header */}
                  <div
                    onClick={() => toggleGroup(g)}
                    style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', cursor: 'pointer' }}
                  >
                    <Checkbox checked={allSelected} indeterminate={someSelected && !allSelected} accent={theme.accent} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: '#fff' }}>{g.appName}</div>
                      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 1 }}>
                        {g.bundleId} · {g.files.length} file{g.files.length > 1 ? 's' : ''}
                      </div>
                    </div>
                    <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', flexShrink: 0 }}>{fmt(g.totalSize)}</span>
                    <button
                      onClick={e => toggleExpand(key, e)}
                      style={{
                        background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)',
                        cursor: 'pointer', fontSize: 12, padding: '2px 6px', borderRadius: 4,
                        transform: isExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s'
                      }}
                    >▾</button>
                  </div>

                  {/* Expanded file list */}
                  {isExpanded && (
                    <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingBottom: 4 }}>
                      {g.files.map(f => (
                        <div
                          key={f.path}
                          onClick={() => toggleFile(f)}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 12, padding: '7px 14px 7px 42px',
                            cursor: 'pointer',
                            background: selected.has(f.path) ? 'rgba(74,144,226,0.08)' : 'transparent',
                            transition: 'background 0.1s'
                          }}
                        >
                          <Checkbox checked={selected.has(f.path)} accent={theme.accent} size={14} />
                          <span style={{ flex: 1, fontSize: 12, color: 'rgba(255,255,255,0.7)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {f.name}
                          </span>
                          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', flexShrink: 0 }}>{fmt(f.size)}</span>
                          <button
                            onClick={e => { e.stopPropagation(); window.electron.openInFinder(f.path) }}
                            title="Show in Finder"
                            style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.35)', cursor: 'pointer', fontSize: 11, padding: '2px 4px' }}
                          >
                            ⌕
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Footer */}
          {selected.size > 0 && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 16, padding: '14px 16px',
              background: 'rgba(0,0,0,0.3)', borderRadius: 14,
              border: '1px solid rgba(255,255,255,0.1)', backdropFilter: 'blur(12px)'
            }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#fff' }}>
                  {selectedFiles.length} file{selectedFiles.length > 1 ? 's' : ''} selected
                </div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', marginTop: 2 }}>{fmt(selectedSize)}</div>
              </div>
              <button onClick={clean} disabled={working} style={{
                padding: '9px 22px', borderRadius: 10, border: 'none', cursor: working ? 'default' : 'pointer',
                background: working ? 'rgba(255,255,255,0.1)' : '#e53e3e',
                color: '#fff', fontSize: 13, fontWeight: 600, opacity: working ? 0.6 : 1,
                transition: 'opacity 0.2s'
              }}>
                {working ? 'Removing…' : 'Move to Trash'}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ── Shared micro-components ───────────────────────────────────────────────────

function Checkbox({ checked, indeterminate, accent, size = 16 }: {
  checked: boolean
  indeterminate?: boolean
  accent: string
  size?: number
}) {
  return (
    <div style={{
      width: size, height: size, borderRadius: size * 0.3,
      border: `1.5px solid ${checked || indeterminate ? accent : 'rgba(255,255,255,0.25)'}`,
      background: checked ? accent : indeterminate ? `${accent}55` : 'transparent',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexShrink: 0, transition: 'all 0.15s ease'
    }}>
      {checked && <span style={{ fontSize: size * 0.65, color: '#fff', lineHeight: 1 }}>✓</span>}
      {!checked && indeterminate && <span style={{ fontSize: size * 0.65, color: '#fff', lineHeight: 1 }}>–</span>}
    </div>
  )
}

function ScanningIndicator({ label, theme }: { label: string; theme: PageTheme }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 16 }}>
      <Spinner accent={theme.accent} />
      <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.6)' }}>{label}</div>
    </div>
  )
}

function Spinner({ accent }: { accent: string }) {
  return (
    <div style={{
      width: 32, height: 32, borderRadius: '50%',
      border: `2px solid rgba(255,255,255,0.1)`,
      borderTopColor: accent,
      animation: 'spin 0.8s linear infinite'
    }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

function ProgressBar({ pct, accent }: { pct: number; accent: string }) {
  return (
    <div style={{ width: 260, height: 4, background: 'rgba(255,255,255,0.1)', borderRadius: 2, overflow: 'hidden' }}>
      <div style={{ width: `${pct}%`, height: '100%', background: accent, borderRadius: 2, transition: 'width 0.3s ease' }} />
    </div>
  )
}

const ghostBtn: React.CSSProperties = {
  padding: '7px 14px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.2)',
  background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.7)',
  fontSize: 12, fontWeight: 500, cursor: 'pointer'
}

// ── Tab selector ──────────────────────────────────────────────────────────────

const TABS: Array<{ id: Tab; label: string; icon: string }> = [
  { id: 'uninstaller', label: 'App Uninstaller', icon: '⊗' },
  { id: 'updater',     label: 'App Updater',     icon: '↑' },
  { id: 'leftovers',   label: 'File Leftovers',  icon: '◎' },
]

// ── Root component ────────────────────────────────────────────────────────────

export default function Applications({ theme }: Props) {
  const [tab, setTab] = useState<Tab>('uninstaller')

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header */}
      <div>
        <h1 style={{ margin: '0 0 4px', fontSize: 28, fontWeight: 700, color: '#fff', letterSpacing: '-0.02em' }}>
          Applications
        </h1>
        <p style={{ margin: 0, fontSize: 13, color: 'rgba(255,255,255,0.45)' }}>
          Uninstall, update, or remove leftover files from your applications.
        </p>
      </div>

      {/* Tab strip */}
      <div style={{ display: 'flex', gap: 8 }}>
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '9px 18px', borderRadius: 12, border: 'none', cursor: 'pointer',
              background: tab === t.id ? `${theme.accent}22` : 'rgba(255,255,255,0.06)',
              color: tab === t.id ? theme.accent : 'rgba(255,255,255,0.55)',
              fontSize: 13, fontWeight: tab === t.id ? 600 : 400,
              outline: tab === t.id ? `1px solid ${theme.accent}55` : 'none',
              transition: 'all 0.15s ease'
            }}
          >
            <span style={{ fontSize: 15 }}>{t.icon}</span>
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div style={{ flex: 1, overflow: 'hidden', minHeight: 0 }}>
        {tab === 'uninstaller' && <UninstallerTab theme={theme} />}
        {tab === 'updater'     && <UpdaterTab theme={theme} />}
        {tab === 'leftovers'   && <LeftoversTab theme={theme} />}
      </div>
    </div>
  )
}
