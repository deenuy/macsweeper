#!/usr/bin/env python3
"""
MacSweeper build console — retro terminal orchestrator.
Usage: python3 scripts/console.py <command>
       make <command>  (delegates here)
"""

import os
import sys
import signal
import subprocess
import threading
import datetime
import shutil
import time
from pathlib import Path

# ── Config ────────────────────────────────────────────────────────────────────
APP_NAME    = "MacSweeper"
VERSION     = "1.0.0"
ROOT        = Path(__file__).resolve().parent.parent
LOG_DIR     = ROOT / "logs"
LOG_FILE    = LOG_DIR / "macsweeper-build.log"
DIST_DIR    = ROOT / "dist"
OUT_DIR     = ROOT / "out"

LOG_DIR.mkdir(exist_ok=True)

PID_DIR  = ROOT / ".pids"
PID_FILE = PID_DIR / "dev.pid"

# ── ANSI ──────────────────────────────────────────────────────────────────────
R  = "\033[0m"
B  = "\033[1m"
DIM= "\033[2m"
CY = "\033[36m"
GR = "\033[32m"
YL = "\033[33m"
RD = "\033[31m"
MG = "\033[35m"
BL = "\033[34m"
WH = "\033[97m"

def c(color, text): return f"{color}{text}{R}"

# ── Logging ───────────────────────────────────────────────────────────────────
def ts(): return datetime.datetime.now().strftime("%H:%M:%S")
def log_raw(line: str):
    with open(LOG_FILE, "a") as f:
        f.write(f"[{datetime.datetime.now().isoformat()}] {line}\n")

def classify(line: str):
    lo = line.lower()
    if any(w in lo for w in ("error", "failed", "fatal", "err ")):
        return "ERROR", RD
    if any(w in lo for w in ("warn", "warning", "deprecated")):
        return "WARN ", YL
    return "INFO ", DIM

def print_line(line: str):
    level, col = classify(line)
    print(f"  {c(DIM, ts())}  {c(col, level)}  {line}", flush=True)
    log_raw(f"[{level.strip()}] {line}")

# ── Banner ────────────────────────────────────────────────────────────────────
def banner(command: str):
    w = shutil.get_terminal_size((80, 24)).columns
    bar = "─" * (w - 2)
    print()
    print(c(MG, f"┌{bar}┐"))
    title = f"  {APP_NAME} v{VERSION}  ·  make {command}"
    pad   = w - 2 - len(title)
    print(c(MG, "│") + c(B + WH, title) + " " * pad + c(MG, "│"))
    info  = f"  {datetime.datetime.now().strftime('%a %b %d %H:%M:%S %Y')}  ·  log → {LOG_FILE.relative_to(ROOT)}"
    pad2  = w - 2 - len(info)
    print(c(MG, "│") + c(DIM, info) + " " * max(pad2, 0) + c(MG, "│"))
    print(c(MG, f"└{bar}┘"))
    print()

# ── Step runner ───────────────────────────────────────────────────────────────
def run_step(label: str, cmd: list[str], cwd=ROOT, critical=True) -> bool:
    print(f"\n  {c(CY, '▶')} {c(B, label)}")
    log_raw(f"[STEP] {label} — {' '.join(cmd)}")
    t0 = time.monotonic()

    try:
        proc = subprocess.Popen(
            cmd, cwd=str(cwd),
            stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
            text=True, bufsize=1
        )
    except FileNotFoundError as e:
        print(f"  {c(RD, '✗')} Command not found: {e}")
        log_raw(f"[ERROR] {e}")
        if critical: sys.exit(1)
        return False

    def drain():
        for line in proc.stdout:
            print_line(line.rstrip())

    t = threading.Thread(target=drain, daemon=True)
    t.start()
    proc.wait()
    t.join(timeout=5)

    elapsed = f"{time.monotonic() - t0:.1f}s"
    if proc.returncode == 0:
        print(f"  {c(GR, '✓')} {label} {c(DIM, f'({elapsed})')}")
        log_raw(f"[OK] {label} ({elapsed})")
        return True
    else:
        print(f"  {c(RD, '✗')} {label} failed (exit {proc.returncode}) {c(DIM, f'({elapsed})')}")
        log_raw(f"[FAIL] {label} exit={proc.returncode} ({elapsed})")
        if critical: sys.exit(1)
        return False

def section(title: str):
    w = shutil.get_terminal_size((80, 24)).columns
    print(f"\n  {c(BL, '●')} {c(B, title)}")
    print(f"  {c(DIM, '─' * min(w - 4, 60))}")

# ── Commands ──────────────────────────────────────────────────────────────────
NPM = ["npm"]

def cmd_install():
    banner("install")
    section("Installing dependencies")
    run_step("npm ci", [*NPM, "ci"], critical=True)
    run_step("Rebuild native modules", ["npx", "@electron/rebuild", "-f", "-w", "better-sqlite3"])
    print(f"\n  {c(GR, '✓ Ready.')} Run {c(CY, 'make dev')} to start.\n")

def cmd_dev():
    banner("dev")
    section("Starting dev server")
    print(f"  {c(DIM, 'Hot reload enabled — Ctrl+C to stop')}\n")
    log_raw("[START] electron-vite dev")
    os.execlp("npm", "npm", "run", "dev")  # replaces process; Ctrl-C ends it

def cmd_build():
    banner("build")
    section("TypeScript → JavaScript")
    run_step("tsc typecheck", [*NPM, "run", "typecheck"], critical=False)
    run_step("electron-vite build", [*NPM, "run", "build"], critical=True)
    size_out = OUT_DIR
    if size_out.exists():
        total = sum(f.stat().st_size for f in size_out.rglob("*") if f.is_file())
        print(f"  {c(DIM, f'Output: {OUT_DIR.relative_to(ROOT)}/  ({total/1024/1024:.1f} MB)')}")
    print(f"\n  {c(GR, '✓ Build complete.')}\n")

def cmd_pack():
    banner("pack")
    cmd_build()
    section("Creating unpacked .app")
    run_step("electron-builder --mac --dir", ["npx", "electron-builder", "--mac", "--dir"])
    _print_dist_files()

def cmd_dist(arch: str | None = None):
    label = f"dist{'-' + arch if arch else ''}"
    banner(label)
    cmd_build()
    _check_signing()
    section(f"Building DMG {'(' + arch + ')' if arch else '(current arch)'}")
    eb_args = ["npx", "electron-builder", "--mac", "dmg"]
    if arch == "arm64": eb_args.append("--arm64")
    elif arch == "x64": eb_args.append("--x64")
    elif arch == "universal": eb_args.append("--universal")
    run_step("electron-builder", eb_args)
    _print_dist_files()

def cmd_notarize():
    banner("notarize")
    for var in ("APPLE_ID", "APPLE_APP_SPECIFIC_PASSWORD", "APPLE_TEAM_ID", "CSC_LINK"):
        if not os.environ.get(var):
            print(f"  {c(RD, '✗')} {var} is not set. Source .env.signing first.")
            sys.exit(1)
    cmd_build()
    section("Building universal DMG + notarizing")
    env = {**os.environ, "NOTARIZE": "true"}
    proc = subprocess.run(
        ["npx", "electron-builder", "--mac", "dmg", "--universal", "--publish", "never"],
        cwd=str(ROOT), env=env
    )
    if proc.returncode != 0:
        print(f"  {c(RD, '✗')} Notarization failed. Check logs.")
        sys.exit(1)
    _print_dist_files()
    print(f"\n  {c(GR, '✓ Notarized DMG ready for distribution.')}\n")

def _read_pid() -> int | None:
    if not PID_FILE.exists():
        return None
    try:
        return int(PID_FILE.read_text().strip())
    except (ValueError, OSError):
        return None

def _pid_alive(pid: int) -> bool:
    try:
        os.kill(pid, 0)
        return True
    except (ProcessLookupError, PermissionError):
        return False

def cmd_start():
    """Start the dev server + Electron in background (daemon mode)."""
    banner("start")
    PID_DIR.mkdir(exist_ok=True)

    old_pid = _read_pid()
    if old_pid and _pid_alive(old_pid):
        print(f"  {c(YL, '⚠')}  Already running (PID {old_pid}).")
        print(f"     Run {c(CY, 'make restart')} to restart or {c(CY, 'make stop')} to stop.\n")
        return

    if PID_FILE.exists():
        PID_FILE.unlink()  # stale pid file

    section("Launching dev server + Electron (background)")
    log_raw("[START] electron-vite dev (daemon)")
    log_fh = open(LOG_FILE, "a")
    proc = subprocess.Popen(
        [*NPM, "run", "dev"],
        cwd=str(ROOT),
        stdout=log_fh,
        stderr=subprocess.STDOUT,
        start_new_session=True,    # own process group — killpg works cleanly
    )
    PID_FILE.write_text(str(proc.pid))
    print(f"  {c(GR, '✓')} Started  PID {c(CY, str(proc.pid))}")
    print(f"  {c(DIM, f'Logs   → {LOG_FILE.relative_to(ROOT)}')}")
    print(f"  Run {c(CY, 'make stop')} to stop.  {c(CY, 'make restart')} to restart.\n")

def cmd_stop():
    """Stop the running dev server / Electron (daemon mode)."""
    banner("stop")
    pid = _read_pid()
    if pid is None:
        print(f"  {c(DIM, '–')} No PID file found — nothing to stop.\n")
        return
    if not _pid_alive(pid):
        PID_FILE.unlink(missing_ok=True)
        print(f"  {c(DIM, '–')} Process {pid} is not running (stale PID file removed).\n")
        return

    section("Stopping processes")
    try:
        pgid = os.getpgid(pid)
        os.killpg(pgid, signal.SIGTERM)
        # Wait up to 4 s for graceful exit, then SIGKILL
        for _ in range(40):
            time.sleep(0.1)
            if not _pid_alive(pid):
                break
        else:
            os.killpg(pgid, signal.SIGKILL)
        PID_FILE.unlink(missing_ok=True)
        print(f"  {c(GR, '✓')} Stopped (PID {pid})\n")
        log_raw(f"[STOP] PID {pid} terminated")
    except (ProcessLookupError, OSError) as e:
        print(f"  {c(YL, '⚠')}  Could not kill PID {pid}: {e}")
        PID_FILE.unlink(missing_ok=True)

def cmd_restart():
    """Stop the running instance then start a fresh one."""
    banner("restart")
    pid = _read_pid()
    if pid and _pid_alive(pid):
        section("Stopping")
        try:
            pgid = os.getpgid(pid)
            os.killpg(pgid, signal.SIGTERM)
            for _ in range(40):
                time.sleep(0.1)
                if not _pid_alive(pid):
                    break
            else:
                os.killpg(pgid, signal.SIGKILL)
            PID_FILE.unlink(missing_ok=True)
            print(f"  {c(GR, '✓')} Stopped  PID {pid}")
            log_raw(f"[RESTART] stopped PID {pid}")
        except (ProcessLookupError, OSError):
            PID_FILE.unlink(missing_ok=True)
    else:
        if PID_FILE.exists():
            PID_FILE.unlink()

    time.sleep(0.5)  # brief pause so ports are released

    section("Starting")
    PID_DIR.mkdir(exist_ok=True)
    log_fh = open(LOG_FILE, "a")
    proc = subprocess.Popen(
        [*NPM, "run", "dev"],
        cwd=str(ROOT),
        stdout=log_fh,
        stderr=subprocess.STDOUT,
        start_new_session=True,
    )
    PID_FILE.write_text(str(proc.pid))
    print(f"  {c(GR, '✓')} Restarted  PID {c(CY, str(proc.pid))}")
    print(f"  {c(DIM, f'Logs → {LOG_FILE.relative_to(ROOT)}')}\n")
    log_raw(f"[RESTART] started PID {proc.pid}")

def cmd_audit(fix: bool = False, force: bool = False):
    """Run npm audit [fix [--force]]."""
    label = "audit" + ("-fix" if fix else "") + ("-force" if force else "")
    banner(label)
    if force:
        print(f"  {c(YL, '⚠')}  --force may install semver-major upgrades and introduce breaking changes.")
        print(f"     Review the diff carefully before committing.\n")
    cmd = [*NPM, "audit"]
    if fix:
        cmd.append("fix")
    if force:
        cmd.append("--force")
    run_step(" ".join(cmd[1:]), cmd, critical=not fix)  # audit alone exits non-zero if vulns exist
    print()

def cmd_desktop():
    """Build fresh and launch MacSweeper's own Electron dev server (electron-vite dev)."""
    banner("desktop")
    section("Building & launching MacSweeper")
    print(f"  {c(DIM, 'Starts electron-vite dev on its own port — not affected by other Vite servers')}\n")
    log_raw("[START] MacSweeper desktop via electron-vite dev")
    # electron-vite dev bundles main, starts its own Vite renderer, and opens Electron
    run_step("electron-vite dev", [*NPM, "run", "dev"], critical=True)

def cmd_release():
    """Build, notarize and publish a GitHub release."""
    banner("release")
    for var in ("APPLE_ID", "APPLE_APP_SPECIFIC_PASSWORD", "APPLE_TEAM_ID", "CSC_LINK", "GH_TOKEN"):
        if not os.environ.get(var):
            print(f"  {c(RD, '✗')} {var} is not set. Source .env.signing first.")
            sys.exit(1)
    cmd_build()
    section("Building universal DMG, notarizing and publishing to GitHub Releases")
    env = {**os.environ, "NOTARIZE": "true"}
    proc = subprocess.run(
        ["npx", "electron-builder", "--mac", "dmg", "--universal", "--publish", "always"],
        cwd=str(ROOT), env=env
    )
    if proc.returncode != 0:
        print(f"  {c(RD, '✗')} Release build failed. Check logs.")
        sys.exit(1)
    _print_dist_files()
    print(f"\n  {c(GR, '✓ Released to GitHub Releases. Users will auto-update on next launch.')}\n")

def cmd_clean(all_: bool = False):
    banner("clean" + ("-all" if all_ else ""))
    for d in [OUT_DIR, DIST_DIR]:
        if d.exists():
            shutil.rmtree(d)
            print(f"  {c(GR, '✓')} Removed {d.relative_to(ROOT)}/")
    if all_ and (ROOT / "node_modules").exists():
        shutil.rmtree(ROOT / "node_modules")
        print(f"  {c(GR, '✓')} Removed node_modules/")
    print()

def cmd_status():
    banner("status")
    section("Environment")
    checks = [
        ("node", ["node", "--version"]),
        ("npm",  [*NPM, "--version"]),
        ("npx",  ["npx", "--version"]),
    ]
    for label, cmd in checks:
        try:
            out = subprocess.check_output(cmd, text=True).strip()
            print(f"  {c(GR, '✓')} {label:8s} {c(DIM, out)}")
        except Exception:
            print(f"  {c(RD, '✗')} {label:8s} not found")

    section("Build artifacts")
    for d, desc in [(OUT_DIR, "compiled output"), (DIST_DIR, "distribution DMGs")]:
        if d.exists():
            files = list(d.rglob("*"))
            size  = sum(f.stat().st_size for f in files if f.is_file())
            print(f"  {c(GR, '✓')} {str(d.relative_to(ROOT)):20s}  {c(DIM, f'{len(files)} files, {size/1024/1024:.1f} MB')}")
        else:
            print(f"  {c(DIM, '–')} {str(d.relative_to(ROOT)):20s}  {c(DIM, 'not built')}")

    section("Signing")
    for var, label in [
        ("CSC_LINK", "Code signing cert"),
        ("APPLE_ID", "Apple ID"),
        ("APPLE_TEAM_ID", "Team ID"),
    ]:
        val = os.environ.get(var)
        icon = c(GR, "✓") if val else c(YL, "⚠")
        hint = val[:4] + "…" if val and len(val) > 4 else (val or "not set")
        print(f"  {icon} {label:22s}  {c(DIM, hint)}")
    print()

# ── Helpers ───────────────────────────────────────────────────────────────────
def _print_dist_files():
    if not DIST_DIR.exists(): return
    dmgs = list(DIST_DIR.glob("*.dmg"))
    if dmgs:
        print(f"\n  {c(GR, '✓')} Distribution files:")
        for f in dmgs:
            mb = f.stat().st_size / 1024 / 1024
            print(f"    {c(CY, str(f.relative_to(ROOT)))}  {c(DIM, f'{mb:.1f} MB')}")
    print()

def _check_signing():
    if not os.environ.get("CSC_LINK"):
        print(f"  {c(YL, '⚠')}  CSC_LINK not set — DMG will be unsigned (OK for testing, not for distribution)")
        print(f"     Source {c(CY, '.env.signing')} and re-run for a signed build.\n")

# ── Dispatch ──────────────────────────────────────────────────────────────────
COMMANDS = {
    "install":          lambda: cmd_install(),
    "start":            lambda: cmd_start(),
    "stop":             lambda: cmd_stop(),
    "restart":          lambda: cmd_restart(),
    "dev":              lambda: cmd_dev(),
    "desktop":          lambda: cmd_desktop(),
    "build":            lambda: cmd_build(),
    "pack":             lambda: cmd_pack(),
    "dist":             lambda: cmd_dist(),
    "dist-arm64":       lambda: cmd_dist("arm64"),
    "dist-x64":         lambda: cmd_dist("x64"),
    "dist-universal":   lambda: cmd_dist("universal"),
    "notarize":         lambda: cmd_notarize(),
    "release":          lambda: cmd_release(),
    "audit":            lambda: cmd_audit(),
    "audit-fix":        lambda: cmd_audit(fix=True),
    "audit-fix-force":  lambda: cmd_audit(fix=True, force=True),
    "clean":            lambda: cmd_clean(False),
    "clean-all":        lambda: cmd_clean(True),
    "status":           lambda: cmd_status(),
}

if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else "status"
    if cmd not in COMMANDS:
        print(f"\n  Unknown command: {c(RD, cmd)}")
        print(f"  Available: {', '.join(c(CY, k) for k in COMMANDS)}\n")
        sys.exit(1)
    try:
        COMMANDS[cmd]()
    except KeyboardInterrupt:
        print(f"\n\n  {c(YL, 'Interrupted.')}\n")
        sys.exit(130)
