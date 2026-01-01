'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useMemo } from 'react';
import { apiFetch } from '@/lib/api';
import { getAccessToken } from '@/lib/auth';

type ConsumerListItem = {
  id: string;
  username: string;
  customId: string;
  tags: string[] | null;
  createdAt: string;
};

export default function ConsumersPage() {
  const params = useParams<{ workspaceId: string }>();
  const router = useRouter();
  const token = useMemo(() => getAccessToken(), []);

  useEffect(() => {
    if (!token) router.replace('/login');
  }, [router, token]);

  const consumersQuery = useQuery({
    queryKey: ['consumers', params.workspaceId],
    queryFn: async () => {
      const res = await apiFetch<{ consumers: ConsumerListItem[] }>(
        `/workspaces/${params.workspaceId}/consumers`,
        { token },
      );
      return res.consumers;
    },
    enabled: !!token,
  });

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900">Consumers</h1>
          <p className="mt-1 text-sm text-zinc-600">Client identities (consumers).</p>
        </div>
        <Link
          href={`/w/${params.workspaceId}/gateway/consumers/new`}
          className="rounded-md bg-black px-3 py-2 text-sm font-medium text-white"
        >
          New consumer
        </Link>
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-zinc-200 text-sm">
            <thead className="bg-zinc-50">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-zinc-700">Username</th>
                <th className="px-4 py-3 text-left font-medium text-zinc-700">Custom ID</th>
                <th className="px-4 py-3 text-left font-medium text-zinc-700">Tags</th>
                <th className="px-4 py-3 text-right font-medium text-zinc-700">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200">
              {consumersQuery.isLoading ? (
                <tr>
                  <td className="px-4 py-3 text-zinc-600" colSpan={4}>
                    Loading…
                  </td>
                </tr>
              ) : null}
              {consumersQuery.isError ? (
                <tr>
                  <td className="px-4 py-3 text-red-700" colSpan={4}>
                    Failed to load consumers.
                  </td>
                </tr>
              ) : null}

              {(consumersQuery.data ?? []).map((c) => (
                <tr key={c.id}>
                  <td className="px-4 py-3 font-medium text-zinc-900">{c.username}</td>
                  <td className="px-4 py-3 text-zinc-700">{c.customId}</td>
                  <td className="px-4 py-3 text-zinc-700">{c.tags?.length ? c.tags.join(', ') : '—'}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-3">
                      <Link
                        href={`/w/${params.workspaceId}/gateway/consumers/${c.id}`}
                        className="text-zinc-900 hover:underline"
                      >
                        View
                      </Link>
                      <Link
                        href={`/w/${params.workspaceId}/gateway/consumers/${c.id}/edit`}
                        className="text-zinc-900 hover:underline"
                      >
                        Edit
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}

              {consumersQuery.data?.length === 0 ? (
                <tr>
                  <td className="px-4 py-3 text-zinc-600" colSpan={4}>
                    No consumers yet.
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
