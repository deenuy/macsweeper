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

  onScanProgress: (callback: (progress: ScanProgress) => void): (() => void) => {
    const handler = (_: Electron.IpcRendererEvent, progress: ScanProgress): void =>
      callback(progress)
    ipcRenderer.on('scan:progress', handler)
    return () => ipcRenderer.removeListener('scan:progress', handler)
  },

  // Space Lens: directory tree walker
  pickFolder: (): Promise<string | null> => ipcRenderer.invoke('fs:pickFolder'),
  scanDir: (dirPath: string): Promise<TreeNode[]> => ipcRenderer.invoke('fs:scanDir', dirPath),
  fileMeta: (filePath: string): Promise<FileMeta | null> => ipcRenderer.invoke('fs:fileMeta', filePath),

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

  homeDir: os.homedir()
}

contextBridge.exposeInMainWorld('electron', electronAPI)

export type ElectronAPI = typeof electronAPI

declare global {
  interface Window {
    electron: ElectronAPI
  }
}
