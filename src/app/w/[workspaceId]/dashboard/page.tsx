'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { getAccessToken } from '@/lib/auth';

type WorkspaceListItem = { id: string; name: string; role: 'viewer' | 'admin' | 'owner' };

type ServiceListItem = {
  id: string;
  name: string;
  host: string;
  protocol: string;
  port: number;
  enabled: boolean;
  ttl: number | null;
  path: string | null;
  createdAt: string;
};

type ConsumerListItem = {
  id: string;
  username: string;
  customId: string;
  tags: string[] | null;
  createdAt: string;
};

type PluginListItem = {
  id: string;
  name: string;
  createdAt: string;
};

type ActivityListItem = {
  id: string;
  statusCode: number;
  serviceId: string;
  routeId: string | null;
  consumerId: string;
  createdAt: string;
};

function statusBucket(statusCode: number) {
  if (statusCode >= 200 && statusCode < 300) return '2xx';
  if (statusCode >= 300 && statusCode < 400) return '3xx';
  if (statusCode >= 400 && statusCode < 500) return '4xx';
  if (statusCode >= 500 && statusCode < 600) return '5xx';
  return 'other';
}

type Timeframe = '1h' | '6h' | '12h' | '24h' | '7d';

function timeframeLabel(tf: Timeframe) {
  switch (tf) {
    case '1h':
      return 'Última 1 hora';
    case '6h':
      return 'Últimas 6 horas';
    case '12h':
      return 'Últimas 12 horas';
    case '24h':
      return 'Últimas 24 horas';
    case '7d':
      return 'Últimos 7 dias';
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

function formatBucketLabel(d: Date, tf: Timeframe) {
  if (tf === '7d') {
    return d.toLocaleDateString(undefined, { day: '2-digit', month: '2-digit' });
  }
  return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
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

export default function WorkspaceDashboardPage() {
  const params = useParams<{ workspaceId: string }>();
  const router = useRouter();
  const token = useMemo(() => getAccessToken(), []);
  const [timeframe, setTimeframe] = useState<Timeframe>('12h');

  useEffect(() => {
    if (!token) router.replace('/login');
  }, [router, token]);

  const workspacesQuery = useQuery({
    queryKey: ['workspaces'],
    queryFn: async () => {
      const res = await apiFetch<{ workspaces: WorkspaceListItem[] }>('/workspaces', { token });
      return res.workspaces;
    },
    enabled: !!token,
  });

  const activitiesQuery = useQuery({
    queryKey: ['activities', params.workspaceId],
    queryFn: async () => {
      const res = await apiFetch<{ activities: ActivityListItem[] }>(
        `/workspaces/${params.workspaceId}/activities`,
        { token },
      );
      return res.activities;
    },
    enabled: !!token,
  });

  const servicesQuery = useQuery({
    queryKey: ['services', params.workspaceId],
    queryFn: async () => {
      const res = await apiFetch<{ services: ServiceListItem[] }>(
        `/workspaces/${params.workspaceId}/services`,
        { token },
      );
      return res.services;
    },
    enabled: !!token,
  });

  const consumersQuery = useQuery({
    queryKey: ['consumers', params.workspaceId],
    queryFn: async () => {
      const res = await apiFetch<{ consumers: ConsumerListItem[] }>(
        `/workspaces/${params.workspaceId}/consumers`,
        { token },
      );
      return res.consumers;
    },
    enabled: !!token,
  });

  const pluginsQuery = useQuery({
    queryKey: ['plugins', params.workspaceId],
    queryFn: async () => {
      const res = await apiFetch<{ plugins: PluginListItem[] }>(
        `/workspaces/${params.workspaceId}/plugins`,
        { token },
      );
      return res.plugins;
    },
    enabled: !!token,
  });

  const workspaceName =
    workspacesQuery.data?.find((w) => w.id === params.workspaceId)?.name ?? params.workspaceId;

  const now = new Date();
  const start = useMemo(() => startForTimeframe(now, timeframe), [now, timeframe]);
  const bucketMinutes = bucketMinutesForTimeframe(timeframe);

  const activitiesAll = activitiesQuery.data ?? [];
  const activities = useMemo(
    () => activitiesAll.filter((a) => new Date(a.createdAt).getTime() >= start.getTime()),
    [activitiesAll, start],
  );

  const { buckets, successSeries, errorSeries, bucketLabels } = useMemo(() => {
    const startBucket = clampDateToBucket(start, bucketMinutes);
    const endBucket = clampDateToBucket(now, bucketMinutes);
    const bucketMs = bucketMinutes * 60 * 1000;
    const keys: number[] = [];

    for (let t = startBucket.getTime(); t <= endBucket.getTime(); t += bucketMs) {
      keys.push(t);
    }

    const success = new Array(keys.length).fill(0) as number[];
    const errors = new Array(keys.length).fill(0) as number[];
    const indexByTime = new Map<number, number>();
    keys.forEach((t, i) => indexByTime.set(t, i));

    for (const a of activities) {
      const d = clampDateToBucket(new Date(a.createdAt), bucketMinutes);
      const i = indexByTime.get(d.getTime());
      if (i === undefined) continue;
      if (a.statusCode >= 400) errors[i] += 1;
      else success[i] += 1;
    }

    const labels = keys.map((t) => formatBucketLabel(new Date(t), timeframe));
    return { buckets: keys, successSeries: success, errorSeries: errors, bucketLabels: labels };
  }, [activities, bucketMinutes, now, start, timeframe]);

  const stats = useMemo(() => {
    const totalRequests = activities.length;
    const errorRequests = activities.filter((a) => a.statusCode >= 400).length;
    const avgErrorRate = totalRequests === 0 ? 0 : (errorRequests / totalRequests) * 100;
    const totalConsumers = new Set(activities.map((a) => a.consumerId)).size;
    const totalServices = new Set(activities.map((a) => a.serviceId)).size;
    return { totalRequests, errorRequests, avgErrorRate, totalConsumers, totalServices };
  }, [activities]);

  const servicesPreview = useMemo(() => (servicesQuery.data ?? []).slice(0, 5), [servicesQuery.data]);
  const consumersPreview = useMemo(() => (consumersQuery.data ?? []).slice(0, 5), [consumersQuery.data]);
  const latestPlugins = useMemo(() => {
    const list = pluginsQuery.data ?? [];
    return [...list]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 5);
  }, [pluginsQuery.data]);

  const chart = useMemo(() => {
    const width = 1000;
    const height = 220;
    const maxY = Math.max(1, ...successSeries.map((v, i) => v + (errorSeries[i] ?? 0)));
    const successLine = svgPathFromSeries(successSeries, width, height, maxY);
    const errorLine = svgPathFromSeries(errorSeries, width, height, maxY);
    const successArea = svgAreaFromLine(successLine, width, height);
    const errorArea = svgAreaFromLine(errorLine, width, height);
    return { width, height, maxY, successLine, errorLine, successArea, errorArea };
  }, [errorSeries, successSeries]);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold text-zinc-900">{workspaceName} Workspace</h1>
        </div>

        <div className="flex items-center gap-2">
          <div className="text-xs text-zinc-500">Timeframe:</div>
          <select
            className="rounded-md border border-zinc-200 bg-white px-2 py-1 text-sm text-zinc-900"
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
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white">
        <div className="grid divide-x divide-zinc-200 sm:grid-cols-4">
          <div className="p-4">
            <div className="text-xs font-medium uppercase tracking-wide text-zinc-500">Total Requests</div>
            <div className="mt-1 text-2xl font-semibold text-zinc-900">{stats.totalRequests.toLocaleString()}</div>
          </div>
          <div className="p-4">
            <div className="text-xs font-medium uppercase tracking-wide text-zinc-500">Average Error Rate</div>
            <div className="mt-1 text-2xl font-semibold text-red-600">
              {stats.avgErrorRate.toFixed(2)}%
            </div>
          </div>
          <div className="p-4">
            <div className="text-xs font-medium uppercase tracking-wide text-zinc-500">Total Consumers</div>
            <div className="mt-1 text-2xl font-semibold text-zinc-900">{stats.totalConsumers}</div>
          </div>
          <div className="p-4">
            <div className="text-xs font-medium uppercase tracking-wide text-zinc-500">Total Services</div>
            <div className="mt-1 text-2xl font-semibold text-zinc-900">{stats.totalServices}</div>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white p-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-sm font-medium text-zinc-900">Workspace Requests</div>
            <div className="mt-1 text-xs text-zinc-500">
              {timeframeLabel(timeframe)} · Success vs Error
            </div>
          </div>
        </div>

        {activitiesQuery.isLoading ? <div className="mt-3 text-sm text-zinc-600">Carregando…</div> : null}
        {activitiesQuery.isError ? <div className="mt-3 text-sm text-red-700">Falha ao carregar.</div> : null}

        {!activitiesQuery.isLoading && !activitiesQuery.isError ? (
          <div className="mt-4">
            <div className="h-[260px] w-full">
              <svg
                viewBox={`0 0 ${chart.width} ${chart.height + 30}`}
                preserveAspectRatio="none"
                className="h-full w-full"
                role="img"
                aria-label="Workspace requests"
              >
                <rect x="0" y="0" width={chart.width} height={chart.height} fill="white" />

                <path d={chart.successArea} fill="rgb(59 130 246 / 0.25)" />
                <path d={chart.errorArea} fill="rgb(239 68 68 / 0.20)" />

                <path d={chart.successLine} fill="none" stroke="rgb(59 130 246)" strokeWidth="2" />
                <path d={chart.errorLine} fill="none" stroke="rgb(239 68 68)" strokeWidth="2" />

                {buckets.length > 1
                  ? Array.from({ length: 6 }, (_, i) => i).map((i) => {
                      const x = (i * chart.width) / 5;
                      return (
                        <line
                          key={`grid-${i}`}
                          x1={x}
                          y1={0}
                          x2={x}
                          y2={chart.height}
                          stroke="rgb(228 228 231)"
                          strokeWidth="1"
                        />
                      );
                    })
                  : null}

                {buckets.length > 0
                  ? Array.from({ length: 6 }, (_, i) => i).map((i) => {
                      const idx = Math.round((i * (buckets.length - 1)) / 5);
                      const x = buckets.length <= 1 ? 0 : (idx * chart.width) / (buckets.length - 1);
                      const label = bucketLabels[idx] ?? '';
                      return (
                        <text
                          key={`lbl-${i}`}
                          x={x}
                          y={chart.height + 22}
                          textAnchor={i === 0 ? 'start' : i === 5 ? 'end' : 'middle'}
                          fontSize="12"
                          fill="rgb(113 113 122)"
                        >
                          {label}
                        </text>
                      );
                    })
                  : null}
              </svg>
            </div>

            <div className="mt-3 flex items-center gap-4 text-xs text-zinc-600">
              <div className="flex items-center gap-2">
                <span className="inline-block h-2 w-2 rounded-sm bg-blue-500" />
                Success
              </div>
              <div className="flex items-center gap-2">
                <span className="inline-block h-2 w-2 rounded-sm bg-red-500" />
                Error
              </div>
            </div>
          </div>
        ) : null}
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <div className="rounded-xl border border-zinc-200 bg-white">
          <div className="flex items-center justify-between px-4 py-3">
            <div className="text-sm font-medium text-zinc-900">Services</div>
            <Link className="text-sm text-blue-600 hover:underline" href={`/w/${params.workspaceId}/gateway/services`}>
              VIEW ALL
            </Link>
          </div>
          <div className="border-t border-zinc-200" />
          <div className="px-4 py-2 text-xs font-medium text-zinc-500">Service Name/ID</div>
          <div className="border-t border-zinc-200" />
          <div className="divide-y divide-zinc-200">
            {servicesQuery.isLoading ? <div className="px-4 py-3 text-sm text-zinc-600">Carregando…</div> : null}
            {servicesQuery.isError ? <div className="px-4 py-3 text-sm text-red-700">Falha ao carregar.</div> : null}
            {!servicesQuery.isLoading && !servicesQuery.isError && servicesPreview.length === 0 ? (
              <div className="px-4 py-3 text-sm text-zinc-600">Nenhum service ainda.</div>
            ) : null}
            {servicesPreview.map((s) => (
              <div key={s.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <div className="truncate text-sm text-zinc-900" title={`${s.name} (${s.id})`}>
                    {s.name}
                  </div>
                </div>
                <Link
                  href={`/w/${params.workspaceId}/gateway/services/${s.id}`}
                  className="text-sm text-blue-600 hover:underline"
                >
                  View
                </Link>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-zinc-200 bg-white">
          <div className="flex items-center justify-between px-4 py-3">
            <div className="text-sm font-medium text-zinc-900">Consumers</div>
            <Link className="text-sm text-blue-600 hover:underline" href={`/w/${params.workspaceId}/gateway/consumers`}>
              VIEW ALL
            </Link>
          </div>
          <div className="border-t border-zinc-200" />
          <div className="px-4 py-2 text-xs font-medium text-zinc-500">Username/ID</div>
          <div className="border-t border-zinc-200" />
          <div className="divide-y divide-zinc-200">
            {consumersQuery.isLoading ? <div className="px-4 py-3 text-sm text-zinc-600">Carregando…</div> : null}
            {consumersQuery.isError ? <div className="px-4 py-3 text-sm text-red-700">Falha ao carregar.</div> : null}
            {!consumersQuery.isLoading && !consumersQuery.isError && consumersPreview.length === 0 ? (
              <div className="px-4 py-3 text-sm text-zinc-600">Nenhum consumer ainda.</div>
            ) : null}
            {consumersPreview.map((c) => (
              <div key={c.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <div className="truncate text-sm text-zinc-900" title={`${c.username} (${c.id})`}>
                    {c.username}
                  </div>
                </div>
                <Link
                  href={`/w/${params.workspaceId}/gateway/consumers/${c.id}`}
                  className="text-sm text-blue-600 hover:underline"
                >
                  View
                </Link>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <div className="rounded-xl border border-zinc-200 bg-white">
          <div className="flex items-center justify-between px-4 py-3">
            <div className="text-sm font-medium text-zinc-900">Latest Installed Plugins</div>
            <Link className="text-sm text-blue-600 hover:underline" href={`/w/${params.workspaceId}/gateway/plugins`}>
              VIEW ALL
            </Link>
          </div>
          <div className="border-t border-zinc-200" />
          <div className="grid grid-cols-2 px-4 py-2 text-xs font-medium text-zinc-500">
            <div>Plugin</div>
            <div className="text-right">Actions</div>
          </div>
          <div className="border-t border-zinc-200" />
          <div className="divide-y divide-zinc-200">
            {pluginsQuery.isLoading ? <div className="px-4 py-3 text-sm text-zinc-600">Carregando…</div> : null}
            {pluginsQuery.isError ? <div className="px-4 py-3 text-sm text-red-700">Falha ao carregar.</div> : null}
            {!pluginsQuery.isLoading && !pluginsQuery.isError && latestPlugins.length === 0 ? (
              <div className="px-4 py-3 text-sm text-zinc-600">Nenhum plugin ainda.</div>
            ) : null}
            {latestPlugins.map((p) => (
              <div key={p.id} className="grid grid-cols-2 items-center gap-3 px-4 py-3">
                <div className="truncate text-sm text-zinc-900" title={`${p.name} (${p.id})`}>
                  {p.name}
                </div>
                <div className="text-right">
                  <Link
                    href={`/w/${params.workspaceId}/gateway/plugins/${p.id}/edit`}
                    className="text-sm text-blue-600 hover:underline"
                  >
                    Edit Settings
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-zinc-200 bg-white p-4">
          <div className="text-sm font-medium text-zinc-900">Developer Portal Summary</div>
          <div className="mt-3 rounded-lg border border-zinc-200 bg-zinc-50 p-6 text-center">
            <div className="text-sm font-medium text-zinc-900">Developer Portal is disabled</div>
            <div className="mt-2 text-sm text-zinc-600">Enable Dev Portal para expor documentação de APIs.</div>
          </div>
        </div>
      </div>
    </div>
  );
}
