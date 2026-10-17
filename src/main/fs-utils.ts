/**
 * File system utilities for Space Lens tree scanning.
 * All operations are read-only. Symlinks are never followed for size walks
 * (preventing infinite loops and double-counting on macOS).
 */
import fs from 'fs'
import path from 'path'

export interface TreeNode {
  name: string
  path: string
  size: number         // total size (recursive for dirs)
  sizeOnDisk: number  // blocks * 512 (actual disk allocation)
  isDir: boolean
  childCount: number   // number of direct children (dirs: subdirs+files)
  hasChildren: boolean // whether expand arrow should show
  ext: string          // '' for dirs, '.png' etc for files
  modifiedAt: string
  createdAt: string
  accessedAt: string
  isSymlink: boolean
  permissions: string  // e.g. 'rwxr-xr-x'
  kind: string         // 'Folder', 'PDF Document', etc.
  owner: string        // uid as string (we can't easily resolve names in renderer)
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

// Extension → human readable kind
const EXT_KIND: Record<string, string> = {
  // Images
  png: 'PNG Image', jpg: 'JPEG Image', jpeg: 'JPEG Image', gif: 'GIF Image',
  webp: 'WebP Image', heic: 'HEIC Image', tiff: 'TIFF Image', bmp: 'Bitmap Image',
  svg: 'SVG Image', raw: 'RAW Image', psd: 'Photoshop Document',
  // Video
  mp4: 'MPEG-4 Video', mov: 'QuickTime Movie', avi: 'AVI Video', mkv: 'Matroska Video',
  m4v: 'iTunes Video', wmv: 'Windows Media Video', webm: 'WebM Video',
  // Audio
  mp3: 'MP3 Audio', aac: 'AAC Audio', flac: 'FLAC Audio', wav: 'WAV Audio',
  m4a: 'M4A Audio', ogg: 'OGG Audio', aiff: 'AIFF Audio',
  // Documents
  pdf: 'PDF Document', docx: 'Word Document', doc: 'Word Document',
  xlsx: 'Excel Spreadsheet', xls: 'Excel Spreadsheet',
  pptx: 'PowerPoint Presentation', ppt: 'PowerPoint Presentation',
  txt: 'Plain Text', rtf: 'Rich Text Document', md: 'Markdown',
  // Archives
  zip: 'ZIP Archive', tar: 'TAR Archive', gz: 'Gzip Archive',
  bz2: 'Bzip2 Archive', xz: 'XZ Archive', '7z': '7-Zip Archive',
  dmg: 'Disk Image', iso: 'Disk Image', pkg: 'macOS Package',
  // Code
  ts: 'TypeScript Source', tsx: 'TypeScript Source', js: 'JavaScript Source',
  jsx: 'JavaScript Source', py: 'Python Script', swift: 'Swift Source',
  kt: 'Kotlin Source', java: 'Java Source', c: 'C Source', cpp: 'C++ Source',
  h: 'C Header', rs: 'Rust Source', go: 'Go Source', rb: 'Ruby Script',
  sh: 'Shell Script', bash: 'Bash Script', zsh: 'Zsh Script',
  // Data
  json: 'JSON Data', xml: 'XML Document', csv: 'CSV Data', sql: 'SQL Script',
  yaml: 'YAML Document', yml: 'YAML Document', toml: 'TOML Configuration',
  // macOS specific
  app: 'Application', framework: 'Framework', dylib: 'Dynamic Library',
  plist: 'Property List', xib: 'Interface File',
  emlx: 'Mail Message', mbox: 'Mailbox',
  // Misc
  log: 'Log File', db: 'SQLite Database', sqlite: 'SQLite Database',
}

function extKind(ext: string, isDir: boolean): string {
  if (isDir) return 'Folder'
  const k = EXT_KIND[ext.toLowerCase().replace(/^\./, '')]
  return k ?? (ext ? `${ext.toUpperCase().replace(/^\./, '')} File` : 'File')
}

function modeToPerms(mode: number): string {
  const chars = ['r', 'w', 'x']
  let result = ''
  for (let i = 2; i >= 0; i--) {
    for (let j = 0; j < 3; j++) {
      result += (mode >> (i * 3 + (2 - j))) & 1 ? chars[j] : '-'
    }
  }
  return result
}

function safeStatSync(p: string): fs.Stats | null {
  try { return fs.lstatSync(p) } catch { return null }
}

// Compute directory size without following symlinks
function dirSizeSync(dirPath: string, maxDepth = 20, depth = 0): { size: number; sizeOnDisk: number } {
  if (depth > maxDepth) return { size: 0, sizeOnDisk: 0 }
  let size = 0, sod = 0
  try {
    const entries = fs.readdirSync(dirPath)
    for (const e of entries) {
      const full = path.join(dirPath, e)
      const st = safeStatSync(full)
      if (!st) continue
      if (st.isSymbolicLink()) continue // never follow symlinks
      if (st.isDirectory()) {
        const sub = dirSizeSync(full, maxDepth, depth + 1)
        size += sub.size
        sod  += sub.sizeOnDisk
      } else {
        size += st.size
        sod  += st.blocks * 512
      }
    }
  } catch { /* permission denied — skip */ }
  return { size, sizeOnDisk: sod }
}

/**
 * Scan one level of a directory. Returns children sorted by size desc.
 * Directory sizes are computed recursively (expensive but necessary for correct sort).
 */
export function scanDirOneLevel(dirPath: string): TreeNode[] {
  const results: TreeNode[] = []
  let entries: string[]
  try {
    entries = fs.readdirSync(dirPath)
  } catch {
    return []
  }

  for (const name of entries) {
    if (name === '.DS_Store') continue
    const full = path.join(dirPath, name)
    const st = safeStatSync(full)
    if (!st) continue

    const isSymlink = st.isSymbolicLink()
    const isDir     = st.isDirectory() && !isSymlink
    const ext       = isDir ? '' : path.extname(name)

    let size = 0, sizeOnDisk = 0, childCount = 0, hasChildren = false

    if (isDir) {
      // Count direct children first (fast)
      try {
        const kids = fs.readdirSync(full)
        childCount = kids.length
        hasChildren = childCount > 0
      } catch { childCount = 0 }
      // Compute recursive size
      const { size: s, sizeOnDisk: sod } = dirSizeSync(full)
      size = s; sizeOnDisk = sod
    } else {
      size = st.size
      sizeOnDisk = st.blocks * 512
    }

    results.push({
      name,
      path: full,
      size,
      sizeOnDisk,
      isDir,
      childCount,
      hasChildren,
      ext,
      modifiedAt:  st.mtime.toISOString(),
      createdAt:   st.birthtime.toISOString(),
      accessedAt:  st.atime.toISOString(),
      isSymlink,
      permissions: modeToPerms(st.mode),
      kind:        extKind(ext, isDir),
      owner:       String(st.uid),
    })
  }

  return results.sort((a, b) => b.size - a.size)
}

/** Full metadata for the properties panel */
export function getFileMeta(filePath: string): FileMeta | null {
  const st = safeStatSync(filePath)
  if (!st) return null

  const isSymlink  = st.isSymbolicLink()
  const isDir      = st.isDirectory() && !isSymlink
  const name       = path.basename(filePath)
  const ext        = isDir ? '' : path.extname(name)

  let size = st.size, sizeOnDisk = st.blocks * 512
  let childCount = 0, hasChildren = false

  if (isDir) {
    try {
      const kids = fs.readdirSync(filePath)
      childCount = kids.length
      hasChildren = childCount > 0
    } catch { /* skip */ }
    const computed = dirSizeSync(filePath)
    size = computed.size
    sizeOnDisk = computed.sizeOnDisk
  }

  // Check read/write access
  let canRead = false, canWrite = false
  try { fs.accessSync(filePath, fs.constants.R_OK); canRead = true } catch { /* no */ }
  try { fs.accessSync(filePath, fs.constants.W_OK); canWrite = true } catch { /* no */ }

  return {
    name,
    path: filePath,
    fullPath: filePath,
    parentPath: path.dirname(filePath),
    size,
    sizeOnDisk,
    isDir,
    childCount,
    hasChildren,
    ext,
    modifiedAt:  st.mtime.toISOString(),
    createdAt:   st.birthtime.toISOString(),
    accessedAt:  st.atime.toISOString(),
    isSymlink,
    permissions: modeToPerms(st.mode),
    kind:        extKind(ext, isDir),
    owner:       String(st.uid),
    inode:       st.ino,
    hardLinks:   st.nlink,
    deviceId:    st.dev,
    canRead,
    canWrite,
  }
}
