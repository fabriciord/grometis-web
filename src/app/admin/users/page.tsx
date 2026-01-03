'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiFetch, type ApiError } from '@/lib/api';
import { clearAccessToken, getAccessToken } from '@/lib/auth';

type AdminUserListItem = {
  id: string;
  email: string;
  name: string | null;
  role: 'admin' | 'write' | 'read';
  allWorkspaces: boolean;
  workspaceIds: string[];
  createdAt: string;
  updatedAt: string;
};

function formatApiError(err: unknown, fallback: string): string {
  if (!err || typeof err !== 'object') return fallback;
  const apiErr = err as Partial<ApiError>;
  const status = typeof apiErr.status === 'number' ? apiErr.status : undefined;
  const raw = typeof apiErr.message === 'string' ? apiErr.message : '';
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      const msg =
        typeof parsed?.message === 'string'
          ? parsed.message
          : Array.isArray(parsed?.message)
            ? parsed.message.join(', ')
            : raw;
      return status ? `${status}: ${msg}` : msg;
    } catch {
      return status ? `${status}: ${raw}` : raw;
    }
  }
  return status ? `${status}: ${fallback}` : fallback;
}

export default function AdminUsersPage() {
  const router = useRouter();
  const token = useMemo(() => getAccessToken(), []);

  useEffect(() => {
    if (!token) router.replace('/login');
  }, [router, token]);

  const usersQuery = useQuery({
    queryKey: ['admin-users'],
    queryFn: async () => {
      const res = await apiFetch<{ users: AdminUserListItem[] }>('/users', { token });
      return res.users;
    },
    enabled: !!token,
  });

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900">
      <header className="sticky top-0 z-20 border-b border-zinc-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-md border border-zinc-200 bg-zinc-100 text-xs font-semibold text-zinc-700">
              G
            </div>
            <div className="flex items-center gap-2">
              <div className="text-sm font-semibold text-zinc-900">GrOMEtiS</div>
              <div className="h-4 w-px bg-zinc-200" />
              <div className="text-sm text-zinc-700">Admin</div>
            </div>
          </div>

          <button
            type="button"
            className="rounded-md px-3 py-2 text-sm text-zinc-600 hover:text-zinc-900"
            onClick={() => {
              clearAccessToken();
              router.push('/login');
            }}
          >
            Sign out
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-6 py-10">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold text-zinc-900">Users</h1>
            <p className="mt-1 text-sm text-zinc-600">Only admins can create and edit users.</p>
          </div>
          <Link
            href="/admin/users/new"
            className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          >
            New user
          </Link>
        </div>

        <div className="mt-6 rounded-xl border border-zinc-200 bg-white">
          <div className="divide-y divide-zinc-200">
            {usersQuery.isLoading ? (
              <div className="p-4 text-sm text-zinc-600">Loading…</div>
            ) : null}

            {usersQuery.isError ? (
              <div className="p-4 text-sm text-red-700">
                {formatApiError(usersQuery.error, 'Failed to load users (admin required).')}
              </div>
            ) : null}

            {(usersQuery.data ?? []).map((u) => (
              <div key={u.id} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <div className="truncate font-medium text-zinc-900">{u.email}</div>
                    <div className="rounded-md bg-zinc-100 px-2 py-0.5 text-xs text-zinc-700">
                      {u.role}
                    </div>
                    {u.allWorkspaces ? (
                      <div className="rounded-md bg-zinc-100 px-2 py-0.5 text-xs text-zinc-700">ALL</div>
                    ) : null}
                  </div>
                  <div className="mt-1 text-sm text-zinc-600">{u.name ?? '—'}</div>
                  <div className="mt-1 text-xs text-zinc-500">
                    Workspaces: {u.allWorkspaces ? 'ALL' : (u.workspaceIds ?? []).length}
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <Link
                    href={`/admin/users/${u.id}/edit`}
                    className="rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-50"
                  >
                    Edit
                  </Link>
                </div>
              </div>
            ))}

            {usersQuery.isSuccess && (usersQuery.data ?? []).length === 0 ? (
              <div className="p-4 text-sm text-zinc-600">No users.</div>
            ) : null}
          </div>
        </div>

        <div className="mt-6 text-sm text-zinc-600">
          <Link href="/workspace" className="text-indigo-600 hover:underline">
            Back to Workspaces
          </Link>
        </div>
      </div>
    </div>
  );
}
