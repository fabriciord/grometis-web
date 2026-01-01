'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { apiFetch, type ApiError } from '@/lib/api';
import { getAccessToken } from '@/lib/auth';
import { HelpHint } from '@/app/_components/HelpHint';

type ConsumerListItem = { id: string; username: string };

type PluginListItem = {
  id: string;
  name: string;
  enabled?: boolean;
  routeId?: string | null;
  serviceId?: string | null;
  consumerId?: string | null;
  isGlobal?: boolean;
};

function splitCsv(value: string): string[] {
  return value
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);
}

export default function AclNewPage() {
  const params = useParams<{ workspaceId: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = useMemo(() => getAccessToken(), []);

  const [group, setGroup] = useState('');
  const [consumerId, setConsumerId] = useState('');
  const [tags, setTags] = useState('');

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

  const hasAclPluginAvailableInWorkspace = useMemo(() => {
    return (pluginsQuery.data ?? []).some((p) => {
      const name = p.name.trim().toLowerCase();
      const enabled = p.enabled ?? true;

      if (name !== 'acl' || !enabled) return false;

      return (
        Boolean(p.routeId) ||
        Boolean(p.serviceId) ||
        Boolean(p.consumerId) ||
        p.isGlobal === true
      );
    });
  }, [pluginsQuery.data]);

  const aclBlockedReason = pluginsQuery.isLoading
    ? 'Loading workspace plugins…'
    : pluginsQuery.isError
      ? 'Failed to load workspace plugins.'
      : !hasAclPluginAvailableInWorkspace
        ? 'This feature can only be used when the ACL plugin is enabled in this workspace and installed on a route, service, consumer, or as global.'
        : null;

  const consumerIdFromQuery = searchParams.get('consumerId') ?? '';
  const selectedConsumerId =
    consumerId || consumerIdFromQuery || consumersQuery.data?.[0]?.id || '';

  const consumerLocked = !!consumerIdFromQuery;

  const createAclMutation = useMutation({
    mutationFn: async () => {
      if (aclBlockedReason) {
        throw { status: 400, message: aclBlockedReason } satisfies ApiError;
      }

      const payload: Record<string, unknown> = {
        group,
        consumerId: selectedConsumerId,
      };

      const parsedTags = splitCsv(tags);
      if (parsedTags.length) payload.tags = parsedTags;

      if (!selectedConsumerId) {
        throw { status: 400, message: 'Consumer is required' } satisfies ApiError;
      }

      return apiFetch<{ acl: { id: string } }>(
        `/workspaces/${params.workspaceId}/acls`,
        {
          method: 'POST',
          token,
          body: JSON.stringify(payload),
        },
      );
    },
    onSuccess: (res) => {
      router.push(`/w/${params.workspaceId}/gateway/acls/${res.acl.id}`);
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900">New ACL</h1>
          <p className="mt-1 text-sm text-zinc-600">Create an ACL group for a consumer.</p>
        </div>
        <Link
          href={`/w/${params.workspaceId}/gateway/acls`}
          className="rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-900 hover:bg-zinc-50"
        >
          Back
        </Link>
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white p-4">
        <form
          className="grid gap-2 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            createAclMutation.mutate();
          }}
        >
          <label className="block">
            <span className="text-sm text-zinc-700">Group</span>
            <input
              className="mt-1 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400"
              value={group}
              onChange={(e) => setGroup(e.target.value)}
              placeholder="admins"
              minLength={1}
              required
            />
          </label>

          <label className="block">
            <span className="text-sm text-zinc-700">Consumer</span>
            <select
              className="mt-1 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900"
              value={selectedConsumerId}
              onChange={(e) => {
                if (consumerLocked) return;
                setConsumerId(e.target.value);
              }}
              disabled={consumerLocked}
              required
            >
              {(consumersQuery.data ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.username}
                </option>
              ))}
            </select>
          </label>

          <label className="block sm:col-span-2">
            <span className="text-sm text-zinc-700">
              Tags <HelpHint text="Optional comma-separated tags for this ACL." />
            </span>
            <input
              className="mt-1 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="prod,edge"
            />
          </label>

          <div className="sm:col-span-2">
            {aclBlockedReason ? (
              <div className="mb-2 rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-700">
                <div className="font-medium">Action blocked</div>
                <div className="mt-1">{aclBlockedReason}</div>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Link
                    href={`/w/${params.workspaceId}/gateway/plugins/new`}
                    className="rounded-md bg-black px-3 py-2 text-sm font-medium text-white"
                  >
                    Install plugin
                  </Link>
                  <Link
                    href={`/w/${params.workspaceId}/gateway/consumers/${encodeURIComponent(selectedConsumerId)}`}
                    className="rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-900 hover:bg-zinc-50"
                  >
                    Back to consumer
                  </Link>
                </div>
              </div>
            ) : null}
            <button
              className="rounded-md bg-black px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
              type="submit"
              disabled={createAclMutation.isPending || !!aclBlockedReason}
              title={aclBlockedReason ?? undefined}
            >
              {createAclMutation.isPending ? 'Creating…' : 'Create ACL'}
            </button>
            {createAclMutation.isError ? (
              <div className="mt-2 text-sm text-red-700">Failed to create ACL.</div>
            ) : null}
          </div>
        </form>
      </div>
    </div>
  );
}
