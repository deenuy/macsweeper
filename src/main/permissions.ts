import fs from 'fs'

/**
 * Check Full Disk Access by attempting to read a file protected by TCC.
 * Returns true if the app has FDA or if the check is inconclusive (non-macOS).
 */
export function hasFullDiskAccess(): boolean {
  if (process.platform !== 'darwin') return true
  try {
    // TCC database is only readable with Full Disk Access
    fs.readFileSync('/Library/Application Support/com.apple.TCC/TCC.db')
    return true
  } catch (e: unknown) {
    const code = (e as NodeJS.ErrnoException).code
    // ENOENT = file doesn't exist on this macOS version — treat as granted
    if (code === 'ENOENT') return true
    // EACCES / EPERM = no FDA
    return false
  }
}
