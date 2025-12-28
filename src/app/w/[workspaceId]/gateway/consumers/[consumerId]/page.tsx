'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
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

type AclListItem = {
  id: string;
  group: string;
  consumerId: string;
  tags: string[] | null;
  createdAt: string;
};

type KeyauthConsumerListItem = {
  id: string;
  key: string;
  ttl: number | null;
  consumerId: string;
  tags: string[] | null;
  createdAt: string;
};

type PluginListItem = {
  id: string;
  name: string;
  enabled?: boolean;
  routeId?: string | null;
  serviceId?: string | null;
  consumerId?: string | null;
  isGlobal?: boolean;
};

function normalizePluginName(name: unknown): string {
  return typeof name === 'string' ? name.trim().toLowerCase() : '';
}

function isKeyAuthPluginName(name: unknown): boolean {
  const n = normalizePluginName(name);
  return n === 'key-auth' || n === 'keyauth' || n === 'keyauthconsumer';
}

export default function ConsumerViewPage() {
  const params = useParams<{ workspaceId: string; consumerId: string }>();
  const router = useRouter();
  const token = useMemo(() => getAccessToken(), []);

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

  const aclsQuery = useQuery({
    queryKey: ['acls', params.workspaceId, params.consumerId],
    queryFn: async () => {
      const res = await apiFetch<{ acls: AclListItem[] }>(
        `/workspaces/${params.workspaceId}/acls?consumerId=${encodeURIComponent(params.consumerId)}`,
        { token },
      );
      return res.acls;
    },
    enabled: !!token,
  });

  const keyauthQuery = useQuery({
    queryKey: ['keyauth-consumers', params.workspaceId, params.consumerId],
    queryFn: async () => {
      const res = await apiFetch<{ keyauthConsumers: KeyauthConsumerListItem[] }>(
        `/workspaces/${params.workspaceId}/keyauth-consumers?consumerId=${encodeURIComponent(
          params.consumerId,
        )}`,
        { token },
      );
      return res.keyauthConsumers;
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

  const hasAclPluginInAnyRoute = (pluginsQuery.data ?? []).some((p) => {
    const name = normalizePluginName(p?.name);
    const enabled = p.enabled ?? true;
    return name === 'acl' && enabled && Boolean(p.routeId);
  });

  const hasAclPluginInAnyService = (pluginsQuery.data ?? []).some((p) => {
    const name = normalizePluginName(p?.name);
    const enabled = p.enabled ?? true;
    return name === 'acl' && enabled && Boolean(p.serviceId);
  });

  const hasAclPluginInAnyConsumer = (pluginsQuery.data ?? []).some((p) => {
    const name = normalizePluginName(p?.name);
    const enabled = p.enabled ?? true;
    return name === 'acl' && enabled && Boolean(p.consumerId);
  });

  const hasAclPluginGlobal = (pluginsQuery.data ?? []).some((p) => {
    const name = normalizePluginName(p?.name);
    const enabled = p.enabled ?? true;
    return name === 'acl' && enabled && p.isGlobal === true;
  });

  const hasKeyauthPluginInAnyRoute = (pluginsQuery.data ?? []).some((p) => {
    const enabled = p.enabled ?? true;
    return isKeyAuthPluginName(p?.name) && enabled && Boolean(p.routeId);
  });

  const hasKeyauthPluginInAnyService = (pluginsQuery.data ?? []).some((p) => {
    const enabled = p.enabled ?? true;
    return isKeyAuthPluginName(p?.name) && enabled && Boolean(p.serviceId);
  });

  const hasKeyauthPluginGlobal = (pluginsQuery.data ?? []).some((p) => {
    const enabled = p.enabled ?? true;
    return isKeyAuthPluginName(p?.name) && enabled && p.isGlobal === true;
  });

  const hasKeyauthPluginAnywhere = (pluginsQuery.data ?? []).some((p) => {
    const enabled = p.enabled ?? true;
    return isKeyAuthPluginName(p?.name) && enabled;
  });
  const pluginsReady = !pluginsQuery.isLoading && !pluginsQuery.isError;
  const canCreateAcl =
    pluginsReady &&
    (hasAclPluginInAnyRoute || hasAclPluginInAnyService || hasAclPluginInAnyConsumer || hasAclPluginGlobal);
  const canCreateKeyauth =
    pluginsReady &&
    (hasKeyauthPluginInAnyRoute || hasKeyauthPluginInAnyService || hasKeyauthPluginGlobal);

  const consumer = consumerQuery.data;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="truncate text-xl font-semibold text-zinc-900">
            Consumer: {consumer?.username ?? '…'}
          </h1>
          <p className="mt-1 text-sm text-zinc-600">Detalhes do consumer.</p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/w/${params.workspaceId}/gateway/consumers`}
            className="rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-900 hover:bg-zinc-50"
          >
            Back
          </Link>
          <Link
            href={`/w/${params.workspaceId}/gateway/consumers/${params.consumerId}/edit`}
            className="rounded-md bg-black px-3 py-2 text-sm font-medium text-white"
          >
            Edit
          </Link>
        </div>
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white">
        {consumerQuery.isLoading ? <div className="p-4 text-sm text-zinc-600">Carregando…</div> : null}
        {consumerQuery.isError ? (
          <div className="p-4 text-sm text-red-700">Falha ao carregar consumer.</div>
        ) : null}

        {consumer ? (
          <div className="divide-y divide-zinc-200">
            <div className="grid gap-4 p-4 sm:grid-cols-2">
              <div>
                <div className="text-sm text-zinc-600">Username</div>
                <div className="mt-1 text-sm font-medium text-zinc-900">{consumer.username}</div>
              </div>
              <div>
                <div className="text-sm text-zinc-600">Custom ID</div>
                <div className="mt-1 text-sm font-medium text-zinc-900">{consumer.customId}</div>
              </div>
              <div className="sm:col-span-2">
                <div className="text-sm text-zinc-600">Tags</div>
                <div className="mt-1 text-sm font-medium text-zinc-900">
                  {consumer.tags?.length ? consumer.tags.join(', ') : '—'}
                </div>
              </div>
              <div>
                <div className="text-sm text-zinc-600">Created</div>
                <div className="mt-1 text-sm font-medium text-zinc-900">
                  {new Date(consumer.createdAt).toLocaleString()}
                </div>
              </div>
              <div>
                <div className="text-sm text-zinc-600">Updated</div>
                <div className="mt-1 text-sm font-medium text-zinc-900">
                  {new Date(consumer.updatedAt).toLocaleString()}
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-zinc-200 bg-white">
          <div className="flex items-start justify-between gap-4 border-b border-zinc-200 p-4">
            <div className="min-w-0">
              <div className="text-sm font-semibold text-zinc-900">ACLs</div>
              <div className="mt-1 text-sm text-zinc-600">Grupos ACL vinculados a este consumer.</div>
            </div>
            {canCreateAcl ? (
              <Link
                href={`/w/${params.workspaceId}/gateway/acls/new?consumerId=${encodeURIComponent(
                  params.consumerId,
                )}`}
                className="shrink-0 rounded-md bg-black px-3 py-2 text-sm font-medium text-white"
              >
                New ACL
              </Link>
            ) : (
              <button
                type="button"
                disabled
                title={
                  pluginsQuery.isLoading
                    ? 'Carregando plugins do workspace…'
                    : pluginsQuery.isError
                      ? 'Falha ao carregar plugins do workspace.'
                      : 'Instale o plugin ACL em rota, service, consumer ou como global neste workspace para habilitar ACLs.'
                }
                className="shrink-0 rounded-md bg-black px-3 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                New ACL
              </button>
            )}
          </div>

          <div className="p-4">
            {aclsQuery.isLoading ? <div className="text-sm text-zinc-600">Carregando…</div> : null}
            {aclsQuery.isError ? (
              <div className="text-sm text-red-700">Falha ao carregar ACLs.</div>
            ) : null}

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-xs uppercase tracking-wide text-zinc-500">
                  <tr>
                    <th className="py-2 pr-3">Group</th>
                    <th className="py-2 pr-3">Created</th>
                    <th className="py-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200">
                  {(aclsQuery.data ?? []).map((a) => (
                    <tr key={a.id}>
                      <td className="py-2 pr-3 font-medium text-zinc-900">{a.group}</td>
                      <td className="py-2 pr-3 text-zinc-700">
                        {new Date(a.createdAt).toLocaleString()}
                      </td>
                      <td className="py-2 text-right">
                        <div className="inline-flex items-center gap-2">
                          <Link
                            href={`/w/${params.workspaceId}/gateway/acls/${a.id}`}
                            className="rounded-md border border-zinc-200 bg-white px-2 py-1 text-sm text-zinc-900 hover:bg-zinc-50"
                          >
                            View
                          </Link>
                          <Link
                            href={`/w/${params.workspaceId}/gateway/acls/${a.id}/edit`}
                            className="rounded-md bg-black px-2 py-1 text-sm text-white"
                          >
                            Edit
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {aclsQuery.data?.length === 0 ? (
              <div className="mt-3 text-sm text-zinc-600">Nenhum ACL para este consumer.</div>
            ) : null}
          </div>
        </div>

        <div className="rounded-xl border border-zinc-200 bg-white">
          <div className="flex items-start justify-between gap-4 border-b border-zinc-200 p-4">
            <div className="min-w-0">
              <div className="text-sm font-semibold text-zinc-900">KeyAuth</div>
              <div className="mt-1 text-sm text-zinc-600">Credenciais KeyAuth vinculadas a este consumer.</div>
            </div>
            {canCreateKeyauth ? (
              <Link
                href={`/w/${params.workspaceId}/gateway/keyauth-consumers/new?consumerId=${encodeURIComponent(
                  params.consumerId,
                )}`}
                className="shrink-0 rounded-md bg-black px-3 py-2 text-sm font-medium text-white"
              >
                New KeyAuth
              </Link>
            ) : (
              <button
                type="button"
                disabled
                title={
                  pluginsQuery.isLoading
                    ? 'Carregando plugins do workspace…'
                    : pluginsQuery.isError
                      ? 'Falha ao carregar plugins do workspace.'
                      : hasKeyauthPluginAnywhere
                        ? 'O plugin KeyAuth está habilitado, mas não está instalado em rota nem service. Instale-o em uma rota ou service (ou deixe como global) para habilitar KeyAuth.'
                        : 'Instale o plugin KeyAuth em uma rota, service ou como global para habilitar KeyAuth.'
                }
                className="shrink-0 rounded-md bg-black px-3 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                New KeyAuth
              </button>
            )}
          </div>

          <div className="p-4">
            {keyauthQuery.isLoading ? <div className="text-sm text-zinc-600">Carregando…</div> : null}
            {keyauthQuery.isError ? (
              <div className="text-sm text-red-700">Falha ao carregar KeyAuth.</div>
            ) : null}

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-xs uppercase tracking-wide text-zinc-500">
                  <tr>
                    <th className="py-2 pr-3">Key</th>
                    <th className="py-2 pr-3">TTL</th>
                    <th className="py-2 pr-3">Created</th>
                    <th className="py-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200">
                  {(keyauthQuery.data ?? []).map((k) => (
                    <tr key={k.id}>
                      <td className="py-2 pr-3 font-medium text-zinc-900">{k.key}</td>
                      <td className="py-2 pr-3 text-zinc-700">{k.ttl === null ? '—' : k.ttl}</td>
                      <td className="py-2 pr-3 text-zinc-700">
                        {new Date(k.createdAt).toLocaleString()}
                      </td>
                      <td className="py-2 text-right">
                        <div className="inline-flex items-center gap-2">
                          <Link
                            href={`/w/${params.workspaceId}/gateway/keyauth-consumers/${k.id}`}
                            className="rounded-md border border-zinc-200 bg-white px-2 py-1 text-sm text-zinc-900 hover:bg-zinc-50"
                          >
                            View
                          </Link>
                          <Link
                            href={`/w/${params.workspaceId}/gateway/keyauth-consumers/${k.id}/edit`}
                            className="rounded-md bg-black px-2 py-1 text-sm text-white"
                          >
                            Edit
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {keyauthQuery.data?.length === 0 ? (
              <div className="mt-3 text-sm text-zinc-600">Nenhuma credencial KeyAuth para este consumer.</div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
