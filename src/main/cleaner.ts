import { shell } from 'electron'
import fs from 'fs'
import type { FileItem, CleanResult } from '../shared/types'

export async function moveToTrash(items: FileItem[]): Promise<CleanResult> {
  let cleaned = 0
  let totalSize = 0
  const failed: { path: string; reason: string }[] = []

  for (const item of items) {
    if (!fs.existsSync(item.path)) {
      failed.push({ path: item.path, reason: 'File no longer exists' })
      continue
    }

    try {
      await shell.trashItem(item.path)
      cleaned++
      totalSize += item.size
    } catch (err) {
      failed.push({
        path: item.path,
        reason: err instanceof Error ? err.message : String(err)
      })
    }
  }

  return { cleaned, totalSize, failed }
}
