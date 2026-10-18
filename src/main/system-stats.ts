import { execSync } from 'child_process'
import { readdirSync, statSync } from 'fs'
import type { SystemSnapshot } from '../shared/types'

let lastNetSample: { time: number; rxBytes: number; txBytes: number } | null = null
let cachedModel: string | null = null

function run(cmd: string, timeoutMs = 4000): string {
  try {
    return execSync(cmd, { encoding: 'utf8', timeout: timeoutMs })
  } catch { return '' }
}

function getDiskInfo(): SystemSnapshot['disk'] {
  const out = run('diskutil info /')
  const toB = (s: string) => parseInt(s.replace(/,/g, ''))
  // Try container stats first (APFS with shared pool)
  const cf = out.match(/Container Free Space:\s+[\d.]+ \S+ \(([\d,]+) Bytes\)/)
  const ct = out.match(/Container Total Space:\s+[\d.]+ \S+ \(([\d,]+) Bytes\)/)
  if (cf && ct) {
    const free = toB(cf[1]), total = toB(ct[1])
    return { freeBytes: free, totalBytes: total, usedBytes: total - free }
  }
  // Volume stats fallback
  const vf = out.match(/Volume Free Space:\s+[\d.]+ \S+ \(([\d,]+) Bytes\)/)
  const vt = out.match(/Volume Total Space:\s+[\d.]+ \S+ \(([\d,]+) Bytes\)/)
  if (vf && vt) {
    const free = toB(vf[1]), total = toB(vt[1])
    return { freeBytes: free, totalBytes: total, usedBytes: total - free }
  }
  // df fallback
  const dfLine = run('df -Pk /').trim().split('\n')[1]?.trim().split(/\s+/) ?? []
  if (dfLine.length >= 4) {
    return {
      totalBytes: parseInt(dfLine[1]) * 1024,
      usedBytes: parseInt(dfLine[2]) * 1024,
      freeBytes: parseInt(dfLine[3]) * 1024,
    }
  }
  return { freeBytes: 0, totalBytes: 0, usedBytes: 0 }
}

function getMemoryInfo(): SystemSnapshot['memory'] {
  const out = run('vm_stat')
  const psMatch = out.match(/page size of (\d+) bytes/)
  const ps = psMatch ? parseInt(psMatch[1]) : 4096
  const g = (key: string) => {
    const m = out.match(new RegExp(key + ':\\s*(\\d+)'))
    return m ? parseInt(m[1]) : 0
  }
  const free = g('Pages free')
  const active = g('Pages active')
  const inactive = g('Pages inactive')
  const spec = g('Pages speculative')
  const wired = g('Pages wired down')
  const comp = g('Pages occupied by compressor')
  const total = (free + active + inactive + spec + wired + comp) * ps
  const used = (active + wired + comp) * ps

  // Use the kernel's own memory pressure level (1=normal, 2=warn, 4=critical)
  // instead of a usage ratio, which reads 65-75% even on healthy systems.
  const pressureLevel = parseInt(run('sysctl -n vm.memory_pressure').trim()) || 1
  const pressurePercent = pressureLevel >= 4 ? 92 : pressureLevel >= 2 ? 65 : Math.round((wired + comp) / Math.max(1, wired + comp + free + inactive) * 40)

  return {
    pressurePercent: Math.min(100, pressurePercent),
    totalBytes: total, usedBytes: used, freeBytes: total - used,
  }
}

function getBatteryInfo(): SystemSnapshot['battery'] {
  const out = run('pmset -g batt')
  const pct = parseInt(out.match(/(\d+)%/)?.[1] ?? '100')
  const status = out.match(/;\s*(charging|discharging|charged|AC attached)/i)?.[1]?.toLowerCase() ?? ''
  const hasBattery = /Battery|InternalBattery/i.test(out)
  return {
    percent: pct,
    charging: status === 'charging' || status === 'ac attached',
    fullyCharged: status === 'charged' || (hasBattery && pct === 100),
    hasBattery,
  }
}

function getCPULoad(): SystemSnapshot['cpu'] {
  const cores = parseInt(run('sysctl -n hw.logicalcpu').trim()) || 1
  const total = parseFloat(
    run(`ps -A -o %cpu | awk 'NR>1 {s+=$1} END {printf "%.1f", s}'`).trim()
  ) || 0
  return { loadPercent: Math.min(100, Math.round(total / cores)) }
}

function getNetworkInfo(): SystemSnapshot['network'] {
  const out = run('netstat -ib')
  let rxBytes = 0, txBytes = 0
  for (const line of out.split('\n')) {
    if (!/^en\d+\s/.test(line) || !line.includes('<Link#')) continue
    const parts = line.trim().split(/\s+/)
    if (parts.length >= 10) {
      rxBytes += parseInt(parts[6]) || 0
      txBytes += parseInt(parts[9]) || 0
    }
  }
  const now = Date.now()
  let upKBps = 0, downKBps = 0
  if (lastNetSample && rxBytes > 0) {
    const dt = (now - lastNetSample.time) / 1000
    if (dt > 0.5) {
      upKBps = Math.max(0, (txBytes - lastNetSample.txBytes) / 1024 / dt)
      downKBps = Math.max(0, (rxBytes - lastNetSample.rxBytes) / 1024 / dt)
    }
  }
  if (rxBytes > 0) lastNetSample = { time: now, rxBytes, txBytes }
  // Try the actual Wi-Fi interface name rather than assuming en0
  const wifiIface = run("networksetup -listallhardwareports | awk '/Wi-Fi/{getline; print $2}'").trim() || 'en0'
  const ssidRaw = run(`networksetup -getairportnetwork ${wifiIface} 2>/dev/null`)
  const ssid = ssidRaw.replace(/^Current Wi-Fi Network:\s*/i, '').trim()
  return {
    upKBps: Math.round(upKBps),
    downKBps: Math.round(downKBps),
    ssid: ssid.toLowerCase().includes('not associated') || ssid === '' ? '' : ssid,
  }
}

function getConnectedDevices(): SystemSnapshot['connectedDevices'] {
  const devices: SystemSnapshot['connectedDevices'] = []
  try {
    const fsmod = require('fs') as typeof import('fs')
    const rootDev = statSync('/').dev

    // Collect disk-image mount points so we can exclude DMG mounts.
    const dmgPaths = new Set<string>()
    try {
      const hdiOut = run('hdiutil info 2>/dev/null', 3000)
      for (const m of hdiOut.matchAll(/\s+(\/Volumes\/[^\n]+)/g)) {
        dmgPaths.add(m[1].trim())
      }
    } catch {}

    for (const name of readdirSync('/Volumes')) {
      if (name.startsWith('.') || name === 'Macintosh HD') continue
      const volPath = `/Volumes/${name}`
      try {
        const lstat = fsmod.lstatSync(volPath)
        if (lstat.isSymbolicLink()) continue   // skip Home-dir symlinks
        const st = statSync(volPath)
        if (st.dev === rootDev) continue       // same APFS container as root
        if (dmgPaths.has(volPath)) continue    // disk image mount (DMG)
        devices.push({ name, type: 'disk', info: '', path: volPath })
      } catch {}
    }
  } catch {}
  return devices
}

function getMacModel(): string {
  if (cachedModel) return cachedModel
  const hw = run('sysctl -n hw.model').trim()
  if (hw.includes('MacBookPro')) cachedModel = 'MacBook Pro'
  else if (hw.includes('MacBookAir')) cachedModel = 'MacBook Air'
  else if (hw.includes('MacBook')) cachedModel = 'MacBook'
  else if (hw.includes('iMac')) cachedModel = 'iMac'
  else if (hw.includes('MacPro')) cachedModel = 'Mac Pro'
  else if (hw.includes('Macmini')) cachedModel = 'Mac mini'
  else if (hw.includes('MacStudio')) cachedModel = 'Mac Studio'
  else cachedModel = 'Mac'
  return cachedModel
}

function calcHealth(
  disk: SystemSnapshot['disk'],
  mem: SystemSnapshot['memory'],
  cpu: SystemSnapshot['cpu']
): SystemSnapshot['healthScore'] {
  const freePct = disk.totalBytes > 0 ? (disk.freeBytes / disk.totalBytes) * 100 : 50
  if (freePct < 5 || mem.pressurePercent > 95) return 'Poor'
  if (freePct < 10 || mem.pressurePercent > 85 || cpu.loadPercent > 90) return 'Fair'
  if (freePct < 20 || mem.pressurePercent > 70 || cpu.loadPercent > 75) return 'Good'
  return 'Excellent'
}

let cachedSnapshot: SystemSnapshot | null = null
let cacheTime = 0

function buildSnapshot(): SystemSnapshot {
  const disk = getDiskInfo()
  const memory = getMemoryInfo()
  const battery = getBatteryInfo()
  const cpu = getCPULoad()
  const network = getNetworkInfo()
  const connectedDevices = getConnectedDevices()
  const macModel = getMacModel()
  return { disk, memory, battery, cpu, network, connectedDevices, macModel, healthScore: calcHealth(disk, memory, cpu) }
}

export function getSystemSnapshot(): SystemSnapshot {
  if (cachedSnapshot && Date.now() - cacheTime < 3500) return cachedSnapshot
  cachedSnapshot = buildSnapshot()
  cacheTime = Date.now()
  return cachedSnapshot
}

// Called once on app ready: pre-warms cache before the UI opens,
// then keeps refreshing in the background so IPC calls are instant.
export function startSnapshotRefresh(): void {
  cachedSnapshot = buildSnapshot()
  cacheTime = Date.now()
  setInterval(() => {
    cachedSnapshot = buildSnapshot()
    cacheTime = Date.now()
  }, 4000)
}
