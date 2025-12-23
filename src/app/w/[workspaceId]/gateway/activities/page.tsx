'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useMemo } from 'react';
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

export default function ActivitiesPage() {
  const params = useParams<{ workspaceId: string }>();
  const router = useRouter();
  const token = useMemo(() => getAccessToken(), []);

  useEffect(() => {
    if (!token) router.replace('/login');
  }, [router, token]);

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

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900">Activities</h1>
          <p className="mt-1 text-sm text-zinc-600">Eventos/auditoria de tráfego (somente leitura).</p>
        </div>
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-zinc-200 text-sm">
            <thead className="bg-zinc-50">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-zinc-700">Status</th>
                <th className="px-4 py-3 text-left font-medium text-zinc-700">Service</th>
                <th className="px-4 py-3 text-left font-medium text-zinc-700">Route</th>
                <th className="px-4 py-3 text-left font-medium text-zinc-700">Consumer</th>
                <th className="px-4 py-3 text-right font-medium text-zinc-700">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200">
              {activitiesQuery.isLoading ? (
                <tr>
                  <td className="px-4 py-3 text-zinc-600" colSpan={5}>
                    Carregando…
                  </td>
                </tr>
              ) : null}
              {activitiesQuery.isError ? (
                <tr>
                  <td className="px-4 py-3 text-red-700" colSpan={5}>
                    Falha ao carregar activities.
                  </td>
                </tr>
              ) : null}

              {(activitiesQuery.data ?? []).map((a) => (
                <tr key={a.id}>
                  <td className="px-4 py-3 font-medium text-zinc-900">{a.statusCode}</td>
                  <td className="px-4 py-3 text-zinc-700 break-all">{a.serviceId}</td>
                  <td className="px-4 py-3 text-zinc-700 break-all">{a.routeId ?? '—'}</td>
                  <td className="px-4 py-3 text-zinc-700 break-all">{a.consumerId}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-3">
                      <Link
                        href={`/w/${params.workspaceId}/gateway/activities/${a.id}`}
                        className="text-zinc-900 hover:underline"
                      >
                        View
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}

              {activitiesQuery.data?.length === 0 ? (
                <tr>
                  <td className="px-4 py-3 text-zinc-600" colSpan={5}>
                    Nenhuma activity ainda.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
