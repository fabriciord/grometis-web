'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useMemo } from 'react';
import { apiFetch } from '@/lib/api';
import { getAccessToken } from '@/lib/auth';

type RouteListItem = {
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
};

export default function RoutesPage() {
  const params = useParams<{ workspaceId: string }>();
  const router = useRouter();
  const token = useMemo(() => getAccessToken(), []);

  useEffect(() => {
    if (!token) router.replace('/login');
  }, [router, token]);

  const routesQuery = useQuery({
    queryKey: ['routes', params.workspaceId],
    queryFn: async () => {
      const res = await apiFetch<{ routes: RouteListItem[] }>(
        `/workspaces/${params.workspaceId}/routes`,
        { token },
      );
      return res.routes;
    },
    enabled: !!token,
  });

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900">Routes</h1>
          <p className="mt-1 text-sm text-zinc-600">Regras de roteamento (paths, methods, protocols).</p>
        </div>
        <Link
          href={`/w/${params.workspaceId}/gateway/routes/new`}
          className="rounded-md bg-black px-3 py-2 text-sm font-medium text-white"
        >
          New route
        </Link>
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-zinc-200 text-sm">
            <thead className="bg-zinc-50">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-zinc-700">Name</th>
                <th className="px-4 py-3 text-left font-medium text-zinc-700">Paths</th>
                <th className="px-4 py-3 text-left font-medium text-zinc-700">Service</th>
                <th className="px-4 py-3 text-right font-medium text-zinc-700">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200">
              {routesQuery.isLoading ? (
                <tr>
                  <td className="px-4 py-3 text-zinc-600" colSpan={4}>
                    Carregando…
                  </td>
                </tr>
              ) : null}
              {routesQuery.isError ? (
                <tr>
                  <td className="px-4 py-3 text-red-700" colSpan={4}>
                    Falha ao carregar routes.
                  </td>
                </tr>
              ) : null}

              {(routesQuery.data ?? []).map((r) => (
                <tr key={r.id}>
                  <td className="px-4 py-3 font-medium text-zinc-900">
                    {r.name ?? r.paths.join(', ')}
                  </td>
                  <td className="px-4 py-3 text-zinc-700">{r.paths.join(', ')}</td>
                  <td className="px-4 py-3 text-zinc-700">{r.serviceId}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-3">
                      <Link
                        href={`/w/${params.workspaceId}/gateway/routes/${r.id}`}
                        className="text-zinc-900 hover:underline"
                      >
                        View
                      </Link>
                      <Link
                        href={`/w/${params.workspaceId}/gateway/routes/${r.id}/edit`}
                        className="text-zinc-900 hover:underline"
                      >
                        Edit
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}

              {routesQuery.data?.length === 0 ? (
                <tr>
                  <td className="px-4 py-3 text-zinc-600" colSpan={4}>
                    Nenhuma route ainda.
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
