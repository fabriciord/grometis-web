'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { apiFetch, type ApiError } from '@/lib/api';
import { getAccessToken } from '@/lib/auth';

type ConsumerListItem = { id: string; username: string };

type PluginListItem = {
  id: string;
  name: string;
  enabled?: boolean;
  routeId?: string | null;
  serviceId?: string | null;
  isGlobal?: boolean;
};

function normalizePluginName(name: unknown): string {
  return typeof name === 'string' ? name.trim().toLowerCase() : '';
}

function isKeyAuthPluginName(name: unknown): boolean {
  const n = normalizePluginName(name);
  return n === 'key-auth' || n === 'keyauth' || n === 'keyauthconsumer';
}

function splitCsv(value: string): string[] {
  return value
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);
}

export default function KeyauthNewPage() {
  const params = useParams<{ workspaceId: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = useMemo(() => getAccessToken(), []);

  const [key, setKey] = useState('');
  const [ttl, setTtl] = useState('30');
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

  const pluginsQuery = useQuery({
    queryKey: ['plugins', params.workspaceId],
    queryFn: async () => {
      const res = await apiFetch<{ plugins: PluginListItem[] }>(
        `/workspaces/${params.workspaceId}/plugins`,
        { token },
      );
      return res.plugins;
    },
    enabled: !!token,
  });

  const hasKeyauthPluginInAnyRoute = useMemo(() => {
    return (pluginsQuery.data ?? []).some((p) => {
      const enabled = p.enabled ?? true;
      return isKeyAuthPluginName(p.name) && enabled && Boolean(p.routeId);
    });
  }, [pluginsQuery.data]);

  const hasKeyauthPluginInAnyService = useMemo(() => {
    return (pluginsQuery.data ?? []).some((p) => {
      const enabled = p.enabled ?? true;
      return isKeyAuthPluginName(p.name) && enabled && Boolean(p.serviceId);
    });
  }, [pluginsQuery.data]);

  const hasKeyauthPluginGlobal = useMemo(() => {
    return (pluginsQuery.data ?? []).some((p) => {
      const enabled = p.enabled ?? true;
      return isKeyAuthPluginName(p.name) && enabled && p.isGlobal === true;
    });
  }, [pluginsQuery.data]);

  const hasKeyauthPluginAnywhere = useMemo(() => {
    return (pluginsQuery.data ?? []).some((p) => {
      const enabled = p.enabled ?? true;
      return isKeyAuthPluginName(p.name) && enabled;
    });
  }, [pluginsQuery.data]);

  const keyauthBlockedReason = pluginsQuery.isLoading
    ? 'Loading workspace plugins…'
    : pluginsQuery.isError
      ? 'Failed to load workspace plugins.'
      : !(hasKeyauthPluginInAnyRoute || hasKeyauthPluginInAnyService || hasKeyauthPluginGlobal)
        ? hasKeyauthPluginAnywhere
          ? 'The KeyAuth plugin is enabled, but it is not installed on any route or service. Install it on a route or service (or set it as global) to create credentials.'
          : 'This feature can only be used when the KeyAuth plugin is installed on a route, service, or as global in this workspace.'
        : null;

  const consumerIdFromQuery = searchParams.get('consumerId') ?? '';
  const selectedConsumerId =
    consumerId || consumerIdFromQuery || consumersQuery.data?.[0]?.id || '';

  const consumerLocked = !!consumerIdFromQuery;

  const createMutation = useMutation({
    mutationFn: async () => {
      if (keyauthBlockedReason) {
        throw { status: 400, message: keyauthBlockedReason } satisfies ApiError;
      }

      if (!selectedConsumerId) {
        throw { status: 400, message: 'Consumer is required' } satisfies ApiError;
      }

      const ttlNumber = ttl.trim().length ? Number(ttl) : NaN;
      if (ttl.trim().length && (!Number.isFinite(ttlNumber) || ttlNumber < 0)) {
        throw { status: 400, message: 'Invalid TTL' } satisfies ApiError;
      }

      const payload: Record<string, unknown> = {
        key,
        consumerId: selectedConsumerId,
        ttl: ttl.trim().length ? ttlNumber : null,
      };

      const parsedTags = splitCsv(tags);
      if (parsedTags.length) payload.tags = parsedTags;

      return apiFetch<{ keyauthConsumer: { id: string } }>(
        `/workspaces/${params.workspaceId}/keyauth-consumers`,
        {
          method: 'POST',
          token,
          body: JSON.stringify(payload),
        },
      );
    },
    onSuccess: (res) => {
      router.push(`/w/${params.workspaceId}/gateway/keyauth-consumers/${res.keyauthConsumer.id}`);
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900">New KeyAuth</h1>
          <p className="mt-1 text-sm text-zinc-600">Create a KeyAuth credential for a consumer.</p>
        </div>
        <Link
          href={`/w/${params.workspaceId}/gateway/keyauth-consumers`}
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
            createMutation.mutate();
          }}
        >
          <label className="block sm:col-span-2">
            <span className="text-sm text-zinc-700">Key</span>
            <input
              className="mt-1 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              placeholder="my-secret-key"
              required
            />
          </label>

          <label className="block">
            <span className="text-sm text-zinc-700">TTL (seconds)</span>
            <input
              className="mt-1 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900"
              value={ttl}
              onChange={(e) => setTtl(e.target.value)}
              inputMode="numeric"
            />
          </label>

          <label className="block">
            <span className="text-sm text-zinc-700">Consumer</span>
            <select
              className="mt-1 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900"
              value={selectedConsumerId}
              onChange={(e) => {
                if (consumerLocked) return;
                setConsumerId(e.target.value);
              }}
              disabled={consumerLocked}
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
            <span className="text-sm text-zinc-700">Tags</span>
            <input
              className="mt-1 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="prod,edge"
            />
          </label>

          <div className="sm:col-span-2">
            {keyauthBlockedReason ? (
              <div className="mb-2 rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-700">
                <div className="font-medium">Action blocked</div>
                <div className="mt-1">{keyauthBlockedReason}</div>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Link
                    href={`/w/${params.workspaceId}/gateway/plugins/new`}
                    className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700"
                  >
                    Install plugin
                  </Link>
                  <Link
                    href={`/w/${params.workspaceId}/gateway/consumers/${encodeURIComponent(selectedConsumerId)}`}
                    className="rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-900 hover:bg-zinc-50"
                  >
                    Back to consumer
                  </Link>
                </div>
              </div>
            ) : null}
            <button
              className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
              type="submit"
              disabled={createMutation.isPending || !!keyauthBlockedReason}
              title={keyauthBlockedReason ?? undefined}
            >
              {createMutation.isPending ? 'Creating…' : 'Create KeyAuth'}
            </button>

            {createMutation.isError ? (
              <div className="mt-2 text-sm text-red-700">Failed to create KeyAuth.</div>
            ) : null}
          </div>
        </form>
      </div>
    </div>
  );
}
