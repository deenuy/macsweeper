import { shell } from 'electron'
import fs from 'fs'
import type { BrowserWindow } from 'electron'
import type { InstalledApp, AppUpdate, AppLeftoverGroup, FileItem } from '../shared/types'
import {
  getInstalledApps,
  scanFileLeftovers,
  findLeftoversForApp,
  checkAppUpdates as checkUpdatesCore,
} from './apps'

// ── Combined scan: installed apps + orphaned leftovers + Sparkle updates ─────

export async function scanInstalledApps(win: BrowserWindow | null): Promise<{
  installed: InstalledApp[]
  updates: AppUpdate[]
  leftovers: AppLeftoverGroup[]
}> {
  win?.webContents.send('apps:progress', { phase: 'apps', status: 'scanning' })

  const installed = getInstalledApps()
  const installedIds = new Set(installed.map(a => a.bundleId))

  win?.webContents.send('apps:progress', { phase: 'leftovers', status: 'scanning' })
  const leftovers = scanFileLeftovers(installedIds)

  win?.webContents.send('apps:progress', { phase: 'updates', status: 'scanning' })
  const updates = await checkUpdatesCore(installed)

  win?.webContents.send('apps:progress', { phase: 'done', status: 'done' })
  return { installed, updates, leftovers }
}

// ── Leftover files for a specific app (for the uninstaller detail panel) ─────

export function getAppLeftovers(bundleId: string, appName: string): FileItem[] {
  return findLeftoversForApp(bundleId, appName)
}

// ── Orphaned leftover scan (standalone) ──────────────────────────────────────

export function scanOrphanedLeftovers(_win: BrowserWindow | null): AppLeftoverGroup[] {
  const installed = getInstalledApps()
  const installedIds = new Set(installed.map(a => a.bundleId))
  return scanFileLeftovers(installedIds)
}

// ── Update check (standalone) ─────────────────────────────────────────────────

export async function checkAppUpdates(
  apps: InstalledApp[],
  _win: BrowserWindow | null
): Promise<AppUpdate[]> {
  return checkUpdatesCore(apps)
}

// ── Uninstall: move app bundle + optional leftovers to Trash ─────────────────

export async function uninstallApp(
  appPath: string,
  bundleId: string,
  appName: string,
  removeLeftovers: boolean
): Promise<{ trashed: string[]; failed: { path: string; reason: string }[] }> {
  const pathsToTrash: string[] = []

  if (fs.existsSync(appPath)) pathsToTrash.push(appPath)

  if (removeLeftovers) {
    const leftovers = findLeftoversForApp(bundleId, appName)
    for (const f of leftovers) {
      if (fs.existsSync(f.path) && f.path !== appPath) {
        pathsToTrash.push(f.path)
      }
    }
  }

  const trashed: string[] = []
  const failed: { path: string; reason: string }[] = []

  for (const p of pathsToTrash) {
    try {
      await shell.trashItem(p)
      trashed.push(p)
    } catch (err) {
      failed.push({
        path: p,
        reason: err instanceof Error ? err.message : String(err),
      })
    }
  }

  return { trashed, failed }
}
