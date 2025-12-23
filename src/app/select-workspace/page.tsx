'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { clearAccessToken, getAccessToken } from '@/lib/auth';

type WorkspaceListItem = { id: string; name: string; role: 'viewer' | 'admin' | 'owner' };

export default function SelectWorkspacePage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const token = useMemo(() => getAccessToken(), []);
  const [newName, setNewName] = useState('');

  useEffect(() => {
    if (!token) router.replace('/login');
  }, [router, token]);

  const workspacesQuery = useQuery({
    queryKey: ['workspaces'],
    queryFn: async () => {
      const res = await apiFetch<{ workspaces: WorkspaceListItem[] }>('/workspaces', {
        token,
      });
      return res.workspaces;
    },
    enabled: !!token,
  });

  const createWorkspaceMutation = useMutation({
    mutationFn: async () => {
      return apiFetch<{ workspace: { id: string; name: string } }>('/workspaces', {
        method: 'POST',
        token,
        body: JSON.stringify({ name: newName }),
      });
    },
    onSuccess: async () => {
      setNewName('');
      await queryClient.invalidateQueries({ queryKey: ['workspaces'] });
    },
  });

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-zinc-900">Selecione um workspace</h1>
        <button
          className="text-sm text-zinc-600 hover:text-zinc-900"
          onClick={() => {
            clearAccessToken();
            router.push('/login');
          }}
        >
          Sair
        </button>
      </div>

      <div className="mt-6 rounded-xl border border-zinc-200 bg-white p-4">
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            createWorkspaceMutation.mutate();
          }}
        >
          <input
            className="flex-1 rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400"
            placeholder="Nome do novo workspace"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            minLength={2}
            required
          />
          <button
            className="rounded-md bg-black px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
            disabled={createWorkspaceMutation.isPending}
            type="submit"
          >
            Criar
          </button>
        </form>
      </div>

      <div className="mt-6 space-y-2">
        {workspacesQuery.isLoading ? (
          <div className="text-sm text-zinc-600">Carregando…</div>
        ) : null}
        {workspacesQuery.isError ? (
          <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">
            Falha ao carregar workspaces.
          </div>
        ) : null}

        {(workspacesQuery.data ?? []).map((w) => (
          <Link
            key={w.id}
            href={`/w/${w.id}/dashboard`}
            className="flex items-center justify-between rounded-lg border border-zinc-200 bg-white p-4 hover:bg-zinc-50"
          >
            <div>
              <div className="font-medium text-zinc-900">{w.name}</div>
              <div className="text-sm text-zinc-600">Role: {w.role}</div>
            </div>
            <div className="text-sm text-zinc-600">Abrir</div>
          </Link>
        ))}

        {workspacesQuery.data?.length === 0 ? (
          <div className="text-sm text-zinc-600">Nenhum workspace ainda.</div>
        ) : null}
      </div>
    </div>
  );
}
