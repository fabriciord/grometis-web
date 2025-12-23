'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { apiFetch, type ApiError } from '@/lib/api';
import { getAccessToken } from '@/lib/auth';

type ConsumerListItem = { id: string; username: string };

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

  const consumerIdFromQuery = searchParams.get('consumerId') ?? '';
  const selectedConsumerId =
    consumerId || consumerIdFromQuery || consumersQuery.data?.[0]?.id || '';

  const createAclMutation = useMutation({
    mutationFn: async () => {
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
          <p className="mt-1 text-sm text-zinc-600">Crie um grupo ACL para um consumer.</p>
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
              onChange={(e) => setConsumerId(e.target.value)}
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
            <span className="text-sm text-zinc-700">Tags (opcional, vírgula)</span>
            <input
              className="mt-1 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="prod,edge"
            />
          </label>

          <div className="sm:col-span-2">
            <button
              className="rounded-md bg-black px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
              type="submit"
              disabled={createAclMutation.isPending}
            >
              {createAclMutation.isPending ? 'Creating…' : 'Create ACL'}
            </button>
            {createAclMutation.isError ? (
              <div className="mt-2 text-sm text-red-700">Falha ao criar ACL.</div>
            ) : null}
          </div>
        </form>
      </div>
    </div>
  );
}
