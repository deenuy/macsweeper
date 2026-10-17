// SVG icons for each scan category - replaces emoji
const iconPaths: Record<string, React.ReactElement> = {
  'user-cache': (
    <svg viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="4" width="14" height="11" rx="2"/>
      <path d="M6 4V3a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v1"/>
      <path d="M9 9v3M7.5 10.5h3"/>
    </svg>
  ),
  'language-files': (
    <svg viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9" cy="9" r="7"/>
      <path d="M9 2C9 2 12 5.5 12 9s-3 7-3 7M9 2C9 2 6 5.5 6 9s3 7 3 7M2 9h14"/>
    </svg>
  ),
  'extra-binaries': (
    <svg viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="5" width="6" height="8" rx="1.5"/>
      <rect x="10" y="5" width="6" height="8" rx="1.5"/>
      <path d="M8 9h2"/>
    </svg>
  ),
  'logs': (
    <svg viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 4h10M4 7h10M4 10h7M4 13h5"/>
    </svg>
  ),
  'mail': (
    <svg viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="4" width="14" height="10" rx="2"/>
      <path d="M2 6l7 5 7-5"/>
    </svg>
  ),
  'doc-versions': (
    <svg viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 2H5a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V6l-4-4z"/>
      <path d="M10 2v4h4M6 10h6M6 13h4"/>
    </svg>
  ),
  'trash': (
    <svg viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 5h12M7 5V3.5a.5.5 0 0 1 .5-.5h3a.5.5 0 0 1 .5.5V5M5 5l.8 9.5a1 1 0 0 0 1 .5h4.4a1 1 0 0 0 1-.5L13 5"/>
    </svg>
  ),
  'downloads-junk': (
    <svg viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 2v9M6 8l3 3 3-3"/>
      <path d="M3 13v1a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-1"/>
    </svg>
  ),
  'dev-junk': (
    <svg viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 6l-3 3 3 3M12 6l3 3-3 3M10 4l-2 10"/>
    </svg>
  ),
  'ds-store': (
    <svg viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9" cy="9" r="2"/>
      <path d="M9 2v2M9 14v2M2 9h2M14 9h2M4.22 4.22l1.42 1.42M12.36 12.36l1.42 1.42M4.22 13.78l1.42-1.42M12.36 5.64l1.42-1.42"/>
    </svg>
  ),
  'app-leftovers': (
    <svg viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="12" height="12" rx="3"/>
      <path d="M7 9l2 2 4-4"/>
    </svg>
  ),
  'startup-items': (
    <svg viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 2L9 9M6 5l3-3 3 3"/>
      <path d="M3 11a6 6 0 1 0 12 0"/>
    </svg>
  ),
  'large-files': (
    <svg viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="5" width="12" height="8" rx="1.5"/>
      <path d="M3 8h12"/>
      <path d="M6 11h6"/>
    </svg>
  ),
  'duplicates': (
    <svg viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <rect x="6" y="6" width="8" height="8" rx="1.5"/>
      <path d="M4 12V4a1 1 0 0 1 1-1h8"/>
    </svg>
  ),
  'similar-images': (
    <svg viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="3" width="10" height="10" rx="1.5"/>
      <path d="M6 10l2-2 2 2M8.5 6.5a.5.5 0 1 1 0-1"/>
      <path d="M8 13v2M13 8h2M10 5l3-3M13 10l3 3"/>
    </svg>
  ),
  'privacy': (
    <svg viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 2L3.5 4.5v5C3.5 13 9 16 9 16s5.5-3 5.5-6.5v-5L9 2z"/>
      <path d="M6.5 9l2 2 3-3"/>
    </svg>
  ),
  // Fallback
  'default': (
    <svg viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 2H5a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V6l-4-4z"/>
      <path d="M10 2v4h4"/>
    </svg>
  )
}

interface Props {
  categoryId: string
  size?: number
  color?: string
}

export default function CategoryIcon({ categoryId, size = 14, color = 'currentColor' }: Props) {
  const icon = iconPaths[categoryId] ?? iconPaths['default']
  return (
    <span style={{ width: size, height: size, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color, flexShrink: 0 }}>
      {icon}
    </span>
  )
}
