'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { ConfirmDialog } from '@/app/_components/ConfirmDialog';
import { HelpHint } from '@/app/_components/HelpHint';
import { apiFetch, type ApiError } from '@/lib/api';
import { getAccessToken } from '@/lib/auth';

type ConsumerListItem = { id: string; username: string };

type Acl = {
  id: string;
  group: string;
  consumerId: string;
  tags: string[] | null;
  createdAt: string;
  updatedAt: string;
};

function splitCsv(value: string): string[] {
  return value
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);
}

export default function AclEditPage() {
  const params = useParams<{ workspaceId: string; aclId: string }>();
  const router = useRouter();
  const token = useMemo(() => getAccessToken(), []);

  const [draftGroup, setDraftGroup] = useState<string | null>(null);
  const [draftTags, setDraftTags] = useState<string | null>(null);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);

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

  const group = draftGroup ?? aclQuery.data?.group ?? '';
  const consumerId = aclQuery.data?.consumerId ?? '';
  const tags = draftTags ?? (aclQuery.data?.tags?.join(', ') ?? '');

  const updateMutation = useMutation({
    mutationFn: async () => {
      const payload: Record<string, unknown> = {
        group,
        tags: tags.trim().length ? splitCsv(tags) : null,
      };

      return apiFetch<{ acl: { id: string } }>(
        `/workspaces/${params.workspaceId}/acls/${params.aclId}`,
        {
          method: 'PATCH',
          token,
          body: JSON.stringify(payload),
        },
      );
    },
    onSuccess: () => {
      router.push(`/w/${params.workspaceId}/gateway/acls/${params.aclId}`);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      return apiFetch<{ ok: true }>(
        `/workspaces/${params.workspaceId}/acls/${params.aclId}`,
        { method: 'DELETE', token },
      );
    },
    onSuccess: () => {
      router.push(`/w/${params.workspaceId}/gateway/acls`);
    },
  });

  const selectedConsumerId = consumerId || consumersQuery.data?.[0]?.id || '';

  return (
    <div className="space-y-6">
      <ConfirmDialog
        open={isDeleteOpen}
        title="Delete ACL?"
        description="Delete this ACL? This action cannot be undone."
        tone="danger"
        confirmLabel={deleteMutation.isPending ? 'Deleting…' : 'Delete'}
        cancelLabel="Cancel"
        busy={deleteMutation.isPending}
        onCancel={() => setIsDeleteOpen(false)}
        onConfirm={() => {
          deleteMutation.mutate();
          setIsDeleteOpen(false);
        }}
      />

      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900">Edit ACL</h1>
          <p className="mt-1 text-sm text-zinc-600">Update group/tags.</p>
        </div>
        <Link
          href={
            aclQuery.data?.consumerId
              ? `/w/${params.workspaceId}/gateway/consumers/${aclQuery.data.consumerId}`
              : `/w/${params.workspaceId}/gateway/acls/${params.aclId}`
          }
          className="rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-900 hover:bg-zinc-50"
        >
          Back
        </Link>
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white p-4">
        {aclQuery.isLoading ? <div className="text-sm text-zinc-600">Loading…</div> : null}
        {aclQuery.isError ? <div className="text-sm text-red-700">Failed to load.</div> : null}

        {aclQuery.data ? (
          <form
            className="grid gap-2 sm:grid-cols-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (!selectedConsumerId) {
                throw { status: 400, message: 'Consumer is required' } satisfies ApiError;
              }
              updateMutation.mutate();
            }}
          >
            <label className="block">
              <span className="text-sm text-zinc-700">Group</span>
              <input
                className="mt-1 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900"
                value={group}
                onChange={(e) => setDraftGroup(e.target.value)}
                required
              />
            </label>

            <label className="block">
              <span className="text-sm text-zinc-700">Consumer</span>
              <select
                className="mt-1 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900"
                value={selectedConsumerId}
                disabled
                required
              >
                {consumerId && !(consumersQuery.data ?? []).some((c) => c.id === consumerId) ? (
                  <option value={consumerId}>{consumerId}</option>
                ) : null}
                {(consumersQuery.data ?? []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.username}
                  </option>
                ))}
              </select>
            </label>

            <label className="block sm:col-span-2">
              <div className="flex items-center gap-1">
                <span className="text-sm text-zinc-700">Tags</span>
                <HelpHint text="Optional. Comma-separated values." />
              </div>
              <input
                className="mt-1 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900"
                value={tags}
                onChange={(e) => setDraftTags(e.target.value)}
              />
            </label>

            <div className="sm:col-span-2 flex items-center gap-3">
              <button
                className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                type="submit"
                disabled={updateMutation.isPending}
              >
                {updateMutation.isPending ? 'Saving…' : 'Save changes'}
              </button>

              <button
                className="rounded-md border border-red-200 bg-white px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
                type="button"
                disabled={deleteMutation.isPending}
                onClick={() => {
                  setIsDeleteOpen(true);
                }}
              >
                {deleteMutation.isPending ? 'Deleting…' : 'Delete'}
              </button>

              {updateMutation.isError ? (
                <div className="text-sm text-red-700">Failed to save.</div>
              ) : null}
              {deleteMutation.isError ? (
                <div className="text-sm text-red-700">Failed to delete.</div>
              ) : null}
            </div>
          </form>
        ) : null}
      </div>
    </div>
  );
}
