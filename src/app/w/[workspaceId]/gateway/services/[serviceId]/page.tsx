'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { getAccessToken } from '@/lib/auth';

type ServiceDetails = {
  id: string;
  name: string;
  host: string;
  protocol: string;
  port: number;
  enabled: boolean;
  ttl: number | null;
  path: string | null;
  tags?: string[] | null;
  connectTimeout?: number | null;
  writeTimeout?: number | null;
  readTimeout?: number | null;
  retries?: number | null;
  workspaceId?: string;
  createdAt: string;
  updatedAt: string;
};

type ActivityListItem = {
  id: string;
  statusCode: number;
  serviceId: string;
  routeId: string | null;
  consumerId: string;
  createdAt: string;
};

type RouteListItem = {
  id: string;
  name: string | null;
  protocols: string[];
  serviceId: string;
  createdAt: string;
};

type PluginListItem = {
  id: string;
  name: string;
  protocols: string[];
  enabled: boolean;
  serviceId: string | null;
  routeId: string | null;
  consumerId: string | null;
  isGlobal?: boolean;
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

function statusClass(statusCode: number) {
  if (statusCode >= 200 && statusCode < 300) return 'bg-blue-500';
  if (statusCode >= 300 && statusCode < 400) return 'bg-blue-500';
  if (statusCode >= 400 && statusCode < 500) return 'bg-red-500';
  if (statusCode >= 500 && statusCode < 600) return 'bg-red-500';
  return 'bg-zinc-400';
}

function serviceEnabledBadge(enabled: boolean) {
  return enabled
    ? 'border-zinc-200 bg-zinc-100 text-zinc-900'
    : 'border-zinc-200 bg-white text-zinc-600';
}

export default function ServiceViewPage() {
  const params = useParams<{ workspaceId: string; serviceId: string }>();
  const router = useRouter();
  const token = useMemo(() => getAccessToken(), []);
  const [timeframe, setTimeframe] = useState<Timeframe>('12h');

  useEffect(() => {
    if (!token) router.replace('/login');
  }, [router, token]);

  const serviceQuery = useQuery({
    queryKey: ['service', params.workspaceId, params.serviceId],
    queryFn: async () => {
      const res = await apiFetch<{ service: ServiceDetails }>(
        `/workspaces/${params.workspaceId}/services/${params.serviceId}`,
        { token },
      );
      return res.service;
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

  const routesQuery = useQuery({
    queryKey: ['serviceRoutes', params.workspaceId, params.serviceId],
    queryFn: async () => {
      const res = await apiFetch<{ routes: RouteListItem[] }>(
        `/workspaces/${params.workspaceId}/services/${params.serviceId}/routes`,
        { token },
      );
      return res.routes;
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


  const service = serviceQuery.data;

  const start = useMemo(() => startForTimeframe(new Date(), timeframe), [timeframe]);

  const activities = useMemo(() => {
    const all = activitiesQuery.data ?? [];
    return all
      .filter((a) => a.serviceId === params.serviceId)
      .filter((a) => new Date(a.createdAt).getTime() >= start.getTime());
  }, [activitiesQuery.data, params.serviceId, start]);

  const statusCodes = useMemo(() => {
    const total = activities.length;
    const counts = new Map<number, number>();
    for (const a of activities) {
      counts.set(a.statusCode, (counts.get(a.statusCode) ?? 0) + 1);
    }
    const rows = Array.from(counts.entries())
      .map(([code, count]) => ({ code, count, pct: total === 0 ? 0 : (count / total) * 100 }))
      .sort((a, b) => b.count - a.count);
    return { total, rows };
  }, [activities]);

  const routes = useMemo(() => (routesQuery.data ?? []).slice(0, 5), [routesQuery.data]);
  const plugins = useMemo(() => {
    const all = pluginsQuery.data ?? [];
    const related = all.filter((p) => {
      if (p.isGlobal) return false;
      if (p.routeId) return false;
      if (p.consumerId) return false;
      return p.serviceId === params.serviceId;
    });
    return related.slice(0, 5);
  }, [params.serviceId, pluginsQuery.data]);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="text-sm text-zinc-600">
            <Link className="hover:underline" href={`/w/${params.workspaceId}/gateway/services`}>
              Services
            </Link>{' '}
            <span className="text-zinc-400">›</span>{' '}
            <span className="text-zinc-900">{service?.name ?? '…'}</span>
          </div>
          <h1 className="mt-2 truncate text-3xl font-semibold text-zinc-900">{service?.name ?? '…'}</h1>

          <div className="mt-2 flex flex-wrap items-center gap-2">
            {service ? (
              <span
                className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${serviceEnabledBadge(
                  service.enabled,
                )}`}
              >
                {service.enabled ? 'Enabled' : 'Disabled'}
              </span>
            ) : null}
            <span className="inline-flex items-center rounded-full border border-zinc-200 bg-white px-2 py-0.5 text-xs text-zinc-600">
              ID: {params.serviceId}
            </span>
          </div>

          {service ? (
            <div className="mt-2 text-sm text-zinc-600">
              <span className="font-mono">
                {service.protocol}://{service.host}:{service.port}
                {service.path ? service.path : ''}
              </span>
            </div>
          ) : (
            <div className="mt-2 text-sm text-zinc-600">Loading…</div>
          )}
        </div>

        <div className="flex flex-col items-end gap-2">
          <div className="flex items-center gap-2">
            <Link
              href={`/w/${params.workspaceId}/gateway/services/${params.serviceId}/config`}
              className="rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-900 hover:bg-zinc-50"
            >
              View Config
            </Link>
            <Link
              href={`/w/${params.workspaceId}/gateway/services/${params.serviceId}/edit`}
              className="rounded-md bg-black px-3 py-2 text-sm font-medium text-white hover:bg-zinc-800"
            >
              Edit Service
            </Link>
          </div>
          {service?.updatedAt ? (
            <div className="text-xs text-zinc-500">
              Last Updated: {new Date(service.updatedAt).toLocaleString()}
            </div>
          ) : null}
        </div>
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white p-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-sm font-medium text-zinc-900">Status Codes</div>
              <div className="mt-1 text-xs text-zinc-500">Total in timeframe: {statusCodes.total.toLocaleString()}</div>
          </div>

          <div className="flex items-center gap-3">
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
        </div>

        {activitiesQuery.isLoading ? <div className="mt-3 text-sm text-zinc-600">Loading…</div> : null}
        {activitiesQuery.isError ? <div className="mt-3 text-sm text-red-700">Failed to load.</div> : null}

        {!activitiesQuery.isLoading && !activitiesQuery.isError ? (
          <div className="mt-4">
            <div className="grid grid-cols-2 px-1 text-xs font-medium text-zinc-500">
              <div>Status Code</div>
              <div className="text-right">Count</div>
            </div>

            <div className="mt-2 space-y-2">
              {statusCodes.rows.length === 0 ? (
                <div className="rounded-md border border-zinc-200 bg-zinc-50 p-3 text-sm text-zinc-600">
                  No activity in timeframe.
                </div>
              ) : null}

              {statusCodes.rows.map((row) => (
                <div key={row.code} className="rounded-md border border-zinc-200 bg-white p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm font-medium text-zinc-900">{row.code}</div>
                    <div className="text-sm text-zinc-700">
                      {row.count.toLocaleString()} ({row.pct.toFixed(2)}%)
                    </div>
                  </div>
                  <div className="mt-2 h-2 w-full rounded bg-zinc-100">
                    <div
                      className={`h-2 rounded ${statusClass(row.code)}`}
                      style={{ width: `${Math.min(100, row.pct)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <div className="rounded-xl border border-zinc-200 bg-white">
          <div className="flex items-center justify-between px-4 py-3">
            <div>
              <div className="text-sm font-medium text-zinc-900">Routes</div>
              <div className="mt-0.5 text-xs text-zinc-500">
                {routesQuery.isLoading ? 'Loading…' : `Total: ${(routesQuery.data ?? []).length.toLocaleString()}`}
              </div>
            </div>
            <Link
              className="text-sm text-blue-600 hover:underline"
              href={`/w/${params.workspaceId}/gateway/routes/new?serviceId=${params.serviceId}`}
            >
              Add Route
            </Link>
          </div>
          <div className="border-t border-zinc-200" />
          <div className="grid grid-cols-2 px-4 py-2 text-xs font-medium text-zinc-500">
            <div>Name/ID</div>
            <div className="text-right">Protocols</div>
          </div>
          <div className="border-t border-zinc-200" />
          <div className="divide-y divide-zinc-200">
            {routesQuery.isLoading ? <div className="px-4 py-3 text-sm text-zinc-600">Loading…</div> : null}
            {routesQuery.isError ? <div className="px-4 py-3 text-sm text-red-700">Failed to load.</div> : null}
            {!routesQuery.isLoading && !routesQuery.isError && routes.length === 0 ? (
              <div className="px-4 py-6 text-center">
                <div className="text-sm font-medium text-zinc-900">No routes yet</div>
                <div className="mt-1 text-sm text-zinc-600">Create your first route to start routing traffic.</div>
                <Link
                  href={`/w/${params.workspaceId}/gateway/routes/new?serviceId=${params.serviceId}`}
                  className="mt-3 inline-flex rounded-md bg-black px-3 py-2 text-sm font-medium text-white hover:bg-zinc-800"
                >
                  Add Route
                </Link>
              </div>
            ) : null}
            {routes.map((r) => (
              <Link
                key={r.id}
                href={`/w/${params.workspaceId}/gateway/routes/${r.id}`}
                className="grid grid-cols-2 items-center gap-3 px-4 py-3 hover:bg-zinc-50"
              >
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium text-zinc-900" title={r.name ?? r.id}>
                    {r.name ?? r.id}
                  </div>
                  <div className="mt-0.5 truncate text-xs text-zinc-500">{r.id}</div>
                </div>
                <div className="text-right">
                  <div className="text-sm text-zinc-700">{r.protocols.join(', ')}</div>
                </div>
              </Link>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-zinc-200 bg-white">
          <div className="flex items-center justify-between px-4 py-3">
            <div>
              <div className="text-sm font-medium text-zinc-900">Plugins</div>
              <div className="mt-0.5 text-xs text-zinc-500">
                {pluginsQuery.isLoading ? 'Loading…' : `Total: ${(pluginsQuery.data ?? []).length.toLocaleString()}`}
              </div>
            </div>
            <Link
              className="text-sm text-blue-600 hover:underline"
              href={`/w/${params.workspaceId}/gateway/plugins/new?serviceId=${params.serviceId}`}
            >
              Add Plugin
            </Link>
          </div>
          <div className="border-t border-zinc-200" />
          <div className="px-4 py-2 text-xs font-medium text-zinc-500">Plugin</div>
          <div className="border-t border-zinc-200" />
          <div className="divide-y divide-zinc-200">
            {pluginsQuery.isLoading ? <div className="px-4 py-3 text-sm text-zinc-600">Loading…</div> : null}
            {pluginsQuery.isError ? <div className="px-4 py-3 text-sm text-red-700">Failed to load.</div> : null}
            {!pluginsQuery.isLoading && !pluginsQuery.isError && plugins.length === 0 ? (
              <div className="px-4 py-6 text-center">
                <div className="text-sm font-medium text-zinc-900">No plugins on this service</div>
                <div className="mt-1 text-sm text-zinc-600">Add plugins to apply policies and transformations.</div>
                <Link
                  href={`/w/${params.workspaceId}/gateway/plugins/new?serviceId=${params.serviceId}`}
                  className="mt-3 inline-flex rounded-md bg-black px-3 py-2 text-sm font-medium text-white hover:bg-zinc-800"
                >
                  Add Plugin
                </Link>
              </div>
            ) : null}
            {plugins.map((p) => (
              <Link
                key={p.id}
                href={`/w/${params.workspaceId}/gateway/plugins/${p.id}`}
                className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-zinc-50"
                title={`${p.name} (${p.id})`}
              >
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium text-zinc-900">{p.name}</div>
                  <div className="mt-0.5 truncate text-xs text-zinc-500">{p.id}</div>
                </div>
                <span
                  className={`shrink-0 rounded-full border px-2 py-0.5 text-xs font-medium ${
                    p.enabled ? 'border-zinc-200 bg-zinc-100 text-zinc-900' : 'border-zinc-200 bg-white text-zinc-600'
                  }`}
                >
                  {p.enabled ? 'Enabled' : 'Disabled'}
                </span>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
