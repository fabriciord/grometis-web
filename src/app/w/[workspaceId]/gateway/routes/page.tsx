'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { ConfirmDialog } from '@/app/_components/ConfirmDialog';
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

type WorkspaceListItem = { id: string; name: string; role: 'viewer' | 'admin' | 'owner' };

type PluginListItem = {
  id: string;
  isGlobal?: boolean;
  routeId: string | null;
  serviceId: string | null;
  consumerId: string | null;
};

export default function RoutesPage() {
  const params = useParams<{ workspaceId: string }>();
  const router = useRouter();
  const token = useMemo(() => getAccessToken(), []);
  const queryClient = useQueryClient();
  const [routeToDelete, setRouteToDelete] = useState<{ id: string; label: string } | null>(null);

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

  const workspacesQuery = useQuery({
    queryKey: ['workspaces'],
    queryFn: async () => {
      const res = await apiFetch<{ workspaces: WorkspaceListItem[] }>('/workspaces', { token });
      return res.workspaces;
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

  const deleteRouteMutation = useMutation({
    mutationFn: async (routeId: string) => {
      return apiFetch<{ ok: true }>(`/workspaces/${params.workspaceId}/routes/${routeId}`, {
        method: 'DELETE',
        token,
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['routes', params.workspaceId] });
      await queryClient.invalidateQueries({ queryKey: ['plugins', params.workspaceId] });
    },
  });

  const role =
    workspacesQuery.data?.find((w) => w.id === params.workspaceId)?.role ?? 'viewer';
  const canManage = role === 'admin' || role === 'owner';

  const pluginCountByRoute = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of pluginsQuery.data ?? []) {
      if (p.isGlobal) continue;
      if (p.serviceId) continue;
      if (p.consumerId) continue;
      if (!p.routeId) continue;
      map.set(p.routeId, (map.get(p.routeId) ?? 0) + 1);
    }
    return map;
  }, [pluginsQuery.data]);

  return (
    <div className="space-y-6">
      <ConfirmDialog
        open={routeToDelete !== null}
        title="Delete route?"
        description={
          routeToDelete ? `Delete route "${routeToDelete.label}"? This action cannot be undone.` : undefined
        }
        tone="danger"
        confirmLabel={deleteRouteMutation.isPending ? 'Deleting…' : 'Delete'}
        cancelLabel="Cancel"
        busy={deleteRouteMutation.isPending}
        onCancel={() => setRouteToDelete(null)}
        onConfirm={() => {
          if (!routeToDelete) return;
          deleteRouteMutation.mutate(routeToDelete.id);
          setRouteToDelete(null);
        }}
      />

      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900">Routes</h1>
          <p className="mt-1 text-sm text-zinc-600">Routing rules (paths, methods, protocols).</p>
        </div>
        <Link
          href={`/w/${params.workspaceId}/gateway/routes/new`}
          className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700"
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
                    Loading…
                  </td>
                </tr>
              ) : null}
              {routesQuery.isError ? (
                <tr>
                  <td className="px-4 py-3 text-red-700" colSpan={4}>
                    Failed to load routes.
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
                      <button
                        type="button"
                        className="text-red-700 hover:underline disabled:cursor-not-allowed disabled:opacity-50"
                        disabled={
                          !canManage ||
                          (pluginCountByRoute.get(r.id) ?? 0) > 0 ||
                          deleteRouteMutation.isPending
                        }
                        title={
                          !canManage
                            ? 'You do not have permission to delete routes.'
                            : (pluginCountByRoute.get(r.id) ?? 0) > 0
                              ? 'Remove the plugins from this route before deleting.'
                              : undefined
                        }
                        onClick={() => {
                          if (!canManage) return;
                          const pluginsCount = pluginCountByRoute.get(r.id) ?? 0;
                          if (pluginsCount > 0) return;
                          const label = r.name ?? r.paths.join(', ');
                          setRouteToDelete({ id: r.id, label });
                        }}
                      >
                        {deleteRouteMutation.isPending ? 'Deleting…' : 'Delete'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}

              {routesQuery.data?.length === 0 ? (
                <tr>
                  <td className="px-4 py-3 text-zinc-600" colSpan={4}>
                    No routes yet.
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
