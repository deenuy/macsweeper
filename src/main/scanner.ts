import fs from 'fs'
import path from 'path'
import os from 'os'
import crypto from 'crypto'
import { BrowserWindow } from 'electron'
import type { FileItem, DuplicateGroup, ScanCategory } from '../shared/types'

const HOME = os.homedir()

const PROTECTED_PATHS = new Set([
  '/System',
  '/Library',
  '/usr',
  '/bin',
  '/sbin',
  '/private/etc',
  '/private/var/db',
  path.join(HOME, 'Library', 'Keychains'),
  path.join(HOME, 'Library', 'Preferences')
])

function isProtected(filePath: string): boolean {
  return Array.from(PROTECTED_PATHS).some((p) => filePath.startsWith(p))
}

function safeStatSync(filePath: string): fs.Stats | null {
  try {
    return fs.statSync(filePath)
  } catch {
    return null
  }
}

function safeDirRead(dirPath: string): string[] {
  try {
    return fs.readdirSync(dirPath)
  } catch {
    return []
  }
}

function walkDir(
  dirPath: string,
  maxDepth: number,
  depth = 0,
  onFile?: (filePath: string, stat: fs.Stats) => void,
  onDir?: (dirPath: string, stat: fs.Stats) => boolean
): void {
  if (depth > maxDepth) return
  if (isProtected(dirPath)) return

  const entries = safeDirRead(dirPath)
  for (const entry of entries) {
    if (entry.startsWith('.') && entry !== '.DS_Store') continue
    const fullPath = path.join(dirPath, entry)
    const stat = safeStatSync(fullPath)
    if (!stat) continue

    if (stat.isDirectory()) {
      const descend = onDir ? onDir(fullPath, stat) : true
      if (descend) walkDir(fullPath, maxDepth, depth + 1, onFile, onDir)
    } else if (stat.isFile()) {
      onFile?.(fullPath, stat)
    }
  }
}

function getDirSize(dirPath: string): number {
  let total = 0
  walkDir(dirPath, 20, 0, (_, stat) => {
    total += stat.size
  })
  return total
}

let cancelRequested = false

export function requestCancel(): void {
  cancelRequested = true
}

let lastProgressSend = 0
function emitScanFile(win: BrowserWindow | null, filePath: string) {
  if (!win || Date.now() - lastProgressSend < 80) return
  lastProgressSend = Date.now()
  win.webContents.send('scan:file', filePath)
}

function emitProgress(
  win: BrowserWindow | null,
  category: ScanCategory,
  found: number,
  size: number,
  status: 'scanning' | 'done'
): void {
  win?.webContents.send('scan:progress', { category, found, size, status })
}

export async function scanLanguageFiles(win: BrowserWindow | null): Promise<FileItem[]> {
  const results: FileItem[] = []
  const appsDir = '/Applications'
  const keepLprojs = new Set(['en.lproj', 'Base.lproj', 'en_GB.lproj', 'en_AU.lproj'])

  const apps = safeDirRead(appsDir)
  for (const appName of apps) {
    if (cancelRequested) break
    const appPath = path.join(appsDir, appName)
    if (!appName.endsWith('.app')) continue

    const resourcesDir = path.join(appPath, 'Contents', 'Resources')
    const entries = safeDirRead(resourcesDir)
    for (const entry of entries) {
      if (!entry.endsWith('.lproj')) continue
      if (keepLprojs.has(entry)) continue
      const lprojPath = path.join(resourcesDir, entry)
      const size = getDirSize(lprojPath)
      if (size < 1024) continue
      results.push({
        path: lprojPath,
        name: `${appName} — ${entry}`,
        size,
        category: 'language-files',
        modifiedAt: safeStatSync(lprojPath)?.mtime.toISOString() ?? ''
      })
    }
    emitProgress(win, 'language-files', results.length, results.reduce((a, f) => a + f.size, 0), 'scanning')
  }

  emitProgress(win, 'language-files', results.length, results.reduce((a, f) => a + f.size, 0), 'done')
  return results
}

export async function scanUserCache(win: BrowserWindow | null): Promise<FileItem[]> {
  const results: FileItem[] = []
  const cacheDir = path.join(HOME, 'Library', 'Caches')
  const minSize = 1024 * 1024

  const entries = safeDirRead(cacheDir)
  for (const entry of entries) {
    if (cancelRequested) break
    const fullPath = path.join(cacheDir, entry)
    const stat = safeStatSync(fullPath)
    if (!stat) continue

    let size = 0
    if (stat.isDirectory()) {
      size = getDirSize(fullPath)
    } else {
      size = stat.size
    }

    if (size < minSize) continue

    results.push({
      path: fullPath,
      name: entry,
      size,
      category: 'user-cache',
      modifiedAt: stat.mtime.toISOString()
    })

    emitProgress(win, 'user-cache', results.length, results.reduce((a, f) => a + f.size, 0), 'scanning')
  }

  emitProgress(win, 'user-cache', results.length, results.reduce((a, f) => a + f.size, 0), 'done')
  return results
}

export async function scanLogs(win: BrowserWindow | null): Promise<FileItem[]> {
  const results: FileItem[] = []
  const logDirs = [path.join(HOME, 'Library', 'Logs'), '/Library/Logs']

  for (const logDir of logDirs) {
    if (!fs.existsSync(logDir)) continue
    walkDir(logDir, 5, 0, (filePath, stat) => {
      if (!filePath.endsWith('.log') && !filePath.endsWith('.log.gz')) return
      if (stat.size < 10240) return
      results.push({
        path: filePath,
        name: path.basename(filePath),
        size: stat.size,
        category: 'logs',
        modifiedAt: stat.mtime.toISOString()
      })
      emitScanFile(win, filePath)
      emitProgress(win, 'logs', results.length, results.reduce((a, f) => a + f.size, 0), 'scanning')
    })
  }

  emitProgress(win, 'logs', results.length, results.reduce((a, f) => a + f.size, 0), 'done')
  return results
}

export async function scanMailAttachments(win: BrowserWindow | null): Promise<FileItem[]> {
  const results: FileItem[] = []
  const mailDir = path.join(HOME, 'Library', 'Mail')

  if (!fs.existsSync(mailDir)) {
    emitProgress(win, 'mail', 0, 0, 'done')
    return results
  }

  walkDir(mailDir, 8, 0, (filePath, stat) => {
    if (cancelRequested) return
    const isAttachment =
      filePath.includes('/Attachments/') ||
      (filePath.includes('/IMAP-') && stat.size > 102400)
    if (!isAttachment) return

    results.push({
      path: filePath,
      name: path.basename(filePath),
      size: stat.size,
      category: 'mail',
      modifiedAt: stat.mtime.toISOString()
    })
    if (results.length % 50 === 0) {
      emitProgress(win, 'mail', results.length, results.reduce((a, f) => a + f.size, 0), 'scanning')
    }
  })

  emitProgress(win, 'mail', results.length, results.reduce((a, f) => a + f.size, 0), 'done')
  return results
}

export async function scanDownloadsJunk(win: BrowserWindow | null): Promise<FileItem[]> {
  const results: FileItem[] = []
  const downloadsDir = path.join(HOME, 'Downloads')
  const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000
  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000
  const junkExts = new Set(['.dmg', '.pkg', '.zip', '.tar', '.gz', '.iso'])

  const entries = safeDirRead(downloadsDir)
  for (const entry of entries) {
    if (cancelRequested) break
    const fullPath = path.join(downloadsDir, entry)
    const stat = safeStatSync(fullPath)
    if (!stat || !stat.isFile()) continue

    const ext = path.extname(entry).toLowerCase()
    if (!junkExts.has(ext)) continue

    const mtime = stat.mtime.getTime()
    const isDmgOrPkg = ext === '.dmg' || ext === '.pkg'
    const isOld = isDmgOrPkg ? mtime < thirtyDaysAgo : mtime < sevenDaysAgo

    if (!isOld) continue

    results.push({
      path: fullPath,
      name: entry,
      size: stat.size,
      category: 'downloads-junk',
      modifiedAt: stat.mtime.toISOString()
    })
  }

  emitProgress(win, 'downloads-junk', results.length, results.reduce((a, f) => a + f.size, 0), 'done')
  return results
}

export async function scanDsStore(win: BrowserWindow | null): Promise<FileItem[]> {
  const results: FileItem[] = []
  const searchDirs = [path.join(HOME, 'Documents'), path.join(HOME, 'Desktop')]

  for (const dir of searchDirs) {
    if (!fs.existsSync(dir)) continue
    walkDir(dir, 10, 0, (filePath, stat) => {
      if (path.basename(filePath) !== '.DS_Store') return
      results.push({
        path: filePath,
        name: '.DS_Store',
        size: stat.size,
        category: 'ds-store',
        modifiedAt: stat.mtime.toISOString()
      })
    })
  }

  emitProgress(win, 'ds-store', results.length, results.reduce((a, f) => a + f.size, 0), 'done')
  return results
}

export async function scanDevJunk(win: BrowserWindow | null): Promise<FileItem[]> {
  const results: FileItem[] = []
  const sixtyDaysAgo = Date.now() - 60 * 24 * 60 * 60 * 1000
  const searchDirs = [
    path.join(HOME, 'Documents'),
    path.join(HOME, 'Desktop'),
    path.join(HOME, 'Projects')
  ]

  for (const base of searchDirs) {
    if (!fs.existsSync(base)) continue

    walkDir(
      base,
      6,
      0,
      undefined,
      (dirPath, stat) => {
        if (cancelRequested) return false
        const name = path.basename(dirPath)

        if (name === 'node_modules') {
          if (stat.mtime.getTime() < sixtyDaysAgo) {
            const size = getDirSize(dirPath)
            results.push({
              path: dirPath,
              name: `node_modules (${path.basename(path.dirname(dirPath))})`,
              size,
              category: 'dev-junk',
              modifiedAt: stat.mtime.toISOString()
            })
            emitProgress(win, 'dev-junk', results.length, results.reduce((a, f) => a + f.size, 0), 'scanning')
          }
          return false
        }

        if (name === '__pycache__') {
          const size = getDirSize(dirPath)
          results.push({
            path: dirPath,
            name: `__pycache__ (${path.basename(path.dirname(dirPath))})`,
            size,
            category: 'dev-junk',
            modifiedAt: stat.mtime.toISOString()
          })
          return false
        }

        return true
      }
    )
  }

  emitProgress(win, 'dev-junk', results.length, results.reduce((a, f) => a + f.size, 0), 'done')
  return results
}

// ── Extra Binaries (Rosetta / x86_64 slices in universal app bundles) ──────────
export async function scanExtraBinaries(win: BrowserWindow | null): Promise<FileItem[]> {
  const results: FileItem[] = []
  const isAppleSilicon = process.arch === 'arm64'
  if (!isAppleSilicon) {
    emitProgress(win, 'extra-binaries', 0, 0, 'done')
    return results
  }

  const { execFileSync } = await import('child_process')
  const apps = safeDirRead('/Applications')

  for (const appName of apps) {
    if (cancelRequested) break
    if (!appName.endsWith('.app')) continue

    const macosDir = path.join('/Applications', appName, 'Contents', 'MacOS')
    const entries  = safeDirRead(macosDir)

    for (const entry of entries) {
      const fullPath = path.join(macosDir, entry)
      const stat = safeStatSync(fullPath)
      if (!stat || !stat.isFile()) continue

      try {
        // lipo -info tells us if it's a fat (universal) binary with x86_64 slice
        const info = execFileSync('lipo', ['-info', fullPath], { encoding: 'utf8', timeout: 5000 })
        if (info.includes('x86_64') && info.includes('arm64')) {
          // Estimate x86_64 slice size as ~half the binary
          const sliceSize = Math.floor(stat.size / 2)
          if (sliceSize < 512 * 1024) continue
          results.push({
            path: fullPath,
            name: `${appName} — x86_64 slice`,
            size: sliceSize,
            category: 'extra-binaries',
            modifiedAt: stat.mtime.toISOString()
          })
        }
      } catch { /* not a Mach-O or lipo failed — skip */ }
    }
    emitProgress(win, 'extra-binaries', results.length, results.reduce((a, f) => a + f.size, 0), 'scanning')
  }

  emitProgress(win, 'extra-binaries', results.length, results.reduce((a, f) => a + f.size, 0), 'done')
  return results
}

// ── Document Versions (Autosave / Versions) ─────────────────────────────────
export async function scanDocVersions(win: BrowserWindow | null): Promise<FileItem[]> {
  const results: FileItem[] = []
  const versionsDir = path.join(HOME, 'Library', 'Autosave Information')
  const mobileDocsVersions = path.join(HOME, 'Library', 'Mobile Documents', 'com~apple~TextEdit')

  for (const dir of [versionsDir, mobileDocsVersions]) {
    if (!fs.existsSync(dir)) continue
    walkDir(dir, 4, 0, (filePath, stat) => {
      if (stat.size < 10240) return
      results.push({
        path: filePath,
        name: path.basename(filePath),
        size: stat.size,
        category: 'doc-versions',
        modifiedAt: stat.mtime.toISOString()
      })
    })
  }

  // Also check NSPersistentDocument versions store
  const versionsStore = path.join(HOME, 'Library', 'Application Support', '.DocumentRevisions-V100')
  if (fs.existsSync(versionsStore)) {
    const size = getDirSize(versionsStore)
    if (size > 10 * 1024 * 1024) {
      results.push({
        path: versionsStore,
        name: 'Document Version History',
        size,
        category: 'doc-versions',
        modifiedAt: safeStatSync(versionsStore)?.mtime.toISOString() ?? ''
      })
    }
  }

  emitProgress(win, 'doc-versions', results.length, results.reduce((a, f) => a + f.size, 0), 'done')
  return results
}

// ── Trash bin contents ────────────────────────────────────────────────────────
export async function scanTrash(win: BrowserWindow | null): Promise<FileItem[]> {
  const results: FileItem[] = []
  const trashDirs = [
    path.join(HOME, '.Trash'),
    `/.Trashes/${process.getuid?.() ?? 501}`
  ]

  for (const trashDir of trashDirs) {
    if (!fs.existsSync(trashDir)) continue
    const entries = safeDirRead(trashDir)
    for (const entry of entries) {
      if (entry === '.DS_Store' || entry === '.localized') continue
      const fullPath = path.join(trashDir, entry)
      const stat = safeStatSync(fullPath)
      if (!stat) continue
      const size = stat.isDirectory() ? getDirSize(fullPath) : stat.size
      results.push({
        path: fullPath,
        name: entry,
        size,
        category: 'trash',
        modifiedAt: stat.mtime.toISOString()
      })
    }
  }

  emitProgress(win, 'trash', results.length, results.reduce((a, f) => a + f.size, 0), 'done')
  return results
}

// ── Large Files (> 100 MB anywhere in home) ───────────────────────────────────
export async function scanLargeFiles(win: BrowserWindow | null): Promise<FileItem[]> {
  const results: FileItem[] = []
  const threshold = 100 * 1024 * 1024
  const skipDirs  = new Set(['.Trash', 'node_modules', '.git', 'Library/Developer/Xcode/DerivedData'])

  walkDir(HOME, 12, 0,
    (filePath, stat) => {
      if (cancelRequested) return
      if (stat.size < threshold) return
      results.push({
        path: filePath,
        name: path.basename(filePath),
        size: stat.size,
        category: 'large-files',
        modifiedAt: stat.mtime.toISOString()
      })
      emitScanFile(win, filePath)
      if (results.length % 10 === 0) {
        emitProgress(win, 'large-files', results.length, results.reduce((a, f) => a + f.size, 0), 'scanning')
      }
    },
    (dirPath) => {
      const name = path.basename(dirPath)
      return !skipDirs.has(name) && !isProtected(dirPath)
    }
  )

  results.sort((a, b) => b.size - a.size)
  emitProgress(win, 'large-files', results.length, results.reduce((a, f) => a + f.size, 0), 'done')
  return results
}

// ── App Leftovers (support files for uninstalled apps) ───────────────────────
export async function scanAppLeftovers(win: BrowserWindow | null): Promise<FileItem[]> {
  const results: FileItem[] = []
  const installedBundleIds = new Set<string>()

  // Collect bundle IDs of installed apps
  for (const appName of safeDirRead('/Applications')) {
    if (!appName.endsWith('.app')) continue
    const plist = path.join('/Applications', appName, 'Contents', 'Info.plist')
    try {
      const { execFileSync } = await import('child_process')
      const out = execFileSync('plutil', ['-extract', 'CFBundleIdentifier', 'raw', '-o', '-', plist], {
        encoding: 'utf8', timeout: 3000
      }).trim()
      if (out) installedBundleIds.add(out.toLowerCase())
    } catch { /* skip */ }
  }

  // Scan support directories for orphaned entries
  const supportDirs = [
    path.join(HOME, 'Library', 'Application Support'),
    path.join(HOME, 'Library', 'Preferences'),
    path.join(HOME, 'Library', 'Containers'),
    path.join(HOME, 'Library', 'Group Containers'),
  ]

  for (const dir of supportDirs) {
    if (!fs.existsSync(dir)) continue
    const entries = safeDirRead(dir)
    for (const entry of entries) {
      if (cancelRequested) break
      // Reverse-domain bundle ID pattern: com.vendor.AppName
      if (!entry.includes('.') || entry.startsWith('.')) continue
      const lentry = entry.toLowerCase()
      // Skip Apple system entries
      if (lentry.startsWith('com.apple.') || lentry.startsWith('apple.')) continue
      // Check if any installed app matches this bundle ID prefix
      const isInstalled = installedBundleIds.has(lentry) ||
        Array.from(installedBundleIds).some((id) => lentry.startsWith(id) || id.startsWith(lentry.split('.').slice(0, 3).join('.')))
      if (isInstalled) continue

      const fullPath = path.join(dir, entry)
      const stat = safeStatSync(fullPath)
      if (!stat) continue
      const size = stat.isDirectory() ? getDirSize(fullPath) : stat.size
      if (size < 512 * 1024) continue

      results.push({
        path: fullPath,
        name: entry,
        size,
        category: 'app-leftovers',
        modifiedAt: stat.mtime.toISOString()
      })
      emitProgress(win, 'app-leftovers', results.length, results.reduce((a, f) => a + f.size, 0), 'scanning')
    }
  }

  results.sort((a, b) => b.size - a.size)
  emitProgress(win, 'app-leftovers', results.length, results.reduce((a, f) => a + f.size, 0), 'done')
  return results
}

// ── Privacy cleanup targets ───────────────────────────────────────────────────
export async function scanPrivacy(win: BrowserWindow | null): Promise<FileItem[]> {
  const results: FileItem[] = []

  const targets = [
    // Safari
    { path: path.join(HOME, 'Library/Safari/History.db'), name: 'Safari History' },
    { path: path.join(HOME, 'Library/Safari/Downloads.plist'), name: 'Safari Downloads List' },
    { path: path.join(HOME, 'Library/Cookies/Cookies.binarycookies'), name: 'Safari Cookies' },
    // Chrome
    { path: path.join(HOME, 'Library/Application Support/Google/Chrome/Default/History'), name: 'Chrome History' },
    { path: path.join(HOME, 'Library/Application Support/Google/Chrome/Default/Cookies'), name: 'Chrome Cookies' },
    // Firefox
    { path: path.join(HOME, 'Library/Application Support/Firefox/Profiles'), name: 'Firefox Profile Data', isDir: true },
    // Recent items
    { path: path.join(HOME, 'Library/Application Support/com.apple.sharedfilelist'), name: 'Recent Items List', isDir: true },
    // Clipboard (no file — managed separately)
  ]

  for (const t of targets) {
    const stat = safeStatSync(t.path)
    if (!stat) continue
    const size = stat.isDirectory() ? getDirSize(t.path) : stat.size
    if (size === 0) continue
    results.push({
      path: t.path,
      name: t.name,
      size,
      category: 'privacy',
      modifiedAt: stat.mtime.toISOString()
    })
  }

  emitProgress(win, 'privacy', results.length, results.reduce((a, f) => a + f.size, 0), 'done')
  return results
}

// ── Login Items / Launch Agents ───────────────────────────────────────────────
export async function getStartupItems(): Promise<import('../shared/types').StartupItem[]> {
  const items: import('../shared/types').StartupItem[] = []

  const launchAgentDirs = [
    path.join(HOME, 'Library', 'LaunchAgents'),
    '/Library/LaunchAgents',
    '/Library/LaunchDaemons',
  ]

  for (const dir of launchAgentDirs) {
    if (!fs.existsSync(dir)) continue
    const isDaemon = dir.includes('LaunchDaemons')
    for (const file of safeDirRead(dir)) {
      if (!file.endsWith('.plist')) continue
      const fullPath = path.join(dir, file)
      items.push({
        name: file.replace(/\.plist$/, ''),
        path: fullPath,
        type: isDaemon ? 'launch-daemon' : 'launch-agent',
        enabled: true,
        bundleId: file.replace(/\.plist$/, '')
      })
    }
  }

  return items
}

export async function findDuplicates(
  searchPaths: string[],
  win: BrowserWindow | null
): Promise<DuplicateGroup[]> {
  const sizeMap = new Map<number, string[]>()

  function collectFiles(dirPath: string): void {
    walkDir(dirPath, 8, 0, (filePath, stat) => {
      if (stat.size < 102400) return
      const bucket = sizeMap.get(stat.size) ?? []
      bucket.push(filePath)
      sizeMap.set(stat.size, bucket)
    })
  }

  for (const p of searchPaths) {
    if (fs.existsSync(p)) collectFiles(p)
  }

  const candidates = Array.from(sizeMap.values()).filter((arr) => arr.length > 1)

  const hashMap = new Map<string, FileItem[]>()
  let processed = 0

  for (const group of candidates) {
    for (const filePath of group) {
      if (cancelRequested) break
      try {
        const content = fs.readFileSync(filePath)
        const hash = crypto.createHash('md5').update(content).digest('hex')
        const stat = safeStatSync(filePath)!
        const key = `${stat.size}:${hash}`
        const bucket = hashMap.get(key) ?? []
        bucket.push({
          path: filePath,
          name: path.basename(filePath),
          size: stat.size,
          category: 'duplicates',
          modifiedAt: stat.mtime.toISOString()
        })
        hashMap.set(key, bucket)
      } catch {
        // skip unreadable files
      }
      processed++
      emitScanFile(win, filePath)
    }
  }

  const groups: DuplicateGroup[] = []
  for (const [key, files] of hashMap) {
    if (files.length < 2) continue
    const [, hash] = key.split(':')
    groups.push({
      hash,
      size: files[0].size,
      count: files.length,
      files,
      totalWaste: files[0].size * (files.length - 1)
    })
  }

  groups.sort((a, b) => b.totalWaste - a.totalWaste)

  win?.webContents.send('scan:progress', {
    category: 'duplicates',
    found: groups.length,
    size: groups.reduce((a, g) => a + g.totalWaste, 0),
    status: 'done'
  })

  return groups
}
