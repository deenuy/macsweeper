import { ipcMain, BrowserWindow, shell, dialog } from 'electron'
import {
  startGmailAuth, getConnectedAccounts, disconnectAccount,
  scanEmailsByRules, deleteEmails, getCredentialsPath, hasCredentials
} from './gmail'
import type { ScanRule } from './gmail'
import {
  scanLanguageFiles,
  scanUserCache,
  scanLogs,
  scanMailAttachments,
  scanDownloadsJunk,
  scanDsStore,
  scanDevJunk,
  scanExtraBinaries,
  scanDocVersions,
  scanTrash,
  scanLargeFiles,
  scanAppLeftovers,
  scanPrivacy,
  getStartupItems,
  findDuplicates,
  requestCancel
} from './scanner'
import { scanDirOneLevel, getFileMeta, buildSpaceIndex } from './fs-utils'
import { recordCleanup, beginScanSession, completeScanSession, saveScanFindings,
         getCleanupHistory, getTotalFreed, addIgnorePath, removeIgnorePath, getIgnoredPaths,
         isSpaceTreeFresh, insertSpaceTreeBatch, querySpaceChildren, clearSpaceTree, invalidateSpacePaths } from './db'
import { moveToTrash } from './cleaner'
import type { FileItem, DiskStats } from '../shared/types'

function getFocusedWindow(): BrowserWindow | null {
  return BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0] ?? null
}

function getDiskStats(): DiskStats {
  try {
    const { execSync } = require('child_process') as typeof import('child_process')
    const output = execSync("df -k /", { encoding: 'utf8' })
    const lines = output.trim().split('\n')
    const parts = lines[1].trim().split(/\s+/)
    const totalBlocks = parseInt(parts[1])
    const usedBlocks = parseInt(parts[2])
    const totalBytes = totalBlocks * 1024
    const usedBytes = usedBlocks * 1024
    const freeBytes = totalBytes - usedBytes
    const usedPercent = Math.round((usedBytes / totalBytes) * 100)
    return { totalBytes, usedBytes, freeBytes, usedPercent }
  } catch {
    return { totalBytes: 0, usedBytes: 0, freeBytes: 0, usedPercent: 0 }
  }
}

export function registerIpcHandlers(): void {
  ipcMain.handle('disk:stats', async () => {
    return getDiskStats()
  })

  ipcMain.handle('scan:category', async (_, category: string) => {
    const win = getFocusedWindow()
    switch (category) {
      case 'language-files':  return scanLanguageFiles(win)
      case 'user-cache':      return scanUserCache(win)
      case 'logs':            return scanLogs(win)
      case 'mail':            return scanMailAttachments(win)
      case 'downloads-junk':  return scanDownloadsJunk(win)
      case 'ds-store':        return scanDsStore(win)
      case 'dev-junk':        return scanDevJunk(win)
      case 'extra-binaries':  return scanExtraBinaries(win)
      case 'doc-versions':    return scanDocVersions(win)
      case 'trash':           return scanTrash(win)
      case 'large-files':     return scanLargeFiles(win)
      case 'app-leftovers':   return scanAppLeftovers(win)
      case 'privacy':         return scanPrivacy(win)
      default: return []
    }
  })

  ipcMain.handle('scan:all', async () => {
    const win = getFocusedWindow()
    const sessionId = beginScanSession([
      'user-cache','language-files','extra-binaries','logs','mail',
      'doc-versions','trash','downloads-junk','dev-junk','ds-store',
      'app-leftovers','large-files','privacy'
    ])

    const settled = await Promise.allSettled([
      scanUserCache(win),
      scanLanguageFiles(win),
      scanExtraBinaries(win),
      scanLogs(win),
      scanMailAttachments(win),
      scanDocVersions(win),
      scanTrash(win),
      scanDownloadsJunk(win),
      scanDevJunk(win),
      scanDsStore(win),
      scanAppLeftovers(win),
      scanLargeFiles(win),
      scanPrivacy(win),
    ])

    const keys = [
      'user-cache','language-files','extra-binaries','logs','mail',
      'doc-versions','trash','downloads-junk','dev-junk','ds-store',
      'app-leftovers','large-files','privacy'
    ]

    const result: Record<string, FileItem[]> = {}
    for (let i = 0; i < keys.length; i++) {
      result[keys[i]] = settled[i].status === 'fulfilled' ? settled[i].value as FileItem[] : []
    }

    const allItems = Object.values(result).flat()
    const totalSize  = allItems.reduce((a, f) => a + f.size, 0)
    completeScanSession(sessionId, totalSize, allItems.length)
    saveScanFindings(sessionId, allItems)

    return { ...result, _sessionId: sessionId }
  })

  ipcMain.handle('scan:startup', async () => getStartupItems())

  // ── Space Lens: real directory tree walker ──────────────────────────────────
  ipcMain.handle('fs:pickFolder', async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    const { canceled, filePaths } = await dialog.showOpenDialog(win!, {
      title: 'Select folder to scan',
      properties: ['openDirectory'],
      buttonLabel: 'Scan Folder'
    })
    return canceled ? null : filePaths[0]
  })

  ipcMain.handle('fs:scanDir', async (_, dirPath: string) => {
    return scanDirOneLevel(dirPath)
  })

  ipcMain.handle('fs:fileMeta', async (_, filePath: string) => {
    return getFileMeta(filePath)
  })

  // ── Space Lens: SQLite-backed full index ────────────────────────────────────
  ipcMain.handle('space:isFresh', async (_, rootPath: string) => {
    return isSpaceTreeFresh(rootPath)
  })

  ipcMain.handle('space:index', async (_, rootPath: string) => {
    const win = getFocusedWindow()
    clearSpaceTree(rootPath)
    const nodes = buildSpaceIndex(rootPath, win)
    insertSpaceTreeBatch(nodes as any)
    return nodes.length
  })

  ipcMain.handle('space:query', async (_, parentPath: string) => {
    return querySpaceChildren(parentPath)
  })

  ipcMain.handle('space:invalidate', async (_, paths: string[]) => {
    invalidateSpacePaths(paths)
  })

  ipcMain.handle('scan:duplicates', async (_, searchPaths: string[]) => {
    const win = getFocusedWindow()
    return findDuplicates(searchPaths, win)
  })

  ipcMain.handle('scan:cancel', () => {
    requestCancel()
  })

  ipcMain.handle('clean:items', async (event, items: FileItem[], sessionId?: number) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    const totalSize = items.reduce((a, f) => a + f.size, 0)
    const sizeMB = (totalSize / 1024 / 1024).toFixed(1)

    const { response } = await dialog.showMessageBox(win!, {
      type: 'warning',
      title: 'Move to Trash',
      message: `Move ${items.length} items to Trash?`,
      detail: `${sizeMB} MB will be moved to your Trash. You can recover them from Trash if needed.`,
      buttons: ['Move to Trash', 'Cancel'],
      defaultId: 0,
      cancelId: 1
    })

    if (response === 1) return { cleaned: 0, totalSize: 0, failed: [], cancelled: true }

    const result = await moveToTrash(items)
    if (result.cleaned > 0) {
      const cleaned = items.slice(0, result.cleaned)
      recordCleanup(cleaned, sessionId ?? null)
    }
    return result
  })

  ipcMain.handle('db:cleanupHistory', async () => getCleanupHistory(30))
  ipcMain.handle('db:totalFreed',     async () => getTotalFreed())
  ipcMain.handle('db:addIgnore',      async (_, p: string) => addIgnorePath(p))
  ipcMain.handle('db:removeIgnore',   async (_, p: string) => removeIgnorePath(p))
  ipcMain.handle('db:getIgnored',     async () => getIgnoredPaths())

  ipcMain.handle('shell:openInFinder', async (_, filePath: string) => {
    shell.showItemInFinder(filePath)
  })

  ipcMain.handle('shell:openPath', async (_, filePath: string) => {
    shell.openPath(filePath)
  })

  ipcMain.handle('shell:quickLook', async (_, filePath: string) => {
    const { spawn } = require('child_process') as typeof import('child_process')
    spawn('qlmanage', ['-p', filePath], { detached: true, stdio: 'ignore' }).unref()
  })

  ipcMain.handle('window:minimize', () => {
    getFocusedWindow()?.minimize()
  })

  ipcMain.handle('window:maximize', () => {
    const win = getFocusedWindow()
    if (win?.isMaximized()) win.unmaximize()
    else win?.maximize()
  })

  ipcMain.handle('window:close', () => {
    getFocusedWindow()?.close()
  })

  // ── Gmail OAuth & API ────────────────────────────────────────────────────────

  ipcMain.handle('gmail:hasCredentials', () => hasCredentials())
  ipcMain.handle('gmail:credentialsPath', () => getCredentialsPath())

  ipcMain.handle('gmail:startAuth', async () => {
    if (!hasCredentials()) throw new Error('NO_CREDENTIALS')
    return startGmailAuth()
  })

  ipcMain.handle('gmail:getAccounts', async () => getConnectedAccounts())

  ipcMain.handle('gmail:disconnect', async (_, email: string) => {
    disconnectAccount(email)
  })

  ipcMain.handle('gmail:scan', async (_, email: string, rules: ScanRule[]) => {
    return scanEmailsByRules(email, rules)
  })

  ipcMain.handle('gmail:delete', async (event, email: string, messageIds: string[]) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    const { response } = await dialog.showMessageBox(win!, {
      type: 'warning',
      title: 'Delete Emails',
      message: `Permanently delete ${messageIds.length} emails?`,
      detail: 'This will move emails to Trash in Gmail. You can recover them from Gmail Trash within 30 days.',
      buttons: ['Delete', 'Cancel'],
      defaultId: 0, cancelId: 1
    })
    if (response === 1) return { deleted: 0, failed: 0, cancelled: true }
    return deleteEmails(email, messageIds)
  })
}
