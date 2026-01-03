'use client';

import { useMutation } from '@tanstack/react-query';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { getAccessToken } from '@/lib/auth';
import { HelpHint } from '@/app/_components/HelpHint';

function splitCsv(value: string): string[] {
  return value
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);
}

export default function ConsumerNewPage() {
  const params = useParams<{ workspaceId: string }>();
  const router = useRouter();
  const token = useMemo(() => getAccessToken(), []);

  const [username, setUsername] = useState('');
  const [customId, setCustomId] = useState('');
  const [tags, setTags] = useState('');

  useEffect(() => {
    if (!token) router.replace('/login');
  }, [router, token]);

  const createConsumerMutation = useMutation({
    mutationFn: async () => {
      const payload: Record<string, unknown> = {
        username,
        customId,
      };

      const parsedTags = splitCsv(tags);
      if (parsedTags.length) payload.tags = parsedTags;

      return apiFetch<{ consumer: { id: string } }>(
        `/workspaces/${params.workspaceId}/consumers`,
        {
          method: 'POST',
          token,
          body: JSON.stringify(payload),
        },
      );
    },
    onSuccess: (res) => {
      router.push(`/w/${params.workspaceId}/gateway/consumers/${res.consumer.id}`);
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900">New consumer</h1>
          <p className="mt-1 text-sm text-zinc-600">Create a consumer identity.</p>
        </div>
        <Link
          href={`/w/${params.workspaceId}/gateway/consumers`}
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
            createConsumerMutation.mutate();
          }}
        >
          <label className="block">
            <span className="text-sm text-zinc-700">Username</span>
            <input
              className="mt-1 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="cliente-abc"
              minLength={2}
              required
            />
          </label>

          <label className="block">
            <span className="text-sm text-zinc-700">Custom ID</span>
            <input
              className="mt-1 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400"
              value={customId}
              onChange={(e) => setCustomId(e.target.value)}
              placeholder="cust_123"
              minLength={1}
              required
            />
          </label>

          <label className="block sm:col-span-2">
            <span className="text-sm text-zinc-700">
              Tags <HelpHint text="Optional comma-separated tags for this consumer." />
            </span>
            <input
              className="mt-1 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="mobile,prod"
            />
          </label>

          <button
            className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50 sm:col-span-2"
            disabled={createConsumerMutation.isPending}
            type="submit"
          >
            {createConsumerMutation.isPending ? 'Creating…' : 'Create consumer'}
          </button>
        </form>

        {createConsumerMutation.isError ? (
          <div className="mt-3 rounded-md bg-red-50 p-3 text-sm text-red-700">
            Failed to create consumer (must be admin/owner).
          </div>
        ) : null}
      </div>
    </div>
  );
}
