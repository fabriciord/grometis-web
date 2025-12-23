'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { getAccessToken } from '@/lib/auth';

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

type ServiceDetails = {
  id: string;
  name: string;
};

export default function RouteConfigPage() {
  const params = useParams<{ workspaceId: string; routeId: string }>();
  const router = useRouter();
  const token = useMemo(() => getAccessToken(), []);

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

  const route = routeQuery.data;
  const service = serviceQuery.data;

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
            <Link
              className="text-zinc-900 hover:underline"
              href={`/w/${params.workspaceId}/gateway/routes/${params.routeId}`}
            >
              {route?.name ?? route?.paths?.join(', ') ?? '…'}
            </Link>{' '}
            <span className="text-zinc-400">›</span> <span className="text-zinc-900">Config</span>
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

      <div className="rounded-xl border border-zinc-200 bg-white">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="text-sm font-medium text-zinc-900">Config</div>
          <Link
            href={`/w/${params.workspaceId}/gateway/routes/${params.routeId}`}
            className="text-sm text-zinc-700 hover:underline"
          >
            Voltar para Route
          </Link>
        </div>
        <div className="border-t border-zinc-200" />

        {routeQuery.isLoading ? <div className="p-4 text-sm text-zinc-600">Carregando…</div> : null}
        {routeQuery.isError ? <div className="p-4 text-sm text-red-700">Falha ao carregar route.</div> : null}

        {!routeQuery.isLoading && !routeQuery.isError ? (
          <div className="p-4">
            <div className="rounded-md border border-zinc-200 bg-zinc-50 p-3">
              <pre className="overflow-auto text-xs text-zinc-900">{JSON.stringify(route ?? {}, null, 2)}</pre>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
