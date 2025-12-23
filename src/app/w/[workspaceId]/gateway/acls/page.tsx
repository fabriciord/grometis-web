'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useMemo } from 'react';
import { apiFetch } from '@/lib/api';
import { getAccessToken } from '@/lib/auth';

type AclListItem = {
  id: string;
  group: string;
  consumerId: string;
  tags: string[] | null;
  createdAt: string;
};

export default function AclsPage() {
  const params = useParams<{ workspaceId: string }>();
  const router = useRouter();
  const token = useMemo(() => getAccessToken(), []);

  useEffect(() => {
    if (!token) router.replace('/login');
  }, [router, token]);

  const aclsQuery = useQuery({
    queryKey: ['acls', params.workspaceId],
    queryFn: async () => {
      const res = await apiFetch<{ acls: AclListItem[] }>(
        `/workspaces/${params.workspaceId}/acls`,
        { token },
      );
      return res.acls;
    },
    enabled: !!token,
  });

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900">ACLs</h1>
          <p className="mt-1 text-sm text-zinc-600">Grupos ACL associados a um consumer.</p>
        </div>
        <Link
          href={`/w/${params.workspaceId}/gateway/acls/new`}
          className="rounded-md bg-black px-3 py-2 text-sm font-medium text-white"
        >
          New ACL
        </Link>
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-zinc-200 text-sm">
            <thead className="bg-zinc-50">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-zinc-700">Group</th>
                <th className="px-4 py-3 text-left font-medium text-zinc-700">Consumer</th>
                <th className="px-4 py-3 text-left font-medium text-zinc-700">Tags</th>
                <th className="px-4 py-3 text-right font-medium text-zinc-700">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200">
              {aclsQuery.isLoading ? (
                <tr>
                  <td className="px-4 py-3 text-zinc-600" colSpan={4}>
                    Carregando…
                  </td>
                </tr>
              ) : null}
              {aclsQuery.isError ? (
                <tr>
                  <td className="px-4 py-3 text-red-700" colSpan={4}>
                    Falha ao carregar ACLs.
                  </td>
                </tr>
              ) : null}

              {(aclsQuery.data ?? []).map((a) => (
                <tr key={a.id}>
                  <td className="px-4 py-3 font-medium text-zinc-900">{a.group}</td>
                  <td className="px-4 py-3 text-zinc-700">{a.consumerId}</td>
                  <td className="px-4 py-3 text-zinc-700">{a.tags?.length ? a.tags.join(', ') : '—'}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-3">
                      <Link
                        href={`/w/${params.workspaceId}/gateway/acls/${a.id}`}
                        className="text-zinc-900 hover:underline"
                      >
                        View
                      </Link>
                      <Link
                        href={`/w/${params.workspaceId}/gateway/acls/${a.id}/edit`}
                        className="text-zinc-900 hover:underline"
                      >
                        Edit
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}

              {aclsQuery.data?.length === 0 ? (
                <tr>
                  <td className="px-4 py-3 text-zinc-600" colSpan={4}>
                    Nenhuma ACL ainda.
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
