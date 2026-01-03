'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useMemo } from 'react';
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

export default function ServiceConfigPage() {
  const params = useParams<{ workspaceId: string; serviceId: string }>();
  const router = useRouter();
  const token = useMemo(() => getAccessToken(), []);

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
            <Link
              className="text-zinc-900 hover:underline"
              href={`/w/${params.workspaceId}/gateway/services/${params.serviceId}`}
            >
              {service?.name ?? '…'}
            </Link>{' '}
            <span className="text-zinc-400">›</span> <span className="text-zinc-900">Config</span>
          </div>

          <h1 className="mt-2 truncate text-3xl font-semibold text-zinc-900">{service?.name ?? '…'}</h1>
          {service ? (
            <div className="mt-2 text-sm text-zinc-600">
              {service.protocol}://{service.host}:{service.port}
              {service.path ? service.path : ''}
            </div>
          ) : (
            <div className="mt-2 text-sm text-zinc-600">Loading…</div>
          )}
        </div>

        <div className="flex flex-col items-end gap-2">
          <div className="flex items-center gap-2">
            <Link
              href={`/w/${params.workspaceId}/gateway/services/${params.serviceId}/edit`}
              className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700"
            >
              Edit Service
            </Link>
          </div>
          {service?.updatedAt ? (
            <div className="text-xs text-zinc-500">Last Updated: {new Date(service.updatedAt).toLocaleString()}</div>
          ) : null}
        </div>
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="text-sm font-medium text-zinc-900">Config</div>
          <Link
            href={`/w/${params.workspaceId}/gateway/services/${params.serviceId}`}
            className="text-sm text-zinc-700 hover:underline"
          >
            Back to Service
          </Link>
        </div>
        <div className="border-t border-zinc-200" />

        {serviceQuery.isLoading ? <div className="p-4 text-sm text-zinc-600">Loading…</div> : null}
        {serviceQuery.isError ? (
          <div className="p-4 text-sm text-red-700">Failed to load service.</div>
        ) : null}

        {!serviceQuery.isLoading && !serviceQuery.isError ? (
          <div className="p-4">
            <div className="rounded-md border border-zinc-200 bg-zinc-50 p-3">
              <pre className="overflow-auto text-xs text-zinc-900">{JSON.stringify(service ?? {}, null, 2)}</pre>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
