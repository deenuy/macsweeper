import fs from 'fs'
import path from 'path'
import os from 'os'
import https from 'https'
import http from 'http'
import { execFileSync } from 'child_process'
import { BrowserWindow } from 'electron'
import type { FileItem } from '../shared/types'

const HOME = os.homedir()

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

// ── Helpers ──────────────────────────────────────────────────────────────────

function safeStatSync(p: string): fs.Stats | null {
  try { return fs.statSync(p) } catch { return null }
}

function safeDirRead(p: string): string[] {
  try { return fs.readdirSync(p) } catch { return [] }
}

function getDirSize(dirPath: string): number {
  let total = 0
  function walk(d: string, depth: number) {
    if (depth > 15) return
    try {
      for (const e of fs.readdirSync(d)) {
        const full = path.join(d, e)
        try {
          const s = fs.lstatSync(full)
          if (s.isDirectory()) walk(full, depth + 1)
          else total += s.size
        } catch { /* skip */ }
      }
    } catch { /* skip */ }
  }
  walk(dirPath, 0)
  return total
}

function plistToJson(plistPath: string): Record<string, unknown> {
  try {
    const out = execFileSync('plutil', ['-convert', 'json', '-o', '-', plistPath], {
      encoding: 'utf8', timeout: 3000
    })
    return JSON.parse(out)
  } catch { return {} }
}

function fetchUrl(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http
    const req = mod.get(url, { timeout: 8000 }, (res) => {
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        fetchUrl(res.headers.location).then(resolve).catch(reject)
        return
      }
      let body = ''
      res.on('data', (chunk: Buffer) => { body += chunk.toString() })
      res.on('end', () => resolve(body))
      res.on('error', reject)
    })
    req.on('error', reject)
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')) })
  })
}

function versionGt(a: string, b: string): boolean {
  const pa = a.replace(/[^0-9.]/g, '').split('.').map(Number)
  const pb = b.replace(/[^0-9.]/g, '').split('.').map(Number)
  const len = Math.max(pa.length, pb.length)
  for (let i = 0; i < len; i++) {
    const va = pa[i] ?? 0
    const vb = pb[i] ?? 0
    if (va > vb) return true
    if (va < vb) return false
  }
  return false
}

// ── App enumeration ──────────────────────────────────────────────────────────

const APP_DIRS = ['/Applications', path.join(HOME, 'Applications')]

export async function scanInstalledApps(win: BrowserWindow | null): Promise<InstalledApp[]> {
  const apps: InstalledApp[] = []

  for (const dir of APP_DIRS) {
    if (!fs.existsSync(dir)) continue
    const entries = safeDirRead(dir)

    for (const entry of entries) {
      if (!entry.endsWith('.app')) continue
      const appPath = path.join(dir, entry)
      const plistPath = path.join(appPath, 'Contents', 'Info.plist')
      if (!fs.existsSync(plistPath)) continue

      try {
        const info = plistToJson(plistPath)
        const bundleId = (info.CFBundleIdentifier as string) ?? ''
        const version = (info.CFBundleShortVersionString as string)
          ?? (info.CFBundleVersion as string) ?? '0'
        const displayName = (info.CFBundleDisplayName as string)
          ?? (info.CFBundleName as string) ?? entry.replace(/\.app$/, '')
        const sparkleUrl = (info.SUFeedURL as string) ?? ''
        const isMAS = fs.existsSync(path.join(appPath, 'Contents', '_MASReceipt', 'receipt'))

        // Size: use du for faster result
        let size = 0
        try {
          const duOut = execFileSync('du', ['-sk', appPath], { encoding: 'utf8', timeout: 10000 })
          size = parseInt(duOut.split('\t')[0]) * 1024
        } catch {
          size = getDirSize(appPath)
        }

        // Last used via mdls
        let lastUsed: string | undefined
        try {
          const mdlsOut = execFileSync('mdls', ['-name', 'kMDItemLastUsedDate', '-raw', appPath], {
            encoding: 'utf8', timeout: 3000
          }).trim()
          if (mdlsOut && mdlsOut !== '(null)') lastUsed = mdlsOut
        } catch { /* ok */ }

        apps.push({
          name: displayName,
          path: appPath,
          bundleId,
          version,
          size,
          isMAS,
          sparkleUrl: sparkleUrl || undefined,
          lastUsed
        })

        win?.webContents.send('apps:scanProgress', { phase: 'apps', found: apps.length })
      } catch { /* skip malformed app */ }
    }
  }

  apps.sort((a, b) => b.size - a.size)
  return apps
}

// ── Leftover locations for a single app ──────────────────────────────────────

const LEFTOVER_DIRS_USER: Array<[string, 'dir' | 'prefix' | 'exact']> = [
  [path.join(HOME, 'Library', 'Application Support'), 'dir'],
  [path.join(HOME, 'Library', 'Preferences'), 'prefix'],
  [path.join(HOME, 'Library', 'Caches'), 'dir'],
  [path.join(HOME, 'Library', 'Containers'), 'dir'],
  [path.join(HOME, 'Library', 'Group Containers'), 'dir'],
  [path.join(HOME, 'Library', 'Saved Application State'), 'prefix'],
  [path.join(HOME, 'Library', 'Cookies'), 'prefix'],
  [path.join(HOME, 'Library', 'WebKit'), 'dir'],
  [path.join(HOME, 'Library', 'HTTPStorages'), 'dir'],
  [path.join(HOME, 'Library', 'Logs'), 'dir'],
]

const LEFTOVER_DIRS_SYSTEM: Array<[string, 'dir' | 'prefix']> = [
  ['/Library/Application Support', 'dir'],
  ['/Library/LaunchAgents', 'prefix'],
  ['/Library/LaunchDaemons', 'prefix'],
  ['/Library/Preferences', 'prefix'],
  ['/var/db/receipts', 'prefix'],
]

function matchesApp(entry: string, bundleId: string, appName: string): boolean {
  const lentry = entry.toLowerCase()
  const lid = bundleId.toLowerCase()
  const lname = appName.toLowerCase().replace(/\s+/g, '')

  if (lid && (lentry === lid || lentry.startsWith(lid + '.') || lentry.startsWith(lid + '-'))) return true
  if (lid && lentry.includes(lid)) return true

  // Group containers: "TEAMID.bundleId" or "*.group.bundleId"
  if (lid) {
    const parts = lid.split('.')
    const reverseDomain = parts.slice(0, 3).join('.')
    if (lentry.endsWith('.' + reverseDomain) || lentry.includes('.' + lid)) return true
  }

  // Name-based fallback for common patterns
  if (lname.length >= 4 && lentry.replace(/[^a-z]/g, '').includes(lname)) return true

  return false
}

export async function getAppLeftovers(bundleId: string, appName: string): Promise<FileItem[]> {
  const files: FileItem[] = []

  function addIfExists(p: string) {
    const stat = safeStatSync(p)
    if (!stat) return
    const size = stat.isDirectory() ? getDirSize(p) : stat.size
    if (size === 0) return
    files.push({
      path: p,
      name: path.basename(p),
      size,
      category: 'app-leftovers',
      modifiedAt: stat.mtime.toISOString()
    })
  }

  // User-level locations
  for (const [dir, mode] of LEFTOVER_DIRS_USER) {
    if (!fs.existsSync(dir)) continue
    if (mode === 'dir') {
      for (const entry of safeDirRead(dir)) {
        if (matchesApp(entry, bundleId, appName)) addIfExists(path.join(dir, entry))
      }
    } else if (mode === 'prefix') {
      for (const entry of safeDirRead(dir)) {
        if (matchesApp(entry, bundleId, appName)) addIfExists(path.join(dir, entry))
      }
    }
  }

  // System-level locations (may be empty without root, safe to try)
  for (const [dir, mode] of LEFTOVER_DIRS_SYSTEM) {
    if (!fs.existsSync(dir)) continue
    if (mode === 'dir' || mode === 'prefix') {
      for (const entry of safeDirRead(dir)) {
        if (matchesApp(entry, bundleId, appName)) addIfExists(path.join(dir, entry))
      }
    }
  }

  // Spotlight-based search for any remaining traces
  if (bundleId) {
    try {
      const mdfindOut = execFileSync(
        'mdfind',
        ['-name', bundleId, '-onlyin', HOME],
        { encoding: 'utf8', timeout: 5000 }
      )
      for (const p of mdfindOut.split('\n').filter(Boolean)) {
        if (files.some(f => p.startsWith(f.path))) continue
        const stat = safeStatSync(p)
        if (!stat || stat.isDirectory()) continue
        const size = stat.size
        if (size < 1024) continue
        files.push({
          path: p,
          name: path.basename(p),
          size,
          category: 'app-leftovers',
          modifiedAt: stat.mtime.toISOString()
        })
      }
    } catch { /* mdfind timeout is acceptable */ }
  }

  // Deduplicate by path
  const seen = new Set<string>()
  return files.filter(f => {
    if (seen.has(f.path)) return false
    seen.add(f.path)
    return true
  })
}

// ── Uninstall ─────────────────────────────────────────────────────────────────

export async function uninstallApp(
  appPath: string,
  bundleId: string,
  appName: string,
  removeLeftovers: boolean
): Promise<{ trashed: string[]; failed: string[] }> {
  const { shell } = await import('electron')
  const trashed: string[] = []
  const failed: string[] = []

  async function trash(p: string) {
    try {
      await shell.trashItem(p)
      trashed.push(p)
    } catch (err) {
      failed.push(p)
    }
  }

  await trash(appPath)

  if (removeLeftovers) {
    const leftovers = await getAppLeftovers(bundleId, appName)
    for (const f of leftovers) {
      await trash(f.path)
    }
  }

  return { trashed, failed }
}

// ── App Updater ───────────────────────────────────────────────────────────────

function parseSparkleVersion(xml: string): { version: string; shortVersion: string; url: string } | null {
  // Extract first <item> block
  const itemMatch = xml.match(/<item[\s\S]*?<\/item>/i)
  if (!itemMatch) return null
  const item = itemMatch[0]

  // sparkle:shortVersionString or sparkle:version in <enclosure>
  const enclosureMatch = item.match(/<enclosure[^>]+>/i)
  if (!enclosureMatch) return null
  const enclosure = enclosureMatch[0]

  const sv = enclosure.match(/sparkle:shortVersionString="([^"]+)"/i)?.[1]
    ?? enclosure.match(/sparkle:version="([^"]+)"/i)?.[1] ?? ''
  const v = enclosure.match(/sparkle:version="([^"]+)"/i)?.[1] ?? sv
  const url = enclosure.match(/url="([^"]+)"/i)?.[1] ?? ''

  if (!sv && !v) return null
  return { version: v, shortVersion: sv || v, url }
}

async function checkSparkleUpdate(app: InstalledApp): Promise<AppUpdate | null> {
  if (!app.sparkleUrl) return null
  try {
    const xml = await fetchUrl(app.sparkleUrl)
    const parsed = parseSparkleVersion(xml)
    if (!parsed) return null
    const latest = parsed.shortVersion || parsed.version
    if (versionGt(latest, app.version)) {
      return { app, latestVersion: latest, updateUrl: parsed.url, source: 'sparkle' }
    }
    return null
  } catch { return null }
}

async function checkMASUpdate(app: InstalledApp): Promise<AppUpdate | null> {
  if (!app.isMAS || !app.bundleId) return null
  try {
    const url = `https://itunes.apple.com/lookup?bundleId=${encodeURIComponent(app.bundleId)}`
    const body = await fetchUrl(url)
    const data = JSON.parse(body) as { resultCount: number; results: Array<{ version: string }> }
    if (data.resultCount < 1) return null
    const latest = data.results[0].version
    if (versionGt(latest, app.version)) {
      return {
        app,
        latestVersion: latest,
        updateUrl: `https://apps.apple.com/app/id${app.bundleId}`,
        source: 'mas'
      }
    }
    return null
  } catch { return null }
}

export async function checkAppUpdates(
  apps: InstalledApp[],
  win: BrowserWindow | null
): Promise<AppUpdate[]> {
  const updates: AppUpdate[] = []
  let checked = 0

  // Check in batches of 5 to avoid hammering network
  const batch = 5
  for (let i = 0; i < apps.length; i += batch) {
    const chunk = apps.slice(i, i + batch)
    const results = await Promise.allSettled(
      chunk.map(app => app.isMAS ? checkMASUpdate(app) : checkSparkleUpdate(app))
    )
    for (const r of results) {
      if (r.status === 'fulfilled' && r.value) updates.push(r.value)
    }
    checked += chunk.length
    win?.webContents.send('apps:updateProgress', { checked, total: apps.length })
  }

  return updates
}

// ── Orphaned leftovers (File Leftovers tab) ───────────────────────────────────

export async function scanOrphanedLeftovers(win: BrowserWindow | null): Promise<LeftoverGroup[]> {
  // Build set of installed bundle IDs
  const installed = new Map<string, string>() // bundleId -> appName
  for (const dir of APP_DIRS) {
    if (!fs.existsSync(dir)) continue
    for (const entry of safeDirRead(dir)) {
      if (!entry.endsWith('.app')) continue
      const plistPath = path.join(dir, entry, 'Contents', 'Info.plist')
      if (!fs.existsSync(plistPath)) continue
      try {
        const info = plistToJson(plistPath)
        const id = ((info.CFBundleIdentifier as string) ?? '').toLowerCase()
        const name = (info.CFBundleDisplayName as string)
          ?? (info.CFBundleName as string) ?? entry.replace(/\.app$/, '')
        if (id) installed.set(id, name)
      } catch { /* skip */ }
    }
  }

  // Collect orphaned entries grouped by apparent app
  const orphans = new Map<string, { bundleId: string; appName: string; files: FileItem[] }>()

  const SCAN_DIRS: Array<{ dir: string }> = [
    { dir: path.join(HOME, 'Library', 'Application Support') },
    { dir: path.join(HOME, 'Library', 'Containers') },
    { dir: path.join(HOME, 'Library', 'Group Containers') },
    { dir: path.join(HOME, 'Library', 'Caches') },
    { dir: path.join(HOME, 'Library', 'Saved Application State') },
    { dir: path.join(HOME, 'Library', 'WebKit') },
    { dir: path.join(HOME, 'Library', 'HTTPStorages') },
    { dir: path.join(HOME, 'Library', 'Preferences') },
  ]

  let scanned = 0

  for (const { dir } of SCAN_DIRS) {
    if (!fs.existsSync(dir)) continue
    const entries = safeDirRead(dir)

    for (const entry of entries) {
      if (entry.startsWith('.')) continue
      // Must look like a reverse-domain bundle ID
      if (!entry.includes('.')) continue

      const lentry = entry.toLowerCase()

      // Skip Apple system entries
      if (lentry.startsWith('com.apple.') || lentry.startsWith('apple.')) continue
      if (lentry.startsWith('com.microsoft.') && lentry.includes('office')) continue // MAS, likely installed

      // Determine the bundle-ID prefix (first 3 segments: com.vendor.app)
      const segments = lentry.replace(/\.(savedstate|plist|binarycookies)$/i, '').split('.')
      const key = segments.slice(0, Math.min(segments.length, 4)).join('.')

      // Check if any installed app matches
      const isInstalled = Array.from(installed.keys()).some(id =>
        id === key || id.startsWith(key + '.') || key.startsWith(id + '.') || id === lentry.replace(/\.plist$/i, '')
      )
      if (isInstalled) continue

      const fullPath = path.join(dir, entry)
      const stat = safeStatSync(fullPath)
      if (!stat) continue
      const size = stat.isDirectory() ? getDirSize(fullPath) : stat.size
      if (size < 512 * 1024) continue // ignore < 512 KB

      const group = orphans.get(key) ?? { bundleId: key, appName: guessAppName(key), files: [] }
      group.files.push({
        path: fullPath,
        name: entry,
        size,
        category: 'app-leftovers',
        modifiedAt: stat.mtime.toISOString()
      })
      orphans.set(key, group)

      scanned++
      if (scanned % 20 === 0) {
        win?.webContents.send('apps:leftoverProgress', { scanned, groups: orphans.size })
      }
    }
  }

  // Also scan launch agents/daemons
  const launchDirs = [
    path.join(HOME, 'Library', 'LaunchAgents'),
    '/Library/LaunchAgents',
    '/Library/LaunchDaemons',
  ]
  for (const dir of launchDirs) {
    if (!fs.existsSync(dir)) continue
    for (const entry of safeDirRead(dir)) {
      if (!entry.endsWith('.plist')) continue
      const lentry = entry.toLowerCase().replace(/\.plist$/, '')
      if (lentry.startsWith('com.apple.')) continue
      const isInstalled = Array.from(installed.keys()).some(id => lentry.startsWith(id))
      if (isInstalled) continue

      const fullPath = path.join(dir, entry)
      const stat = safeStatSync(fullPath)
      if (!stat) continue
      const key = lentry.split('.').slice(0, 4).join('.')
      const group = orphans.get(key) ?? { bundleId: key, appName: guessAppName(key), files: [] }
      group.files.push({
        path: fullPath,
        name: entry,
        size: stat.size,
        category: 'app-leftovers',
        modifiedAt: stat.mtime.toISOString()
      })
      orphans.set(key, group)
    }
  }

  const result: LeftoverGroup[] = Array.from(orphans.values()).map(g => ({
    appName: g.appName,
    bundleId: g.bundleId,
    totalSize: g.files.reduce((a, f) => a + f.size, 0),
    files: g.files
  }))

  result.sort((a, b) => b.totalSize - a.totalSize)
  win?.webContents.send('apps:leftoverProgress', { scanned, groups: result.length })
  return result
}

function guessAppName(bundleId: string): string {
  const parts = bundleId.split('.')
  // com.vendor.AppName -> AppName
  const candidate = parts[parts.length - 1] ?? bundleId
  // CamelCase split and capitalize
  return candidate
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/^./, s => s.toUpperCase())
    || bundleId
}
