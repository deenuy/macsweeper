export type ScanCategory =
  | 'language-files'   // Non-English .lproj in app bundles
  | 'user-cache'       // ~/Library/Caches
  | 'logs'             // ~/Library/Logs, /Library/Logs
  | 'mail'             // ~/Library/Mail attachments
  | 'downloads-junk'   // Old .dmg/.pkg in ~/Downloads
  | 'ds-store'         // .DS_Store files
  | 'dev-junk'         // node_modules, __pycache__, .gradle
  | 'extra-binaries'   // Rosetta / x86_64 slices in universal app bundles
  | 'doc-versions'     // Old auto-saved document versions (~/Library/Autosave Information)
  | 'trash'            // Items in Trash (~/Library/.Trash)
  | 'large-files'      // Files > 100 MB anywhere in home dir
  | 'app-leftovers'    // ~/Library support/pref files for uninstalled apps
  | 'duplicates'       // Duplicate files by content hash
  | 'similar-images'   // Near-duplicate images (perceptual hash)
  | 'startup-items'    // Login items / launch agents
  | 'privacy'          // Browser history, recent items, clipboard

export interface FileItem {
  path: string
  name: string
  size: number
  category: ScanCategory
  modifiedAt: string
}

export interface DuplicateGroup {
  hash: string
  size: number
  count: number
  files: FileItem[]
  totalWaste: number
}

export interface ScanResult {
  [category: string]: FileItem[]
}

export interface CleanResult {
  cleaned: number
  totalSize: number
  failed: { path: string; reason: string }[]
  cancelled?: boolean
}

export interface DiskStats {
  totalBytes: number
  usedBytes: number
  freeBytes: number
  usedPercent: number
  volumeName?: string
}

export interface SystemSnapshot {
  disk: { freeBytes: number; totalBytes: number; usedBytes: number }
  memory: { pressurePercent: number; totalBytes: number; usedBytes: number; freeBytes: number }
  battery: { percent: number; charging: boolean; fullyCharged: boolean; hasBattery: boolean }
  cpu: { loadPercent: number }
  network: { upKBps: number; downKBps: number; ssid: string }
  connectedDevices: Array<{ name: string; type: 'disk' | 'phone'; info: string; path?: string }>
  healthScore: 'Excellent' | 'Good' | 'Fair' | 'Poor'
  macModel: string
}

export interface VolumeInfo {
  name: string
  path: string
  totalBytes: number
  usedBytes: number
  freeBytes: number
  isNetwork: boolean
}

export interface ScanProgress {
  category: ScanCategory
  found: number
  size: number
  status: 'scanning' | 'done'
}

// Startup / Login items
export interface StartupItem {
  name: string
  path: string
  type: 'login-item' | 'launch-agent' | 'launch-daemon'
  enabled: boolean
  bundleId?: string
}

// App leftover (support files for removed apps)
export interface AppLeftover {
  appName: string
  paths: string[]
  totalSize: number
}

export interface CategoryMeta {
  id: ScanCategory
  label: string
  description: string
  icon: string
  color: string
  group: 'junk' | 'privacy' | 'large' | 'apps' | 'system'
}

export const CATEGORIES: CategoryMeta[] = [
  // ── Junk ────────────────────────────────────────────────────────────────────
  {
    id: 'user-cache',
    label: 'User Cache',
    description: 'App cache files in ~/Library/Caches',
    icon: '🗂️',
    color: '#a855f7',
    group: 'junk'
  },
  {
    id: 'language-files',
    label: 'Language Files',
    description: 'Unused language packs inside app bundles',
    icon: '🌐',
    color: '#06b6d4',
    group: 'junk'
  },
  {
    id: 'extra-binaries',
    label: 'Extra Binaries',
    description: 'Unused Rosetta/x86_64 slices in universal apps',
    icon: '⚙️',
    color: '#8b5cf6',
    group: 'junk'
  },
  {
    id: 'logs',
    label: 'Log Files',
    description: 'System and application log files',
    icon: '📋',
    color: '#f59e0b',
    group: 'junk'
  },
  {
    id: 'mail',
    label: 'Mail Attachments',
    description: 'Cached attachments in ~/Library/Mail',
    icon: '📧',
    color: '#3b82f6',
    group: 'junk'
  },
  {
    id: 'doc-versions',
    label: 'Document Versions',
    description: 'Auto-saved old document versions',
    icon: '📄',
    color: '#64748b',
    group: 'junk'
  },
  {
    id: 'trash',
    label: 'Trash',
    description: 'Items waiting in the Trash bin',
    icon: '🗑️',
    color: '#6b7280',
    group: 'junk'
  },
  {
    id: 'downloads-junk',
    label: 'Downloads Junk',
    description: 'Old installers and archives in ~/Downloads',
    icon: '📦',
    color: '#ec4899',
    group: 'junk'
  },
  {
    id: 'dev-junk',
    label: 'Developer Junk',
    description: 'Stale node_modules, __pycache__, .gradle caches',
    icon: '💻',
    color: '#10b981',
    group: 'junk'
  },
  {
    id: 'ds-store',
    label: '.DS_Store Files',
    description: 'Hidden macOS Finder metadata files',
    icon: '🗃️',
    color: '#6366f1',
    group: 'junk'
  },
  // ── Apps ────────────────────────────────────────────────────────────────────
  {
    id: 'app-leftovers',
    label: 'App Leftovers',
    description: 'Support files for apps no longer installed',
    icon: '🧹',
    color: '#f97316',
    group: 'apps'
  },
  {
    id: 'startup-items',
    label: 'Login Items',
    description: 'Apps and agents that launch at login',
    icon: '🚀',
    color: '#14b8a6',
    group: 'system'
  },
  // ── Large & Duplicates ───────────────────────────────────────────────────────
  {
    id: 'large-files',
    label: 'Large Files',
    description: 'Files larger than 100 MB anywhere in home',
    icon: '📊',
    color: '#ef4444',
    group: 'large'
  },
  {
    id: 'duplicates',
    label: 'Duplicates',
    description: 'Identical files found by content hash',
    icon: '⊞',
    color: '#f59e0b',
    group: 'large'
  },
  {
    id: 'similar-images',
    label: 'Similar Images',
    description: 'Near-duplicate photos and screenshots',
    icon: '🖼️',
    color: '#22c55e',
    group: 'large'
  },
  // ── Privacy ─────────────────────────────────────────────────────────────────
  {
    id: 'privacy',
    label: 'Privacy Cleanup',
    description: 'Browser history, recent items, clipboard',
    icon: '🔒',
    color: '#dc2626',
    group: 'privacy'
  }
]

// ── Applications module ──────────────────────────────────────────────────────

export interface InstalledApp {
  name: string
  path: string
  bundleId: string
  version: string
  size: number
  isMAS: boolean
  sparkleUrl?: string
  lastUsed?: string
}

export interface AppUpdate {
  app: InstalledApp
  latestVersion: string
  updateUrl?: string
  source: 'sparkle' | 'mas'
}

export interface LeftoverGroup {
  appName: string
  bundleId: string
  totalSize: number
  files: FileItem[]
}

export interface UninstallResult {
  trashed: string[]
  failed: string[]
}

// Space Lens tree types (IPC-serialisable; must stay in sync with src/main/fs-utils.ts)
export interface TreeNode {
  name: string
  path: string
  size: number
  sizeOnDisk: number
  isDir: boolean
  childCount: number
  hasChildren: boolean
  ext: string
  modifiedAt: string
  createdAt: string
  accessedAt: string
  isSymlink: boolean
  permissions: string
  kind: string
  owner: string
}

export interface FileMeta extends TreeNode {
  inode: number
  hardLinks: number
  deviceId: number
  fullPath: string
  parentPath: string
  canRead: boolean
  canWrite: boolean
}

export const CATEGORY_GROUPS: Record<string, { label: string; categories: ScanCategory[] }> = {
  junk:    { label: 'Junk Files',     categories: ['user-cache','language-files','extra-binaries','logs','mail','doc-versions','trash','downloads-junk','dev-junk','ds-store'] },
  apps:    { label: 'Applications',   categories: ['app-leftovers'] },
  system:  { label: 'System',         categories: ['startup-items'] },
  large:   { label: 'Storage',        categories: ['large-files','duplicates','similar-images'] },
  privacy: { label: 'Privacy',        categories: ['privacy'] },
}
