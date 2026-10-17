import { useState, useEffect } from 'react'
import ProgressRing from './ui/ProgressRing'
import ScanCard from './ui/ScanCard'
import type { DiskStats, ScanResult } from '../../../shared/types'
import type { Page } from '../App'

function formatBytes(n: number): string {
  if (n >= 1e9) return (n / 1e9).toFixed(1) + ' GB'
  if (n >= 1e6) return (n / 1e6).toFixed(0) + ' MB'
  return (n / 1e3).toFixed(0) + ' KB'
}

interface Props {
  diskStats: DiskStats | null
  onNavigate: (page: Page) => void
}

export default function Dashboard({ diskStats, onNavigate }: Props) {
  const [scanResult, setScanResult] = useState<ScanResult | null>(null)
  const [scanning, setScanning] = useState(false)
  const [hasScanned, setHasScanned] = useState(false)
  const [progress, setProgress] = useState<Record<string, { found: number; size: number }>>({})

  useEffect(() => {
    const unsub = window.electron.onScanProgress((p) => {
      if (p.status === 'done') {
        setProgress(prev => ({ ...prev, [p.category]: { found: p.found, size: p.size } }))
      }
    })
    return unsub
  }, [])

  const runScan = async () => {
    setScanning(true)
    setProgress({})
    try {
      const result = await window.electron.scanAll()
      setScanResult(result)
      setHasScanned(true)
    } catch (err) {
      console.error('Scan failed:', err)
    } finally {
      setScanning(false)
    }
  }

  const totalJunkSize = scanResult
    ? Object.values(scanResult).flat().reduce((a, f) => a + f.size, 0)
    : 0
  const totalJunkCount = scanResult
    ? Object.values(scanResult).flat().length
    : 0

  const usedPct = diskStats?.usedPercent ?? 0
  const ringColor = usedPct >= 85 ? '#ef4444' : usedPct >= 70 ? '#f59e0b' : '#22c55e'

  const categoryIcons: Record<string, string> = {
    'language-files': '🌐', 'user-cache': '🗂️', logs: '📋',
    mail: '📧', 'downloads-junk': '📦', 'ds-store': '🗃️', 'dev-junk': '💻'
  }
  const categoryColors: Record<string, string> = {
    'language-files': '#06b6d4', 'user-cache': '#a855f7', logs: '#f59e0b',
    mail: '#3b82f6', 'downloads-junk': '#ec4899', 'ds-store': '#6366f1', 'dev-junk': '#10b981'
  }
  const categoryLabels: Record<string, string> = {
    'language-files': 'Language Files', 'user-cache': 'User Cache', logs: 'Log Files',
    mail: 'Mail Attachments', 'downloads-junk': 'Downloads Junk', 'ds-store': '.DS_Store', 'dev-junk': 'Dev Junk'
  }

  return (
    <div>
      <h1 style={{ fontSize: 26, fontWeight: 700, marginBottom: 6, letterSpacing: '-0.02em' }}>
        Smart Care
      </h1>
      <p style={{ color: 'var(--text-muted)', fontSize: 14, marginBottom: 32 }}>
        {hasScanned
          ? `Found ${totalJunkCount} items (${formatBytes(totalJunkSize)}) to clean`
          : 'Scan your Mac for junk files, caches, and large items'}
      </p>

      {/* Top section: ring + stats */}
      <div style={{
        display: 'flex',
        gap: 32,
        marginBottom: 32,
        alignItems: 'center'
      }}>
        {diskStats && (
          <div style={{ flexShrink: 0 }}>
            <ProgressRing percent={usedPct} size={170} strokeWidth={12}>
              <div style={{ textAlign: 'center' }}>
                <div style={{
                  fontSize: 32,
                  fontWeight: 800,
                  color: ringColor,
                  letterSpacing: '-0.03em',
                  lineHeight: 1
                }}>
                  {usedPct}%
                </div>
                <div style={{
                  fontSize: 11,
                  color: 'var(--text-muted)',
                  marginTop: 4
                }}>
                  disk used
                </div>
                {diskStats.freeBytes < 5e9 && (
                  <div style={{
                    fontSize: 10,
                    color: '#fca5a5',
                    marginTop: 4,
                    fontWeight: 600
                  }}>
                    {formatBytes(diskStats.freeBytes)} left
                  </div>
                )}
              </div>
            </ProgressRing>
          </div>
        )}

        <div style={{ flex: 1 }}>
          {diskStats && (
            <div style={{
              background: usedPct >= 90
                ? 'rgba(239,68,68,0.1)'
                : 'rgba(255,255,255,0.05)',
              border: `1px solid ${usedPct >= 90 ? 'rgba(239,68,68,0.3)' : 'rgba(255,255,255,0.09)'}`,
              borderRadius: 16,
              padding: '18px 22px',
              marginBottom: 16
            }}>
              {usedPct >= 90 ? (
                <>
                  <div style={{ fontSize: 15, fontWeight: 700, color: '#fca5a5', marginBottom: 6 }}>
                    ⚠️ Disk almost full
                  </div>
                  <div style={{ fontSize: 13, color: 'rgba(252,165,165,0.8)' }}>
                    Only {formatBytes(diskStats.freeBytes)} remaining on {formatBytes(diskStats.totalBytes)} total.
                    Run a scan to free up space now.
                  </div>
                </>
              ) : (
                <>
                  <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>
                    {formatBytes(diskStats.usedBytes)} used of {formatBytes(diskStats.totalBytes)}
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                    {formatBytes(diskStats.freeBytes)} available
                  </div>
                </>
              )}
            </div>
          )}

          <button
            className="btn-primary"
            onClick={runScan}
            disabled={scanning}
            style={{ fontSize: 15, padding: '12px 36px', borderRadius: 14 }}
          >
            {scanning ? (
              <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className="animate-spin" style={{ display: 'inline-block', fontSize: 14 }}>⟳</span>
                Scanning...
              </span>
            ) : hasScanned ? 'Scan Again' : 'Run Scan'}
          </button>
        </div>
      </div>

      {/* Results grid */}
      {(hasScanned || scanning) && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
          gap: 14
        }}>
          {Object.entries(categoryLabels).map(([id, label], i) => {
            const items = scanResult?.[id] ?? []
            const size = items.reduce((a, f) => a + f.size, 0)
            const isLoading = scanning && !progress[id]
            return (
              <div key={id} style={{ animationDelay: `${i * 0.06}s` }} className="animate-slide-up">
                <ScanCard
                  icon={categoryIcons[id]}
                  label={label}
                  value={isLoading ? '' : size > 0 ? formatBytes(size) : 'Clean'}
                  sublabel={isLoading ? '' : items.length > 0 ? `${items.length} items` : 'Nothing found'}
                  color={categoryColors[id]}
                  loading={isLoading}
                  onClick={size > 0 ? () => onNavigate('junk') : undefined}
                  badge={size > 0 ? 'Review' : undefined}
                />
              </div>
            )
          })}
          <div className="animate-slide-up" style={{ animationDelay: '0.42s' }}>
            <ScanCard
              icon="⊞"
              label="Duplicates"
              value="Scan"
              sublabel="Find duplicate files"
              color="#f59e0b"
              onClick={() => onNavigate('duplicates')}
            />
          </div>
        </div>
      )}

      {!hasScanned && !scanning && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
          gap: 14
        }}>
          {[
            { icon: '🗑️', label: 'Junk Cleanup', desc: 'Caches, logs, temp files', color: '#a855f7', page: 'junk' as Page },
            { icon: '⊞', label: 'Duplicate Finder', desc: 'Find wasted space', color: '#f59e0b', page: 'duplicates' as Page },
            { icon: '◎', label: 'Space Lens', desc: 'Visualize disk usage', color: '#06b6d4', page: 'space-lens' as Page },
            { icon: '☁️', label: 'Cloud Cleanup', desc: 'Dropbox, iCloud, Drive', color: '#3b82f6', page: 'cloud' as Page }
          ].map((item, i) => (
            <div key={item.page} className="animate-slide-up" style={{ animationDelay: `${i * 0.08}s` }}>
              <ScanCard
                icon={item.icon}
                label={item.label}
                value=""
                sublabel={item.desc}
                color={item.color}
                onClick={() => onNavigate(item.page)}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
