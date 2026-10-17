import type React from 'react'
import { useMemo } from 'react'

interface Props {
  hero: React.ReactNode
  title: string
  currentFile?: string
  onStop?: () => void
}

function truncatePath(p: string, maxLen = 62): string {
  if (!p || p.length <= maxLen) return p
  const half = Math.floor(maxLen / 2) - 1
  return p.slice(0, half) + '…' + p.slice(-half)
}

export default function HeroScanScreen({ hero, title, currentFile, onStop }: Props) {
  const displayPath = useMemo(() => truncatePath(currentFile ?? ''), [currentFile])

  return (
    <div style={{
      height: '100%', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{ marginBottom: 36, transform: 'scale(1.05)', transformOrigin: 'center bottom' }}>
        {hero}
      </div>

      <h2 style={{
        fontSize: 32, fontWeight: 700, letterSpacing: '-0.03em',
        marginBottom: 14, textAlign: 'center', color: 'rgba(255,255,255,0.96)'
      }}>
        {title}
      </h2>

      <p style={{
        fontSize: 13, color: 'rgba(255,255,255,0.38)', marginBottom: 52,
        textAlign: 'center', maxWidth: 520, lineHeight: 1.4,
        fontFamily: 'ui-monospace, "SF Mono", monospace',
        letterSpacing: '0.01em', minHeight: '1.4em',
      }}>
        {displayPath}
      </p>

      <button
        className="scan-orb"
        data-scanning="true"
        onClick={onStop}
        style={!onStop ? { cursor: 'default', pointerEvents: 'none' } : undefined}
        aria-label={onStop ? 'Stop scan' : 'Scanning'}
      >
        <span style={{ fontSize: 18, fontWeight: 700, letterSpacing: '0.01em' }}>
          {onStop ? 'Stop' : 'Scanning'}
        </span>
      </button>
    </div>
  )
}
