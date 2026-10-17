import { contextBridge, ipcRenderer } from 'electron'
import os from 'os'
import type { FileItem, DiskStats, ScanProgress, TreeNode, FileMeta } from '../shared/types'

const electronAPI = {
  getDiskStats: (): Promise<DiskStats> => ipcRenderer.invoke('disk:stats'),

  scanCategory: (category: string): Promise<FileItem[]> =>
    ipcRenderer.invoke('scan:category', category),

  scanAll: (): Promise<Record<string, FileItem[]>> => ipcRenderer.invoke('scan:all'),

  scanDuplicates: (searchPaths: string[]): Promise<import('../shared/types').DuplicateGroup[]> =>
    ipcRenderer.invoke('scan:duplicates', searchPaths),

  cancelScan: (): Promise<void> => ipcRenderer.invoke('scan:cancel'),

  cleanItems: (items: FileItem[]) => ipcRenderer.invoke('clean:items', items),

  openInFinder: (filePath: string): Promise<void> =>
    ipcRenderer.invoke('shell:openInFinder', filePath),

  openPath: (filePath: string): Promise<void> =>
    ipcRenderer.invoke('shell:openPath', filePath),

  quickLook: (filePath: string): Promise<void> =>
    ipcRenderer.invoke('shell:quickLook', filePath),

  onScanProgress: (callback: (progress: ScanProgress) => void): (() => void) => {
    const handler = (_: Electron.IpcRendererEvent, progress: ScanProgress): void =>
      callback(progress)
    ipcRenderer.on('scan:progress', handler)
    return () => ipcRenderer.removeListener('scan:progress', handler)
  },

  onScanFile: (callback: (path: string) => void): (() => void) => {
    const handler = (_: Electron.IpcRendererEvent, p: string): void => callback(p)
    ipcRenderer.on('scan:file', handler)
    return () => ipcRenderer.removeListener('scan:file', handler)
  },

  // Space Lens: directory tree walker
  pickFolder: (): Promise<string | null> => ipcRenderer.invoke('fs:pickFolder'),
  scanDir: (dirPath: string): Promise<TreeNode[]> => ipcRenderer.invoke('fs:scanDir', dirPath),
  fileMeta: (filePath: string): Promise<FileMeta | null> => ipcRenderer.invoke('fs:fileMeta', filePath),

  // Space Lens: SQLite-backed full index
  spaceIsFresh: (rootPath: string): Promise<boolean> => ipcRenderer.invoke('space:isFresh', rootPath),
  spaceIndex: (rootPath: string): Promise<number> => ipcRenderer.invoke('space:index', rootPath),
  spaceQuery: (parentPath: string): Promise<TreeNode[]> => ipcRenderer.invoke('space:query', parentPath),
  spaceInvalidate: (paths: string[]): Promise<void> => ipcRenderer.invoke('space:invalidate', paths),

  // Auto-updater
  checkUpdate: (): Promise<void>  => ipcRenderer.invoke('app:checkUpdate'),
  installUpdate: (): Promise<void> => ipcRenderer.invoke('app:installUpdate'),

  onUpdateAvailable: (cb: (info: { version: string }) => void) => {
    const h = (_: Electron.IpcRendererEvent, info: { version: string }) => cb(info)
    ipcRenderer.on('updater:available', h)
    return () => ipcRenderer.removeListener('updater:available', h)
  },
  onUpdateProgress: (cb: (info: { percent: number }) => void) => {
    const h = (_: Electron.IpcRendererEvent, info: { percent: number }) => cb(info)
    ipcRenderer.on('updater:progress', h)
    return () => ipcRenderer.removeListener('updater:progress', h)
  },
  onUpdateDownloaded: (cb: (info: { version: string }) => void) => {
    const h = (_: Electron.IpcRendererEvent, info: { version: string }) => cb(info)
    ipcRenderer.on('updater:downloaded', h)
    return () => ipcRenderer.removeListener('updater:downloaded', h)
  },

  minimize: (): Promise<void> => ipcRenderer.invoke('window:minimize'),
  maximize: (): Promise<void> => ipcRenderer.invoke('window:maximize'),
  close: (): Promise<void> => ipcRenderer.invoke('window:close'),

  homeDir: os.homedir(),

  // Gmail OAuth & API
  gmail: {
    hasCredentials: (): Promise<boolean> => ipcRenderer.invoke('gmail:hasCredentials'),
    credentialsPath: (): Promise<string> => ipcRenderer.invoke('gmail:credentialsPath'),
    startAuth: (): Promise<string> => ipcRenderer.invoke('gmail:startAuth'),
    getAccounts: (): Promise<Array<{ email: string; provider: string; totalMessages?: number }>> =>
      ipcRenderer.invoke('gmail:getAccounts'),
    disconnect: (email: string): Promise<void> => ipcRenderer.invoke('gmail:disconnect', email),
    scan: (email: string, rules: Array<{ id: string; type: string; enabled: boolean }>): Promise<
      Array<{ ruleId: string; count: number; sizeBytes: number; messageIds: string[] }>
    > => ipcRenderer.invoke('gmail:scan', email, rules),
    delete: (email: string, messageIds: string[]): Promise<{ deleted: number; failed: number; cancelled?: boolean }> =>
      ipcRenderer.invoke('gmail:delete', email, messageIds),
  }
}

contextBridge.exposeInMainWorld('electron', electronAPI)

export type ElectronAPI = typeof electronAPI

declare global {
  interface Window {
    electron: ElectronAPI
  }
}
