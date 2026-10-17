# MacSweeper

A production-grade macOS disk cleaner built with Electron + React + TypeScript.

## Features

- **Smart Care Dashboard** — overview of disk usage with animated progress ring
- **Junk Cleaner** — scan and remove language files, user cache, logs, mail attachments, downloads junk, dev artifacts
- **Duplicate Finder** — content-based MD5 hashing to find exact duplicates; two-panel UI
- **Space Lens** — interactive bubble visualization of disk usage by category
- **Cloud Cleanup** — detect local caches from iCloud, Dropbox, Google Drive, OneDrive

## Cleaning Rules

**Included (+ rules):**
- `~/Library/Caches/**` — user application caches > 1MB
- `~/Library/Logs/**/*.log` — log files > 10KB
- `~/Library/Mail/**/Attachments/**` — mail attachment caches
- `/Applications/**/*.app/Contents/Resources/*.lproj` — non-English language packs
- `~/Downloads/*.dmg|*.pkg` older than 30 days
- `~/Documents/**/node_modules` not accessed in 60 days
- `~/Documents/**/__pycache__` directories

**Excluded (× rules):**
- All files outside `~/Library` and `/Applications`
- System Library paths
- Files in `~/Library/Keychains` and `~/Library/Preferences`

## Safety

- **Never permanently deletes** — always moves to Trash via `shell.trashItem()`
- Shows confirmation dialog with item count and size before cleaning
- Requires explicit checkbox selection per item
- Read-only scanning; no changes until explicit user action

## Setup

```bash
nvm use 24
npm install
npm run dev
```

## Build

```bash
npm run build
npm run dist   # creates .dmg in dist/
```

## Tech Stack

- **Electron 31** + **electron-vite 2**
- **React 18** + **TypeScript 5**
- **electron-builder** for packaging
- Custom CSS (no UI library) — macOS vibrancy, SF Pro fonts
