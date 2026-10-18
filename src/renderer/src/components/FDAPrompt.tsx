import { useState } from 'react'

const STEPS = [
  'Open System Settings',
  'Go to Privacy & Security → Full Disk Access',
  'Click the lock icon to make changes',
  'Find MacSweeper and enable its toggle',
  'If not listed, click + and add MacSweeper',
  'Quit and reopen MacSweeper',
]

export default function FDAPrompt({ onGranted }: { onGranted: () => void }) {
  const [checking, setChecking] = useState(false)
  const [denied, setDenied] = useState(false)

  const openSettings = () => {
    window.electron.openFDASettings()
  }

  const recheck = async () => {
    setChecking(true)
    setDenied(false)
    await new Promise(r => setTimeout(r, 400))
    const ok = await window.electron.checkFDA()
    setChecking(false)
    if (ok) {
      onGranted()
    } else {
      setDenied(true)
    }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'rgba(0,0,0,0.82)',
      backdropFilter: 'blur(18px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 24,
    }}>
      <div style={{
        background: 'rgba(255,255,255,0.06)',
        border: '1px solid rgba(255,255,255,0.12)',
        borderRadius: 24,
        padding: '40px 36px',
        maxWidth: 460,
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 0,
      }}>
        {/* Icon */}
        <div style={{
          width: 72, height: 72,
          borderRadius: 18,
          background: 'linear-gradient(135deg, #6d28d9, #4c1d95)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          marginBottom: 24,
          boxShadow: '0 8px 32px rgba(109,40,217,0.45)',
        }}>
          <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
            <path d="M18 4L6 10v9c0 7.18 5.16 13.9 12 15.5C25.84 32.9 31 26.18 31 19v-9L18 4z"
              fill="rgba(255,255,255,0.15)" stroke="rgba(255,255,255,0.8)" strokeWidth="1.5"
              strokeLinejoin="round"/>
            <path d="M13 18l3.5 3.5 7-7" stroke="white" strokeWidth="2"
              strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>

        {/* Title */}
        <h2 style={{
          fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em',
          marginBottom: 10, textAlign: 'center',
        }}>
          Full Disk Access Required
        </h2>
        <p style={{
          fontSize: 14, color: 'rgba(255,255,255,0.55)', textAlign: 'center',
          lineHeight: 1.6, marginBottom: 28, maxWidth: 340,
        }}>
          MacSweeper needs Full Disk Access to scan your Mac for junk files,
          duplicates, and large items in protected folders.
        </p>

        {/* Steps */}
        <div style={{
          width: '100%', display: 'flex', flexDirection: 'column', gap: 10,
          marginBottom: 28,
        }}>
          {STEPS.map((step, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'flex-start', gap: 12,
            }}>
              <div style={{
                width: 24, height: 24, borderRadius: '50%', flexShrink: 0,
                background: 'rgba(139,92,246,0.20)',
                border: '1px solid rgba(139,92,246,0.40)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 12, fontWeight: 700, color: '#a78bfa',
                marginTop: 1,
              }}>
                {i + 1}
              </div>
              <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.75)', lineHeight: 1.55 }}>
                {step}
              </span>
            </div>
          ))}
        </div>

        {/* Error message if still denied */}
        {denied && (
          <p style={{
            fontSize: 12, color: '#f87171', textAlign: 'center',
            marginBottom: 16, padding: '8px 16px',
            background: 'rgba(248,113,113,0.08)',
            border: '1px solid rgba(248,113,113,0.20)',
            borderRadius: 8, width: '100%',
          }}>
            Full Disk Access not detected. Follow the steps above, then quit
            and reopen MacSweeper.
          </p>
        )}

        {/* Buttons */}
        <div style={{ display: 'flex', gap: 10, width: '100%' }}>
          <button
            onClick={openSettings}
            style={{
              flex: 1, padding: '12px 0',
              background: 'linear-gradient(135deg, #7c3aed, #5b21b6)',
              border: 'none', borderRadius: 12,
              color: 'white', fontSize: 14, fontWeight: 600,
              cursor: 'pointer',
              boxShadow: '0 4px 16px rgba(109,40,217,0.35)',
            }}
          >
            Open System Settings
          </button>
          <button
            onClick={recheck}
            disabled={checking}
            style={{
              flex: 1, padding: '12px 0',
              background: 'rgba(255,255,255,0.08)',
              border: '1px solid rgba(255,255,255,0.15)',
              borderRadius: 12,
              color: checking ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.80)',
              fontSize: 14, fontWeight: 600,
              cursor: checking ? 'default' : 'pointer',
            }}
          >
            {checking ? 'Checking…' : "I've Granted Access"}
          </button>
        </div>
      </div>
    </div>
  )
}
