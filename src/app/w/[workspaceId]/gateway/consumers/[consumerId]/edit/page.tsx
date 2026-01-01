'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { HelpHint } from '@/app/_components/HelpHint';
import { apiFetch } from '@/lib/api';
import { getAccessToken } from '@/lib/auth';

type ConsumerDetails = {
  id: string;
  username: string;
  customId: string;
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

export default function ConsumerEditPage() {
  const params = useParams<{ workspaceId: string; consumerId: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const token = useMemo(() => getAccessToken(), []);

  const usernameRef = useRef<HTMLInputElement | null>(null);
  const customIdRef = useRef<HTMLInputElement | null>(null);
  const tagsRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!token) router.replace('/login');
  }, [router, token]);

  const consumerQuery = useQuery({
    queryKey: ['consumer', params.workspaceId, params.consumerId],
    queryFn: async () => {
      const res = await apiFetch<{ consumer: ConsumerDetails }>(
        `/workspaces/${params.workspaceId}/consumers/${params.consumerId}`,
        { token },
      );
      return res.consumer;
    },
    enabled: !!token,
  });

  const consumer = consumerQuery.data;

  const updateConsumerMutation = useMutation({
    mutationFn: async () => {
      if (!consumer) throw new Error('Consumer not loaded');

      const nextTagsRaw = tagsRef.current?.value ?? '';
      const parsedTags = splitCsv(nextTagsRaw);

      const payload: Record<string, unknown> = {
        username: usernameRef.current?.value ?? consumer.username,
        customId: customIdRef.current?.value ?? consumer.customId,
        tags: parsedTags.length ? parsedTags : null,
      };

      return apiFetch<{ consumer: { id: string } }>(
        `/workspaces/${params.workspaceId}/consumers/${params.consumerId}`,
        {
          method: 'PATCH',
          token,
          body: JSON.stringify(payload),
        },
      );
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['consumer', params.workspaceId, params.consumerId] });
      await queryClient.invalidateQueries({ queryKey: ['consumers', params.workspaceId] });
      router.push(`/w/${params.workspaceId}/gateway/consumers/${params.consumerId}`);
    },
  });

  if (consumerQuery.isLoading) {
    return <div className="text-sm text-zinc-600">Loading…</div>;
  }

  if (consumerQuery.isError || !consumer) {
    return <div className="text-sm text-red-700">Failed to load consumer.</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="truncate text-xl font-semibold text-zinc-900">Edit consumer: {consumer.username}</h1>
          <p className="mt-1 text-sm text-zinc-600">Update consumer details.</p>
        </div>
        <Link
          href={`/w/${params.workspaceId}/gateway/consumers/${params.consumerId}`}
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
            updateConsumerMutation.mutate();
          }}
        >
          <label className="block">
            <span className="text-sm text-zinc-700">Username</span>
            <input
              ref={usernameRef}
              defaultValue={consumer.username}
              className="mt-1 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900"
              minLength={2}
              required
            />
          </label>

          <label className="block">
            <span className="text-sm text-zinc-700">Custom ID</span>
            <input
              ref={customIdRef}
              defaultValue={consumer.customId}
              className="mt-1 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900"
              minLength={1}
              required
            />
          </label>

          <label className="block sm:col-span-2">
            <div className="flex items-center gap-1">
              <span className="text-sm text-zinc-700">Tags</span>
              <HelpHint text="Optional. Comma-separated values." />
            </div>
            <input
              ref={tagsRef}
              defaultValue={consumer.tags?.join(',') ?? ''}
              className="mt-1 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900"
              placeholder="mobile, prod"
            />
          </label>

          <button
            className="rounded-md bg-black px-3 py-2 text-sm font-medium text-white disabled:opacity-50 sm:col-span-2"
            disabled={updateConsumerMutation.isPending}
            type="submit"
          >
            {updateConsumerMutation.isPending ? 'Saving…' : 'Save'}
          </button>
        </form>

        {updateConsumerMutation.isError ? (
          <div className="mt-3 rounded-md bg-red-50 p-3 text-sm text-red-700">
            Failed to save (must be admin/owner).
          </div>
        ) : null}
      </div>
    </div>
  );
}
