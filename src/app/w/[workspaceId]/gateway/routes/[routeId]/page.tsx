'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { getAccessToken } from '@/lib/auth';

type ActivityListItem = {
  id: string;
  statusCode: number;
  serviceId: string;
  routeId: string | null;
  consumerId: string;
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

type ServiceDetails = {
  id: string;
  name: string;
};

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

function statusClass(statusCode: number) {
  if (statusCode >= 200 && statusCode < 300) return 'bg-blue-500';
  if (statusCode >= 300 && statusCode < 400) return 'bg-blue-500';
  if (statusCode >= 400 && statusCode < 500) return 'bg-red-500';
  if (statusCode >= 500 && statusCode < 600) return 'bg-red-500';
  return 'bg-zinc-400';
}

type RouteDetails = {
  id: string;
  name: string | null;
  description: string | null;
  paths: string[];
  methods: string[];
  protocols: string[];
  host: string | null;
  stripPath: boolean | null;
  serviceId: string;
  createdAt: string;
  updatedAt: string;
};

export default function RouteViewPage() {
  const params = useParams<{ workspaceId: string; routeId: string }>();
  const router = useRouter();
  const token = useMemo(() => getAccessToken(), []);
  const [timeframe, setTimeframe] = useState<Timeframe>('12h');

  useEffect(() => {
    if (!token) router.replace('/login');
  }, [router, token]);

  const routeQuery = useQuery({
    queryKey: ['route', params.workspaceId, params.routeId],
    queryFn: async () => {
      const res = await apiFetch<{ route: RouteDetails }>(
        `/workspaces/${params.workspaceId}/routes/${params.routeId}`,
        { token },
      );
      return res.route;
    },
    enabled: !!token,
  });


  const serviceQuery = useQuery({
    queryKey: ['service', params.workspaceId, routeQuery.data?.serviceId ?? null],
    queryFn: async () => {
      const serviceId = routeQuery.data?.serviceId;
      if (!serviceId) throw new Error('Service not selected');
      const res = await apiFetch<{ service: ServiceDetails }>(
        `/workspaces/${params.workspaceId}/services/${serviceId}`,
        { token },
      );
      return res.service;
    },
    enabled: !!token && !!routeQuery.data?.serviceId,
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


  const route = routeQuery.data;
  const service = serviceQuery.data;

  const start = useMemo(() => startForTimeframe(new Date(), timeframe), [timeframe]);

  const activities = useMemo(() => {
    const all = activitiesQuery.data ?? [];
    return all
      .filter((a) => a.routeId === params.routeId)
      .filter((a) => new Date(a.createdAt).getTime() >= start.getTime());
  }, [activitiesQuery.data, params.routeId, start]);

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

  const plugins = useMemo(() => {
    const all = pluginsQuery.data ?? [];
    const related = all.filter((p) => {
      if (p.isGlobal) return false;
      if (p.serviceId) return false;
      if (p.consumerId) return false;
      return p.routeId === params.routeId;
    });
    return related.slice(0, 5);
  }, [params.routeId, pluginsQuery.data]);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="text-sm text-zinc-600">
            <Link className="hover:underline" href={`/w/${params.workspaceId}/gateway/services`}>
              Services
            </Link>{' '}
            <span className="text-zinc-400">›</span>{' '}
            {route?.serviceId ? (
              <Link
                className="text-zinc-900 hover:underline"
                href={`/w/${params.workspaceId}/gateway/services/${route.serviceId}`}
              >
                {service?.name ?? route.serviceId}
              </Link>
            ) : (
              <span className="text-zinc-900">…</span>
            )}{' '}
            <span className="text-zinc-400">›</span>{' '}
            <span className="text-zinc-900">{route?.name ?? route?.paths?.join(', ') ?? '…'}</span>
          </div>

          <h1 className="mt-2 truncate text-3xl font-semibold text-zinc-900">
            {route?.name ?? route?.paths?.join(', ') ?? '…'}
          </h1>

          {route ? (
            <div className="mt-2 text-sm text-zinc-600">
              {route.methods.join(', ')} · {route.paths.join(', ')}
            </div>
          ) : (
            <div className="mt-2 text-sm text-zinc-600">Carregando…</div>
          )}
        </div>

        <div className="flex flex-col items-end gap-2">
          <div className="flex items-center gap-2">
            <Link
              href={`/w/${params.workspaceId}/gateway/routes/${params.routeId}/config`}
              className="rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-900 hover:bg-zinc-50"
            >
              View Config
            </Link>
            <Link
              href={`/w/${params.workspaceId}/gateway/routes/${params.routeId}/edit`}
              className="rounded-md bg-black px-3 py-2 text-sm font-medium text-white"
            >
              Edit Route
            </Link>
          </div>
          {route?.updatedAt ? (
            <div className="text-xs text-zinc-500">Last Updated: {new Date(route.updatedAt).toLocaleString()}</div>
          ) : null}
        </div>
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white p-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-sm font-medium text-zinc-900">Status Codes</div>
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

        {activitiesQuery.isLoading ? <div className="mt-3 text-sm text-zinc-600">Carregando…</div> : null}
        {activitiesQuery.isError ? <div className="mt-3 text-sm text-red-700">Falha ao carregar.</div> : null}

        {!activitiesQuery.isLoading && !activitiesQuery.isError ? (
          <div className="mt-4">
            <div className="grid grid-cols-2 px-1 text-xs font-medium text-zinc-500">
              <div>Status Code</div>
              <div className="text-right">Count</div>
            </div>

            <div className="mt-2 space-y-2">
              {statusCodes.rows.length === 0 ? (
                <div className="rounded-md border border-zinc-200 bg-zinc-50 p-3 text-sm text-zinc-600">
                  Nenhuma activity no período.
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

      <div className="rounded-xl border border-zinc-200 bg-white">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="text-sm font-medium text-zinc-900">Plugins</div>
          <Link
            className="text-sm text-blue-600 hover:underline"
            href={`/w/${params.workspaceId}/gateway/plugins/new?routeId=${params.routeId}`}
          >
            Add Plugin
          </Link>
        </div>
        <div className="border-t border-zinc-200" />
        <div className="px-4 py-2 text-xs font-medium text-zinc-500">Plugin</div>
        <div className="border-t border-zinc-200" />
        <div className="divide-y divide-zinc-200">
          {pluginsQuery.isLoading ? <div className="px-4 py-3 text-sm text-zinc-600">Carregando…</div> : null}
          {pluginsQuery.isError ? <div className="px-4 py-3 text-sm text-red-700">Falha ao carregar.</div> : null}
          {!pluginsQuery.isLoading && !pluginsQuery.isError && plugins.length === 0 ? (
            <div className="px-4 py-6 text-center text-sm text-zinc-600">No Plugins</div>
          ) : null}
          {plugins.map((p) => (
            <Link
              key={p.id}
              href={`/w/${params.workspaceId}/gateway/plugins/${p.id}`}
              className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-zinc-50"
              title={`${p.name} (${p.id})`}
            >
              <div className="min-w-0">
                <div className="truncate text-sm text-zinc-900">{p.name}</div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
