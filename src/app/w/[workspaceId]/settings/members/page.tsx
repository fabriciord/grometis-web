'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { getAccessToken } from '@/lib/auth';

type Member = {
  userId: string;
  email: string | null;
  name: string | null;
  role: string;
};

type Invitation = {
  id: string;
  email: string;
  role: string;
  expiresAt: string;
  acceptedAt: string | null;
};

export default function MembersPage() {
  const params = useParams<{ workspaceId: string }>();
  const router = useRouter();
  const token = useMemo(() => getAccessToken(), []);

  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'viewer' | 'admin' | 'owner'>('viewer');
  const [createdToken, setCreatedToken] = useState<string | null>(null);

  useEffect(() => {
    if (!token) router.replace('/login');
  }, [router, token]);

  const membersQuery = useQuery({
    queryKey: ['members', params.workspaceId],
    queryFn: async () => {
      const res = await apiFetch<{ members: Member[] }>(
        `/workspaces/${params.workspaceId}/members`,
        { token },
      );
      return res.members;
    },
    enabled: !!token,
  });

  const invitesQuery = useQuery({
    queryKey: ['invitations', params.workspaceId],
    queryFn: async () => {
      const res = await apiFetch<{ invitations: Invitation[] }>(
        `/workspaces/${params.workspaceId}/invitations`,
        { token },
      );
      return res.invitations;
    },
    enabled: !!token,
  });

  const inviteMutation = useMutation({
    mutationFn: async () => {
      setCreatedToken(null);
      const res = await apiFetch<{ token: string }>(
        `/workspaces/${params.workspaceId}/invitations`,
        {
          method: 'POST',
          token,
          body: JSON.stringify({ email: inviteEmail, role: inviteRole }),
        },
      );
      return res;
    },
    onSuccess: (res) => {
      setCreatedToken(res.token);
      setInviteEmail('');
      invitesQuery.refetch();
    },
  });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold text-zinc-900">Members</h1>
        <p className="mt-1 text-sm text-zinc-600">Manage workspace members and invitations.</p>
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white p-4">
        <h2 className="font-medium text-zinc-900">Invite (no SMTP yet)</h2>
        <form
          className="mt-3 grid gap-2 sm:grid-cols-3"
          onSubmit={(e) => {
            e.preventDefault();
            inviteMutation.mutate();
          }}
        >
          <input
            className="rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 sm:col-span-2"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            type="email"
            placeholder="email@company.com"
            required
          />
          <select
            className="rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900"
            value={inviteRole}
            onChange={(e) => {
              const value = e.target.value;
              if (value === 'viewer' || value === 'admin' || value === 'owner') {
                setInviteRole(value);
              }
            }}
          >
            <option value="viewer">viewer</option>
            <option value="admin">admin</option>
            <option value="owner">owner</option>
          </select>
          <button
            className="rounded-md bg-black px-3 py-2 text-sm font-medium text-white disabled:opacity-50 sm:col-span-3"
            disabled={inviteMutation.isPending}
            type="submit"
          >
            {inviteMutation.isPending ? 'Inviting…' : 'Generate Invite'}
          </button>
        </form>

        {inviteMutation.isError ? (
          <div className="mt-3 rounded-md bg-red-50 p-3 text-sm text-red-700">
            Failed to create invite (requires admin/owner).
          </div>
        ) : null}

        {createdToken ? (
          <div className="mt-3 rounded-md bg-zinc-50 p-3 text-sm">
            Invite token (for testing): <span className="font-mono">{createdToken}</span>
          </div>
        ) : null}
      </div>

      <div>
        <h2 className="font-medium text-zinc-900">Member list</h2>
        <div className="mt-2 rounded-xl border border-zinc-200 bg-white">
          <div className="divide-y divide-zinc-200">
            {(membersQuery.data ?? []).map((m) => (
              <div key={m.userId} className="flex items-center justify-between p-4">
                <div>
                  <div className="font-medium text-zinc-900">{m.name ?? m.email ?? m.userId}</div>
                  <div className="text-sm text-zinc-600">{m.email ?? ''}</div>
                </div>
                <div className="text-sm text-zinc-600">{m.role}</div>
              </div>
            ))}
            {membersQuery.isLoading ? (
              <div className="p-4 text-sm text-zinc-600">Loading…</div>
            ) : null}
            {membersQuery.data?.length === 0 ? (
              <div className="p-4 text-sm text-zinc-600">No members.</div>
            ) : null}
          </div>
        </div>
      </div>

      <div>
        <h2 className="font-medium text-zinc-900">Convites</h2>
        <div className="mt-2 rounded-xl border border-zinc-200 bg-white">
          <div className="divide-y divide-zinc-200">
            {(invitesQuery.data ?? []).map((i) => (
              <div key={i.id} className="flex items-center justify-between p-4">
                <div>
                  <div className="font-medium text-zinc-900">{i.email}</div>
                  <div className="text-sm text-zinc-600">role: {i.role}</div>
                </div>
                <div className="text-sm text-zinc-600">
                  {i.acceptedAt ? 'accepted' : 'pending'}
                </div>
              </div>
            ))}
            {invitesQuery.isLoading ? (
              <div className="p-4 text-sm text-zinc-600">Loading…</div>
            ) : null}
            {invitesQuery.data?.length === 0 ? (
              <div className="p-4 text-sm text-zinc-600">No invites.</div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
