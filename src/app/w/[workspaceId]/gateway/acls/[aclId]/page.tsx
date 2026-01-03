'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useMemo } from 'react';
import { apiFetch } from '@/lib/api';
import { getAccessToken } from '@/lib/auth';

type Acl = {
  id: string;
  group: string;
  consumerId: string;
  tags: string[] | null;
  createdAt: string;
  updatedAt: string;
};

export default function AclViewPage() {
  const params = useParams<{ workspaceId: string; aclId: string }>();
  const router = useRouter();
  const token = useMemo(() => getAccessToken(), []);

  useEffect(() => {
    if (!token) router.replace('/login');
  }, [router, token]);

  const aclQuery = useQuery({
    queryKey: ['acl', params.workspaceId, params.aclId],
    queryFn: async () => {
      const res = await apiFetch<{ acl: Acl }>(
        `/workspaces/${params.workspaceId}/acls/${params.aclId}`,
        { token },
      );
      return res.acl;
    },
    enabled: !!token,
  });

  const acl = aclQuery.data;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900">ACL</h1>
          <p className="mt-1 text-sm text-zinc-600">Detalhes do grupo ACL.</p>
        </div>
        <div className="flex gap-2">
          <Link
            href={
              acl?.consumerId
                ? `/w/${params.workspaceId}/gateway/consumers/${acl.consumerId}`
                : `/w/${params.workspaceId}/gateway/acls`
            }
            className="rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-900 hover:bg-zinc-50"
          >
            Back
          </Link>
          <Link
            href={`/w/${params.workspaceId}/gateway/acls/${params.aclId}/edit`}
            className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          >
            Edit
          </Link>
        </div>
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white p-4">
        {aclQuery.isLoading ? <div className="text-sm text-zinc-600">Loading…</div> : null}
        {aclQuery.isError ? <div className="text-sm text-red-700">Failed to load.</div> : null}

        {acl ? (
          <dl className="grid gap-3 sm:grid-cols-2">
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500">Group</dt>
              <dd className="mt-1 text-sm text-zinc-900">{acl.group}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500">Consumer</dt>
              <dd className="mt-1 break-all text-sm">
                <Link
                  href={`/w/${params.workspaceId}/gateway/consumers/${acl.consumerId}`}
                  className="text-zinc-900 hover:underline"
                >
                  {acl.consumerId}
                </Link>
              </dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500">Tags</dt>
              <dd className="mt-1 text-sm text-zinc-900">{acl.tags?.length ? acl.tags.join(', ') : '—'}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500">Created</dt>
              <dd className="mt-1 text-sm text-zinc-900">{new Date(acl.createdAt).toLocaleString()}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500">Updated</dt>
              <dd className="mt-1 text-sm text-zinc-900">{new Date(acl.updatedAt).toLocaleString()}</dd>
            </div>
          </dl>
        ) : null}
      </div>
    </div>
  );
}
