import fs from 'fs'
import path from 'path'
import os from 'os'
import { execFileSync, execSync } from 'child_process'
import type { InstalledApp, AppLeftoverGroup, FileItem, AppUpdate } from '../shared/types'

const HOME = os.homedir()

// ── Utilities ────────────────────────────────────────────────────────────────

function safeExec(cmd: string, args: string[], timeout = 6000): string {
  try {
    return execFileSync(cmd, args, {
      encoding: 'utf8',
      timeout,
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim()
  } catch {
    return ''
  }
}

function readPlistJson(plistPath: string): Record<string, unknown> {
  try {
    const raw = safeExec('plutil', ['-convert', 'json', '-o', '-', plistPath], 4000)
    return raw ? (JSON.parse(raw) as Record<string, unknown>) : {}
  } catch {
    return {}
  }
}

function safeStatSync(p: string): fs.Stats | null {
  try {
    return fs.lstatSync(p)
  } catch {
    return null
  }
}

function safeDirRead(p: string): string[] {
  try {
    return fs.readdirSync(p)
  } catch {
    return []
  }
}

// Fast size via du -sk (much faster than walking for large app bundles)
function getDirSizeSafe(dirPath: string): number {
  try {
    const out = execSync(`du -sk "${dirPath.replace(/"/g, '\\"')}" 2>/dev/null`, {
      encoding: 'utf8',
      timeout: 20000,
    })
    const kb = parseInt(out.split('\t')[0])
    return isNaN(kb) ? 0 : kb * 1024
  } catch {
    return 0
  }
}

// Bulk size computation — one du invocation for all paths
function getSizesInBulk(paths: string[]): Map<string, number> {
  const map = new Map<string, number>()
  if (paths.length === 0) return map
  const escaped = paths.map(p => `"${p.replace(/"/g, '\\"')}"`).join(' ')
  try {
    const out = execSync(`du -sk ${escaped} 2>/dev/null`, { encoding: 'utf8', timeout: 120000 })
    for (const line of out.trim().split('\n')) {
      const tab = line.indexOf('\t')
      if (tab === -1) continue
      const kb = parseInt(line.substring(0, tab))
      const p = line.substring(tab + 1).trim()
      if (!isNaN(kb)) map.set(p, kb * 1024)
    }
  } catch {
    /* ignore — some apps may error, rest succeed */
  }
  return map
}

function compareVersions(a: string, b: string): number {
  const parts = (v: string) =>
    v
      .replace(/^v/i, '')
      .split(/[.\-]/)
      .map(p => parseInt(p, 10))
      .filter(n => !isNaN(n))
  const pa = parts(a)
  const pb = parts(b)
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const na = pa[i] ?? 0
    const nb = pb[i] ?? 0
    if (na > nb) return 1
    if (na < nb) return -1
  }
  return 0
}

// ── App Enumeration ──────────────────────────────────────────────────────────

function enumerateAppPaths(): string[] {
  const result: string[] = []
  const roots = ['/Applications', path.join(HOME, 'Applications')]
  for (const root of roots) {
    for (const entry of safeDirRead(root)) {
      const full = path.join(root, entry)
      if (entry.endsWith('.app')) {
        result.push(full)
      } else if (!entry.startsWith('.')) {
        // One level deep (e.g., /Applications/Utilities)
        const stat = safeStatSync(full)
        if (stat?.isDirectory()) {
          for (const sub of safeDirRead(full)) {
            if (sub.endsWith('.app')) result.push(path.join(full, sub))
          }
        }
      }
    }
  }
  return result
}

export function getInstalledApps(): InstalledApp[] {
  const appPaths = enumerateAppPaths()
  const results: InstalledApp[] = []

  for (const appPath of appPaths) {
    const plistPath = path.join(appPath, 'Contents', 'Info.plist')
    if (!fs.existsSync(plistPath)) continue

    const plist = readPlistJson(plistPath)
    const bundleId = (plist.CFBundleIdentifier as string) || ''
    if (!bundleId) continue

    const name = path.basename(appPath).replace(/\.app$/, '')
    const version =
      (plist.CFBundleShortVersionString as string) ||
      (plist.CFBundleVersion as string) ||
      '—'
    const isMAS = fs.existsSync(path.join(appPath, 'Contents', '_MASReceipt', 'receipt'))
    const sparkleUrl = !isMAS ? (plist.SUFeedURL as string) || '' : ''
    const stat = safeStatSync(appPath)

    results.push({
      name,
      path: appPath,
      bundleId,
      version,
      size: 0, // populated below via bulk du
      isMAS,
      sparkleUrl: sparkleUrl || undefined,
      modifiedAt: stat?.mtime.toISOString() ?? '',
    })
  }

  // Compute all app sizes in one bulk du invocation
  const sizeMap = getSizesInBulk(results.map(a => a.path))
  for (const app of results) {
    app.size = sizeMap.get(app.path) ?? 0
  }

  return results.sort((a, b) => a.name.localeCompare(b.name))
}

export function getAppSize(appPath: string): number {
  return getDirSizeSafe(appPath)
}

// ── Leftover Detection for a Specific App ────────────────────────────────────

export function findLeftoversForApp(bundleId: string, appName: string): FileItem[] {
  const leftovers: FileItem[] = []
  const seen = new Set<string>()

  // All standard macOS paths where an app can leave files
  const candidates: string[] = [
    // Application Support (by bundle ID and by name)
    path.join(HOME, 'Library', 'Application Support', bundleId),
    path.join(HOME, 'Library', 'Application Support', appName),
    // Preferences
    path.join(HOME, 'Library', 'Preferences', `${bundleId}.plist`),
    path.join(HOME, 'Library', 'Preferences', `${bundleId}.LSSharedFileList.plist`),
    // Caches
    path.join(HOME, 'Library', 'Caches', bundleId),
    path.join(HOME, 'Library', 'Caches', appName),
    // Sandboxed container
    path.join(HOME, 'Library', 'Containers', bundleId),
    // Saved window state
    path.join(HOME, 'Library', 'Saved Application State', `${bundleId}.savedState`),
    // WKWebView storage
    path.join(HOME, 'Library', 'HTTPStorages', bundleId),
    // WebKit data
    path.join(HOME, 'Library', 'WebKit', bundleId),
    // Application Scripts (Automation)
    path.join(HOME, 'Library', 'Application Scripts', bundleId),
    // Logs
    path.join(HOME, 'Library', 'Logs', appName),
    path.join(HOME, 'Library', 'Logs', bundleId),
    // Per-user LaunchAgent
    path.join(HOME, 'Library', 'LaunchAgents', `${bundleId}.plist`),
    // Cookies
    path.join(HOME, 'Library', 'Cookies', `${bundleId}.binarycookies`),
    // System-level (readable, deletion may require auth)
    `/Library/Application Support/${appName}`,
    `/Library/Application Support/${bundleId}`,
    `/Library/LaunchAgents/${bundleId}.plist`,
    `/Library/LaunchDaemons/${bundleId}.plist`,
    `/Library/PrivilegedHelperTools/${bundleId}`,
    `/Library/PrivilegedHelperTools/${bundleId}.helper`,
    // Package receipts
    `/var/db/receipts/${bundleId}.bom`,
    `/var/db/receipts/${bundleId}.plist`,
  ]

  // Group Containers — entries containing this bundle ID
  const groupContainersDir = path.join(HOME, 'Library', 'Group Containers')
  for (const entry of safeDirRead(groupContainersDir)) {
    const el = entry.toLowerCase()
    if (el.includes(bundleId.toLowerCase())) {
      candidates.push(path.join(groupContainersDir, entry))
    }
  }

  // Spotlight-based discovery inside ~/Library
  try {
    const safe = bundleId.replace(/'/g, "'\\''")
    const mdfindOut = execSync(
      `mdfind -onlyin "${HOME}/Library" "kMDItemCFBundleIdentifier == '${safe}'" 2>/dev/null`,
      { encoding: 'utf8', timeout: 8000 }
    ).trim()
    if (mdfindOut) {
      for (const p of mdfindOut.split('\n')) {
        if (p && !candidates.includes(p)) candidates.push(p)
      }
    }
  } catch {
    /* Spotlight unavailable */
  }

  for (const candidate of candidates) {
    if (!candidate || seen.has(candidate)) continue
    seen.add(candidate)

    const stat = safeStatSync(candidate)
    if (!stat) continue

    const size = stat.isDirectory() ? getDirSizeSafe(candidate) : stat.size

    leftovers.push({
      path: candidate,
      name: path.basename(candidate),
      size,
      category: 'app-leftovers',
      modifiedAt: stat.mtime.toISOString(),
    })
  }

  return leftovers.sort((a, b) => b.size - a.size)
}

// ── Orphaned File Leftovers Scanner ──────────────────────────────────────────

// Checks if an entry in a Library dir belongs to any currently installed app
function isMatchedByInstalled(entry: string, installedIds: Set<string>): boolean {
  const base = entry
    .toLowerCase()
    .replace(/\.(plist|savedstate|binarycookies|lockfile)$/i, '')
    .replace(/^group\./i, '')
    .split(' ')[0] // strip trailing descriptors

  if (!base.includes('.')) return true // Not a bundle-ID-like name — skip
  if (base.startsWith('com.apple.') || base.startsWith('apple.')) return true // System

  for (const id of installedIds) {
    const lid = id.toLowerCase()
    if (base === lid) return true
    if (base.startsWith(lid + '.') || lid.startsWith(base + '.')) return true
  }
  return false
}

export function scanFileLeftovers(installedBundleIds: Set<string>): AppLeftoverGroup[] {
  const groups = new Map<string, { paths: string[]; totalSize: number; displayName: string }>()

  const processDir = (dir: string) => {
    for (const entry of safeDirRead(dir)) {
      if (entry.startsWith('.')) continue
      const fullPath = path.join(dir, entry)
      const stat = safeStatSync(fullPath)
      if (!stat) continue

      if (isMatchedByInstalled(entry, installedBundleIds)) continue

      // Must look like a reverse-domain bundle ID (at minimum 2 dots)
      const base = entry
        .toLowerCase()
        .replace(/\.(plist|savedstate|binarycookies|lockfile)$/i, '')
        .replace(/^group\./i, '')
      if ((base.match(/\./g) || []).length < 1) continue

      const size = stat.isDirectory() ? getDirSizeSafe(fullPath) : stat.size
      if (size < 256 * 1024) continue // Skip tiny remnants (< 256 KB)

      const parts = base.split('.')
      const displayName =
        parts.length >= 3
          ? parts
              .slice(2)
              .map(p => p.charAt(0).toUpperCase() + p.slice(1))
              .join(' ')
          : base

      const existing = groups.get(base) ?? { paths: [], totalSize: 0, displayName }
      existing.paths.push(fullPath)
      existing.totalSize += size
      groups.set(base, existing)
    }
  }

  const dirsToScan = [
    path.join(HOME, 'Library', 'Application Support'),
    path.join(HOME, 'Library', 'Preferences'),
    path.join(HOME, 'Library', 'Caches'),
    path.join(HOME, 'Library', 'Containers'),
    path.join(HOME, 'Library', 'Group Containers'),
    path.join(HOME, 'Library', 'Saved Application State'),
    path.join(HOME, 'Library', 'HTTPStorages'),
    path.join(HOME, 'Library', 'WebKit'),
    path.join(HOME, 'Library', 'LaunchAgents'),
    path.join(HOME, 'Library', 'Logs'),
  ]

  for (const dir of dirsToScan) {
    if (fs.existsSync(dir)) processDir(dir)
  }

  const result: AppLeftoverGroup[] = []
  for (const [bundleId, data] of groups) {
    if (data.paths.length === 0) continue
    result.push({
      appName: data.displayName,
      bundleId,
      paths: data.paths,
      totalSize: data.totalSize,
    })
  }

  return result.sort((a, b) => b.totalSize - a.totalSize)
}

// ── Sparkle Update Check ─────────────────────────────────────────────────────

function fetchUrl(url: string, timeoutMs = 8000): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const https = require('https') as typeof import('https')
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const http = require('http') as typeof import('http')
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http
    const req = mod.get(url, { timeout: timeoutMs }, res => {
      // Follow one redirect
      if (
        (res.statusCode ?? 0) >= 300 &&
        (res.statusCode ?? 0) < 400 &&
        res.headers.location
      ) {
        fetchUrl(res.headers.location as string, timeoutMs).then(resolve).catch(reject)
        return
      }
      let data = ''
      res.setEncoding('utf8')
      res.on('data', chunk => {
        data += chunk
        if (data.length > 512 * 1024) req.destroy() // Cap at 512 KB
      })
      res.on('end', () => resolve(data))
    })
    req.on('error', reject)
    req.on('timeout', () => {
      req.destroy()
      reject(new Error('timeout'))
    })
    setTimeout(() => {
      req.destroy()
      reject(new Error('timeout'))
    }, timeoutMs)
  })
}

function parseSparkleLatest(
  xml: string
): { version: string; shortVersion: string; downloadUrl: string } | null {
  // Sparkle appcast: grab first item's version attributes
  const shortV =
    xml.match(/sparkle:shortVersionString="([^"]+)"/i)?.[1] ??
    xml.match(/<sparkle:shortVersionString>([^<]+)<\/sparkle:shortVersionString>/i)?.[1]
  const v =
    xml.match(/sparkle:version="([^"]+)"/i)?.[1] ??
    xml.match(/<sparkle:version>([^<]+)<\/sparkle:version>/i)?.[1]
  const urlMatch = xml.match(/<enclosure[^>]+url="([^"]+)"/i)

  const version = shortV ?? v
  if (!version) return null

  return {
    version,
    shortVersion: shortV ?? version,
    downloadUrl: urlMatch?.[1] ?? '',
  }
}

export async function checkAppUpdates(apps: InstalledApp[]): Promise<AppUpdate[]> {
  const sparkleApps = apps.filter(a => !a.isMAS && a.sparkleUrl)

  const settled = await Promise.allSettled(
    sparkleApps.map(async app => {
      try {
        const xml = await fetchUrl(app.sparkleUrl!, 8000)
        const latest = parseSparkleLatest(xml)
        if (!latest) return null
        if (compareVersions(latest.version, app.version) > 0) {
          const update: AppUpdate = {
            bundleId: app.bundleId,
            appName: app.name,
            currentVersion: app.version,
            latestVersion: latest.version,
            downloadUrl: latest.downloadUrl || undefined,
            isMAS: false,
          }
          return update
        }
        return null
      } catch {
        return null
      }
    })
  )

  const updates: AppUpdate[] = []
  for (const r of settled) {
    if (r.status === 'fulfilled' && r.value) updates.push(r.value)
  }

  return updates
}

// ── Combined Scan (all three features in one call) ───────────────────────────

export async function scanApplications(): Promise<{
  installed: InstalledApp[]
  updates: AppUpdate[]
  leftovers: AppLeftoverGroup[]
}> {
  const installed = getInstalledApps()
  const installedIds = new Set(installed.map(a => a.bundleId))

  const [updates, leftovers] = await Promise.all([
    checkAppUpdates(installed),
    Promise.resolve(scanFileLeftovers(installedIds)),
  ])

  return { installed, updates, leftovers }
}
