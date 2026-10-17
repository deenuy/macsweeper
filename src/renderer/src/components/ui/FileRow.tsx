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
}

export default function FileRow({ file, selected, onToggle, onOpenInFinder }: Props) {
  const parts = file.path.split('/')
  const dirPath = parts.slice(0, -1).join('/').replace(/^\/Users\/[^/]+/, '~')

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '9px 16px',
        borderRadius: 10,
        background: selected ? 'rgba(168,85,247,0.12)' : 'transparent',
        border: selected ? '1px solid rgba(168,85,247,0.2)' : '1px solid transparent',
        transition: 'all 0.1s ease',
        cursor: 'pointer'
      }}
      onClick={onToggle}
    >
      <input
        type="checkbox"
        checked={selected}
        onChange={onToggle}
        onClick={e => e.stopPropagation()}
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 13,
          fontWeight: 500,
          color: 'var(--text)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap'
        }}>
          {file.name}
        </div>
        <div style={{
          fontSize: 11,
          color: 'var(--text-muted)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          marginTop: 2
        }}>
          {dirPath}
        </div>
      </div>
      <div style={{
        fontSize: 12,
        fontWeight: 600,
        color: 'var(--text-muted)',
        flexShrink: 0
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
            fontSize: 13,
            opacity: 0.5,
            padding: '2px 4px',
            borderRadius: 4,
            color: 'var(--text)'
          }}
        >
          ↗
        </button>
      )}
    </div>
  )
}
