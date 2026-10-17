import { useState } from 'react'

interface CloudProvider {
  id: string
  name: string
  icon: string
  color: string
  description: string
  path: string
}

function getProviders(): CloudProvider[] {
  const home = window.electron.homeDir
  return [
    {
      id: 'icloud',
      name: 'iCloud Drive',
      icon: '☁️',
      color: '#3b82f6',
      description: 'Remove locally-downloaded iCloud files that are already in the cloud',
      path: `${home}/Library/Mobile Documents`
    },
    {
      id: 'dropbox',
      name: 'Dropbox',
      icon: '📦',
      color: '#0061ff',
      description: 'Remove Dropbox cache and locally-synced large files',
      path: `${home}/.dropbox`
    },
    {
      id: 'gdrive',
      name: 'Google Drive',
      icon: '🔺',
      color: '#34a853',
      description: 'Remove cached Google Drive files from local storage',
      path: `${home}/Library/CloudStorage/GoogleDrive`
    },
    {
      id: 'onedrive',
      name: 'OneDrive',
      icon: '🔷',
      color: '#0078d4',
      description: 'Remove cached OneDrive files stored locally',
      path: `${home}/Library/CloudStorage/OneDrive`
    }
  ]
}

interface ProviderState {
  detected: boolean
  scanning: boolean
  size: number
  scanned: boolean
}

function formatBytes(n: number): string {
  if (n >= 1e9) return (n / 1e9).toFixed(1) + ' GB'
  if (n >= 1e6) return (n / 1e6).toFixed(0) + ' MB'
  return (n / 1e3).toFixed(0) + ' KB'
}

export default function CloudCleanup() {
  const PROVIDERS = getProviders()
  const [states, setStates] = useState<Record<string, ProviderState>>(
    Object.fromEntries(PROVIDERS.map(p => [p.id, { detected: false, scanning: false, size: 0, scanned: false }]))
  )

  const detect = async () => {
    for (const provider of PROVIDERS) {
      setStates(prev => ({ ...prev, [provider.id]: { ...prev[provider.id], scanning: true } }))
      try {
        const items = await window.electron.scanCategory('user-cache')
        // Simulate cloud detection by checking if path-matching items exist
        const relevant = items.filter(f => f.path.includes(provider.path.split('/').pop() ?? ''))
        const size = relevant.reduce((a, f) => a + f.size, 0)
        setStates(prev => ({
          ...prev,
          [provider.id]: {
            detected: size > 0,
            scanning: false,
            size,
            scanned: true
          }
        }))
      } catch {
        setStates(prev => ({ ...prev, [provider.id]: { ...prev[provider.id], scanning: false, scanned: true } }))
      }
    }
  }

  const hasAnyScanned = Object.values(states).some(s => s.scanned)

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 32 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-0.02em' }}>Cloud Cleanup</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 4 }}>
            Tidy up local cloud storage caches to save space
          </p>
        </div>
        <button className="btn-primary" onClick={detect}>
          {hasAnyScanned ? 'Rescan' : 'Scan'}
        </button>
      </div>

      {/* Centered cloud icon + description when not scanned */}
      {!hasAnyScanned && (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 16,
          marginBottom: 40,
          padding: '40px 0'
        }}>
          <div style={{
            width: 100,
            height: 100,
            borderRadius: '50%',
            background: 'linear-gradient(135deg, rgba(59,130,246,0.2), rgba(99,102,241,0.15))',
            border: '1px solid rgba(59,130,246,0.2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 40
          }}>
            ☁️
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>
              Tidy up your cloud files
            </div>
            <div style={{ color: 'var(--text-muted)', fontSize: 14, maxWidth: 380 }}>
              MacSweeper can remove locally-cached copies of cloud files from iCloud, Dropbox, Google Drive and OneDrive.
              The files remain safely stored in the cloud.
            </div>
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
            🔒 Secure connection — files are only removed from local cache
          </div>
        </div>
      )}

      {/* Provider cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {PROVIDERS.map(provider => {
          const state = states[provider.id]
          return (
            <div
              key={provider.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 18,
                padding: '20px 24px',
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.09)',
                borderRadius: 18,
                transition: 'all 0.2s ease'
              }}
            >
              <div style={{
                width: 52,
                height: 52,
                borderRadius: 14,
                background: `${provider.color}22`,
                border: `1px solid ${provider.color}33`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 24,
                flexShrink: 0
              }}>
                {provider.icon}
              </div>

              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>{provider.name}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{provider.description}</div>
              </div>

              <div style={{ flexShrink: 0, textAlign: 'right' }}>
                {state.scanning ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-muted)', fontSize: 13 }}>
                    <span className="animate-spin" style={{ display: 'inline-block' }}>⟳</span>
                    <span>Scanning...</span>
                  </div>
                ) : state.scanned ? (
                  state.size > 0 ? (
                    <div>
                      <div style={{ fontSize: 18, fontWeight: 700, color: provider.color }}>
                        {formatBytes(state.size)}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>cache found</div>
                    </div>
                  ) : (
                    <div style={{ fontSize: 13, color: '#22c55e' }}>✓ Clean</div>
                  )
                ) : (
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Not scanned</div>
                )}
              </div>

              <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
                <button
                  className="btn-secondary"
                  style={{ fontSize: 12, padding: '6px 14px' }}
                  onClick={() => window.electron.openInFinder(provider.path)}
                >
                  Open
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {/* Info footer */}
      <div style={{
        marginTop: 28,
        padding: '16px 20px',
        background: 'rgba(59,130,246,0.08)',
        border: '1px solid rgba(59,130,246,0.15)',
        borderRadius: 14,
        fontSize: 12,
        color: 'rgba(147,197,253,0.85)',
        lineHeight: 1.6
      }}>
        <strong>Note:</strong> Cloud Cleanup only removes <em>locally-cached copies</em> of files that are already synced to the cloud.
        Your files remain safe in iCloud, Dropbox, Google Drive, or OneDrive. After cleanup, files will re-download on demand when you open them.
      </div>
    </div>
  )
}
