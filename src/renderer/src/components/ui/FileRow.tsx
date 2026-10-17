import type { FileItem } from '../../../../shared/types'

function formatBytes(n: number): string {
  if (n >= 1e9) return (n / 1e9).toFixed(1) + ' GB'
  if (n >= 1e6) return (n / 1e6).toFixed(1) + ' MB'
  if (n >= 1e3) return (n / 1e3).toFixed(0) + ' KB'
  return n + ' B'
}

interface Props {
  file: FileItem
  selected: boolean
  onToggle: () => void
  onOpenInFinder?: () => void
  accent?: string
}

export default function FileRow({ file, selected, onToggle, onOpenInFinder, accent = '#CF6EE4' }: Props) {
  const parts = file.path.split('/')
  const dirPath = parts.slice(0, -1).join('/').replace(/^\/Users\/[^/]+/, '~')

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '8px 14px',
        borderRadius: 9,
        background: selected ? `${accent}18` : 'transparent',
        border: selected ? `1px solid ${accent}30` : '1px solid transparent',
        transition: 'background 0.1s, border-color 0.1s',
        cursor: 'pointer'
      }}
      onClick={onToggle}
      onMouseEnter={e => {
        if (!selected) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.05)'
      }}
      onMouseLeave={e => {
        if (!selected) (e.currentTarget as HTMLElement).style.background = 'transparent'
      }}
    >
      <input
        type="checkbox"
        checked={selected}
        onChange={onToggle}
        onClick={e => e.stopPropagation()}
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 12,
          fontWeight: 500,
          color: 'var(--text)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap'
        }}>
          {file.name}
        </div>
        <div style={{
          fontSize: 10,
          color: 'rgba(255,255,255,0.38)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          marginTop: 1
        }}>
          {dirPath}
        </div>
      </div>
      <div style={{
        fontSize: 11,
        fontWeight: 600,
        color: 'rgba(255,255,255,0.45)',
        flexShrink: 0,
        fontVariantNumeric: 'tabular-nums'
      }}>
        {formatBytes(file.size)}
      </div>
      {onOpenInFinder && (
        <button
          onClick={e => { e.stopPropagation(); onOpenInFinder() }}
          title="Show in Finder"
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            fontSize: 12,
            opacity: 0.4,
            padding: '2px 4px',
            borderRadius: 4,
            color: 'var(--text)',
            transition: 'opacity 0.1s'
          }}
          onMouseEnter={e => (e.currentTarget.style.opacity = '0.8')}
          onMouseLeave={e => (e.currentTarget.style.opacity = '0.4')}
        >
          ↗
        </button>
      )}
    </div>
  )
}
