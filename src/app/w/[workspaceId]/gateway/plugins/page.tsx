'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useMemo } from 'react';
import { apiFetch } from '@/lib/api';
import { getAccessToken } from '@/lib/auth';

type PluginListItem = {
  id: string;
  name: string;
  protocols: string[];
  tags: string[] | null;
  enabled: boolean;
  config: Record<string, unknown>;
  isGlobal: boolean;
  serviceId: string | null;
  routeId: string | null;
  consumerId: string | null;
  createdAt: string;
};

function targetLabel(p: PluginListItem): string {
  if (p.serviceId) return `service: ${p.serviceId}`;
  if (p.routeId) return `route: ${p.routeId}`;
  if (p.consumerId) return `consumer: ${p.consumerId}`;
  return 'target: -';
}

export default function PluginsPage() {
  const params = useParams<{ workspaceId: string }>();
  const router = useRouter();
  const token = useMemo(() => getAccessToken(), []);

  useEffect(() => {
    if (!token) router.replace('/login');
  }, [router, token]);

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

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900">Plugins</h1>
          <p className="mt-1 text-sm text-zinc-600">Plugins por Service/Route/Consumer.</p>
        </div>
        <Link
          href={`/w/${params.workspaceId}/gateway/plugins/new`}
          className="rounded-md bg-black px-3 py-2 text-sm font-medium text-white"
        >
          New plugin
        </Link>
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-zinc-200 text-sm">
            <thead className="bg-zinc-50">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-zinc-700">Name</th>
                <th className="px-4 py-3 text-left font-medium text-zinc-700">Target</th>
                <th className="px-4 py-3 text-left font-medium text-zinc-700">Status</th>
                <th className="px-4 py-3 text-right font-medium text-zinc-700">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200">
              {pluginsQuery.isLoading ? (
                <tr>
                  <td className="px-4 py-3 text-zinc-600" colSpan={4}>
                    Carregando…
                  </td>
                </tr>
              ) : null}
              {pluginsQuery.isError ? (
                <tr>
                  <td className="px-4 py-3 text-red-700" colSpan={4}>
                    Falha ao carregar plugins.
                  </td>
                </tr>
              ) : null}
              {(pluginsQuery.data ?? []).map((p) => (
                <tr key={p.id}>
                  <td className="px-4 py-3 font-medium text-zinc-900">{p.name}</td>
                  <td className="px-4 py-3 text-zinc-700">{targetLabel(p)}</td>
                  <td className="px-4 py-3 text-zinc-700">
                    {p.enabled ? 'enabled' : 'disabled'}
                    {p.isGlobal ? ' · global' : ''}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-3">
                      <Link
                        href={`/w/${params.workspaceId}/gateway/plugins/${p.id}`}
                        className="text-zinc-900 hover:underline"
                      >
                        View
                      </Link>
                      <Link
                        href={`/w/${params.workspaceId}/gateway/plugins/${p.id}/edit`}
                        className="text-zinc-900 hover:underline"
                      >
                        Edit
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
              {pluginsQuery.data?.length === 0 ? (
                <tr>
                  <td className="px-4 py-3 text-zinc-600" colSpan={4}>
                    Nenhum plugin ainda.
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
