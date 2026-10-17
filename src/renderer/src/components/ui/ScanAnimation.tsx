interface Props {
  accent: string
  label?: string
}

// Radar-sweep 3D scan animation, similar to CleanMyMac's scanning state
export default function ScanAnimation({ accent, label = 'Scanning…' }: Props) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 28,
      height: '100%'
    }}>
      {/* 3D radar orb */}
      <div style={{ position: 'relative', width: 200, height: 200 }}>

        {/* Outer glow */}
        <div style={{
          position: 'absolute', inset: -20,
          borderRadius: '50%',
          background: `radial-gradient(ellipse, ${accent}22 0%, transparent 70%)`,
          animation: 'scan-pulse 2s ease-in-out infinite'
        }} />

        {/* Sphere body */}
        <div style={{
          position: 'absolute', inset: 0,
          borderRadius: '50%',
          background: `radial-gradient(ellipse at 35% 30%, ${accent}CC 0%, ${accent}66 40%, rgba(8,2,20,0.9) 100%)`,
          boxShadow: `0 0 60px ${accent}44, 0 20px 60px rgba(0,0,0,0.5), 0 0 0 1px ${accent}40 inset`,
          overflow: 'hidden'
        }}>
          {/* Highlight */}
          <div style={{
            position: 'absolute', top: '10%', left: '18%',
            width: '38%', height: '28%',
            borderRadius: '50%',
            background: 'radial-gradient(ellipse, rgba(255,255,255,0.30) 0%, transparent 80%)'
          }} />

          {/* Latitude lines */}
          {[30, 50, 70].map(y => (
            <div key={y} style={{
              position: 'absolute',
              top: `${y}%`,
              left: 0, right: 0,
              height: 1,
              background: `${accent}33`
            }} />
          ))}

          {/* Radar sweep */}
          <div style={{
            position: 'absolute', inset: 0,
            borderRadius: '50%',
            overflow: 'hidden',
            animation: 'scan-rotate 2.4s linear infinite'
          }}>
            <div style={{
              position: 'absolute',
              top: '50%', left: '50%',
              width: '50%', height: '50%',
              transformOrigin: '0 0',
              background: `conic-gradient(from 0deg, transparent 0deg, ${accent}88 50deg, transparent 50deg)`,
              borderRadius: '0 100% 0 0'
            }} />
            <div style={{
              position: 'absolute',
              top: '50%', left: '50%',
              width: '50%', height: '50%',
              transformOrigin: '0 0',
              transform: 'rotate(180deg)',
              background: `conic-gradient(from 0deg, transparent 0deg, ${accent}88 50deg, transparent 50deg)`,
              borderRadius: '0 100% 0 0'
            }} />
          </div>

          {/* Scan beam line */}
          <div style={{
            position: 'absolute',
            top: 0, bottom: 0, left: '50%',
            width: 2,
            background: `linear-gradient(to bottom, transparent, ${accent}FF, transparent)`,
            transformOrigin: '50% 50%',
            animation: 'scan-line 2.4s linear infinite'
          }} />
        </div>

        {/* Orbiting dot */}
        <div style={{
          position: 'absolute',
          top: '50%', left: '50%',
          width: '50%', height: '50%',
          transformOrigin: '0 0',
          animation: 'scan-rotate 2.4s linear infinite'
        }}>
          <div style={{
            position: 'absolute', top: -4, right: -4,
            width: 8, height: 8,
            borderRadius: '50%',
            background: accent,
            boxShadow: `0 0 12px ${accent}, 0 0 24px ${accent}88`
          }} />
        </div>

        {/* Ring */}
        <div style={{
          position: 'absolute', inset: -10,
          borderRadius: '50%',
          border: `1.5px solid ${accent}30`,
          animation: 'scan-ring 2.4s linear infinite'
        }} />
        <div style={{
          position: 'absolute', inset: -22,
          borderRadius: '50%',
          border: `1px solid ${accent}15`
        }} />
      </div>

      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 6 }}>{label}</div>
        <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)' }}>Nothing is removed during scanning</div>
      </div>

      <style>{`
        @keyframes scan-rotate {
          to { transform: rotate(360deg); }
        }
        @keyframes scan-line {
          to { transform: rotate(360deg); }
        }
        @keyframes scan-pulse {
          0%, 100% { opacity: 0.6; transform: scale(1); }
          50%       { opacity: 1;   transform: scale(1.05); }
        }
        @keyframes scan-ring {
          0%   { transform: rotate(0deg); border-color: ${accent}40; }
          50%  { border-color: ${accent}80; }
          100% { transform: rotate(360deg); border-color: ${accent}40; }
        }
      `}</style>
    </div>
  )
}
