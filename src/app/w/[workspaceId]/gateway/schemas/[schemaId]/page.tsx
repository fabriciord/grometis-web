'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useMemo } from 'react';
import { apiFetch } from '@/lib/api';
import { getAccessToken } from '@/lib/auth';

type Schema = {
  id: string;
  name: string;
  schema: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export default function SchemaViewPage() {
  const params = useParams<{ workspaceId: string; schemaId: string }>();
  const router = useRouter();
  const token = useMemo(() => getAccessToken(), []);

  useEffect(() => {
    if (!token) router.replace('/login');
  }, [router, token]);

  const schemaQuery = useQuery({
    queryKey: ['schema', params.workspaceId, params.schemaId],
    queryFn: async () => {
      const res = await apiFetch<{ schema: Schema }>(
        `/workspaces/${params.workspaceId}/schemas/${params.schemaId}`,
        { token },
      );
      return res.schema;
    },
    enabled: !!token,
  });

  const s = schemaQuery.data;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900">Schema</h1>
          <p className="mt-1 text-sm text-zinc-600">Detalhes do schema JSON.</p>
        </div>
        <div className="flex gap-2">
          <Link
            href={`/w/${params.workspaceId}/gateway/schemas`}
            className="rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-900 hover:bg-zinc-50"
          >
            Back
          </Link>
          <Link
            href={`/w/${params.workspaceId}/gateway/schemas/${params.schemaId}/edit`}
            className="rounded-md bg-black px-3 py-2 text-sm font-medium text-white"
          >
            Edit
          </Link>
        </div>
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white p-4">
        {schemaQuery.isLoading ? <div className="text-sm text-zinc-600">Loading…</div> : null}
        {schemaQuery.isError ? <div className="text-sm text-red-700">Failed to load.</div> : null}

        {s ? (
          <div className="space-y-4">
            <dl className="grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500">Name</dt>
                <dd className="mt-1 text-sm text-zinc-900">{s.name}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500">Created</dt>
                <dd className="mt-1 text-sm text-zinc-900">{new Date(s.createdAt).toLocaleString()}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500">Updated</dt>
                <dd className="mt-1 text-sm text-zinc-900">{new Date(s.updatedAt).toLocaleString()}</dd>
              </div>
            </dl>

            <div>
              <div className="text-xs font-medium uppercase tracking-wide text-zinc-500">Schema</div>
              <pre className="mt-2 overflow-x-auto rounded-md border border-zinc-200 bg-zinc-50 p-3 text-xs text-zinc-900">
                {JSON.stringify(s.schema, null, 2)}
              </pre>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
