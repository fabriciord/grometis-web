'use client';

import { useMutation } from '@tanstack/react-query';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { apiFetch, type ApiError } from '@/lib/api';
import { getAccessToken } from '@/lib/auth';

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

export default function SchemaNewPage() {
  const params = useParams<{ workspaceId: string }>();
  const router = useRouter();
  const token = useMemo(() => getAccessToken(), []);

  const [name, setName] = useState('');
  const [schemaText, setSchemaText] = useState('{}');
  const [schemaError, setSchemaError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) router.replace('/login');
  }, [router, token]);

  const createMutation = useMutation({
    mutationFn: async () => {
      setSchemaError(null);
      const parsed = safeJsonParse(schemaText);
      if (!parsed.ok) {
        setSchemaError('Invalid JSON schema (must be an object).');
        throw { status: 400, message: 'Invalid schema JSON' } satisfies ApiError;
      }

      return apiFetch<{ schema: { id: string } }>(
        `/workspaces/${params.workspaceId}/schemas`,
        {
          method: 'POST',
          token,
          body: JSON.stringify({ name, schema: parsed.data }),
        },
      );
    },
    onSuccess: (res) => {
      router.push(`/w/${params.workspaceId}/gateway/schemas/${res.schema.id}`);
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900">New schema</h1>
          <p className="mt-1 text-sm text-zinc-600">Create a JSON schema.</p>
        </div>
        <Link
          href={`/w/${params.workspaceId}/gateway/schemas`}
          className="rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-900 hover:bg-zinc-50"
        >
          Back
        </Link>
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white p-4">
        <form
          className="grid gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            createMutation.mutate();
          }}
        >
          <label className="block">
            <span className="text-sm text-zinc-700">Name</span>
            <input
              className="mt-1 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="plugin.key-auth"
              required
            />
          </label>

          <label className="block">
            <span className="text-sm text-zinc-700">Schema (JSON)</span>
            <textarea
              className="mt-1 h-64 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 font-mono text-xs text-zinc-900"
              value={schemaText}
              onChange={(e) => setSchemaText(e.target.value)}
              spellCheck={false}
            />
          </label>

          {schemaError ? <div className="text-sm text-red-700">{schemaError}</div> : null}

          <div>
            <button
              className="rounded-md bg-black px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
              type="submit"
              disabled={createMutation.isPending}
            >
              {createMutation.isPending ? 'Creating…' : 'Create schema'}
            </button>
            {createMutation.isError ? (
              <div className="mt-2 text-sm text-red-700">Failed to create schema.</div>
            ) : null}
          </div>
        </form>
      </div>
    </div>
  );
}
