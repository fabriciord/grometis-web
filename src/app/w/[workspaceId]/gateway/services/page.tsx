'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useMemo } from 'react';
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

export default function ServicesPage() {
  const params = useParams<{ workspaceId: string }>();
  const router = useRouter();
  const token = useMemo(() => getAccessToken(), []);

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

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900">Services</h1>
          <p className="mt-1 text-sm text-zinc-600">Defina para onde o gateway encaminha as requisições.</p>
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
                    Carregando…
                  </td>
                </tr>
              ) : null}
              {servicesQuery.isError ? (
                <tr>
                  <td className="px-4 py-3 text-red-700" colSpan={4}>
                    Falha ao carregar services.
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
                    </div>
                  </td>
                </tr>
              ))}
              {servicesQuery.data?.length === 0 ? (
                <tr>
                  <td className="px-4 py-3 text-zinc-600" colSpan={4}>
                    Nenhum service ainda.
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
