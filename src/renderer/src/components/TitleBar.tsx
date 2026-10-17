import { IconBell } from './icons'

export default function TitleBar() {
  return (
    <div
      style={{
        height: 52,
        display: 'flex',
        alignItems: 'center',
        paddingLeft: 76,
        paddingRight: 20,
        WebkitAppRegion: 'drag',
        flexShrink: 0
      } as React.CSSProperties}
    >
      {/* Notification button — no-drag so it's clickable */}
      <div style={{ marginLeft: 'auto', WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
        <button style={{
          width: 34,
          height: 34,
          borderRadius: '50%',
          background: 'rgba(255,255,255,0.10)',
          border: '1px solid rgba(255,255,255,0.15)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          color: 'rgba(255,255,255,0.75)',
          transition: 'background 0.15s'
        }}
          onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.16)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.10)')}
        >
          <IconBell />
        </button>
      </div>
    </div>
  )
}
