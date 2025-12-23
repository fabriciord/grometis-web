'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { apiFetch, type ApiError } from '@/lib/api';
import { getAccessToken } from '@/lib/auth';

type ConsumerListItem = { id: string; username: string };

type KeyauthConsumer = {
  id: string;
  key: string;
  ttl: number | null;
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

export default function KeyauthEditPage() {
  const params = useParams<{ workspaceId: string; keyauthConsumerId: string }>();
  const router = useRouter();
  const token = useMemo(() => getAccessToken(), []);

  const [draftKey, setDraftKey] = useState<string | null>(null);
  const [draftTtl, setDraftTtl] = useState<string | null>(null);
  const [draftConsumerId, setDraftConsumerId] = useState<string | null>(null);
  const [draftTags, setDraftTags] = useState<string | null>(null);

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

  const key = draftKey ?? keyauthQuery.data?.key ?? '';
  const ttl =
    draftTtl ??
    (keyauthQuery.data
      ? keyauthQuery.data.ttl === null
        ? ''
        : String(keyauthQuery.data.ttl)
      : '');
  const consumerId = draftConsumerId ?? keyauthQuery.data?.consumerId ?? '';
  const tags = draftTags ?? (keyauthQuery.data?.tags?.join(', ') ?? '');

  const updateMutation = useMutation({
    mutationFn: async () => {
      const ttlValue = ttl.trim().length ? Number(ttl) : null;
      if (ttlValue !== null && (!Number.isFinite(ttlValue) || ttlValue < 0)) {
        throw { status: 400, message: 'Invalid TTL' } satisfies ApiError;
      }

      const payload: Record<string, unknown> = {
        key,
        consumerId,
        ttl: ttlValue,
        tags: tags.trim().length ? splitCsv(tags) : null,
      };

      return apiFetch<{ keyauthConsumer: { id: string } }>(
        `/workspaces/${params.workspaceId}/keyauth-consumers/${params.keyauthConsumerId}`,
        { method: 'PATCH', token, body: JSON.stringify(payload) },
      );
    },
    onSuccess: () => {
      router.push(`/w/${params.workspaceId}/gateway/keyauth-consumers/${params.keyauthConsumerId}`);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      return apiFetch<{ ok: true }>(
        `/workspaces/${params.workspaceId}/keyauth-consumers/${params.keyauthConsumerId}`,
        { method: 'DELETE', token },
      );
    },
    onSuccess: () => {
      router.push(`/w/${params.workspaceId}/gateway/keyauth-consumers`);
    },
  });

  const selectedConsumerId = consumerId || consumersQuery.data?.[0]?.id || '';

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900">Edit KeyAuth</h1>
          <p className="mt-1 text-sm text-zinc-600">Atualize key/ttl/consumer/tags.</p>
        </div>
        <Link
          href={`/w/${params.workspaceId}/gateway/keyauth-consumers/${params.keyauthConsumerId}`}
          className="rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-900 hover:bg-zinc-50"
        >
          Back
        </Link>
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white p-4">
        {keyauthQuery.isLoading ? <div className="text-sm text-zinc-600">Carregando…</div> : null}
        {keyauthQuery.isError ? <div className="text-sm text-red-700">Falha ao carregar.</div> : null}

        {keyauthQuery.data ? (
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
            <label className="block sm:col-span-2">
              <span className="text-sm text-zinc-700">Key</span>
              <input
                className="mt-1 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900"
                value={key}
                onChange={(e) => setDraftKey(e.target.value)}
                required
              />
            </label>

            <label className="block">
              <span className="text-sm text-zinc-700">TTL (segundos)</span>
              <input
                className="mt-1 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900"
                value={ttl}
                onChange={(e) => setDraftTtl(e.target.value)}
                inputMode="numeric"
              />
            </label>

            <label className="block">
              <span className="text-sm text-zinc-700">Consumer</span>
              <select
                className="mt-1 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900"
                value={selectedConsumerId}
                onChange={(e) => setDraftConsumerId(e.target.value)}
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
                className="mt-1 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900"
                value={tags}
                onChange={(e) => setDraftTags(e.target.value)}
              />
            </label>

            <div className="sm:col-span-2 flex items-center gap-3">
              <button
                className="rounded-md bg-black px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
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
                  const ok = window.confirm('Deletar esta credencial KeyAuth?');
                  if (ok) deleteMutation.mutate();
                }}
              >
                {deleteMutation.isPending ? 'Deleting…' : 'Delete'}
              </button>

              {updateMutation.isError ? (
                <div className="text-sm text-red-700">Falha ao salvar.</div>
              ) : null}
              {deleteMutation.isError ? (
                <div className="text-sm text-red-700">Falha ao deletar.</div>
              ) : null}
            </div>
          </form>
        ) : null}
      </div>
    </div>
  );
}
