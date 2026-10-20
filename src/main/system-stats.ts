import { exec } from 'child_process'
import { promisify } from 'util'
import { readdirSync } from 'fs'
import type { SystemSnapshot } from '../shared/types'

const execAsync = promisify(exec)

let lastNetSample: { time: number; rxBytes: number; txBytes: number } | null = null
let cachedModel: string | null = null
let cachedWifiIface: string | null = null

// All shell commands are async — main process event loop never blocks
async function run(cmd: string, timeoutMs = 5000): Promise<string> {
  try {
    const { stdout } = await execAsync(cmd, { timeout: timeoutMs })
    return stdout
  } catch { return '' }
}

async function getDiskInfo(): Promise<SystemSnapshot['disk']> {
  const out = await run('diskutil info /')
  const toB = (s: string) => parseInt(s.replace(/,/g, ''))
  const cf = out.match(/Container Free Space:\s+[\d.]+ \S+ \(([\d,]+) Bytes\)/)
  const ct = out.match(/Container Total Space:\s+[\d.]+ \S+ \(([\d,]+) Bytes\)/)
  if (cf && ct) {
    const free = toB(cf[1]), total = toB(ct[1])
    return { freeBytes: free, totalBytes: total, usedBytes: total - free }
  }
  const vf = out.match(/Volume Free Space:\s+[\d.]+ \S+ \(([\d,]+) Bytes\)/)
  const vt = out.match(/Volume Total Space:\s+[\d.]+ \S+ \(([\d,]+) Bytes\)/)
  if (vf && vt) {
    const free = toB(vf[1]), total = toB(vt[1])
    return { freeBytes: free, totalBytes: total, usedBytes: total - free }
  }
  const dfLine = (await run('df -Pk /')).trim().split('\n')[1]?.trim().split(/\s+/) ?? []
  if (dfLine.length >= 4) {
    return {
      totalBytes: parseInt(dfLine[1]) * 1024,
      usedBytes: parseInt(dfLine[2]) * 1024,
      freeBytes: parseInt(dfLine[3]) * 1024,
    }
  }
  return { freeBytes: 0, totalBytes: 0, usedBytes: 0 }
}

async function getMemoryInfo(): Promise<SystemSnapshot['memory']> {
  const [vmStatOut, pressureOut] = await Promise.all([
    run('vm_stat'),
    run('sysctl -n vm.memory_pressure'),
  ])
  const psMatch = vmStatOut.match(/page size of (\d+) bytes/)
  const ps = psMatch ? parseInt(psMatch[1]) : 4096
  const g = (key: string) => {
    const m = vmStatOut.match(new RegExp(key + ':\\s*(\\d+)'))
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
  const pressureLevel = parseInt(pressureOut.trim()) || 1
  const pressurePercent = pressureLevel >= 4 ? 92
    : pressureLevel >= 2 ? 65
    : Math.round((wired + comp) / Math.max(1, wired + comp + free + inactive) * 40)
  return {
    pressurePercent: Math.min(100, pressurePercent),
    totalBytes: total, usedBytes: used, freeBytes: total - used,
  }
}

async function getBatteryInfo(): Promise<SystemSnapshot['battery']> {
  const out = await run('pmset -g batt')
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

async function getCPULoad(): Promise<SystemSnapshot['cpu']> {
  // Two-sample top gives the delta over the interval — accurate instantaneous CPU
  const out = await run(
    "top -l 2 -n 0 -s 0.5 2>/dev/null | grep 'CPU usage:' | tail -1",
    3000
  )
  const m = out.match(/CPU usage:\s+([\d.]+)%\s+user,\s+([\d.]+)%\s+sys/)
  if (m) {
    return { loadPercent: Math.min(100, Math.round(parseFloat(m[1]) + parseFloat(m[2]))) }
  }
  // Fallback: ps cumulative divided by core count
  const [psOut, cpuCountOut] = await Promise.all([
    run("ps -A -o %cpu | awk 'NR>1 {s+=$1} END {printf \"%.1f\", s}'"),
    run('sysctl -n hw.logicalcpu'),
  ])
  const cores = parseInt(cpuCountOut.trim()) || 1
  return { loadPercent: Math.min(100, Math.round((parseFloat(psOut.trim()) || 0) / cores)) }
}

async function getNetworkInfo(): Promise<SystemSnapshot['network']> {
  const out = await run('netstat -ib')
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
  // Cache Wi-Fi interface — changes only when network config changes
  if (!cachedWifiIface) {
    cachedWifiIface = (await run(
      "networksetup -listallhardwareports | awk '/Wi-Fi/{getline; print $2}'"
    )).trim() || 'en0'
  }
  const ssidRaw = await run(`networksetup -getairportnetwork ${cachedWifiIface} 2>/dev/null`)
  const ssid = ssidRaw.replace(/^Current Wi-Fi Network:\s*/i, '').trim()
  return {
    upKBps: Math.round(upKBps),
    downKBps: Math.round(downKBps),
    ssid: ssid.toLowerCase().includes('not associated') || ssid === '' ? '' : ssid,
  }
}

// Connected devices: slow (diskutil external can take 1-2s) — separate 30s cache
let cachedDevices: SystemSnapshot['connectedDevices'] | null = null
let deviceCacheTime = 0

async function getConnectedDevices(): Promise<SystemSnapshot['connectedDevices']> {
  if (cachedDevices && Date.now() - deviceCacheTime < 30000) return cachedDevices
  const devices: SystemSnapshot['connectedDevices'] = []
  try {
    const fsmod = require('fs') as typeof import('fs')
    const extOut = await run('diskutil list external physical 2>/dev/null', 8000)
    const extDisks = new Set(Array.from(extOut.matchAll(/^(\/dev\/disk\d+)\s/gm)).map(m => m[1]))
    if (extDisks.size > 0) {
      for (const name of readdirSync('/Volumes')) {
        if (name.startsWith('.') || name === 'Macintosh HD') continue
        const volPath = `/Volumes/${name}`
        try {
          if (fsmod.lstatSync(volPath).isSymbolicLink()) continue
          const dfOut = await run(`df -Pk "${volPath.replace(/"/g, '\\"')}" 2>/dev/null`)
          const device = dfOut.trim().split('\n')[1]?.trim().split(/\s+/)[0] ?? ''
          if (!Array.from(extDisks).some(d => device.startsWith(d))) continue
          devices.push({ name, type: 'disk', info: '', path: volPath })
        } catch {}
      }
    }
  } catch {}
  cachedDevices = devices
  deviceCacheTime = Date.now()
  return devices
}

function getMacModel(): string {
  if (cachedModel) return cachedModel
  const hw = require('child_process').execSync('sysctl -n hw.model', { encoding: 'utf8', timeout: 2000 }).trim()
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

// All independent stats gathered in parallel — snapshot completes in ~500ms (CPU sample time)
async function buildSnapshot(): Promise<SystemSnapshot> {
  const [disk, memory, battery, cpu, network, connectedDevices] = await Promise.all([
    getDiskInfo(),
    getMemoryInfo(),
    getBatteryInfo(),
    getCPULoad(),
    getNetworkInfo(),
    getConnectedDevices(),
  ])
  const macModel = getMacModel()
  return {
    disk, memory, battery, cpu, network, connectedDevices, macModel,
    healthScore: calcHealth(disk, memory, cpu),
  }
}

let cachedSnapshot: SystemSnapshot | null = null
let cacheTime = 0

export async function getSystemSnapshot(): Promise<SystemSnapshot> {
  if (cachedSnapshot && Date.now() - cacheTime < 4500) return cachedSnapshot
  cachedSnapshot = await buildSnapshot()
  cacheTime = Date.now()
  return cachedSnapshot
}

// Pre-warms cache before window opens; background refresh every 5s (non-blocking)
export async function startSnapshotRefresh(): Promise<void> {
  cachedSnapshot = await buildSnapshot()
  cacheTime = Date.now()
  setInterval(() => {
    buildSnapshot().then(snap => {
      cachedSnapshot = snap
      cacheTime = Date.now()
    }).catch(() => {})
  }, 5000)
}
