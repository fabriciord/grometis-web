'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useMemo } from 'react';
import { apiFetch } from '@/lib/api';
import { getAccessToken } from '@/lib/auth';

type Activity = {
  id: string;
  statusCode: number;
  serviceId: string;
  routeId: string | null;
  consumerId: string;
  createdAt: string;
  updatedAt: string;
};

export default function ActivityViewPage() {
  const params = useParams<{ workspaceId: string; activityId: string }>();
  const router = useRouter();
  const token = useMemo(() => getAccessToken(), []);

  useEffect(() => {
    if (!token) router.replace('/login');
  }, [router, token]);

  const activityQuery = useQuery({
    queryKey: ['activity', params.workspaceId, params.activityId],
    queryFn: async () => {
      const res = await apiFetch<{ activity: Activity }>(
        `/workspaces/${params.workspaceId}/activities/${params.activityId}`,
        { token },
      );
      return res.activity;
    },
    enabled: !!token,
  });

  const a = activityQuery.data;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900">Activity</h1>
          <p className="mt-1 text-sm text-zinc-600">Detalhes do evento (somente leitura).</p>
        </div>
        <Link
          href={`/w/${params.workspaceId}/gateway/activities`}
          className="rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-900 hover:bg-zinc-50"
        >
          Back
        </Link>
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white p-4">
        {activityQuery.isLoading ? <div className="text-sm text-zinc-600">Carregando…</div> : null}
        {activityQuery.isError ? <div className="text-sm text-red-700">Falha ao carregar.</div> : null}

        {a ? (
          <dl className="grid gap-3 sm:grid-cols-2">
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500">Status</dt>
              <dd className="mt-1 text-sm text-zinc-900">{a.statusCode}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500">Service</dt>
              <dd className="mt-1 break-all text-sm text-zinc-900">{a.serviceId}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500">Route</dt>
              <dd className="mt-1 break-all text-sm text-zinc-900">{a.routeId ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500">Consumer</dt>
              <dd className="mt-1 break-all text-sm text-zinc-900">{a.consumerId}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500">Created</dt>
              <dd className="mt-1 text-sm text-zinc-900">{new Date(a.createdAt).toLocaleString()}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500">Updated</dt>
              <dd className="mt-1 text-sm text-zinc-900">{new Date(a.updatedAt).toLocaleString()}</dd>
            </div>
          </dl>
        ) : null}
      </div>
    </div>
  );
}
