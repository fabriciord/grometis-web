'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useMemo } from 'react';
import { apiFetch } from '@/lib/api';
import { getAccessToken } from '@/lib/auth';

type SchemaListItem = {
  id: string;
  name: string;
  createdAt: string;
};

export default function SchemasPage() {
  const params = useParams<{ workspaceId: string }>();
  const router = useRouter();
  const token = useMemo(() => getAccessToken(), []);

  useEffect(() => {
    if (!token) router.replace('/login');
  }, [router, token]);

  const schemasQuery = useQuery({
    queryKey: ['schemas', params.workspaceId],
    queryFn: async () => {
      const res = await apiFetch<{ schemas: SchemaListItem[] }>(
        `/workspaces/${params.workspaceId}/schemas`,
        { token },
      );
      return res.schemas;
    },
    enabled: !!token,
  });

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900">Schemas</h1>
          <p className="mt-1 text-sm text-zinc-600">JSON schemas used for configuration/validation.</p>
        </div>
        <Link
          href={`/w/${params.workspaceId}/gateway/schemas/new`}
          className="rounded-md bg-black px-3 py-2 text-sm font-medium text-white"
        >
          New schema
        </Link>
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-zinc-200 text-sm">
            <thead className="bg-zinc-50">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-zinc-700">Name</th>
                <th className="px-4 py-3 text-right font-medium text-zinc-700">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200">
              {schemasQuery.isLoading ? (
                <tr>
                  <td className="px-4 py-3 text-zinc-600" colSpan={2}>
                    Loading…
                  </td>
                </tr>
              ) : null}
              {schemasQuery.isError ? (
                <tr>
                  <td className="px-4 py-3 text-red-700" colSpan={2}>
                    Failed to load schemas.
                  </td>
                </tr>
              ) : null}

              {(schemasQuery.data ?? []).map((s) => (
                <tr key={s.id}>
                  <td className="px-4 py-3 font-medium text-zinc-900">{s.name}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-3">
                      <Link
                        href={`/w/${params.workspaceId}/gateway/schemas/${s.id}`}
                        className="text-zinc-900 hover:underline"
                      >
                        View
                      </Link>
                      <Link
                        href={`/w/${params.workspaceId}/gateway/schemas/${s.id}/edit`}
                        className="text-zinc-900 hover:underline"
                      >
                        Edit
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}

              {schemasQuery.data?.length === 0 ? (
                <tr>
                  <td className="px-4 py-3 text-zinc-600" colSpan={2}>
                    No schemas yet.
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
