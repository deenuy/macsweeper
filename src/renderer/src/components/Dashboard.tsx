import React, { useState, useEffect, useRef } from 'react'
import type { DiskStats, ScanResult } from '../../../shared/types'
import type { Page, PageTheme } from '../App'
import HeroScanScreen from './ui/HeroScanScreen'

function formatBytes(n: number): string {
  if (n >= 1e9) return (n / 1e9).toFixed(1) + ' GB'
  if (n >= 1e6) return (n / 1e6).toFixed(0) + ' MB'
  return (n / 1e3).toFixed(0) + ' KB'
}

function Spinner({ size = 20, color = 'white' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" className="animate-spin" style={{ display: 'inline-block' }}>
      <circle cx="10" cy="10" r="7" stroke={color === 'white' ? 'rgba(255,255,255,0.22)' : 'rgba(0,0,0,0.15)'} strokeWidth="2.5"/>
      <path d="M10 3a7 7 0 0 1 7 7" stroke={color} strokeWidth="2.5" strokeLinecap="round"/>
    </svg>
  )
}

function CheckIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" style={{ display: 'inline-block', verticalAlign: 'middle' }}>
      <path d="M3 8l4 4 6-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

// ─── Blob sphere hero (shared aesthetic with Space Lens) ──────────────────────

function HeroMacIcon({ accent, scanning }: { accent: string; scanning: boolean }) {
  return (
    <div style={{
      position: 'relative', width: 300, height: 300,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      animation: 'float 4s ease-in-out infinite',
    }}>
      {/* Ambient glow */}
      <div style={{
        position: 'absolute', inset: 0, borderRadius: '50%',
        background: `radial-gradient(ellipse, ${accent}40 0%, transparent 70%)`,
        filter: 'blur(36px)',
      }} />

      {/* Blob sphere */}
      <div style={{
        width: 240, height: 240,
        borderRadius: '55% 45% 50% 50% / 48% 52% 48% 52%',
        background: `radial-gradient(ellipse at 36% 28%, rgba(215,165,255,0.94) 0%, ${accent}EE 32%, rgba(80,30,170,0.94) 65%, rgba(18,5,55,0.97) 100%)`,
        boxShadow: `0 30px 80px ${accent}66, 0 0 0 1.5px rgba(220,180,255,0.20) inset`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        position: 'relative', overflow: 'hidden',
        animation: 'blob-morph 6s ease-in-out infinite',
      }}>
        {/* Specular highlight */}
        <div style={{
          position: 'absolute', top: '10%', left: '16%', width: '42%', height: '28%',
          borderRadius: '50%',
          background: 'radial-gradient(ellipse, rgba(240,220,255,0.42) 0%, transparent 80%)',
        }} />

        {/* Clock / care icon */}
        <svg width="92" height="92" viewBox="0 0 92 92" fill="none"
          style={{ position: 'relative', zIndex: 1, filter: 'drop-shadow(0 6px 20px rgba(0,0,80,0.5))' }}>
          {/* Outer scan ring */}
          <circle cx="46" cy="46" r="36" stroke="rgba(255,255,255,0.30)" strokeWidth="1.5" fill="none"/>
          {/* Animated sweep arc during scan */}
          <circle cx="46" cy="46" r="36" stroke="rgba(255,255,255,0.80)" strokeWidth="2.5"
            strokeDasharray={scanning ? '56 170' : '0 0'} strokeLinecap="round"
            style={scanning ? { animation: 'spin 2s linear infinite', transformOrigin: '46px 46px' } : undefined}/>
          {/* Clock face */}
          <circle cx="46" cy="46" r="21" stroke="rgba(255,255,255,0.65)" strokeWidth="1.5" fill="rgba(255,255,255,0.07)"/>
          {/* Hour hand */}
          <line x1="46" y1="46" x2="46" y2="29" stroke="white" strokeWidth="2.8" strokeLinecap="round"/>
          {/* Minute hand */}
          <line x1="46" y1="46" x2="60" y2="55" stroke="rgba(255,255,255,0.78)" strokeWidth="2.2" strokeLinecap="round"/>
          {/* Center pivot */}
          <circle cx="46" cy="46" r="3.2" fill="white"/>
        </svg>
      </div>

      {/* Ground shadow */}
      <div style={{
        position: 'absolute', bottom: 14, left: '50%', transform: 'translateX(-50%)',
        width: 170, height: 22,
        background: 'radial-gradient(ellipse, rgba(0,0,0,0.30) 0%, transparent 70%)',
        filter: 'blur(10px)',
      }} />
    </div>
  )
}

// ─── Feature list item ────────────────────────────────────────────────────────

interface FeatureItemProps {
  icon: React.ReactNode
  label: string
  accent: string
}

function FeatureItem({ icon, label, accent }: FeatureItemProps) {
  return (
    <div className="feature-item">
      <div className="feature-item-icon" style={{ background: `${accent}22`, border: `1px solid ${accent}33`, color: accent }}>
        {icon}
      </div>
      <span style={{ fontSize: 15, fontWeight: 500 }}>{label}</span>
    </div>
  )
}

// ─── Dimensional scan button ──────────────────────────────────────────────────

function ScanButton({ scanning, onScan }: { scanning: boolean; onScan: () => void }) {
  return (
    <button
      type="button"
      className="scan-orb"
      data-scanning={scanning}
      disabled={scanning}
      onClick={onScan}
      aria-label={scanning ? 'Scan in progress' : 'Scan Mac'}
    >
      {scanning ? (
        <>
          <Spinner size={22} />
          <span style={{ fontSize: 12, marginTop: 2, opacity: 0.85 }}>Scanning</span>
        </>
      ) : (
        <span style={{ fontSize: 18, letterSpacing: '0.02em' }}>Scan</span>
      )}
    </button>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

interface Props {
  diskStats: DiskStats | null
  onNavigate: (page: Page) => void
  theme: PageTheme
}

export default function Dashboard({ diskStats, onNavigate, theme }: Props) {
  const [scanResult, setScanResult] = useState<ScanResult | null>(null)
  const [scanning, setScanning] = useState(false)
  const [hasScanned, setHasScanned] = useState(false)
  const [scanFile, setScanFile] = useState('')
  const scanFileCleanupRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    const unsub = window.electron.onScanProgress(() => {})
    return unsub
  }, [])

  useEffect(() => {
    if (scanning) {
      scanFileCleanupRef.current = window.electron.onScanFile(setScanFile)
    } else {
      scanFileCleanupRef.current?.()
      scanFileCleanupRef.current = null
      setScanFile('')
    }
  }, [scanning])

  const runScan = async () => {
    setScanning(true)
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

  // Post-scan results view
  if (hasScanned && !scanning) {
    return (
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        <h1 style={{ fontSize: 36, fontWeight: 700, letterSpacing: '-0.03em', marginBottom: 4 }}>Smart Care</h1>
        <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 15, marginBottom: 28 }}>
          {totalJunkCount > 0
            ? `Found ${totalJunkCount} items — ${formatBytes(totalJunkSize)} to review`
            : 'Your Mac looks clean'}
        </p>

        {diskStats && (
          <div style={{ padding: '14px 20px', background: 'rgba(0,0,0,0.25)', borderRadius: 14, border: '1px solid rgba(255,255,255,0.10)', marginBottom: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, alignItems: 'baseline' }}>
              <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.55)' }}>Macintosh HD</span>
              <span style={{ fontSize: 13, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                {formatBytes(diskStats.usedBytes)} of {formatBytes(diskStats.totalBytes)}
              </span>
            </div>
            <div style={{ height: 5, background: 'rgba(255,255,255,0.12)', borderRadius: 3, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${usedPct}%`, background: `linear-gradient(90deg, ${theme.accent}99, ${theme.accent})`, borderRadius: 3, transition: 'width 0.5s ease' }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 6 }}>
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.38)', fontVariantNumeric: 'tabular-nums' }}>
                {formatBytes(diskStats.freeBytes)} available
              </span>
            </div>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12, marginBottom: 28 }}>
          {[
            { label: 'Junk Cleanup', size: Object.entries(scanResult ?? {})
                .filter(([k]) => !['duplicates','similar-images','large-files'].includes(k))
                .flatMap(([,v]) => v).reduce((a,f) => a + f.size, 0), page: 'junk' as Page },
            { label: 'Duplicates', size: (scanResult?.duplicates ?? []).reduce((a,f) => a+f.size, 0), page: 'duplicates' as Page },
            { label: 'Space Lens', size: 0, page: 'space-lens' as Page },
            { label: 'Applications', size: 0, page: 'applications' as Page },
          ].map(item => (
            <button key={item.page} onClick={() => onNavigate(item.page)}
              style={{ padding: '16px 18px', borderRadius: 14, background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.10)', color: 'var(--text)', cursor: 'pointer', textAlign: 'left', transition: 'background 0.15s' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(0,0,0,0.35)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'rgba(0,0,0,0.25)')}>
              <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.55)', marginBottom: 4 }}>{item.label}</div>
              <div style={{ fontSize: 22, fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: item.size > 0 ? theme.accent : 'rgba(255,255,255,0.6)', display: 'flex', alignItems: 'center', gap: 6 }}>
                {item.size > 0
                  ? formatBytes(item.size)
                  : item.page === 'junk'
                  ? <><CheckIcon size={18} /> Clean</>
                  : 'Review'}
              </div>
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          {totalJunkCount > 0 && (
            <button className="btn-primary" onClick={() => onNavigate('junk')}
              style={{ fontSize: 14, padding: '12px 28px', background: `linear-gradient(135deg, ${theme.accent}, ${theme.accent}AA)` }}>
              Review {formatBytes(totalJunkSize)} of junk
            </button>
          )}
          <button className="btn-secondary" onClick={runScan} style={{ fontSize: 14, padding: '12px 24px' }}>
            Scan Again
          </button>
        </div>
      </div>
    )
  }

  if (scanning) {
    return (
      <HeroScanScreen
        hero={<HeroMacIcon accent={theme.accent} scanning />}
        title="Scanning your Mac…"
        currentFile={scanFile}
        onStop={() => { window.electron.cancelScan(); setScanning(false) }}
      />
    )
  }

  // Pre-scan hero
  return (
    <div style={{ height: '100%', display: 'flex', alignItems: 'center', gap: 0 }}>
      {/* Left: dimensional hero */}
      <div style={{ flex: '0 0 50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <HeroMacIcon accent={theme.accent} scanning={scanning} />
      </div>

      {/* Right: title + features + scan button */}
      <div style={{ flex: '0 0 50%', paddingRight: 16 }}>
        <h1 style={{ fontSize: 42, fontWeight: 700, letterSpacing: '-0.03em', lineHeight: 1.1, marginBottom: 10 }}>
          Smart Care
        </h1>
        <p style={{ fontSize: 16, color: 'rgba(255,255,255,0.60)', lineHeight: 1.5, marginBottom: 32, maxWidth: 320 }}>
          Quick maintenance that keeps your Mac running clean.
        </p>

        <div style={{ marginBottom: 40 }}>
          <FeatureItem accent={theme.accent} label="Quick Scan" icon={
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <circle cx="7" cy="7" r="5"/><path d="M11 11l3 3"/>
            </svg>
          } />
          <FeatureItem accent={theme.accent} label="Junk Cleanup" icon={
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 5h10M6 5V3.5a.5.5 0 0 1 .5-.5h3a.5.5 0 0 1 .5.5V5M4.5 5l.7 8a1 1 0 0 0 1 .5h3.6a1 1 0 0 0 1-.5l.7-8"/>
            </svg>
          } />
          <FeatureItem accent={theme.accent} label="Space Analysis" icon={
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <rect x="2" y="10" width="3" height="4"/><rect x="6.5" y="6" width="3" height="8"/><rect x="11" y="2" width="3" height="12"/>
            </svg>
          } />
        </div>

        {diskStats && (
          <div style={{ padding: '12px 16px', background: 'rgba(0,0,0,0.20)', borderRadius: 12, border: '1px solid rgba(255,255,255,0.08)', marginBottom: 36 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)' }}>Storage</span>
              <span style={{ fontSize: 12, fontVariantNumeric: 'tabular-nums', color: 'rgba(255,255,255,0.55)' }}>
                {formatBytes(diskStats.usedBytes)} / {formatBytes(diskStats.totalBytes)}
              </span>
            </div>
            <div style={{ height: 4, background: 'rgba(255,255,255,0.10)', borderRadius: 2, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${usedPct}%`, background: `linear-gradient(90deg, ${theme.accent}88, ${theme.accent})`, borderRadius: 2 }} />
            </div>
          </div>
        )}

        {/* Dimensional scan orb — centered */}
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <ScanButton scanning={scanning} onScan={runScan} />
        </div>

        {/* Status text below button */}
        {scanning && (
          <p style={{ marginTop: 14, fontSize: 12, color: 'rgba(255,255,255,0.40)', letterSpacing: '0.02em' }}>
            Analyzing your Mac…
          </p>
        )}
      </div>
    </div>
  )
}
