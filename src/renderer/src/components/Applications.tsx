import { useState, useCallback, useRef } from 'react'
import type { InstalledApp, AppUpdate, AppLeftoverGroup, FileItem } from '../../../shared/types'
import type { PageTheme } from '../App'

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number): string {
  if (n >= 1e9) return (n / 1e9).toFixed(1) + ' GB'
  if (n >= 1e6) return (n / 1e6).toFixed(0) + ' MB'
  if (n >= 1e3) return (n / 1e3).toFixed(0) + ' KB'
  return n + ' B'
}

// ── Types ─────────────────────────────────────────────────────────────────────

type ScanPhase = 'idle' | 'scanning' | 'done'
type AppTab = 'uninstaller' | 'updater' | 'leftovers'

interface Props { theme: PageTheme }

// ── Sub-components ────────────────────────────────────────────────────────────

function SpinnerIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 18 18" fill="none" className="animate-spin" style={{ display: 'inline-block' }}>
      <circle cx="9" cy="9" r="6" stroke="rgba(255,255,255,0.2)" strokeWidth="2"/>
      <path d="M9 3a6 6 0 0 1 6 6" stroke="white" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  )
}

function CheckIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" fill="none" style={{ display: 'inline-block' }}>
      <path d="M2 7l4 4 6-7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

function HexIcon({ accent }: { accent: string }) {
  return (
    <svg width={200} height={220} viewBox="0 0 200 220" fill="none">
      <defs>
        <linearGradient id="hexGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={accent} stopOpacity="0.9"/>
          <stop offset="100%" stopColor={accent} stopOpacity="0.3"/>
        </linearGradient>
        <filter id="hexGlow">
          <feGaussianBlur stdDeviation="8" result="blur"/>
          <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
      </defs>
      {/* Outer hex */}
      <polygon
        points="100,18 178,62 178,150 100,194 22,150 22,62"
        fill={`url(#hexGrad)`}
        opacity="0.18"
        filter="url(#hexGlow)"
      />
      {/* Inner hex */}
      <polygon
        points="100,34 162,70 162,144 100,180 38,144 38,70"
        fill={`url(#hexGrad)`}
        opacity="0.32"
      />
      {/* App grid icon */}
      <rect x="72" y="72" width="22" height="22" rx="4" fill="white" opacity="0.85"/>
      <rect x="106" y="72" width="22" height="22" rx="4" fill="white" opacity="0.85"/>
      <rect x="72" y="106" width="22" height="22" rx="4" fill="white" opacity="0.85"/>
      {/* Plus in bottom-right quadrant */}
      <path d="M117 110v14M110 117h14" stroke="white" strokeWidth="2.5" strokeLinecap="round" opacity="0.85"/>
    </svg>
  )
}

// ── Landing Page ──────────────────────────────────────────────────────────────

function LandingPage({ onScan, accent }: { onScan: () => void; accent: string }) {
  const features = [
    {
      icon: (
        <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M2.5 4h10M5 4V2.5A.5.5 0 0 1 5.5 2h4a.5.5 0 0 1 .5.5V4M3.5 4 4 12.5a.5.5 0 0 0 .5.5h6a.5.5 0 0 0 .5-.5L11.5 4M6 7v4M9 7v4"/>
        </svg>
      ),
      label: 'App Uninstaller',
      desc: 'Completely remove apps and all their leftover files',
    },
    {
      icon: (
        <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M7.5 2v4M7.5 9v4M2 7.5h11M5 4.5 7.5 2l2.5 2.5"/>
        </svg>
      ),
      label: 'App Updater',
      desc: 'Find apps with available Sparkle or App Store updates',
    },
    {
      icon: (
        <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M2 11h11M4 11V5.5L7.5 2 11 5.5V11M6 11V8h3v3"/>
        </svg>
      ),
      label: 'File Leftovers',
      desc: 'Remove orphaned caches, preferences and support files',
    },
  ]

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 60, paddingTop: 24 }}>
      {/* Hero icon */}
      <div style={{ flexShrink: 0 }}>
        <HexIcon accent={accent} />
      </div>

      {/* Right panel */}
      <div style={{ flex: 1 }}>
        <h1 style={{ fontSize: 40, fontWeight: 700, letterSpacing: '-0.03em', marginBottom: 10 }}>
          Applications
        </h1>
        <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: 14, marginBottom: 36, lineHeight: 1.6 }}>
          Take control of your applications. Uninstall, update or remove old application leftovers.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 40 }}>
          {features.map(f => (
            <div key={f.label} style={{
              display: 'flex',
              alignItems: 'center',
              gap: 14,
              padding: '13px 16px',
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.09)',
              borderRadius: 12,
            }}>
              <div style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                background: `linear-gradient(135deg, ${accent}55, ${accent}22)`,
                border: `1px solid ${accent}44`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: accent,
                flexShrink: 0,
              }}>
                {f.icon}
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 2 }}>{f.label}</div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)' }}>{f.desc}</div>
              </div>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button
            className="btn-primary"
            onClick={onScan}
            style={{
              background: `linear-gradient(135deg, ${accent}, ${accent}AA)`,
              fontSize: 15,
              padding: '11px 32px',
              borderRadius: 24,
              fontWeight: 600,
            }}
          >
            Scan
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Scanning State ────────────────────────────────────────────────────────────

function ScanningView({ phase }: { phase: string }) {
  const labels: Record<string, string> = {
    apps: 'Scanning installed applications…',
    leftovers: 'Looking for orphaned files…',
    updates: 'Checking for updates…',
    done: 'Finishing up…',
  }
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      height: '60vh',
      gap: 20,
    }}>
      <SpinnerIcon size={36} />
      <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 14 }}>
        {labels[phase] ?? 'Scanning…'}
      </p>
    </div>
  )
}

// ── Tab bar ───────────────────────────────────────────────────────────────────

function TabBar({
  active,
  onChange,
  counts,
  accent,
}: {
  active: AppTab
  onChange: (t: AppTab) => void
  counts: { uninstaller: number; updater: number; leftovers: number }
  accent: string
}) {
  const tabs: { id: AppTab; label: string; count: number }[] = [
    { id: 'uninstaller', label: 'App Uninstaller', count: counts.uninstaller },
    { id: 'updater',     label: 'App Updater',     count: counts.updater },
    { id: 'leftovers',   label: 'File Leftovers',  count: counts.leftovers },
  ]
  return (
    <div style={{ display: 'flex', gap: 4, marginBottom: 20 }}>
      {tabs.map(t => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          style={{
            padding: '8px 18px',
            borderRadius: 20,
            border: 'none',
            cursor: 'pointer',
            fontSize: 13,
            fontWeight: active === t.id ? 600 : 400,
            background: active === t.id ? `linear-gradient(135deg, ${accent}55, ${accent}22)` : 'rgba(255,255,255,0.07)',
            color: active === t.id ? '#fff' : 'rgba(255,255,255,0.55)',
            outline: active === t.id ? `1px solid ${accent}55` : '1px solid transparent',
            transition: 'all 0.15s',
            display: 'flex',
            alignItems: 'center',
            gap: 7,
          }}
        >
          {t.label}
          {t.count > 0 && (
            <span style={{
              fontSize: 10,
              fontWeight: 700,
              background: active === t.id ? accent : 'rgba(255,255,255,0.15)',
              color: '#fff',
              borderRadius: 10,
              padding: '1px 6px',
              fontVariantNumeric: 'tabular-nums',
            }}>
              {t.count}
            </span>
          )}
        </button>
      ))}
    </div>
  )
}

// ── App Uninstaller Tab ───────────────────────────────────────────────────────

function UninstallerTab({
  apps,
  accent,
}: {
  apps: InstalledApp[]
  accent: string
}) {
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<InstalledApp | null>(null)
  const [leftovers, setLeftovers] = useState<FileItem[]>([])
  const [loadingLeftovers, setLoadingLeftovers] = useState(false)
  const [selectedLeftoverPaths, setSelectedLeftoverPaths] = useState<Set<string>>(new Set())
  const [uninstallStatus, setUninstallStatus] = useState<'idle' | 'working' | 'done' | 'error'>('idle')
  const [uninstallMsg, setUninstallMsg] = useState('')

  const filtered = apps.filter(a =>
    a.name.toLowerCase().includes(search.toLowerCase()) ||
    a.bundleId.toLowerCase().includes(search.toLowerCase())
  )

  const selectApp = async (app: InstalledApp) => {
    setSelected(app)
    setLeftovers([])
    setSelectedLeftoverPaths(new Set())
    setUninstallStatus('idle')
    setUninstallMsg('')
  }

  const findLeftovers = async () => {
    if (!selected) return
    setLoadingLeftovers(true)
    try {
      const files = await window.electron.apps.leftovers(selected.bundleId, selected.name)
      setLeftovers(files)
      setSelectedLeftoverPaths(new Set(files.map(f => f.path)))
    } finally {
      setLoadingLeftovers(false)
    }
  }

  const toggleLeftover = useCallback((p: string) => {
    setSelectedLeftoverPaths(prev => {
      const next = new Set(prev)
      if (next.has(p)) next.delete(p); else next.add(p)
      return next
    })
  }, [])

  const doUninstall = async () => {
    if (!selected) return
    setUninstallStatus('working')
    const selectedFiles = leftovers.filter(f => selectedLeftoverPaths.has(f.path))
    const removeLeftovers = selectedFiles.length > 0

    const result = await window.electron.apps.uninstall(
      selected.path, selected.bundleId, selected.name, removeLeftovers
    )
    if (result.cancelled) {
      setUninstallStatus('idle')
      return
    }
    if (result.trashed.length > 0) {
      setUninstallStatus('done')
      setUninstallMsg(`Moved ${result.trashed.length} items to Trash`)
      setSelected(null)
      setLeftovers([])
    } else if (result.failed.length > 0) {
      setUninstallStatus('error')
      setUninstallMsg(`Failed to trash ${result.failed.length} items`)
    }
  }

  return (
    <div style={{ display: 'flex', gap: 14, height: '100%', minHeight: 0 }}>
      {/* App list */}
      <div style={{
        width: 240,
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        gap: 0,
        background: 'rgba(0,0,0,0.22)',
        border: '1px solid rgba(255,255,255,0.09)',
        borderRadius: 14,
        overflow: 'hidden',
      }}>
        {/* Search */}
        <div style={{ padding: '10px 12px', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search apps…"
            style={{
              width: '100%',
              background: 'rgba(255,255,255,0.07)',
              border: '1px solid rgba(255,255,255,0.10)',
              borderRadius: 8,
              color: '#fff',
              fontSize: 12,
              padding: '6px 10px',
              outline: 'none',
            }}
          />
        </div>
        {/* List */}
        <div style={{ overflowY: 'auto', flex: 1 }}>
          {filtered.map(app => {
            const isActive = selected?.bundleId === app.bundleId
            return (
              <button
                key={app.bundleId}
                onClick={() => selectApp(app)}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'flex-start',
                  width: '100%',
                  padding: '9px 12px',
                  border: 'none',
                  borderRadius: 0,
                  cursor: 'pointer',
                  background: isActive ? `${accent}22` : 'transparent',
                  borderLeft: isActive ? `2px solid ${accent}` : '2px solid transparent',
                  textAlign: 'left',
                  transition: 'background 0.12s',
                }}
              >
                <span style={{ fontSize: 12, fontWeight: 500, color: isActive ? '#fff' : 'rgba(255,255,255,0.80)' }}>
                  {app.name}
                </span>
                <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', marginTop: 2, fontVariantNumeric: 'tabular-nums' }}>
                  {app.version} · {fmt(app.size)}
                </span>
              </button>
            )
          })}
          {filtered.length === 0 && (
            <div style={{ padding: 20, textAlign: 'center', color: 'rgba(255,255,255,0.30)', fontSize: 12 }}>
              No apps found
            </div>
          )}
        </div>
      </div>

      {/* Detail panel */}
      <div style={{
        flex: 1,
        background: 'rgba(0,0,0,0.22)',
        border: '1px solid rgba(255,255,255,0.09)',
        borderRadius: 14,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}>
        {!selected ? (
          <div style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'rgba(255,255,255,0.28)',
            gap: 10,
          }}>
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline-block', opacity: 0.5 }}>
              <rect x="4" y="4" width="11" height="11" rx="2.5"/>
              <rect x="17" y="4" width="11" height="11" rx="2.5"/>
              <rect x="4" y="17" width="11" height="11" rx="2.5"/>
              <path d="M22.5 17v11M17 22.5h11"/>
            </svg>
            <span style={{ fontSize: 13 }}>Select an app to uninstall</span>
          </div>
        ) : (
          <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 20, flex: 1, overflow: 'auto' }}>
            {/* App header */}
            <div>
              <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>{selected.name}</div>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 11, padding: '2px 8px', background: 'rgba(255,255,255,0.08)', borderRadius: 6, color: 'rgba(255,255,255,0.6)' }}>
                  v{selected.version}
                </span>
                <span style={{ fontSize: 11, padding: '2px 8px', background: 'rgba(255,255,255,0.08)', borderRadius: 6, color: 'rgba(255,255,255,0.6)' }}>
                  {fmt(selected.size)}
                </span>
                {selected.isMAS && (
                  <span style={{ fontSize: 11, padding: '2px 8px', background: `${accent}22`, border: `1px solid ${accent}44`, borderRadius: 6, color: accent }}>
                    Mac App Store
                  </span>
                )}
              </div>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.30)', marginTop: 6, fontFamily: 'monospace' }}>
                {selected.bundleId}
              </div>
            </div>

            {/* Leftovers section */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <span style={{ fontSize: 13, fontWeight: 600 }}>Associated Files</span>
                {leftovers.length === 0 && (
                  <button
                    className="btn-secondary"
                    style={{ fontSize: 11, padding: '5px 14px' }}
                    onClick={findLeftovers}
                    disabled={loadingLeftovers}
                  >
                    {loadingLeftovers ? <SpinnerIcon size={12} /> : 'Find Leftovers'}
                  </button>
                )}
              </div>

              {leftovers.length > 0 && (
                <div style={{
                  background: 'rgba(0,0,0,0.20)',
                  border: '1px solid rgba(255,255,255,0.07)',
                  borderRadius: 10,
                  overflow: 'hidden',
                }}>
                  {leftovers.map(f => (
                    <label
                      key={f.path}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        padding: '8px 12px',
                        cursor: 'pointer',
                        borderBottom: '1px solid rgba(255,255,255,0.05)',
                      }}
                    >
                      <div
                        onClick={() => toggleLeftover(f.path)}
                        style={{
                          width: 15,
                          height: 15,
                          borderRadius: 4,
                          border: `1.5px solid ${selectedLeftoverPaths.has(f.path) ? accent : 'rgba(255,255,255,0.25)'}`,
                          background: selectedLeftoverPaths.has(f.path) ? accent : 'transparent',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                          cursor: 'pointer',
                        }}
                      >
                        {selectedLeftoverPaths.has(f.path) && <CheckIcon size={10} />}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 11, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {f.name}
                        </div>
                        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {f.path.replace(window.electron.homeDir, '~')}
                        </div>
                      </div>
                      <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)', flexShrink: 0 }}>
                        {fmt(f.size)}
                      </span>
                    </label>
                  ))}
                </div>
              )}

              {leftovers.length === 0 && !loadingLeftovers && (
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', padding: '8px 0' }}>
                  Click "Find Leftovers" to scan for associated files in ~/Library
                </div>
              )}
            </div>

            {/* Status / Result */}
            {uninstallStatus === 'done' && (
              <div style={{ padding: '10px 14px', background: 'rgba(48,209,88,0.12)', border: '1px solid rgba(48,209,88,0.28)', borderRadius: 10, fontSize: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                <CheckIcon size={13} />
                {uninstallMsg}
              </div>
            )}
            {uninstallStatus === 'error' && (
              <div style={{ padding: '10px 14px', background: 'rgba(255,69,58,0.12)', border: '1px solid rgba(255,69,58,0.28)', borderRadius: 10, fontSize: 12 }}>
                {uninstallMsg}
              </div>
            )}

            {/* Uninstall button */}
            <div style={{ marginTop: 'auto' }}>
              <button
                className="btn-danger"
                onClick={doUninstall}
                disabled={uninstallStatus === 'working'}
                style={{ fontSize: 13, padding: '10px 22px' }}
              >
                {uninstallStatus === 'working' ? (
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <SpinnerIcon size={14} /> Uninstalling…
                  </span>
                ) : (
                  `Uninstall${selectedLeftoverPaths.size > 0 ? ' + Leftovers' : ''}`
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── App Updater Tab ───────────────────────────────────────────────────────────

function UpdaterTab({ updates, accent }: { updates: AppUpdate[]; accent: string }) {
  const openAppStore = () => {
    window.electron.openPath('macappstore://showUpdatesPage')
  }

  if (updates.length === 0) {
    return (
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: 320,
        gap: 14,
        color: 'rgba(255,255,255,0.35)',
      }}>
        <svg width="32" height="32" viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline-block' }}>
          <path d="M5 16l9 9 13-14"/>
        </svg>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 14, marginBottom: 4 }}>All apps are up to date</div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.25)' }}>
            Checked Sparkle-enabled apps. For Mac App Store apps, use Software Update.
          </div>
        </div>
        <button
          className="btn-secondary"
          style={{ fontSize: 12, padding: '7px 18px' }}
          onClick={openAppStore}
        >
          Open App Store Updates
        </button>
      </div>
    )
  }

  return (
    <div style={{
      background: 'rgba(0,0,0,0.22)',
      border: '1px solid rgba(255,255,255,0.09)',
      borderRadius: 14,
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        padding: '12px 18px',
        borderBottom: '1px solid rgba(255,255,255,0.07)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.50)' }}>
          {updates.length} update{updates.length !== 1 ? 's' : ''} available
        </span>
        <button className="btn-secondary" style={{ fontSize: 11, padding: '5px 14px' }} onClick={openAppStore}>
          Open App Store
        </button>
      </div>

      {/* Rows */}
      {updates.map(u => (
        <div
          key={u.bundleId}
          style={{
            display: 'flex',
            alignItems: 'center',
            padding: '12px 18px',
            borderBottom: '1px solid rgba(255,255,255,0.05)',
            gap: 14,
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 3 }}>{u.appName}</div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontVariantNumeric: 'tabular-nums' }}>{u.currentVersion}</span>
              <span>→</span>
              <span style={{ color: accent, fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>{u.latestVersion}</span>
            </div>
          </div>
          {u.downloadUrl ? (
            <button
              className="btn-primary"
              style={{ fontSize: 11, padding: '6px 16px', background: `linear-gradient(135deg, ${accent}, ${accent}AA)` }}
              onClick={() => window.electron.openPath(u.downloadUrl!)}
            >
              Download
            </button>
          ) : u.isMAS ? (
            <button
              className="btn-secondary"
              style={{ fontSize: 11, padding: '6px 16px' }}
              onClick={openAppStore}
            >
              App Store
            </button>
          ) : null}
        </div>
      ))}
    </div>
  )
}

// ── File Leftovers Tab ────────────────────────────────────────────────────────

function LeftoversTab({ groups, accent }: { groups: AppLeftoverGroup[]; accent: string }) {
  const [selected, setSelected] = useState<Set<string>>(() => new Set(groups.flatMap(g => g.paths)))
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [cleanDone, setCleanDone] = useState<string | null>(null)
  const [cleaning, setCleaning] = useState(false)

  const toggleGroup = (bundleId: string) => {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(bundleId)) next.delete(bundleId); else next.add(bundleId)
      return next
    })
  }

  const togglePath = (p: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(p)) next.delete(p); else next.add(p)
      return next
    })
  }

  const selectedFiles: FileItem[] = groups
    .flatMap(g => g.paths.filter(p => selected.has(p)).map(p => ({
      path: p,
      name: p.split('/').pop() ?? p,
      size: 0,
      category: 'app-leftovers' as const,
      modifiedAt: '',
    })))

  const clean = async () => {
    if (selectedFiles.length === 0) return
    setCleaning(true)
    try {
      const result = await window.electron.apps.cleanLeftovers(selectedFiles)
      if (!result.cancelled) {
        setCleanDone(`Moved ${result.cleaned} items to Trash`)
        setSelected(prev => {
          const next = new Set(prev)
          selectedFiles.forEach(f => next.delete(f.path))
          return next
        })
      }
    } finally {
      setCleaning(false)
    }
  }

  if (groups.length === 0) {
    return (
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: 320,
        gap: 14,
        color: 'rgba(255,255,255,0.35)',
      }}>
        <svg width="32" height="32" viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline-block' }}>
          <path d="M5 16l9 9 13-14"/>
        </svg>
        <span style={{ fontSize: 14 }}>No leftover files found</span>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)' }}>
          {groups.length} orphaned group{groups.length !== 1 ? 's' : ''} · {selected.size} paths selected
        </span>
        {cleanDone && (
          <div style={{ fontSize: 12, color: '#30d158', display: 'flex', alignItems: 'center', gap: 6 }}>
            <CheckIcon size={12} /> {cleanDone}
          </div>
        )}
        {selected.size > 0 && !cleanDone && (
          <button
            className="btn-danger"
            style={{ fontSize: 12, padding: '7px 18px' }}
            onClick={clean}
            disabled={cleaning}
          >
            {cleaning ? <SpinnerIcon size={13} /> : `Clean Selected`}
          </button>
        )}
      </div>

      {/* Groups */}
      <div style={{
        background: 'rgba(0,0,0,0.22)',
        border: '1px solid rgba(255,255,255,0.09)',
        borderRadius: 14,
        overflow: 'hidden',
      }}>
        {groups.map((g, i) => (
          <div key={g.bundleId} style={{ borderBottom: i < groups.length - 1 ? '1px solid rgba(255,255,255,0.05)' : undefined }}>
            {/* Group header */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                padding: '11px 16px',
                cursor: 'pointer',
                gap: 10,
              }}
              onClick={() => toggleGroup(g.bundleId)}
            >
              <div
                onClick={e => {
                  e.stopPropagation()
                  const allSel = g.paths.every(p => selected.has(p))
                  setSelected(prev => {
                    const next = new Set(prev)
                    if (allSel) g.paths.forEach(p => next.delete(p))
                    else g.paths.forEach(p => next.add(p))
                    return next
                  })
                }}
                style={{
                  width: 15,
                  height: 15,
                  borderRadius: 4,
                  border: `1.5px solid ${g.paths.every(p => selected.has(p)) ? accent : 'rgba(255,255,255,0.25)'}`,
                  background: g.paths.every(p => selected.has(p)) ? accent : 'transparent',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  cursor: 'pointer',
                }}
              >
                {g.paths.every(p => selected.has(p)) && <CheckIcon size={10} />}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{g.appName}</div>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', fontFamily: 'monospace' }}>{g.bundleId}</div>
              </div>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexShrink: 0 }}>
                <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', fontVariantNumeric: 'tabular-nums' }}>
                  {g.paths.length} file{g.paths.length !== 1 ? 's' : ''} · {fmt(g.totalSize)}
                </span>
                <svg
                  width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5"
                  style={{ display: 'inline-block', transform: expanded.has(g.bundleId) ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s', opacity: 0.5 }}
                >
                  <path d="M2 4l4 4 4-4" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
            </div>

            {/* Expanded paths */}
            {expanded.has(g.bundleId) && (
              <div style={{ background: 'rgba(0,0,0,0.15)', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                {g.paths.map(p => (
                  <label
                    key={p}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      padding: '7px 16px 7px 40px',
                      cursor: 'pointer',
                      borderBottom: '1px solid rgba(255,255,255,0.03)',
                    }}
                    onClick={() => togglePath(p)}
                  >
                    <div style={{
                      width: 13,
                      height: 13,
                      borderRadius: 3,
                      border: `1.5px solid ${selected.has(p) ? accent : 'rgba(255,255,255,0.20)'}`,
                      background: selected.has(p) ? accent : 'transparent',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}>
                      {selected.has(p) && <CheckIcon size={9} />}
                    </div>
                    <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.60)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {p.replace(window.electron.homeDir, '~')}
                    </span>
                  </label>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function Applications({ theme }: Props) {
  const [phase, setPhase] = useState<ScanPhase>('idle')
  const [scanningPhase, setScanningPhase] = useState('apps')
  const [installed, setInstalled] = useState<InstalledApp[]>([])
  const [updates, setUpdates] = useState<AppUpdate[]>([])
  const [leftovers, setLeftovers] = useState<AppLeftoverGroup[]>([])
  const [tab, setTab] = useState<AppTab>('uninstaller')
  const unsubRef = useRef<(() => void) | null>(null)

  const runScan = async () => {
    setPhase('scanning')
    setScanningPhase('apps')

    // Subscribe to scan progress events
    unsubRef.current = window.electron.apps.onScanProgress((p: { phase: string; found: number }) => {
      setScanningPhase(p.phase)
    })

    try {
      const result = await window.electron.apps.scan()
      setInstalled(result.installed ?? [])
      setUpdates(result.updates ?? [])
      setLeftovers(result.leftovers ?? [])
      setPhase('done')
      setTab('uninstaller')
    } catch (err) {
      console.error('Apps scan failed:', err)
      setPhase('idle')
    } finally {
      unsubRef.current?.()
      unsubRef.current = null
    }
  }

  const { accent } = theme

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Page header */}
      {phase === 'done' && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div>
            <h1 style={{ fontSize: 30, fontWeight: 700, letterSpacing: '-0.025em' }}>Applications</h1>
            <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: 13, marginTop: 3 }}>
              {installed.length} apps · {updates.length} updates · {leftovers.length} leftover groups
            </p>
          </div>
          <button
            className="btn-secondary"
            onClick={runScan}
            style={{ fontSize: 13, padding: '8px 20px' }}
          >
            Rescan
          </button>
        </div>
      )}

      {/* Content */}
      {phase === 'idle' && <LandingPage onScan={runScan} accent={accent} />}
      {phase === 'scanning' && <ScanningView phase={scanningPhase} />}

      {phase === 'done' && (
        <>
          <TabBar
            active={tab}
            onChange={setTab}
            counts={{ uninstaller: installed.length, updater: updates.length, leftovers: leftovers.length }}
            accent={accent}
          />
          <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
            {tab === 'uninstaller' && <UninstallerTab apps={installed} accent={accent} />}
            {tab === 'updater' && <UpdaterTab updates={updates} accent={accent} />}
            {tab === 'leftovers' && <LeftoversTab groups={leftovers} accent={accent} />}
          </div>
        </>
      )}
    </div>
  )
}
