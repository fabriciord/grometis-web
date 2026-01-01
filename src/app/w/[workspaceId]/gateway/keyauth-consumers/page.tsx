'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useMemo } from 'react';
import { apiFetch } from '@/lib/api';
import { getAccessToken } from '@/lib/auth';

type KeyauthConsumerListItem = {
  id: string;
  key: string;
  ttl: number | null;
  consumerId: string;
  tags: string[] | null;
  createdAt: string;
};

export default function KeyauthConsumersPage() {
  const params = useParams<{ workspaceId: string }>();
  const router = useRouter();
  const token = useMemo(() => getAccessToken(), []);

  useEffect(() => {
    if (!token) router.replace('/login');
  }, [router, token]);

  const keyauthQuery = useQuery({
    queryKey: ['keyauth-consumers', params.workspaceId],
    queryFn: async () => {
      const res = await apiFetch<{ keyauthConsumers: KeyauthConsumerListItem[] }>(
        `/workspaces/${params.workspaceId}/keyauth-consumers`,
        { token },
      );
      return res.keyauthConsumers;
    },
    enabled: !!token,
  });

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900">KeyAuth</h1>
          <p className="mt-1 text-sm text-zinc-600">KeyAuth keys linked to a consumer.</p>
        </div>
        <Link
          href={`/w/${params.workspaceId}/gateway/keyauth-consumers/new`}
          className="rounded-md bg-black px-3 py-2 text-sm font-medium text-white"
        >
          New KeyAuth
        </Link>
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-zinc-200 text-sm">
            <thead className="bg-zinc-50">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-zinc-700">Key</th>
                <th className="px-4 py-3 text-left font-medium text-zinc-700">TTL</th>
                <th className="px-4 py-3 text-left font-medium text-zinc-700">Consumer</th>
                <th className="px-4 py-3 text-right font-medium text-zinc-700">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200">
              {keyauthQuery.isLoading ? (
                <tr>
                  <td className="px-4 py-3 text-zinc-600" colSpan={4}>
                    Loading…
                  </td>
                </tr>
              ) : null}
              {keyauthQuery.isError ? (
                <tr>
                  <td className="px-4 py-3 text-red-700" colSpan={4}>
                    Failed to load KeyAuth.
                  </td>
                </tr>
              ) : null}

              {(keyauthQuery.data ?? []).map((k) => (
                <tr key={k.id}>
                  <td className="px-4 py-3 font-medium text-zinc-900 break-all">{k.key}</td>
                  <td className="px-4 py-3 text-zinc-700">{k.ttl ?? '—'}</td>
                  <td className="px-4 py-3 text-zinc-700 break-all">{k.consumerId}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-3">
                      <Link
                        href={`/w/${params.workspaceId}/gateway/keyauth-consumers/${k.id}`}
                        className="text-zinc-900 hover:underline"
                      >
                        View
                      </Link>
                      <Link
                        href={`/w/${params.workspaceId}/gateway/keyauth-consumers/${k.id}/edit`}
                        className="text-zinc-900 hover:underline"
                      >
                        Edit
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}

              {keyauthQuery.data?.length === 0 ? (
                <tr>
                  <td className="px-4 py-3 text-zinc-600" colSpan={4}>
                    No keys yet.
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
