import { NextResponse } from 'next/server';
import os from 'os';
import { execSync } from 'child_process';

function getDiskUsage() {
  try {
    const output = execSync('df -h / /home 2>/dev/null || df -h /', { encoding: 'utf8', timeout: 5000 });
    const lines = output.trim().split('\n').slice(1);
    return lines.map(line => {
      const parts = line.split(/\s+/);
      return {
        filesystem: parts[0],
        size: parts[1],
        used: parts[2],
        avail: parts[3],
        usePercent: parts[4],
        mounted: parts[5],
      };
    });
  } catch { return []; }
}

function getCpuInfo() {
  const cpus = os.cpus();
  const model = cpus[0]?.model || 'unknown';
  const cores = cpus.length;
  // Calculate aggregate usage
  let totalIdle = 0, totalTick = 0;
  cpus.forEach(cpu => {
    for (const type in cpu.times) {
      totalTick += cpu.times[type as keyof typeof cpu.times];
    }
    totalIdle += cpu.times.idle;
  });
  return {
    model,
    cores,
    usagePercent: totalTick > 0 ? Math.round(((totalTick - totalIdle) / totalTick) * 100 * 100) / 100 : 0,
    loadAvg: os.loadavg(),
  };
}

function getMemoryInfo() {
  const total = os.totalmem();
  const free = os.freemem();
  return {
    total: total,
    used: total - free,
    free: free,
    usagePercent: Math.round(((total - free) / total) * 100 * 100) / 100,
  };
}

function getUptime() {
  const uptime = os.uptime();
  const days = Math.floor(uptime / 86400);
  const hours = Math.floor((uptime % 86400) / 3600);
  const minutes = Math.floor((uptime % 3600) / 60);
  return { days, hours, minutes, totalSeconds: uptime };
}

function getNetworkInfo() {
  const interfaces = os.networkInterfaces();
  const result: Record<string, { ipv4?: string; ipv6?: string; mac: string }> = {};
  for (const [name, addrs] of Object.entries(interfaces)) {
    if (!addrs) continue;
    const entry: { ipv4?: string; ipv6?: string; mac: string } = { mac: '' };
    for (const addr of addrs) {
      if (addr.family === 'IPv4') entry.ipv4 = addr.address;
      if (addr.family === 'IPv6') entry.ipv6 = addr.address;
      if (addr.mac && addr.mac !== '00:00:00:00:00:00') entry.mac = addr.mac;
    }
    if (entry.ipv4 || entry.mac) result[name] = entry;
  }
  return result;
}

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const data = {
      hostname: os.hostname(),
      platform: os.platform(),
      arch: os.arch(),
      release: os.release(),
      uptime: getUptime(),
      cpu: getCpuInfo(),
      memory: getMemoryInfo(),
      disk: getDiskUsage(),
      network: getNetworkInfo(),
      timestamp: Date.now(),
    };
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
