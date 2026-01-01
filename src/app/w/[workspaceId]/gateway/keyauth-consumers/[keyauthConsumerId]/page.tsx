'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useMemo } from 'react';
import { apiFetch } from '@/lib/api';
import { getAccessToken } from '@/lib/auth';

type KeyauthConsumer = {
  id: string;
  key: string;
  ttl: number | null;
  consumerId: string;
  tags: string[] | null;
  createdAt: string;
  updatedAt: string;
};

export default function KeyauthViewPage() {
  const params = useParams<{ workspaceId: string; keyauthConsumerId: string }>();
  const router = useRouter();
  const token = useMemo(() => getAccessToken(), []);

  useEffect(() => {
    if (!token) router.replace('/login');
  }, [router, token]);

  const keyauthQuery = useQuery({
    queryKey: ['keyauth-consumer', params.workspaceId, params.keyauthConsumerId],
    queryFn: async () => {
      const res = await apiFetch<{ keyauthConsumer: KeyauthConsumer }>(
        `/workspaces/${params.workspaceId}/keyauth-consumers/${params.keyauthConsumerId}`,
        { token },
      );
      return res.keyauthConsumer;
    },
    enabled: !!token,
  });

  const k = keyauthQuery.data;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900">KeyAuth</h1>
          <p className="mt-1 text-sm text-zinc-600">Detalhes da credencial KeyAuth.</p>
        </div>
        <div className="flex gap-2">
          <Link
            href={
              k?.consumerId
                ? `/w/${params.workspaceId}/gateway/consumers/${k.consumerId}`
                : `/w/${params.workspaceId}/gateway/keyauth-consumers`
            }
            className="rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-900 hover:bg-zinc-50"
          >
            Back
          </Link>
          <Link
            href={`/w/${params.workspaceId}/gateway/keyauth-consumers/${params.keyauthConsumerId}/edit`}
            className="rounded-md bg-black px-3 py-2 text-sm font-medium text-white"
          >
            Edit
          </Link>
        </div>
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white p-4">
        {keyauthQuery.isLoading ? <div className="text-sm text-zinc-600">Loading…</div> : null}
        {keyauthQuery.isError ? <div className="text-sm text-red-700">Failed to load.</div> : null}

        {k ? (
          <dl className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500">Key</dt>
              <dd className="mt-1 break-all text-sm text-zinc-900">{k.key}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500">TTL</dt>
              <dd className="mt-1 text-sm text-zinc-900">{k.ttl ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500">Consumer</dt>
              <dd className="mt-1 break-all text-sm">
                <Link
                  href={`/w/${params.workspaceId}/gateway/consumers/${k.consumerId}`}
                  className="text-zinc-900 hover:underline"
                >
                  {k.consumerId}
                </Link>
              </dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500">Tags</dt>
              <dd className="mt-1 text-sm text-zinc-900">{k.tags?.length ? k.tags.join(', ') : '—'}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500">Created</dt>
              <dd className="mt-1 text-sm text-zinc-900">{new Date(k.createdAt).toLocaleString()}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500">Updated</dt>
              <dd className="mt-1 text-sm text-zinc-900">{new Date(k.updatedAt).toLocaleString()}</dd>
            </div>
          </dl>
        ) : null}
      </div>
    </div>
  );
}
