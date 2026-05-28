import { NextResponse } from 'next/server';
import { execSync } from 'child_process';
import { homedir } from 'os';
import { readdirSync, statSync, existsSync } from 'fs';
import path from 'path';

const HOME = homedir();

function getDirSize(dir: string): number {
  try {
    const output = execSync(`du -sb "${dir}" 2>/dev/null || echo "0"`, { encoding: 'utf8', timeout: 5000 });
    return parseInt(output.split('\t')[0], 10) || 0;
  } catch { return 0; }
}

function getTopDirs(base: string, limit: number = 10) {
  try {
    const output = execSync(
      `du -sh "${base}"/*/ 2>/dev/null | sort -rh | head -${limit}`,
      { encoding: 'utf8', timeout: 10000 }
    );
    return output.trim().split('\n').filter(Boolean).map(line => {
      const [size, ...nameParts] = line.split('\t');
      return { size, name: nameParts.join('\t') || 'unknown' };
    });
  } catch { return []; }
}

function getReposStatus() {
  const reposDir = `${HOME}/repos`;
  if (!existsSync(reposDir)) return { exists: false, repos: [] };
  
  const repos = readdirSync(reposDir).filter(f => {
    const stat = statSync(`${reposDir}/${f}`);
    return stat.isDirectory() && existsSync(`${reposDir}/${f}/.git`);
  });

  return {
    exists: true,
    repos: repos.map(name => {
      try {
        const branch = execSync(
          `git -C "${reposDir}/${name}" rev-parse --abbrev-ref HEAD 2>/dev/null`,
          { encoding: 'utf8', timeout: 3000 }
        ).trim();
        const status = execSync(
          `git -C "${reposDir}/${name}" status --porcelain 2>/dev/null`,
          { encoding: 'utf8', timeout: 3000 }
        ).trim();
        const lastCommit = execSync(
          `git -C "${reposDir}/${name}" log --oneline -1 2>/dev/null`,
          { encoding: 'utf8', timeout: 3000 }
        ).trim();
        return {
          name,
          branch: branch || 'unknown',
          dirty: status.length > 0,
          uncommittedFiles: status ? status.split('\n').length : 0,
          lastCommit: lastCommit || 'N/A',
        };
      } catch {
        return { name, branch: 'error', dirty: false, uncommittedFiles: 0, lastCommit: 'error' };
      }
    }),
  };
}

function getHomeOverview() {
  const homeDir = HOME;
  if (!existsSync(homeDir)) return {};

  const items = readdirSync(homeDir).filter(f => !f.startsWith('.'));
  const total = items.length;
  let totalSize = 0;
  
  const largeItems: { name: string; size: number; humanSize: string }[] = [];
  for (const item of items) {
    try {
      const fullPath = `${homeDir}/${item}`;
      const stat = statSync(fullPath);
      if (stat.isDirectory()) {
        const size = getDirSize(fullPath);
        totalSize += size;
        if (size > 50 * 1024 * 1024) { // > 50MB
          const mb = (size / 1024 / 1024).toFixed(1);
          largeItems.push({ name: item, size, humanSize: `${mb} MB` });
        }
      } else {
        totalSize += stat.size;
        if (stat.size > 10 * 1024 * 1024) {
          const mb = (stat.size / 1024 / 1024).toFixed(1);
          largeItems.push({ name: item, size: stat.size, humanSize: `${mb} MB` });
        }
      }
    } catch { /* skip */ }
  }

  largeItems.sort((a, b) => b.size - a.size);

  return {
    totalItems: total,
    totalSize,
    totalSizeHuman: (totalSize / 1024 / 1024 / 1024).toFixed(2) + ' GB',
    largeItems: largeItems.slice(0, 20),
  };
}

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const data = {
      homeOverview: getHomeOverview(),
      repos: getReposStatus(),
      topDirs: getTopDirs(HOME, 10),
      timestamp: Date.now(),
    };
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
