'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { apiFetch, type ApiError } from '@/lib/api';
import { getAccessToken } from '@/lib/auth';

type Schema = {
  id: string;
  name: string;
  schema: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

function safeJsonParse(
  value: string,
): { ok: true; data: Record<string, unknown> } | { ok: false } {
  try {
    const parsed = JSON.parse(value) as unknown;
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return { ok: true, data: parsed as Record<string, unknown> };
    }
    return { ok: false };
  } catch {
    return { ok: false };
  }
}

export default function SchemaEditPage() {
  const params = useParams<{ workspaceId: string; schemaId: string }>();
  const router = useRouter();
  const token = useMemo(() => getAccessToken(), []);

  const [draftName, setDraftName] = useState<string | null>(null);
  const [draftSchemaText, setDraftSchemaText] = useState<string | null>(null);
  const [schemaError, setSchemaError] = useState<string | null>(null);

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

  const name = draftName ?? schemaQuery.data?.name ?? '';
  const schemaText =
    draftSchemaText ??
    (schemaQuery.data ? JSON.stringify(schemaQuery.data.schema ?? {}, null, 2) : '{}');

  const updateMutation = useMutation({
    mutationFn: async () => {
      setSchemaError(null);
      const parsed = safeJsonParse(schemaText);
      if (!parsed.ok) {
        setSchemaError('Schema JSON inválido (precisa ser um objeto).');
        throw { status: 400, message: 'Invalid schema JSON' } satisfies ApiError;
      }

      return apiFetch<{ schema: { id: string } }>(
        `/workspaces/${params.workspaceId}/schemas/${params.schemaId}`,
        {
          method: 'PATCH',
          token,
          body: JSON.stringify({ name, schema: parsed.data }),
        },
      );
    },
    onSuccess: () => {
      router.push(`/w/${params.workspaceId}/gateway/schemas/${params.schemaId}`);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      return apiFetch<{ ok: true }>(
        `/workspaces/${params.workspaceId}/schemas/${params.schemaId}`,
        { method: 'DELETE', token },
      );
    },
    onSuccess: () => {
      router.push(`/w/${params.workspaceId}/gateway/schemas`);
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900">Edit schema</h1>
          <p className="mt-1 text-sm text-zinc-600">Atualize o nome e o JSON.</p>
        </div>
        <Link
          href={`/w/${params.workspaceId}/gateway/schemas/${params.schemaId}`}
          className="rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-900 hover:bg-zinc-50"
        >
          Back
        </Link>
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white p-4">
        {schemaQuery.isLoading ? <div className="text-sm text-zinc-600">Carregando…</div> : null}
        {schemaQuery.isError ? <div className="text-sm text-red-700">Falha ao carregar.</div> : null}

        {schemaQuery.data ? (
          <form
            className="grid gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              updateMutation.mutate();
            }}
          >
            <label className="block">
              <span className="text-sm text-zinc-700">Name</span>
              <input
                className="mt-1 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900"
                value={name}
                onChange={(e) => setDraftName(e.target.value)}
                required
              />
            </label>

            <label className="block">
              <span className="text-sm text-zinc-700">Schema (JSON)</span>
              <textarea
                className="mt-1 h-64 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 font-mono text-xs text-zinc-900"
                value={schemaText}
                onChange={(e) => setDraftSchemaText(e.target.value)}
                spellCheck={false}
              />
            </label>

            {schemaError ? <div className="text-sm text-red-700">{schemaError}</div> : null}

            <div className="flex items-center gap-3">
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
                  const ok = window.confirm('Deletar este schema?');
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
