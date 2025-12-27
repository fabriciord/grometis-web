'use client';

import { useQueries, useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { clearAccessToken, getAccessToken } from '@/lib/auth';

type WorkspaceAvatar = { color: string | null; imageDataUrl: string | null };

type WorkspaceListItem = {
  id: string;
  name: string;
  role: 'viewer' | 'admin' | 'owner';
  avatar?: WorkspaceAvatar;
};

type ActivityListItem = {
  id: string;
  statusCode: number;
  serviceId: string;
  routeId: string | null;
  consumerId: string;
  createdAt: string;
};

type Timeframe = '1h' | '6h' | '12h' | '24h' | '7d';

function timeframeLabel(tf: Timeframe) {
  switch (tf) {
    case '1h':
      return 'Last 1 Hour';
    case '6h':
      return 'Last 6 Hours';
    case '12h':
      return 'Last 12 Hours';
    case '24h':
      return 'Last 24 Hours';
    case '7d':
      return 'Last 7 Days';
  }
}

function startForTimeframe(now: Date, tf: Timeframe) {
  const d = new Date(now);
  switch (tf) {
    case '1h':
      d.setHours(d.getHours() - 1);
      return d;
    case '6h':
      d.setHours(d.getHours() - 6);
      return d;
    case '12h':
      d.setHours(d.getHours() - 12);
      return d;
    case '24h':
      d.setHours(d.getHours() - 24);
      return d;
    case '7d':
      d.setDate(d.getDate() - 7);
      return d;
  }
}

function bucketMinutesForTimeframe(tf: Timeframe) {
  switch (tf) {
    case '1h':
      return 2;
    case '6h':
      return 10;
    case '12h':
      return 10;
    case '24h':
      return 20;
    case '7d':
      return 240; // 4h
  }
}

function clampDateToBucket(d: Date, bucketMinutes: number) {
  const ms = d.getTime();
  const bucketMs = bucketMinutes * 60 * 1000;
  return new Date(Math.floor(ms / bucketMs) * bucketMs);
}

function svgPathFromSeries(series: number[], width: number, height: number, maxY: number) {
  const n = series.length;
  if (n === 0) return '';
  const dx = n <= 1 ? 0 : width / (n - 1);
  const pts = series.map((v, i) => {
    const x = i * dx;
    const y = height - (v / maxY) * height;
    return { x, y: Number.isFinite(y) ? y : height };
  });
  return pts
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`)
    .join(' ');
}

function svgAreaFromLine(linePath: string, width: number, height: number) {
  if (!linePath) return '';
  return `${linePath} L ${width.toFixed(2)} ${height.toFixed(2)} L 0 ${height.toFixed(2)} Z`;
}

function initials(name: string) {
  const parts = name
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  const first = parts[0]?.[0] ?? 'W';
  const second = parts.length > 1 ? parts[1]?.[0] : parts[0]?.[1];
  return `${first}${second ?? ''}`.toUpperCase();
}

function avatarBgClass(color: string | null | undefined): string {
  switch (color) {
    case 'blue':
      return 'bg-blue-600 text-white border-blue-600';
    case 'gray':
      return 'bg-zinc-500 text-white border-zinc-500';
    case 'purple':
      return 'bg-purple-600 text-white border-purple-600';
    case 'red':
      return 'bg-red-600 text-white border-red-600';
    case 'green':
      return 'bg-green-600 text-white border-green-600';
    case 'slate':
      return 'bg-slate-700 text-white border-slate-700';
    case 'amber':
      return 'bg-amber-500 text-white border-amber-500';
    case 'teal':
      return 'bg-teal-600 text-white border-teal-600';
    case 'indigo':
      return 'bg-indigo-600 text-white border-indigo-600';
    default:
      return 'bg-zinc-100 text-zinc-700 border-zinc-200';
  }
}

export default function SelectWorkspacePage() {
  const router = useRouter();
  const token = useMemo(() => getAccessToken(), []);
  const [timeframe, setTimeframe] = useState<Timeframe>('12h');
  const [showUtc, setShowUtc] = useState(false);
  const [filter, setFilter] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [showBrandLogo, setShowBrandLogo] = useState(true);

  useEffect(() => {
    if (!token) router.replace('/login');
  }, [router, token]);

  const workspacesQuery = useQuery({
    queryKey: ['workspaces'],
    queryFn: async () => {
      const res = await apiFetch<{ workspaces: WorkspaceListItem[] }>('/workspaces', {
        token,
      });
      return res.workspaces;
    },
    enabled: !!token,
  });

  const workspaces = workspacesQuery.data ?? [];

  const activitiesQueries = useQueries({
    queries: workspaces.map((w) => ({
      queryKey: ['activities', w.id],
      queryFn: async () => {
        const res = await apiFetch<{ activities: ActivityListItem[] }>(
          `/workspaces/${w.id}/activities`,
          { token },
        );
        return res.activities;
      },
      enabled: !!token && workspacesQuery.isSuccess,
      staleTime: 10_000,
    })),
  });

  const now = useMemo(() => new Date(), [timeframe]);
  const start = useMemo(() => startForTimeframe(now, timeframe), [now, timeframe]);
  const bucketMinutes = bucketMinutesForTimeframe(timeframe);

  const activitiesByWorkspaceId = useMemo(() => {
    const map = new Map<string, ActivityListItem[]>();
    for (let i = 0; i < workspaces.length; i += 1) {
      const ws = workspaces[i];
      const list = activitiesQueries[i]?.data ?? [];
      const filtered = list.filter((a) => new Date(a.createdAt).getTime() >= start.getTime());
      map.set(ws.id, filtered);
    }
    return map;
  }, [activitiesQueries, start, workspaces]);

  const { keys, seriesByWorkspaceId, totalsByWorkspaceId, overallSeries, overallStats } = useMemo(() => {
    const startBucket = clampDateToBucket(start, bucketMinutes);
    const endBucket = clampDateToBucket(now, bucketMinutes);
    const bucketMs = bucketMinutes * 60 * 1000;
    const bucketKeys: number[] = [];
    for (let t = startBucket.getTime(); t <= endBucket.getTime(); t += bucketMs) {
      bucketKeys.push(t);
    }
    const indexByTime = new Map<number, number>();
    bucketKeys.forEach((t, i) => indexByTime.set(t, i));

    const perWs = new Map<string, { success: number[]; error: number[] }>();
    const totals = new Map<
      string,
      { totalRequests: number; errorRequests: number; avgErrorRate: number; totalConsumers: number; totalServices: number }
    >();

    const overallSuccess = new Array(bucketKeys.length).fill(0) as number[];
    const overallError = new Array(bucketKeys.length).fill(0) as number[];
    const overallConsumers = new Set<string>();
    const overallServices = new Set<string>();
    let overallTotal = 0;
    let overallErrorsTotal = 0;

    for (const ws of workspaces) {
      const success = new Array(bucketKeys.length).fill(0) as number[];
      const error = new Array(bucketKeys.length).fill(0) as number[];
      const consumers = new Set<string>();
      const services = new Set<string>();
      let total = 0;
      let errors = 0;

      const list = activitiesByWorkspaceId.get(ws.id) ?? [];
      for (const a of list) {
        total += 1;
        overallTotal += 1;
        consumers.add(a.consumerId);
        services.add(a.serviceId);
        overallConsumers.add(a.consumerId);
        overallServices.add(a.serviceId);

        const d = clampDateToBucket(new Date(a.createdAt), bucketMinutes);
        const i = indexByTime.get(d.getTime());
        if (i === undefined) continue;
        if (a.statusCode >= 400) {
          error[i] += 1;
          overallError[i] += 1;
          errors += 1;
          overallErrorsTotal += 1;
        } else {
          success[i] += 1;
          overallSuccess[i] += 1;
        }
      }

      const avgErrorRate = total === 0 ? 0 : (errors / total) * 100;
      totals.set(ws.id, {
        totalRequests: total,
        errorRequests: errors,
        avgErrorRate,
        totalConsumers: consumers.size,
        totalServices: services.size,
      });
      perWs.set(ws.id, { success, error });
    }

    const overallAvgErrorRate = overallTotal === 0 ? 0 : (overallErrorsTotal / overallTotal) * 100;

    return {
      keys: bucketKeys,
      seriesByWorkspaceId: perWs,
      totalsByWorkspaceId: totals,
      overallSeries: { success: overallSuccess, error: overallError },
      overallStats: {
        totalRequests: overallTotal,
        errorRequests: overallErrorsTotal,
        avgErrorRate: overallAvgErrorRate,
        totalConsumers: overallConsumers.size,
        totalServices: overallServices.size,
      },
    };
  }, [activitiesByWorkspaceId, bucketMinutes, now, start, workspaces]);

  const isLoadingActivities = activitiesQueries.some((q) => q.isLoading);
  const isErrorActivities = activitiesQueries.some((q) => q.isError);

  const filteredWorkspaces = useMemo(() => {
    const f = filter.trim().toLowerCase();
    if (!f) return workspaces;
    return workspaces.filter((w) => w.name.toLowerCase().includes(f) || w.id.toLowerCase().includes(f));
  }, [filter, workspaces]);

  const chart = useMemo(() => {
    const width = 920;
    const height = 220;
    const maxY = Math.max(1, ...overallSeries.success, ...overallSeries.error);
    const lineSuccess = svgPathFromSeries(overallSeries.success, width, height, maxY);
    const lineError = svgPathFromSeries(overallSeries.error, width, height, maxY);
    return {
      width,
      height,
      maxY,
      lineSuccess,
      lineError,
      areaSuccess: svgAreaFromLine(lineSuccess, width, height),
      areaError: svgAreaFromLine(lineError, width, height),
    };
  }, [overallSeries.error, overallSeries.success]);

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900">
      <header className="sticky top-0 z-20 border-b border-zinc-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3">
          <div className="flex items-center gap-3">
            {showBrandLogo ? (
              <img
                src="/brand/grometis-logo.png"
                alt="GrOMEtiS"
                className="h-8 w-8 rounded-md border border-zinc-200 bg-white object-contain"
                onError={() => setShowBrandLogo(false)}
              />
            ) : (
              <div className="flex h-8 w-8 items-center justify-center rounded-md border border-zinc-200 bg-zinc-100 text-xs font-semibold text-zinc-700">
                G
              </div>
            )}

            <div className="flex items-center gap-2">
              <div className="text-sm font-semibold text-zinc-900">GrOMEtiS</div>
              <div className="h-4 w-px bg-zinc-200" />
              <div className="text-sm text-zinc-700">Workspaces</div>
            </div>
          </div>

          <button
            type="button"
            className="rounded-md px-3 py-2 text-sm text-zinc-600 hover:text-zinc-900"
            onClick={() => {
              clearAccessToken();
              router.push('/login');
            }}
          >
            Sign out
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-6 py-10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-zinc-900">Overview</h1>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <div className="text-xs text-zinc-500">Timeframe:</div>
              <select
                className="h-9 rounded-md border border-zinc-200 bg-white px-2 text-sm text-zinc-900"
                value={timeframe}
                onChange={(e) => setTimeframe(e.target.value as Timeframe)}
              >
                {(['1h', '6h', '12h', '24h', '7d'] as const).map((tf) => (
                  <option key={tf} value={tf}>
                    {timeframeLabel(tf)}
                  </option>
                ))}
              </select>
            </div>

            <label className="inline-flex h-9 items-center gap-2 rounded-md border border-zinc-200 bg-white px-2 text-sm text-zinc-700">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-zinc-300"
                checked={showUtc}
                onChange={(e) => setShowUtc(e.target.checked)}
              />
              UTC
            </label>

            <button
              type="button"
              className="h-9 rounded-md bg-blue-600 px-3 text-sm font-medium text-white hover:bg-blue-700"
              onClick={() => router.push('/workspace/new')}
            >
              New Workspace
            </button>
          </div>
        </div>

      <div className="mt-8 rounded-xl border border-zinc-200 bg-white">
        <div className="grid grid-cols-1 gap-0 divide-y divide-zinc-200 md:grid-cols-4 md:divide-x md:divide-y-0">
          <div className="px-5 py-4">
            <div className="text-xs text-zinc-500">Total Requests</div>
            <div className="mt-1 text-2xl font-semibold text-zinc-900">
              {isLoadingActivities ? '…' : overallStats.totalRequests.toLocaleString()}
            </div>
          </div>
          <div className="px-5 py-4">
            <div className="text-xs text-zinc-500">Average Error Rate</div>
            <div className="mt-1 text-2xl font-semibold text-red-600">
              {isLoadingActivities ? '…' : `${overallStats.avgErrorRate.toFixed(2)}%`}
            </div>
          </div>
          <div className="px-5 py-4">
            <div className="text-xs text-zinc-500">Total Consumers</div>
            <div className="mt-1 text-2xl font-semibold text-zinc-900">
              {isLoadingActivities ? '…' : overallStats.totalConsumers.toLocaleString()}
            </div>
          </div>
          <div className="px-5 py-4">
            <div className="text-xs text-zinc-500">Total Services</div>
            <div className="mt-1 text-2xl font-semibold text-zinc-900">
              {isLoadingActivities ? '…' : overallStats.totalServices.toLocaleString()}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-10">
        <div className="text-lg font-semibold text-zinc-900">Requests</div>
        <div className="mt-3 rounded-xl border border-zinc-200 bg-white p-4">
          {workspacesQuery.isLoading || isLoadingActivities ? (
            <div className="text-sm text-zinc-600">Carregando…</div>
          ) : null}
          {workspacesQuery.isError || isErrorActivities ? (
            <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">Falha ao carregar dados.</div>
          ) : null}

          {!workspacesQuery.isLoading && !workspacesQuery.isError && !isLoadingActivities && !isErrorActivities ? (
            <div className="w-full overflow-x-auto">
              <svg width={chart.width} height={chart.height} viewBox={`0 0 ${chart.width} ${chart.height}`}>
                <path d={chart.areaSuccess} fill="rgba(59,130,246,0.25)" />
                <path d={chart.areaError} fill="rgba(239,68,68,0.22)" />
                <path d={chart.lineSuccess} fill="none" stroke="rgba(59,130,246,0.9)" strokeWidth={1.5} />
                <path d={chart.lineError} fill="none" stroke="rgba(239,68,68,0.9)" strokeWidth={1.2} />
              </svg>
              <div className="mt-3 text-xs text-zinc-500">
                {showUtc ? 'UTC' : 'Local time'} • {timeframeLabel(timeframe)}
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <div className="mt-12">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-lg font-semibold text-zinc-900">Workspaces</div>
          <div className="flex items-center gap-2">
            <input
              className="w-64 max-w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400"
              placeholder="Filter Workspaces"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            />
            <div className="ml-2 flex items-center gap-2 text-xs text-zinc-500">
              <span>View:</span>
              <button
                type="button"
                className={`rounded-md border px-2 py-1 text-xs ${
                  viewMode === 'grid'
                    ? 'border-zinc-200 bg-zinc-100 text-zinc-900'
                    : 'border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50'
                }`}
                onClick={() => setViewMode('grid')}
              >
                Grid
              </button>
              <button
                type="button"
                className={`rounded-md border px-2 py-1 text-xs ${
                  viewMode === 'list'
                    ? 'border-zinc-200 bg-zinc-100 text-zinc-900'
                    : 'border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50'
                }`}
                onClick={() => setViewMode('list')}
              >
                List
              </button>
            </div>
          </div>
        </div>

        <div
          className={`mt-4 grid gap-4 ${
            viewMode === 'grid' ? 'md:grid-cols-2 lg:grid-cols-3' : 'grid-cols-1'
          }`}
        >
          {workspacesQuery.isLoading ? (
            <div className="text-sm text-zinc-600">Carregando…</div>
          ) : null}
          {workspacesQuery.isError ? (
            <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">Falha ao carregar workspaces.</div>
          ) : null}

          {!workspacesQuery.isLoading && !workspacesQuery.isError && filteredWorkspaces.length === 0 ? (
            <div className="text-sm text-zinc-600">Nenhum workspace encontrado.</div>
          ) : null}

          {filteredWorkspaces.map((w) => {
            const totals = totalsByWorkspaceId.get(w.id) ?? {
              totalRequests: 0,
              errorRequests: 0,
              avgErrorRate: 0,
              totalConsumers: 0,
              totalServices: 0,
            };
            const series = seriesByWorkspaceId.get(w.id) ?? { success: [], error: [] };
            const width = 320;
            const height = 80;
            const maxY = Math.max(1, ...series.success, ...series.error);
            const lineSuccess = svgPathFromSeries(series.success, width, height, maxY);
            const lineError = svgPathFromSeries(series.error, width, height, maxY);
            const areaSuccess = svgAreaFromLine(lineSuccess, width, height);
            const areaError = svgAreaFromLine(lineError, width, height);

            return (
              <Link
                key={w.id}
                href={`/w/${w.id}/dashboard`}
                className="rounded-xl border border-zinc-200 bg-white p-4 hover:bg-zinc-50"
              >
                <div className="flex items-start gap-3">
                  {w.avatar?.imageDataUrl ? (
                    <img
                      src={w.avatar.imageDataUrl}
                      alt=""
                      className="h-8 w-8 rounded-md border border-zinc-200 bg-white object-cover"
                    />
                  ) : (
                    <div
                      className={`flex h-8 w-8 items-center justify-center rounded-md border text-xs font-semibold ${avatarBgClass(
                        w.avatar?.color,
                      )}`}
                    >
                      {initials(w.name)}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold text-zinc-900">{w.name}</div>
                    <div className="mt-0.5 truncate text-xs text-zinc-500">{w.role}</div>
                  </div>
                </div>

                <div className="mt-3 flex items-center justify-between gap-3">
                  <div className="text-xs text-blue-600">
                    {totals.totalRequests.toLocaleString()} Requests
                  </div>
                  <div className="text-xs text-red-600">{totals.avgErrorRate.toFixed(2)}% Error Rate</div>
                </div>

                <div className="mt-3 w-full overflow-hidden rounded-md border border-zinc-200 bg-white">
                  <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
                    <path d={areaSuccess} fill="rgba(59,130,246,0.22)" />
                    <path d={areaError} fill="rgba(239,68,68,0.18)" />
                    <path d={lineSuccess} fill="none" stroke="rgba(59,130,246,0.85)" strokeWidth={1.2} />
                    <path d={lineError} fill="none" stroke="rgba(239,68,68,0.85)" strokeWidth={1} />
                  </svg>
                </div>

                <div className="mt-3 flex items-center justify-between text-xs text-zinc-500">
                  <div>{totals.totalConsumers.toLocaleString()} Consumers</div>
                  <div>{totals.totalServices.toLocaleString()} Services</div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
      </div>
    </div>
  );
}
