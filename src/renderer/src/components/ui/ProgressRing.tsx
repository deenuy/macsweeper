interface Props {
  percent: number
  size?: number
  strokeWidth?: number
  children?: React.ReactNode
}

export default function ProgressRing({ percent, size = 160, strokeWidth = 10, children }: Props) {
  const r = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * r
  const offset = circumference - (percent / 100) * circumference

  const color =
    percent >= 85 ? '#ef4444' :
    percent >= 70 ? '#f59e0b' :
    '#22c55e'

  const glowColor =
    percent >= 85 ? 'rgba(239,68,68,0.6)' :
    percent >= 70 ? 'rgba(245,158,11,0.6)' :
    'rgba(34,197,94,0.6)'

  return (
    <div style={{
      position: 'relative',
      width: size,
      height: size,
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center'
    }}>
      <svg
        width={size}
        height={size}
        style={{ position: 'absolute', top: 0, left: 0, transform: 'rotate(-90deg)' }}
      >
        <defs>
          <filter id="glow">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>
        {/* Track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth={strokeWidth}
        />
        {/* Progress */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{
            transition: 'stroke-dashoffset 0.8s ease, stroke 0.3s ease',
            filter: `drop-shadow(0 0 8px ${glowColor})`
          }}
        />
      </svg>
      <div style={{ position: 'relative', zIndex: 1, textAlign: 'center' }}>
        {children}
      </div>
    </div>
  )
}
