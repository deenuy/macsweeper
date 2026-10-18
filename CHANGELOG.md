# Changelog

All notable changes to MacSweeper are documented here.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).
Versioning follows [Semantic Versioning](https://semver.org/).

---

## What's New in MacSweeper 1.0.0

### New Features

- Added Home dashboard showing Mac Health score (Excellent / Good / Fair / Poor) derived from live disk, memory, and CPU readings, giving a quick overall status on every launch.
- Added real-time storage widget on the Home dashboard displaying accurate APFS free space that matches the value shown in About This Mac.
- Added real-time memory pressure widget sourced directly from the macOS kernel, replacing a usage ratio that read artificially high on healthy systems.
- Added battery widget showing charge percentage and charging status, updated every four seconds.
- Added CPU load widget with a colour-coded usage bar that turns orange above 60% and red above 80%.
- Added Wi-Fi widget showing the connected network name, live upload throughput, and live download throughput.
- Added Connected Devices section listing all mounted external drives with a one-click Eject button per device.
- Added Today's Recommendation section that surfaces a context-aware suggested action based on current disk, memory, and connected device state.
- Added volume selector to Space Lens allowing users to choose any mounted drive or a specific folder path as the scan root instead of scanning the entire system volume.
- Added 3D mouse-tracking tilt animation to the scan sphere, responding to cursor direction with spring easing on release.
- Added Full Disk Access detection and prompt on first launch, linking directly to System Settings if access has not been granted.
- Added auto-update support so packaged builds silently download new versions in the background and notify the user before applying them.
- Added Gmail Mail Cleaner for scanning and removing newsletters, large attachments, social notifications, and old threads via Google OAuth 2.0.
- Added Duplicate Finder using content-based MD5 hashing with a two-panel side-by-side comparison UI.
- Added Space Lens interactive bubble chart visualising disk usage by folder, with a SQLite-backed index for instant subfolder navigation on repeat visits.
- Added Junk Cleaner covering user caches, logs, mail attachments, language packs, old downloads, developer artifacts, and app leftovers.

### UX Improvements

- Improved disk space accuracy by switching from `df` (which reports only the system volume on APFS) to `diskutil info /` which reports the full APFS container free and total space.
- Improved memory pressure display to reflect the macOS kernel pressure level (normal, warning, critical) rather than a raw page count ratio.
- Improved 3D tilt rotation range to 38 degrees and applied the animation uniformly across all pages, making it feel more expressive and consistent.
- Improved Dock icon behaviour so clicking the icon always brings the app window to the front, even when it is hidden behind other windows.
- Improved Wi-Fi interface detection by querying the system for the actual Wi-Fi port name instead of assuming `en0`, which is not always the Wi-Fi interface.

### Bug Fixes

- Fixed storage statistics showing 13.7 GB used instead of the actual container usage on APFS volumes.
- Fixed the eject button on external drives, which was opening Finder instead of running `diskutil eject`.
- Fixed the Full Disk Access badge being permanently shown as Granted regardless of actual permission state.
- Fixed a potential crash in memory stats when a `vm_stat` key was missing from the command output.
- Fixed duplicate MacSweeper icons appearing in Spotlight search caused by an unindexed build artifact left in the `dist/` directory.
- Fixed the OAuth redirect callback failing with a connection-refused error by using a fixed port instead of a random one.

---

## Earlier Development (pre-1.0.0)

Internal development builds. No public changelog kept.
