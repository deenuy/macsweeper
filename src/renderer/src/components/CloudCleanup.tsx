import { useState } from 'react'
import HeroScanScreen from './ui/HeroScanScreen'

interface CloudAccount {
  id: string
  provider: 'icloud' | 'dropbox' | 'gdrive' | 'onedrive'
  label: string
  email: string
  selected: boolean
  scanned: boolean
  size: number
}

function CloudIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M13.5 13H5a3.5 3.5 0 1 1 .44-6.97A4.5 4.5 0 1 1 13.5 11a2 2 0 0 1 0 2z"/>
    </svg>
  )
}

function ProviderIcon({ provider, size = 14 }: { provider: string; size?: number }) {
  if (provider === 'icloud') {
    return (
      <svg width={size} height={size} viewBox="0 0 14 14" fill="none">
        <path d="M10.5 10H4a2.75 2.75 0 1 1 .34-5.48A3.5 3.5 0 1 1 10.5 8.5a1.5 1.5 0 0 1 0 1.5z" fill="rgba(100,180,255,0.9)"/>
      </svg>
    )
  }
  if (provider === 'dropbox') {
    return (
      <svg width={size} height={size} viewBox="0 0 14 14" fill="none">
        <path d="M3.5 2.5L7 5 3.5 7.5 0 5l3.5-2.5zM10.5 2.5L14 5l-3.5 2.5L7 5l3.5-2.5zM3.5 9.5L7 7l3.5 2.5L7 12 3.5 9.5zM0 5l3.5 2.5L7 5 3.5 2.5 0 5z" fill="#0061FF" fillOpacity="0.8"/>
      </svg>
    )
  }
  return <CloudIcon size={size} />
}

function formatBytes(n: number): string {
  if (n >= 1e9) return (n / 1e9).toFixed(1) + ' GB'
  if (n >= 1e6) return (n / 1e6).toFixed(0) + ' MB'
  return (n / 1e3).toFixed(0) + ' KB'
}

// 3D blob cloud icon
function BlobCloudHero({ accent }: { accent: string }) {
  return (
    <div style={{
      position: 'relative',
      width: 300,
      height: 300,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      animation: 'float 4s ease-in-out infinite'
    }}>
      {/* Outer glow */}
      <div style={{
        position: 'absolute', inset: 0,
        borderRadius: '50%',
        background: `radial-gradient(ellipse, ${accent}30 0%, transparent 70%)`,
        filter: 'blur(24px)'
      }} />

      {/* Blob body - organic shape */}
      <div style={{
        width: 240,
        height: 240,
        borderRadius: '62% 38% 46% 54% / 60% 44% 56% 40%',
        background: `radial-gradient(ellipse at 35% 28%, rgba(120,190,255,0.95) 0%, rgba(60,130,240,0.90) 38%, rgba(20,70,180,0.92) 75%, rgba(8,30,100,0.95) 100%)`,
        boxShadow: `
          0 30px 80px rgba(30,90,210,0.55),
          0 0 0 1.5px rgba(140,200,255,0.20) inset,
          0 -8px 30px rgba(0,0,0,0.30) inset
        `,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        overflow: 'hidden',
        animation: 'blob-morph 6s ease-in-out infinite'
      }}>
        {/* Inner highlight */}
        <div style={{
          position: 'absolute', top: '12%', left: '18%',
          width: '40%', height: '28%',
          borderRadius: '50%',
          background: 'radial-gradient(ellipse, rgba(200,230,255,0.45) 0%, transparent 80%)'
        }} />

        {/* Inner smaller blob for depth */}
        <div style={{
          position: 'absolute',
          width: 110, height: 110,
          borderRadius: '50% 50% 40% 60% / 55% 45% 55% 45%',
          background: 'radial-gradient(ellipse at 40% 35%, rgba(180,220,255,0.7) 0%, rgba(100,160,240,0.5) 55%, transparent 80%)',
          top: '20%', left: '22%'
        }} />

        {/* Cloud SVG icon */}
        <svg
          width="80" height="80"
          viewBox="0 0 64 64"
          fill="none"
          style={{ position: 'relative', zIndex: 1, filter: 'drop-shadow(0 4px 16px rgba(0,30,100,0.4))' }}
        >
          <path
            d="M48 44H18a12 12 0 1 1 1.5-23.9A16 16 0 1 1 48 38a7 7 0 0 1 0 6z"
            fill="rgba(255,255,255,0.88)"
          />
        </svg>
      </div>

      {/* Secure connection badge */}
      <div style={{
        position: 'absolute',
        bottom: 18,
        left: '50%',
        transform: 'translateX(-50%)',
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '5px 12px',
        background: 'rgba(0,0,0,0.28)',
        border: '1px solid rgba(255,255,255,0.12)',
        borderRadius: 20,
        backdropFilter: 'blur(8px)',
        whiteSpace: 'nowrap'
      }}>
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
          <path d="M6 1L1.5 3v4C1.5 9.5 6 11 6 11s4.5-1.5 4.5-4V3L6 1z" fill="rgba(100,200,100,0.8)" stroke="rgba(80,180,80,0.9)" strokeWidth="0.5"/>
          <path d="M4 6l1.5 1.5 2.5-2.5" stroke="white" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.70)' }}>Secure connection</span>
      </div>
    </div>
  )
}

const ACCENT = '#3B8FE8'

export default function CloudCleanup() {
  const homeDir = window.electron.homeDir
  const [accounts, setAccounts] = useState<CloudAccount[]>([
    {
      id: 'icloud-main',
      provider: 'icloud',
      label: 'iCloud',
      email: `${homeDir.split('/').pop()}@me.com`,
      selected: true,
      scanned: false,
      size: 0
    }
  ])
  const [scanning, setScanning] = useState(false)
  const [hasScanned, setHasScanned] = useState(false)

  const toggleAccount = (id: string) => {
    setAccounts(prev => prev.map(a => a.id === id ? { ...a, selected: !a.selected } : a))
  }

  const scan = async () => {
    setScanning(true)
    try {
      // Scan iCloud local cache as a proxy for cloud storage
      const items = await window.electron.scanCategory('user-cache')
      const icloudItems = items.filter(f => f.path.includes('CloudKit') || f.path.includes('Mobile Documents') || f.path.includes('iCloud'))
      const size = icloudItems.reduce((a, f) => a + f.size, 0)
      setAccounts(prev => prev.map(a =>
        a.provider === 'icloud' ? { ...a, size, scanned: true } : a
      ))
      setHasScanned(true)
    } catch {
      // ignore
    } finally {
      setScanning(false)
    }
  }

  const addDropbox = () => {
    if (accounts.find(a => a.provider === 'dropbox')) return
    setAccounts(prev => [...prev, {
      id: 'dropbox-main',
      provider: 'dropbox',
      label: 'Dropbox',
      email: 'Connected',
      selected: false,
      scanned: false,
      size: 0
    }])
  }

  if (scanning) {
    return (
      <HeroScanScreen
        hero={<BlobCloudHero accent={ACCENT} />}
        title="Scanning cloud storage…"
        onStop={() => setScanning(false)}
      />
    )
  }

  return (
    <div style={{
      height: '100%',
      display: 'flex',
      alignItems: 'center',
      gap: 0
    }}>
      {/* Left: 3D blob hero */}
      <div style={{
        flex: '0 0 50%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <BlobCloudHero accent={ACCENT} />
      </div>

      {/* Right: accounts + scan */}
      <div style={{ flex: '0 0 50%', paddingRight: 16 }}>
        <h1 style={{
          fontSize: 42,
          fontWeight: 700,
          letterSpacing: '-0.03em',
          lineHeight: 1.1,
          marginBottom: 10
        }}>
          Cloud Cleanup
        </h1>
        <p style={{
          fontSize: 15,
          color: 'rgba(255,255,255,0.55)',
          lineHeight: 1.5,
          marginBottom: 32,
          maxWidth: 340
        }}>
          Tidy up your cloud files to save space and keep your storage in check.
        </p>

        {/* Connected accounts */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
          {accounts.map(account => (
            <div
              key={account.id}
              onClick={() => toggleAccount(account.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 14,
                padding: '14px 18px',
                background: account.selected
                  ? 'rgba(255,255,255,0.12)'
                  : 'rgba(255,255,255,0.06)',
                border: `1px solid ${account.selected ? 'rgba(255,255,255,0.20)' : 'rgba(255,255,255,0.10)'}`,
                borderRadius: 14,
                cursor: 'pointer',
                transition: 'all 0.15s'
              }}
            >
              {/* Radio */}
              <div style={{
                width: 18, height: 18,
                borderRadius: '50%',
                border: `2px solid ${account.selected ? 'rgba(255,255,255,0.8)' : 'rgba(255,255,255,0.30)'}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
                transition: 'border-color 0.15s'
              }}>
                {account.selected && (
                  <div style={{
                    width: 9, height: 9, borderRadius: '50%',
                    background: 'white'
                  }} />
                )}
              </div>

              {/* Provider icon */}
              <div style={{
                width: 28, height: 28,
                borderRadius: 7,
                background: 'rgba(100,180,255,0.15)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0
              }}>
                <ProviderIcon provider={account.provider} size={16} />
              </div>

              {/* Label + email */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600 }}>{account.label}</div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {account.email}
                </div>
              </div>

              {/* Status */}
              <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                {scanning && account.selected ? (
                  <span className="animate-spin" style={{ display: 'inline-block', fontSize: 14, color: 'rgba(255,255,255,0.5)' }}>⟳</span>
                ) : account.scanned ? (
                  <span style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: account.size > 0 ? ACCENT : 'rgba(80,200,120,0.9)',
                    fontVariantNumeric: 'tabular-nums'
                  }}>
                    {account.size > 0 ? formatBytes(account.size) : 'Clean'}
                  </span>
                ) : null}
                {/* Options dots */}
                <button style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: 'rgba(255,255,255,0.35)', fontSize: 16, padding: '0 2px',
                  lineHeight: 1, display: 'flex', alignItems: 'center'
                }}>
                  ···
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Add Another Cloud */}
        <button
          onClick={addDropbox}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '10px 16px',
            background: 'transparent',
            border: '1px solid rgba(255,255,255,0.18)',
            borderRadius: 12,
            color: 'rgba(255,255,255,0.65)',
            fontSize: 13,
            fontWeight: 500,
            cursor: 'pointer',
            marginBottom: 36,
            transition: 'all 0.15s'
          }}
          onMouseEnter={e => {
            e.currentTarget.style.background = 'rgba(255,255,255,0.07)'
            e.currentTarget.style.color = 'rgba(255,255,255,0.85)'
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = 'transparent'
            e.currentTarget.style.color = 'rgba(255,255,255,0.65)'
          }}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            <path d="M7 2v10M2 7h10"/>
          </svg>
          Add Another Cloud
        </button>

        {/* Scan button */}
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: 8 }}>
          <button
            className="scan-orb"
            onClick={scan}
            disabled={scanning || accounts.every(a => !a.selected)}
            data-scanning={scanning}
            aria-label="Scan cloud storage"
          >
            {scanning
              ? <svg width="22" height="22" viewBox="0 0 22 22" fill="none" className="animate-spin"><circle cx="11" cy="11" r="7.5" stroke="rgba(255,255,255,0.22)" strokeWidth="2.5"/><path d="M11 3.5a7.5 7.5 0 0 1 7.5 7.5" stroke="white" strokeWidth="2.5" strokeLinecap="round"/></svg>
              : <span style={{ fontSize: 18, fontWeight: 700 }}>Scan</span>}
          </button>
        </div>

        {hasScanned && !scanning && (
          <div style={{ marginTop: 20, fontSize: 13, color: 'rgba(255,255,255,0.50)' }}>
            {accounts.filter(a => a.scanned && a.size > 0).length > 0
              ? `${formatBytes(accounts.reduce((s, a) => s + a.size, 0))} of local cloud cache found`
              : 'Your local cloud cache looks clean'}
          </div>
        )}
      </div>

    </div>
  )
}
