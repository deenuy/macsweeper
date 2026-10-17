export default function TitleBar() {
  return (
    <div
      style={{
        height: 52,
        display: 'flex',
        alignItems: 'center',
        paddingLeft: 80,
        paddingRight: 20,
        WebkitAppRegion: 'drag' as React.CSSProperties['WebkitAppRegion'],
        flexShrink: 0,
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        background: 'rgba(10,10,24,0.7)',
        backdropFilter: 'blur(20px)'
      } as React.CSSProperties}
    >
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        userSelect: 'none'
      }}>
        <span style={{ fontSize: 18 }}>🧹</span>
        <span style={{
          fontSize: 14,
          fontWeight: 600,
          color: 'rgba(240,240,255,0.9)',
          letterSpacing: '0.01em'
        }}>
          MacSweeper
        </span>
      </div>
    </div>
  )
}
