'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { ConfirmDialog } from '@/app/_components/ConfirmDialog';
import { apiFetch } from '@/lib/api';
import { getAccessToken } from '@/lib/auth';

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

type WorkspaceListItem = { id: string; name: string; role: 'viewer' | 'admin' | 'owner' };

type RouteListItem = {
  id: string;
  serviceId: string;
};

type PluginListItem = {
  id: string;
  isGlobal?: boolean;
  serviceId: string | null;
  routeId: string | null;
  consumerId: string | null;
};

export default function ServicesPage() {
  const params = useParams<{ workspaceId: string }>();
  const router = useRouter();
  const token = useMemo(() => getAccessToken(), []);
  const queryClient = useQueryClient();
  const [serviceToDelete, setServiceToDelete] = useState<{ id: string; name: string } | null>(null);

  useEffect(() => {
    if (!token) router.replace('/login');
  }, [router, token]);

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

  const workspacesQuery = useQuery({
    queryKey: ['workspaces'],
    queryFn: async () => {
      const res = await apiFetch<{ workspaces: WorkspaceListItem[] }>('/workspaces', { token });
      return res.workspaces;
    },
    enabled: !!token,
  });

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

  const deleteServiceMutation = useMutation({
    mutationFn: async (serviceId: string) => {
      return apiFetch<{ ok: true }>(`/workspaces/${params.workspaceId}/services/${serviceId}`, {
        method: 'DELETE',
        token,
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['services', params.workspaceId] });
      await queryClient.invalidateQueries({ queryKey: ['routes', params.workspaceId] });
      await queryClient.invalidateQueries({ queryKey: ['plugins', params.workspaceId] });
    },
  });

  const role =
    workspacesQuery.data?.find((w) => w.id === params.workspaceId)?.role ?? 'viewer';
  const canManage = role === 'admin' || role === 'owner';

  const routeCountByService = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of routesQuery.data ?? []) {
      map.set(r.serviceId, (map.get(r.serviceId) ?? 0) + 1);
    }
    return map;
  }, [routesQuery.data]);

  const pluginCountByService = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of pluginsQuery.data ?? []) {
      if (p.isGlobal) continue;
      if (!p.serviceId) continue;
      if (p.routeId) continue;
      if (p.consumerId) continue;
      map.set(p.serviceId, (map.get(p.serviceId) ?? 0) + 1);
    }
    return map;
  }, [pluginsQuery.data]);

  return (
    <div className="space-y-6">
      <ConfirmDialog
        open={serviceToDelete !== null}
        title="Delete service?"
        description={
          serviceToDelete ? `Delete service "${serviceToDelete.name}"? This action cannot be undone.` : undefined
        }
        tone="danger"
        confirmLabel={deleteServiceMutation.isPending ? 'Deleting…' : 'Delete'}
        cancelLabel="Cancel"
        busy={deleteServiceMutation.isPending}
        onCancel={() => setServiceToDelete(null)}
        onConfirm={() => {
          if (!serviceToDelete) return;
          deleteServiceMutation.mutate(serviceToDelete.id);
          setServiceToDelete(null);
        }}
      />

      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900">Services</h1>
          <p className="mt-1 text-sm text-zinc-600">Define where the gateway forwards requests.</p>
        </div>
        <Link
          href={`/w/${params.workspaceId}/gateway/services/new`}
          className="rounded-md bg-black px-3 py-2 text-sm font-medium text-white"
        >
          New service
        </Link>
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-zinc-200 text-sm">
            <thead className="bg-zinc-50">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-zinc-700">Name</th>
                <th className="px-4 py-3 text-left font-medium text-zinc-700">Upstream</th>
                <th className="px-4 py-3 text-left font-medium text-zinc-700">Status</th>
                <th className="px-4 py-3 text-right font-medium text-zinc-700">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200">
              {servicesQuery.isLoading ? (
                <tr>
                  <td className="px-4 py-3 text-zinc-600" colSpan={4}>
                    Loading…
                  </td>
                </tr>
              ) : null}
              {servicesQuery.isError ? (
                <tr>
                  <td className="px-4 py-3 text-red-700" colSpan={4}>
                    Failed to load services.
                  </td>
                </tr>
              ) : null}
              {(servicesQuery.data ?? []).map((s) => (
                <tr key={s.id}>
                  <td className="px-4 py-3 font-medium text-zinc-900">{s.name}</td>
                  <td className="px-4 py-3 text-zinc-700">
                    {s.protocol}://{s.host}:{s.port}
                    {s.path ? s.path : ''}
                  </td>
                  <td className="px-4 py-3 text-zinc-700">{s.enabled ? 'enabled' : 'disabled'}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-3">
                      <Link
                        href={`/w/${params.workspaceId}/gateway/services/${s.id}`}
                        className="text-zinc-900 hover:underline"
                      >
                        View
                      </Link>
                      <Link
                        href={`/w/${params.workspaceId}/gateway/services/${s.id}/edit`}
                        className="text-zinc-900 hover:underline"
                      >
                        Edit
                      </Link>
                      <button
                        type="button"
                        className="text-red-700 hover:underline disabled:cursor-not-allowed disabled:opacity-50"
                        disabled={
                          !canManage ||
                          (routeCountByService.get(s.id) ?? 0) > 0 ||
                          (pluginCountByService.get(s.id) ?? 0) > 0 ||
                          deleteServiceMutation.isPending
                        }
                        title={
                          !canManage
                            ? 'You do not have permission to delete services.'
                            : (routeCountByService.get(s.id) ?? 0) > 0
                              ? 'Remove the routes from this service before deleting.'
                              : (pluginCountByService.get(s.id) ?? 0) > 0
                                ? 'Remove the plugins from this service before deleting.'
                                : undefined
                        }
                        onClick={() => {
                          if (!canManage) return;
                          const routesCount = routeCountByService.get(s.id) ?? 0;
                          const pluginsCount = pluginCountByService.get(s.id) ?? 0;
                          if (routesCount > 0 || pluginsCount > 0) return;
                          setServiceToDelete({ id: s.id, name: s.name });
                        }}
                      >
                        {deleteServiceMutation.isPending ? 'Deleting…' : 'Delete'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {servicesQuery.data?.length === 0 ? (
                <tr>
                  <td className="px-4 py-3 text-zinc-600" colSpan={4}>
                    No services yet.
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
