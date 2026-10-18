/**
 * SQLite persistence layer — scan history, file size cache, cleanup log, ignore list.
 * Uses better-sqlite3 (synchronous, safe for Electron main process).
 * DB stored at ~/Library/Application Support/MacSweeper/macsweeper.db
 */
import Database from 'better-sqlite3'
import { app } from 'electron'
import path from 'path'
import fs from 'fs'
import type { FileItem } from '../shared/types'

let db: Database.Database | null = null

function getDbPath(): string {
  const dataDir = app.getPath('userData')
  fs.mkdirSync(dataDir, { recursive: true })
  return path.join(dataDir, 'macsweeper.db')
}

export function openDb(): Database.Database {
  if (db) return db
  db = new Database(getDbPath())
  db.pragma('journal_mode = WAL')   // WAL = safe concurrent reads from renderer
  db.pragma('foreign_keys = ON')
  db.pragma('synchronous = NORMAL') // balance safety vs speed
  migrate(db)
  return db
}

export function closeDb(): void {
  db?.close()
  db = null
}

// ── Schema migrations ──────────────────────────────────────────────────────────
function migrate(d: Database.Database): void {
  d.exec(`
    CREATE TABLE IF NOT EXISTS schema_version (
      version INTEGER PRIMARY KEY
    );
  `)

  const row = d.prepare('SELECT version FROM schema_version').get() as { version: number } | undefined
  const current = row?.version ?? 0

  if (current < 1) {
    d.exec(`
      -- Scan sessions: one row per full scan run
      CREATE TABLE IF NOT EXISTS scan_sessions (
        id           INTEGER PRIMARY KEY AUTOINCREMENT,
        started_at   TEXT    NOT NULL DEFAULT (datetime('now')),
        completed_at TEXT,
        total_size   INTEGER NOT NULL DEFAULT 0,
        total_count  INTEGER NOT NULL DEFAULT 0,
        categories   TEXT    NOT NULL DEFAULT '[]'
      );

      -- Individual files found in a scan session
      CREATE TABLE IF NOT EXISTS scan_findings (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id INTEGER NOT NULL REFERENCES scan_sessions(id) ON DELETE CASCADE,
        path       TEXT    NOT NULL,
        name       TEXT    NOT NULL,
        size       INTEGER NOT NULL,
        category   TEXT    NOT NULL,
        modified_at TEXT,
        status     TEXT    NOT NULL DEFAULT 'pending'  -- pending | trashed | skipped
      );
      CREATE INDEX IF NOT EXISTS idx_findings_session ON scan_findings(session_id);
      CREATE INDEX IF NOT EXISTS idx_findings_category ON scan_findings(category);

      -- Cleanup events: when the user clicked "Move to Trash"
      CREATE TABLE IF NOT EXISTS cleanup_history (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        cleaned_at  TEXT    NOT NULL DEFAULT (datetime('now')),
        item_count  INTEGER NOT NULL,
        total_size  INTEGER NOT NULL,
        categories  TEXT    NOT NULL DEFAULT '[]',
        session_id  INTEGER REFERENCES scan_sessions(id)
      );

      -- Cleaned items per event
      CREATE TABLE IF NOT EXISTS cleaned_items (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        cleanup_id INTEGER NOT NULL REFERENCES cleanup_history(id) ON DELETE CASCADE,
        path       TEXT    NOT NULL,
        name       TEXT    NOT NULL,
        size       INTEGER NOT NULL,
        category   TEXT    NOT NULL
      );

      -- File size cache: avoid re-walking unchanged directories
      CREATE TABLE IF NOT EXISTS size_cache (
        path        TEXT PRIMARY KEY,
        size        INTEGER NOT NULL,
        mtime       TEXT    NOT NULL,
        computed_at TEXT    NOT NULL DEFAULT (datetime('now'))
      );

      -- User ignore list: paths the user has excluded from scanning
      CREATE TABLE IF NOT EXISTS ignore_list (
        id       INTEGER PRIMARY KEY AUTOINCREMENT,
        path     TEXT    UNIQUE NOT NULL,
        added_at TEXT    NOT NULL DEFAULT (datetime('now')),
        reason   TEXT
      );

      -- User preferences (key-value store)
      CREATE TABLE IF NOT EXISTS preferences (
        key   TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );

      INSERT OR REPLACE INTO schema_version(version) VALUES(1);
    `)
  }

  if (current < 2) {
    d.exec(`
      CREATE TABLE IF NOT EXISTS space_tree (
        path         TEXT    PRIMARY KEY,
        parent_path  TEXT    NOT NULL,
        name         TEXT    NOT NULL,
        size         INTEGER NOT NULL DEFAULT 0,
        size_on_disk INTEGER NOT NULL DEFAULT 0,
        is_dir       INTEGER NOT NULL DEFAULT 0,
        child_count  INTEGER NOT NULL DEFAULT 0,
        has_children INTEGER NOT NULL DEFAULT 0,
        ext          TEXT    NOT NULL DEFAULT '',
        modified_at  TEXT    NOT NULL DEFAULT '',
        is_symlink   INTEGER NOT NULL DEFAULT 0,
        permissions  TEXT    NOT NULL DEFAULT '',
        kind         TEXT    NOT NULL DEFAULT 'File',
        owner        TEXT    NOT NULL DEFAULT '',
        root_path    TEXT    NOT NULL,
        scanned_at   INTEGER NOT NULL DEFAULT 0
      );
      CREATE INDEX IF NOT EXISTS idx_space_parent ON space_tree(parent_path, size DESC);
      CREATE INDEX IF NOT EXISTS idx_space_root   ON space_tree(root_path);

      INSERT OR REPLACE INTO schema_version(version) VALUES(2);
    `)
  }
}

// ── Scan sessions ──────────────────────────────────────────────────────────────
export function beginScanSession(categories: string[]): number {
  const d = openDb()
  const result = d
    .prepare(`INSERT INTO scan_sessions (categories) VALUES (?)`)
    .run(JSON.stringify(categories))
  return result.lastInsertRowid as number
}

export function completeScanSession(sessionId: number, totalSize: number, totalCount: number): void {
  openDb()
    .prepare(`UPDATE scan_sessions SET completed_at = datetime('now'), total_size = ?, total_count = ? WHERE id = ?`)
    .run(totalSize, totalCount, sessionId)
}

export function saveScanFindings(sessionId: number, items: FileItem[]): void {
  const d = openDb()
  const insert = d.prepare(`
    INSERT INTO scan_findings (session_id, path, name, size, category, modified_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `)
  const insertMany = d.transaction((rows: FileItem[]) => {
    for (const item of rows) {
      insert.run(sessionId, item.path, item.name, item.size, item.category, item.modifiedAt ?? null)
    }
  })
  insertMany(items)
}

export function getLastScanSession(): { id: number; completedAt: string; totalSize: number; totalCount: number } | null {
  return openDb()
    .prepare(`SELECT id, completed_at AS completedAt, total_size AS totalSize, total_count AS totalCount
              FROM scan_sessions WHERE completed_at IS NOT NULL ORDER BY id DESC LIMIT 1`)
    .get() as any ?? null
}

export function getScanFindings(sessionId: number): FileItem[] {
  const rows = openDb()
    .prepare(`SELECT path, name, size, category, modified_at AS modifiedAt FROM scan_findings WHERE session_id = ? AND status = 'pending'`)
    .all(sessionId) as any[]
  return rows
}

// ── Cleanup history ────────────────────────────────────────────────────────────
export function recordCleanup(
  items: FileItem[],
  sessionId: number | null
): number {
  const d = openDb()
  const categories = [...new Set(items.map((f) => f.category))]
  const totalSize  = items.reduce((a, f) => a + f.size, 0)

  const event = d
    .prepare(`INSERT INTO cleanup_history (item_count, total_size, categories, session_id) VALUES (?, ?, ?, ?)`)
    .run(items.length, totalSize, JSON.stringify(categories), sessionId ?? null)

  const cleanupId = event.lastInsertRowid as number

  const insertItem = d.prepare(`
    INSERT INTO cleaned_items (cleanup_id, path, name, size, category)
    VALUES (?, ?, ?, ?, ?)
  `)
  const insertAll = d.transaction((rows: FileItem[]) => {
    for (const item of rows) {
      insertItem.run(cleanupId, item.path, item.name, item.size, item.category)
    }
  })
  insertAll(items)

  // Mark findings as trashed
  if (sessionId) {
    const paths = items.map((f) => f.path)
    const update = d.prepare(`UPDATE scan_findings SET status = 'trashed' WHERE session_id = ? AND path = ?`)
    const updateAll = d.transaction((ps: string[]) => {
      for (const p of ps) update.run(sessionId, p)
    })
    updateAll(paths)
  }

  return cleanupId
}

export interface CleanupHistoryRow {
  id: number
  cleanedAt: string
  itemCount: number
  totalSize: number
  categories: string[]
}

export function getCleanupHistory(limit = 20): CleanupHistoryRow[] {
  const rows = openDb()
    .prepare(`SELECT id, cleaned_at AS cleanedAt, item_count AS itemCount, total_size AS totalSize, categories
              FROM cleanup_history ORDER BY id DESC LIMIT ?`)
    .all(limit) as any[]
  return rows.map((r) => ({ ...r, categories: JSON.parse(r.categories) }))
}

export function getTotalFreed(): number {
  const row = openDb()
    .prepare(`SELECT COALESCE(SUM(total_size), 0) AS total FROM cleanup_history`)
    .get() as { total: number }
  return row.total
}

// ── File size cache ────────────────────────────────────────────────────────────
const CACHE_TTL_MS = 15 * 60 * 1000  // 15 minutes

export function getCachedSize(filePath: string, currentMtime: string): number | null {
  const row = openDb()
    .prepare(`SELECT size, mtime, computed_at FROM size_cache WHERE path = ?`)
    .get(filePath) as { size: number; mtime: string; computed_at: string } | undefined

  if (!row) return null
  if (row.mtime !== currentMtime) return null  // file changed

  const age = Date.now() - new Date(row.computed_at).getTime()
  if (age > CACHE_TTL_MS) return null

  return row.size
}

export function setCachedSize(filePath: string, size: number, mtime: string): void {
  openDb()
    .prepare(`INSERT OR REPLACE INTO size_cache (path, size, mtime, computed_at) VALUES (?, ?, ?, datetime('now'))`)
    .run(filePath, size, mtime)
}

export function pruneOldCache(): void {
  const cutoff = new Date(Date.now() - CACHE_TTL_MS * 4).toISOString()
  openDb().prepare(`DELETE FROM size_cache WHERE computed_at < ?`).run(cutoff)
}

// ── Ignore list ────────────────────────────────────────────────────────────────
export function addIgnorePath(filePath: string, reason?: string): void {
  openDb()
    .prepare(`INSERT OR IGNORE INTO ignore_list (path, reason) VALUES (?, ?)`)
    .run(filePath, reason ?? null)
}

export function removeIgnorePath(filePath: string): void {
  openDb().prepare(`DELETE FROM ignore_list WHERE path = ?`).run(filePath)
}

export function getIgnoredPaths(): string[] {
  const rows = openDb().prepare(`SELECT path FROM ignore_list`).all() as { path: string }[]
  return rows.map((r) => r.path)
}

export function isIgnored(filePath: string): boolean {
  const ignored = getIgnoredPaths()
  return ignored.some((p) => filePath === p || filePath.startsWith(p + '/'))
}

// ── Preferences ────────────────────────────────────────────────────────────────
export function getPref(key: string, defaultValue = ''): string {
  const row = openDb().prepare(`SELECT value FROM preferences WHERE key = ?`).get(key) as { value: string } | undefined
  return row?.value ?? defaultValue
}

export function setPref(key: string, value: string): void {
  openDb()
    .prepare(`INSERT OR REPLACE INTO preferences (key, value) VALUES (?, ?)`)
    .run(key, value)
}

// ── Space Lens tree index ──────────────────────────────────────────────────────
const SPACE_TREE_TTL_MS = 60 * 60 * 1000  // 1 hour

export function isSpaceTreeFresh(rootPath: string): boolean {
  const row = openDb()
    .prepare(`SELECT MAX(scanned_at) AS ts FROM space_tree WHERE root_path = ?`)
    .get(rootPath) as { ts: number | null }
  if (!row?.ts) return false
  return Date.now() - row.ts < SPACE_TREE_TTL_MS
}

export interface SpaceNode {
  path: string
  parentPath: string
  name: string
  size: number
  sizeOnDisk: number
  isDir: boolean
  childCount: number
  hasChildren: boolean
  ext: string
  modifiedAt: string
  isSymlink: boolean
  permissions: string
  kind: string
  owner: string
  rootPath: string
  scannedAt: number
}

export function insertSpaceTreeBatch(nodes: SpaceNode[]): void {
  const d = openDb()
  const insert = d.prepare(`
    INSERT OR REPLACE INTO space_tree
      (path, parent_path, name, size, size_on_disk, is_dir, child_count, has_children,
       ext, modified_at, is_symlink, permissions, kind, owner, root_path, scanned_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  `)
  const insertAll = d.transaction((rows: SpaceNode[]) => {
    for (const n of rows) {
      insert.run(
        n.path, n.parentPath, n.name, n.size, n.sizeOnDisk,
        n.isDir ? 1 : 0, n.childCount, n.hasChildren ? 1 : 0,
        n.ext, n.modifiedAt, n.isSymlink ? 1 : 0, n.permissions,
        n.kind, n.owner, n.rootPath, n.scannedAt
      )
    }
  })
  insertAll(nodes)
}

export function querySpaceChildren(parentPath: string): import('../shared/types').TreeNode[] {
  const rows = openDb()
    .prepare(`
      SELECT path, name, size, size_on_disk AS sizeOnDisk, is_dir AS isDir,
             child_count AS childCount, has_children AS hasChildren, ext,
             modified_at AS modifiedAt, is_symlink AS isSymlink, permissions, kind, owner
      FROM space_tree
      WHERE parent_path = ?
      ORDER BY size DESC
      LIMIT 2000
    `)
    .all(parentPath) as any[]
  return rows.map(r => ({
    ...r,
    isDir:       Boolean(r.isDir),
    hasChildren: Boolean(r.hasChildren),
    isSymlink:   Boolean(r.isSymlink),
    createdAt:   '',
    accessedAt:  '',
  }))
}

export function clearSpaceTree(rootPath: string): void {
  openDb().prepare(`DELETE FROM space_tree WHERE root_path = ?`).run(rootPath)
}

export function invalidateSpacePaths(paths: string[]): void {
  const d = openDb()
  const del = d.prepare(`DELETE FROM space_tree WHERE path = ?`)
  const delAll = d.transaction((ps: string[]) => { for (const p of ps) del.run(p) })
  delAll(paths)
}
