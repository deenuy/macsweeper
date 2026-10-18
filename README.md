# MacSweeper

**A free, open-source macOS disk cleaner built with Electron + React + TypeScript.**

MacSweeper helps you reclaim storage, monitor your Mac's health, and keep things clean -- without the subscription fee of commercial alternatives.

> macOS only. Requires macOS 13 Ventura or later (Apple Silicon and Intel supported).

---

## Screenshots

![MacSweeper Home Dashboard](assets/screenshot-home.png)

---

## Features

### Home Dashboard
Real-time system health at a glance:
- **Mac Health score** (Excellent / Good / Fair / Poor) derived from disk, memory, and CPU
- **Storage** -- accurate free space using APFS Container stats (matches About This Mac)
- **Memory pressure** -- sourced from the macOS kernel (`sysctl vm.memory_pressure`)
- **Battery** status and charge percentage
- **CPU** load percentage
- **Wi-Fi** SSID, upload and download throughput
- **Connected external drives** with one-click eject
- **Today's Recommendation** -- context-aware action based on live stats

### Junk Cleaner
Scan and safely remove common clutter:
- User application caches (`~/Library/Caches`)
- Log files (`~/Library/Logs`)
- Mail attachment caches
- Unused language packs from app bundles
- Old downloads (`.dmg`, `.pkg` older than 30 days)
- Developer artifacts (`node_modules`, `__pycache__`, `.gradle`)
- Xcode derived data and simulators
- Trash contents
- App leftovers from uninstalled applications

### Duplicate Finder
Content-based duplicate detection:
- MD5 hashing for exact matches (no false positives)
- Two-panel side-by-side comparison UI
- Select which copy to keep; move the rest to Trash

### Space Lens
Interactive disk usage visualisation:
- Bubble chart of folder sizes, colour-coded by category
- Volume selector -- scan any connected drive or choose a specific folder path
- 3D mouse-tracking tilt animation on the scan sphere
- SQLite-backed index for instant subfolder navigation on repeat visits

### Mail Cleaner
Reduce Gmail storage usage:
- Connect one or more Google accounts via OAuth 2.0
- Scan by rule: newsletters, large attachments, social notifications, old threads
- Preview matched emails before deleting
- All deletions go to Gmail Trash (recoverable for 30 days)

### Privacy Cleaner
Remove traces left by common apps:
- Recent file lists
- Browser history caches
- App-specific recently-used databases

---

## Safety

MacSweeper is read-only until you explicitly confirm. Specifically:

- **Never permanently deletes.** All removals use `shell.trashItem()` -- files go to the macOS Trash and can be recovered.
- **Confirmation dialog** shows item count and total size before any action.
- **Checkbox selection** -- nothing is cleaned without explicit per-item or per-group selection.
- **Full Disk Access** is requested transparently on first launch; the app explains why and links to System Settings if not granted.
- **No network calls** for core cleaning features. The only outbound traffic is Gmail OAuth (user-initiated) and auto-update checks.

---

## Requirements

| Requirement | Version |
|---|---|
| macOS | 13 Ventura or later |
| Architecture | Apple Silicon (arm64) or Intel (x86_64) |
| Node.js (dev only) | 20 or later |
| npm (dev only) | 10 or later |

---

## Getting Started (Development)

```bash
# Clone the repository
git clone https://github.com/deenuy/macsweeper.git
cd macsweeper

# Install dependencies
npm install

# Start in development mode (hot reload)
npm run dev
```

### Build a distributable

```bash
# Compile + package (outputs to dist/)
npm run build
npm run dmg         # produces MacSweeper-x.y.z-arm64.dmg and MacSweeper-x.y.z.dmg
```

### Type checking

```bash
npm run typecheck
```

---

## Gmail Integration Setup (Optional)

The Mail Cleaner feature requires a Google OAuth 2.0 credential file. This is **not included** in the repository -- you must create your own:

1. Go to [Google Cloud Console](https://console.cloud.google.com/) and create a project.
2. Enable the **Gmail API**.
3. Create an **OAuth 2.0 Client ID** (Desktop application type).
4. Download `credentials.json` and place it at:
   ```
   ~/Library/Application Support/MacSweeper/credentials.json
   ```
5. On first use, MacSweeper will open a browser to complete the OAuth flow.

> The app never stores your Gmail password. Tokens are saved locally in `~/Library/Application Support/MacSweeper/` and never transmitted to any server.

---

## Auto-Updates

Packaged builds check for updates automatically via `electron-updater`. Updates are downloaded in the background and applied on next launch. You are always notified before an update is installed.

---

## Notarization (maintainers)

To notarize a release build for distribution outside the Mac App Store, set the following environment variables before running `make notarize`:

```
NOTARIZE=true
APPLE_ID=your@appleid.com
APPLE_APP_SPECIFIC_PASSWORD=xxxx-xxxx-xxxx-xxxx
APPLE_TEAM_ID=XXXXXXXXXX
```

Never commit these values. Use a CI secrets store or a local `.env` file that is listed in `.gitignore`.

---

## Project Structure

```
src/
  main/           # Electron main process
    index.ts      # App lifecycle, window management
    ipc.ts        # IPC handler registration
    scanner.ts    # Junk scan logic
    cleaner.ts    # Safe trash-based file removal
    system-stats.ts  # Real-time macOS system snapshot
    fs-utils.ts   # Directory walker, Space Lens indexer
    gmail.ts      # Gmail OAuth + API client
    db.ts         # SQLite (cleanup history, Space Lens index)
    permissions.ts  # Full Disk Access detection
  preload/        # Context bridge (renderer <-> main)
  renderer/       # React UI
    components/   # Page components
    hooks/        # Shared React hooks (useTilt)
  shared/         # Types shared between main and renderer
```

---

## Contributing

Contributions are welcome. Please read [CONTRIBUTING.md](CONTRIBUTING.md) before opening a pull request.

---

## License

[MIT](LICENSE) -- free to use, modify, and distribute.
