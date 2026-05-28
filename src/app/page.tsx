"use client";

import { useEffect, useState } from "react";
import {
  Activity, Cpu, HardDrive, Network, Database, Clock, GitBranch,
  FileText, Terminal, Zap, RefreshCw, AlertTriangle, Monitor,
  Server, BarChart3, FolderOpen, ChevronRight, ChevronDown,
  Layers, MemoryStick, Wifi, Box
} from "lucide-react";
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import {
  Tooltip, TooltipContent, TooltipTrigger,
} from "@/components/ui/tooltip";
import { Skeleton } from "@/components/ui/skeleton";

// ── Types ──────────────────────────────────────────────

type SystemInfo = {
  hostname: string; platform: string; arch: string; release: string;
  uptime: { days: number; hours: number; minutes: number; totalSeconds: number };
  cpu: { model: string; cores: number; usagePercent: number; loadAvg: number[] };
  memory: { total: number; used: number; free: number; usagePercent: number };
  disk: { filesystem: string; size: string; used: string; avail: string; usePercent: string; mounted: string }[];
  network: Record<string, { ipv4?: string; ipv6?: string; mac: string }>;
  timestamp: number;
};

type HermesData = {
  tokenStats: {
    daily: { date: string; input_tokens: number; output_tokens: number; cache_read_tokens: number; cost: number; session_count: number }[];
    totals: { total_input: number; total_output: number; total_cost: number; total_sessions: number };
  };
  recentSessions: { id: string; title: string; model: string; started_at: number; message_count: number; input_tokens: number; output_tokens: number }[];
  cronJobs: { name: string; schedule: string; prompt: string }[];
  logStats: { name: string; size: number; modified: number }[];
  timestamp: number;
};

type FilesData = {
  homeOverview: { totalItems: number; totalSize: number; totalSizeHuman: string; largeItems: { name: string; size: number; humanSize: string }[] };
  repos: { exists: boolean; repos: { name: string; branch: string; dirty: boolean; uncommittedFiles: number; lastCommit: string }[] };
  topDirs: { size: string; name: string }[];
  timestamp: number;
};

// ── Helpers ────────────────────────────────────────────

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function formatTime(unix: number): string {
  return new Date(unix * 1000).toLocaleString('zh-CN', { hour12: false });
}

function usePolling<T>(url: string, interval: number) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        setData(json);
        setError(null);
      } catch (e) {
        setError(String(e));
      } finally {
        setLoading(false);
      }
    };
    fetchData();
    const timer = setInterval(fetchData, interval);
    return () => clearInterval(timer);
  }, [url, interval]);

  return { data, loading, error };
}

// ── Sub-Components ─────────────────────────────────────

function StatCard({
  icon, label, value, sub, trend,
}: {
  icon: React.ReactNode; label: string; value: string; sub?: string; trend?: 'up' | 'down' | 'neutral';
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
        <div className="text-muted-foreground">{icon}</div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
      </CardContent>
    </Card>
  );
}

function UsageBar({ label, used, total, percent, color = "bg-primary" }: {
  label: string; used: string; total: string; percent: number; color?: string;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-mono text-xs text-muted-foreground">{used} / {total}</span>
      </div>
      <Progress value={percent} className="h-2" />
      <p className="text-xs text-muted-foreground text-right">{percent.toFixed(1)}%</p>
    </div>
  );
}

function NetworkCard({ name, info }: { name: string; info: { ipv4?: string; ipv6?: string; mac: string } }) {
  return (
    <Card className="hover:bg-accent/50 transition-colors">
      <CardHeader className="p-3 pb-1">
        <div className="flex items-center gap-2">
          <Wifi className="h-3.5 w-3.5 text-muted-foreground" />
          <CardTitle className="text-xs font-mono">{name}</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="p-3 pt-1">
        {info.ipv4 && <p className="text-xs font-mono text-muted-foreground">{info.ipv4}</p>}
        {info.ipv6 && <p className="text-xs font-mono text-muted-foreground truncate">{info.ipv6}</p>}
        {info.mac && <p className="text-[10px] text-muted-foreground/60 font-mono">{info.mac}</p>}
      </CardContent>
    </Card>
  );
}

function DiskBar({ name, used, size, usePercent }: { name: string; used: string; size: string; usePercent: string }) {
  const pct = parseInt(usePercent) || 0;
  return (
    <div className="flex items-center gap-3 py-1.5">
      <div className="w-10 shrink-0">
        <span className="text-xs font-mono text-muted-foreground">{name}</span>
      </div>
      <div className="flex-1">
        <Progress value={pct} className="h-2"
          indicatorClass={pct > 90 ? "bg-destructive" : pct > 70 ? "bg-amber-500" : ""}
        />
      </div>
      <div className="w-44 text-right">
        <span className="text-xs font-mono text-muted-foreground">{used} / {size}</span>
        <span className="text-xs text-muted-foreground/60 ml-2">({usePercent})</span>
      </div>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <Card key={i}>
          <CardHeader className="pb-2">
            <Skeleton className="h-4 w-24" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-8 w-20 mb-1" />
            <Skeleton className="h-3 w-32" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function ErrorState({ msg }: { msg: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-3">
      <AlertTriangle className="h-8 w-8 text-destructive" />
      <p className="text-sm text-destructive">{msg}</p>
    </div>
  );
}

// ── Panels ─────────────────────────────────────────────

function SystemPanel({ data }: { data: SystemInfo }) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={<Cpu className="h-4 w-4" />}
          label="CPU 使用率"
          value={`${data.cpu.usagePercent}%`}
          sub={`${data.cpu.cores} 核 · ${data.cpu.model.split(' ').slice(0, 3).join(' ')}`}
        />
        <StatCard
          icon={<MemoryStick className="h-4 w-4" />}
          label="内存"
          value={`${(data.memory.used / 1024 / 1024 / 1024).toFixed(1)} / ${(data.memory.total / 1024 / 1024 / 1024).toFixed(1)} GB`}
          sub={`${data.memory.usagePercent}% 已用`}
        />
        <StatCard
          icon={<Clock className="h-4 w-4" />}
          label="运行时间"
          value={`${data.uptime.days ? data.uptime.days + 'd ' : ''}${data.uptime.hours}h ${data.uptime.minutes}m`}
          sub={`${data.hostname} · ${data.platform}`}
        />
        <StatCard
          icon={<Activity className="h-4 w-4" />}
          label="系统负载"
          value={`${data.cpu.loadAvg[0].toFixed(2)} / ${data.cpu.loadAvg[1].toFixed(2)}`}
          sub="1m / 5m"
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <HardDrive className="h-4 w-4" /> 磁盘
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {data.disk.map((d, i) => (
            <DiskBar key={i} name={d.mounted} used={d.used} size={d.size} usePercent={d.usePercent} />
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Wifi className="h-4 w-4" /> 网络接口
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
            {Object.entries(data.network)
              .filter(([_, v]) => v.ipv4)
              .map(([name, info]) => (
                <NetworkCard key={name} name={name} info={info} />
              ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function HermesPanel({ data }: { data: HermesData }) {
  const { totals, daily } = data.tokenStats;
  const maxTokens = Math.max(...daily.map(x => x.input_tokens + x.output_tokens), 1);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={<Zap className="h-4 w-4" />}
          label="Token 总量 (30d)"
          value={(totals.total_input + totals.total_output).toLocaleString()}
          sub={`输入 ${totals.total_input.toLocaleString()} · 输出 ${totals.total_output.toLocaleString()}`}
        />
        <StatCard
          icon={<Database className="h-4 w-4" />}
          label="会话数 (30d)"
          value={String(totals.total_sessions)}
          sub={`~$${totals.total_cost.toFixed(4)}`}
        />
        <StatCard
          icon={<Terminal className="h-4 w-4" />}
          label="Cron 任务"
          value={String(data.cronJobs.length)}
          sub="定时自动化"
        />
        <StatCard
          icon={<FileText className="h-4 w-4" />}
          label="日志文件"
          value={String(data.logStats.length)}
          sub={data.logStats.length > 0 ? formatBytes(data.logStats.reduce((a, b) => a + b.size, 0)) : '0 B'}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <BarChart3 className="h-4 w-4" /> Token 消耗趋势
          </CardTitle>
          <CardDescription>近 7 天</CardDescription>
        </CardHeader>
        <CardContent>
          {daily.length > 0 ? (
            <div className="space-y-1">
              {daily.slice(0, 7).reverse().map((d) => {
                const total = d.input_tokens + d.output_tokens;
                return (
                  <div key={d.date} className="flex items-center gap-3 py-1">
                    <span className="text-xs font-mono text-muted-foreground w-24 shrink-0">{d.date}</span>
                    <div className="flex-1">
                      <div className="flex gap-0.5 h-5 items-end">
                        <Tooltip>
                          <TooltipTrigger>
                            <span
                              className="inline-block bg-primary/60 rounded-t w-1/2 transition-all"
                              style={{ height: `${(d.input_tokens / maxTokens) * 100}%`, minHeight: 2 }}
                            />
                          </TooltipTrigger>
                          <TooltipContent>输入: {d.input_tokens.toLocaleString()}</TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger>
                            <span
                              className="inline-block bg-chart-2 rounded-t w-1/2 transition-all"
                              style={{ height: `${(d.output_tokens / maxTokens) * 100}%`, minHeight: 2 }}
                            />
                          </TooltipTrigger>
                          <TooltipContent>输出: {d.output_tokens.toLocaleString()}</TooltipContent>
                        </Tooltip>
                      </div>
                    </div>
                    <span className="text-xs font-mono text-muted-foreground w-20 text-right">
                      {total.toLocaleString()}
                    </span>
                    <span className="text-[10px] text-muted-foreground/60 w-16 text-right">
                      {d.session_count} 会话
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">暂无数据</p>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Layers className="h-4 w-4" /> 最近会话
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-72 overflow-y-auto">
              {data.recentSessions.slice(0, 10).map((s) => (
                <div key={s.id} className="text-sm border-b border-border pb-2 last:border-0">
                  <p className="text-foreground truncate font-medium">{s.title || '无标题'}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{s.model?.split('/').pop() || 'unknown'}</Badge>
                    <span className="text-xs text-muted-foreground">{formatTime(s.started_at)}</span>
                    <span className="text-xs text-muted-foreground">· {s.message_count} 条消息</span>
                    <span className="text-xs text-muted-foreground">· {((s.input_tokens || 0) + (s.output_tokens || 0)).toLocaleString()} tok</span>
                  </div>
                </div>
              ))}
              {data.recentSessions.length === 0 && (
                <p className="text-sm text-muted-foreground">暂无会话</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Terminal className="h-4 w-4" /> Cron 任务
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-72 overflow-y-auto">
              {data.cronJobs.map((c) => (
                <div key={c.name} className="text-sm border-b border-border pb-2 last:border-0">
                  <p className="text-foreground font-medium">{c.name}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <Badge variant="outline" className="text-[10px] font-mono px-1.5 py-0">{c.schedule}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">{c.prompt}</p>
                </div>
              ))}
              {data.cronJobs.length === 0 && (
                <p className="text-sm text-muted-foreground">暂无定时任务</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function FilesPanel({ data }: { data: FilesData }) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard
          icon={<HardDrive className="h-4 w-4" />}
          label="用户目录"
          value={data.homeOverview.totalSizeHuman}
          sub={`${data.homeOverview.totalItems} 个文件`}
        />
        <StatCard
          icon={<GitBranch className="h-4 w-4" />}
          label="Git 仓库"
          value={String(data.repos.repos.length)}
          sub={data.repos.repos.filter(r => r.dirty).length > 0
            ? `${data.repos.repos.filter(r => r.dirty).length} 个未提交`
            : '全部干净'}
        />
        <StatCard
          icon={<AlertTriangle className="h-4 w-4" />}
          label="大文件 (&gt;50MB)"
          value={String(data.homeOverview.largeItems.length)}
          sub="存储大户"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <GitBranch className="h-4 w-4" /> 仓库状态
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-72 overflow-y-auto">
              {data.repos.repos.map((r) => (
                <div key={r.name} className="text-sm border-b border-border pb-2 last:border-0">
                  <div className="flex items-center gap-2">
                    <span className="text-foreground font-medium">{r.name}</span>
                    <Badge variant="secondary" className="text-[10px] font-mono">{r.branch}</Badge>
                    {r.dirty && (
                      <Badge variant="destructive" className="text-[10px]">* {r.uncommittedFiles}</Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">{r.lastCommit}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <FolderOpen className="h-4 w-4" /> 大文件 / 大目录
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1 max-h-72 overflow-y-auto">
              {data.homeOverview.largeItems.slice(0, 10).map((item) => (
                <div key={item.name} className="flex items-center justify-between text-sm border-b border-border py-1.5 last:border-0">
                  <span className="text-foreground truncate flex-1">{item.name}</span>
                  <span className="text-xs text-muted-foreground ml-2 font-mono">{item.humanSize}</span>
                </div>
              ))}
              {data.homeOverview.largeItems.length === 0 && (
                <p className="text-sm text-muted-foreground">无大文件</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ── Main ───────────────────────────────────────────────

export default function Home() {
  const { data: systemData, loading: sysLoading, error: sysError } = usePolling<SystemInfo>('/api/system', 5000);
  const { data: hermesData, loading: hermesLoading, error: hermesError } = usePolling<HermesData>('/api/hermes', 10000);
  const { data: filesData, loading: filesLoading, error: filesError } = usePolling<FilesData>('/api/files', 15000);

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">

            <div>
              <h1 className="text-base font-semibold leading-tight">机枢核心</h1>
              <p className="text-[10px] text-muted-foreground leading-tight">Core of the Loom</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
              <RefreshCw className="h-3 w-3 animate-spin" />
              自动刷新
            </div>
            <Badge variant="outline" className="text-[10px] font-mono">v0.1</Badge>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="container mx-auto px-4 py-6">
        <Tabs defaultValue="system" className="space-y-6">
          <TabsList>
            <TabsTrigger value="system" className="flex items-center gap-2">
              <Server className="h-4 w-4" /> System
            </TabsTrigger>
            <TabsTrigger value="hermes" className="flex items-center gap-2">
              <Zap className="h-4 w-4" /> Hermes
            </TabsTrigger>
            <TabsTrigger value="files" className="flex items-center gap-2">
              <FolderOpen className="h-4 w-4" /> Files
            </TabsTrigger>
          </TabsList>

          <TabsContent value="system">
            {sysLoading ? <LoadingState /> :
             sysError ? <ErrorState msg={sysError} /> :
             systemData ? <SystemPanel data={systemData} /> : null}
          </TabsContent>

          <TabsContent value="hermes">
            {hermesLoading ? <LoadingState /> :
             hermesError ? <ErrorState msg={hermesError} /> :
             hermesData ? <HermesPanel data={hermesData} /> : null}
          </TabsContent>

          <TabsContent value="files">
            {filesLoading ? <LoadingState /> :
             filesError ? <ErrorState msg={filesError} /> :
             filesData ? <FilesPanel data={filesData} /> : null}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
