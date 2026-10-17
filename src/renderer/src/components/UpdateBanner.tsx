import { useState, useEffect } from 'react'

type UpdateState =
  | { phase: 'idle' }
  | { phase: 'available'; version: string }
  | { phase: 'downloading'; version: string; percent: number }
  | { phase: 'ready'; version: string }

export default function UpdateBanner() {
  const [state, setState] = useState<UpdateState>({ phase: 'idle' })
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    const offAvail = window.electron.onUpdateAvailable(({ version }) =>
      setState({ phase: 'available', version })
    )
    const offProg = window.electron.onUpdateProgress(({ percent }) =>
      setState(prev =>
        prev.phase === 'available' || prev.phase === 'downloading'
          ? { phase: 'downloading', version: (prev as { version: string }).version, percent }
          : prev
      )
    )
    const offDone = window.electron.onUpdateDownloaded(({ version }) =>
      setState({ phase: 'ready', version })
    )
    return () => { offAvail(); offProg(); offDone() }
  }, [])

  if (dismissed || state.phase === 'idle') return null

  const isReady      = state.phase === 'ready'
  const isDownloading = state.phase === 'downloading'
  const version      = (state as { version: string }).version

  return (
    <div style={{
      position: 'fixed',
      top: 44,  // below title bar
      left: '50%',
      transform: 'translateX(-50%)',
      zIndex: 9999,
      background: isReady
        ? 'linear-gradient(135deg,rgba(16,185,129,0.18),rgba(6,182,212,0.18))'
        : 'rgba(20,20,40,0.92)',
      border: `1px solid ${isReady ? 'rgba(16,185,129,0.45)' : 'rgba(99,102,241,0.4)'}`,
      borderRadius: 12,
      padding: '10px 18px',
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      backdropFilter: 'blur(20px)',
      boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
      minWidth: 340,
      maxWidth: 480,
    }}>
      {/* Icon */}
      <span style={{ fontSize: 16, flexShrink: 0 }}>
        {isReady ? '✅' : isDownloading ? '⬇️' : '🔔'}
      </span>

      {/* Text */}
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.92)' }}>
          {isReady
            ? `MacSweeper ${version} ready to install`
            : isDownloading
              ? `Downloading MacSweeper ${version}…`
              : `MacSweeper ${version} is available`}
        </div>
        {isDownloading && (state as { percent: number }).percent < 100 && (
          <div style={{ marginTop: 5, height: 3, borderRadius: 2, background: 'rgba(255,255,255,0.1)' }}>
            <div style={{
              height: '100%', borderRadius: 2,
              width: `${(state as { percent: number }).percent}%`,
              background: 'linear-gradient(90deg,#6366f1,#a855f7)',
              transition: 'width 0.3s ease',
            }} />
          </div>
        )}
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
        {isReady && (
          <button
            onClick={() => window.electron.installUpdate()}
            style={{
              background: 'linear-gradient(135deg,#10b981,#06b6d4)',
              border: 'none', borderRadius: 8,
              padding: '6px 14px', color: '#fff',
              fontSize: 12, fontWeight: 700, cursor: 'pointer',
            }}
          >
            Install &amp; Restart
          </button>
        )}
        <button
          onClick={() => setDismissed(true)}
          style={{
            background: 'rgba(255,255,255,0.08)', border: 'none', borderRadius: 8,
            padding: '6px 10px', color: 'rgba(255,255,255,0.5)',
            fontSize: 12, cursor: 'pointer',
          }}
        >
          ✕
        </button>
      </div>
    </div>
  )
}
