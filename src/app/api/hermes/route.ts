import { NextResponse } from 'next/server';
import Database from 'better-sqlite3';
import { homedir } from 'os';
import { readFileSync } from 'fs';

const HERMES_HOME = process.env.HERMES_HOME || `${homedir()}/.hermes`;
const STATE_DB = `${HERMES_HOME}/state.db`;

function queryDB<T>(sql: string, params: any[] = []): T[] {
  try {
    const db = new Database(STATE_DB, { readonly: true });
    const stmt = db.prepare(sql);
    const rows = stmt.all(...params) as T[];
    db.close();
    return rows;
  } catch (e) {
    console.error('DB error:', e);
    return [];
  }
}

function getTokenStats() {
  const rows = queryDB<{
    date: string;
    input_tokens: number;
    output_tokens: number;
    cache_read_tokens: number;
    cache_write_tokens: number;
    cost: number;
    session_count: number;
  }>(
    `SELECT 
      date(datetime(started_at, 'unixepoch')) as date,
      COALESCE(SUM(input_tokens), 0) as input_tokens,
      COALESCE(SUM(output_tokens), 0) as output_tokens,
      COALESCE(SUM(cache_read_tokens), 0) as cache_read_tokens,
      COALESCE(SUM(cache_write_tokens), 0) as cache_write_tokens,
      COALESCE(SUM(estimated_cost_usd), 0) as cost,
      COUNT(*) as session_count
    FROM sessions
    WHERE started_at > unixepoch('now', '-30 days')
    GROUP BY date(datetime(started_at, 'unixepoch'))
    ORDER BY date DESC
    LIMIT 30`
  );

  const totals = queryDB<{
    total_input: number;
    total_output: number;
    total_cost: number;
    total_sessions: number;
  }>(
    `SELECT 
      COALESCE(SUM(input_tokens), 0) as total_input,
      COALESCE(SUM(output_tokens), 0) as total_output,
      COALESCE(SUM(estimated_cost_usd), 0) as total_cost,
      COUNT(*) as total_sessions
    FROM sessions
    WHERE started_at > unixepoch('now', '-30 days')`
  );

  return { daily: rows, totals: totals[0] || { total_input: 0, total_output: 0, total_cost: 0, total_sessions: 0 } };
}

function getRecentSessions() {
  return queryDB<{
    id: string;
    title: string;
    model: string;
    started_at: number;
    message_count: number;
    input_tokens: number;
    output_tokens: number;
  }>(
    `SELECT id, title, model, started_at, message_count, input_tokens, output_tokens
     FROM sessions
     WHERE started_at > unixepoch('now', '-7 days')
     ORDER BY started_at DESC
     LIMIT 20`
  );
}

function getCronJobs() {
  try {
    const cronDir = `${HERMES_HOME}/cron/`;
    const { readdirSync, readFileSync, existsSync } = require('fs');
    if (!existsSync(cronDir)) return [];
    const files = readdirSync(cronDir).filter((f: string) => f.endsWith('.yaml') || f.endsWith('.yml'));
    return files.map((f: string) => {
      try {
        const content = readFileSync(`${cronDir}${f}`, 'utf8');
        const name = f.replace(/\.(yaml|yml)$/, '');
        const schedule = content.match(/schedule:\s*["'](.+?)["']/)?.[1] || 'unknown';
        const prompt = content.match(/prompt:\s*["'](.+?)["']/)?.[1] || '';
        return { name, schedule, prompt: prompt.slice(0, 80) };
      } catch { return null; }
    }).filter(Boolean);
  } catch { return []; }
}

function getLogStats() {
  try {
    const logDir = `${HERMES_HOME}/logs/`;
    const { readdirSync, statSync, existsSync } = require('fs');
    if (!existsSync(logDir)) return [];
    return readdirSync(logDir)
      .filter((f: string) => f.endsWith('.log'))
      .map((f: string) => {
        const stat = statSync(`${logDir}${f}`);
        return {
          name: f,
          size: stat.size,
          modified: stat.mtimeMs,
        };
      });
  } catch { return []; }
}

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const data = {
      tokenStats: getTokenStats(),
      recentSessions: getRecentSessions(),
      cronJobs: getCronJobs(),
      logStats: getLogStats(),
      timestamp: Date.now(),
    };
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
