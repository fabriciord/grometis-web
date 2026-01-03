'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch, type ApiError } from '@/lib/api';
import { clearAccessToken, getAccessToken } from '@/lib/auth';

type WorkspaceListItem = { id: string; name: string; role: 'viewer' | 'admin' | 'owner' };

type AdminUser = {
  id: string;
  email: string;
  name: string | null;
  role: 'admin' | 'write' | 'read';
  allWorkspaces: boolean;
  workspaceIds: string[];
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

export default function EditAdminUserPage() {
  const params = useParams<{ userId: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const token = useMemo(() => getAccessToken(), []);

  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'admin' | 'write' | 'read'>('read');
  const [allWorkspaces, setAllWorkspaces] = useState(false);
  const [workspaceIds, setWorkspaceIds] = useState<string[]>([]);

  useEffect(() => {
    if (!token) router.replace('/login');
  }, [router, token]);

  const userQuery = useQuery({
    queryKey: ['admin-user', params.userId],
    queryFn: async () => {
      const res = await apiFetch<{ user: AdminUser }>(`/users/${params.userId}`, { token });
      return res.user;
    },
    enabled: !!token,
  });

  const workspacesQuery = useQuery({
    queryKey: ['workspaces'],
    queryFn: async () => {
      const res = await apiFetch<{ workspaces: WorkspaceListItem[] }>('/workspaces', { token });
      return res.workspaces;
    },
    enabled: !!token,
  });

  useEffect(() => {
    const u = userQuery.data;
    if (!u) return;
    setEmail(u.email);
    setName(u.name ?? '');
    setRole(u.role);
    setAllWorkspaces(u.role === 'admin' ? true : u.allWorkspaces);
    setWorkspaceIds((u.workspaceIds ?? []).filter((id) => id !== 'ALL'));
  }, [userQuery.data]);

  const effectiveAll = role === 'admin' ? true : allWorkspaces;
  const needsWorkspaces = role !== 'admin' && !effectiveAll;

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (needsWorkspaces && workspaceIds.length === 0) {
        throw new Error('Select at least 1 workspace or enable ALL.');
      }

      const body: Record<string, unknown> = {
        email,
        name: name.trim() || null,
        role,
        allWorkspaces: role === 'admin' ? true : allWorkspaces,
        workspaceIds: needsWorkspaces ? workspaceIds : undefined,
      };

      if (password.trim()) body.password = password;

      return apiFetch<{ user: unknown }>(`/users/${params.userId}`, {
        method: 'PATCH',
        token,
        body: JSON.stringify(body),
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      await queryClient.invalidateQueries({ queryKey: ['admin-user', params.userId] });
      router.push('/admin/users');
    },
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
        <div className="text-sm text-indigo-600">
          <Link href="/admin/users" className="hover:underline">
            Users
          </Link>{' '}
          <span className="text-zinc-400">›</span>
        </div>

        <h1 className="mt-3 text-3xl font-semibold text-zinc-900">Edit user</h1>
        <div className="mt-6 border-b border-zinc-200" />

        {userQuery.isLoading ? (
          <div className="mt-6 text-sm text-zinc-600">Loading…</div>
        ) : null}

        {userQuery.isError ? (
          <div className="mt-6 rounded-md bg-red-50 p-3 text-sm text-red-700">
            {formatApiError(userQuery.error, 'Failed to load user (admin required).')}
          </div>
        ) : null}

        {userQuery.data ? (
          <form
            className="mt-6 max-w-2xl space-y-6"
            onSubmit={(e) => {
              e.preventDefault();
              saveMutation.mutate();
            }}
          >
            <div>
              <div className="text-sm font-medium text-zinc-900">Email</div>
              <input
                className="mt-2 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                type="email"
                autoComplete="email"
              />
            </div>

            <div>
              <div className="text-sm font-medium text-zinc-900">Name</div>
              <input
                className="mt-2 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400"
                value={name}
                onChange={(e) => setName(e.target.value)}
                type="text"
              />
            </div>

            <div>
              <div className="text-sm font-medium text-zinc-900">New password</div>
              <input
                className="mt-2 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                type="password"
                autoComplete="new-password"
                placeholder="Leave blank to keep unchanged"
              />
            </div>

            <div>
              <div className="text-sm font-medium text-zinc-900">Role</div>
              <select
                className="mt-2 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900"
                value={role}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v === 'admin' || v === 'write' || v === 'read') setRole(v);
                }}
              >
                <option value="read">read</option>
                <option value="write">write</option>
                <option value="admin">admin</option>
              </select>
              <div className="mt-2 text-sm text-zinc-500">Admin always has ALL workspaces.</div>
            </div>

            {role !== 'admin' ? (
              <div className="rounded-md border border-zinc-200 bg-white p-4">
                <label className="flex items-center gap-2 text-sm text-zinc-900">
                  <input
                    type="checkbox"
                    className="h-4 w-4"
                    checked={allWorkspaces}
                    onChange={(e) => setAllWorkspaces(e.target.checked)}
                  />
                  All workspaces
                </label>

                {needsWorkspaces ? (
                  <div className="mt-4">
                    <div className="text-sm font-medium text-zinc-900">Workspaces</div>
                    <div className="mt-2 max-h-64 overflow-auto rounded-md border border-zinc-200">
                      <div className="divide-y divide-zinc-200">
                        {(workspacesQuery.data ?? []).map((w) => {
                          const checked = workspaceIds.includes(w.id);
                          return (
                            <label key={w.id} className="flex items-center justify-between gap-3 p-3 text-sm">
                              <span className="min-w-0 flex-1 truncate text-zinc-900">{w.name}</span>
                              <input
                                type="checkbox"
                                className="h-4 w-4"
                                checked={checked}
                                onChange={(e) => {
                                  setWorkspaceIds((prev) => {
                                    if (e.target.checked) return Array.from(new Set([...prev, w.id]));
                                    return prev.filter((id) => id !== w.id);
                                  });
                                }}
                              />
                            </label>
                          );
                        })}
                        {workspacesQuery.isLoading ? (
                          <div className="p-3 text-sm text-zinc-600">Loading workspaces…</div>
                        ) : null}
                        {workspacesQuery.isError ? (
                          <div className="p-3 text-sm text-red-700">
                            {formatApiError(workspacesQuery.error, 'Failed to load workspaces.')}
                          </div>
                        ) : null}
                        {workspacesQuery.isSuccess && (workspacesQuery.data ?? []).length === 0 ? (
                          <div className="p-3 text-sm text-zinc-600">No workspaces.</div>
                        ) : null}
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}

            {saveMutation.isError ? (
              <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">
                {formatApiError(saveMutation.error, 'Failed to save user.')}
              </div>
            ) : null}

            <div className="flex items-center gap-3">
              <button
                className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                disabled={saveMutation.isPending}
                type="submit"
              >
                {saveMutation.isPending ? 'Saving…' : 'Save'}
              </button>
              <Link
                href="/admin/users"
                className="rounded-md border border-zinc-200 bg-white px-4 py-2 text-sm text-zinc-700 hover:bg-zinc-50"
              >
                Cancel
              </Link>
            </div>
          </form>
        ) : null}
      </div>
    </div>
  );
}
