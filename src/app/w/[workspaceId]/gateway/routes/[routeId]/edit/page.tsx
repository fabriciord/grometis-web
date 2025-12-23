'use client';

import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef } from 'react';
import { apiFetch } from '@/lib/api';
import { getAccessToken } from '@/lib/auth';

type ServiceListItem = { id: string; name: string };

type RouteDetails = {
  id: string;
  name: string | null;
  description: string | null;
  paths: string[];
  methods: string[];
  protocols: string[];
  host: string | null;
  stripPath: boolean | null;
  serviceId: string;
  createdAt: string;
  updatedAt: string;
};

function splitList(value: string): string[] {
  return value
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);
}

export default function RouteEditPage() {
  const params = useParams<{ workspaceId: string; routeId: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const token = useMemo(() => getAccessToken(), []);

  const serviceIdRef = useRef<HTMLSelectElement | null>(null);
  const nameRef = useRef<HTMLInputElement | null>(null);
  const descriptionRef = useRef<HTMLInputElement | null>(null);
  const pathsRef = useRef<HTMLInputElement | null>(null);
  const methodsRef = useRef<HTMLInputElement | null>(null);
  const protocolsRef = useRef<HTMLInputElement | null>(null);
  const hostRef = useRef<HTMLInputElement | null>(null);
  const stripPathRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!token) router.replace('/login');
  }, [router, token]);

  const servicesQuery = useQuery({
    queryKey: ['services', params.workspaceId],
    queryFn: async () => {
      const res = await apiFetch<{ services: ServiceListItem[] }>(
        `/workspaces/${params.workspaceId}/services`,
        { token },
      );
      return res.services;
    },
    enabled: !!token,
  });

  const routeQuery = useQuery({
    queryKey: ['route', params.workspaceId, params.routeId],
    queryFn: async () => {
      const res = await apiFetch<{ route: RouteDetails }>(
        `/workspaces/${params.workspaceId}/routes/${params.routeId}`,
        { token },
      );
      return res.route;
    },
    enabled: !!token,
  });

  const route = routeQuery.data;

  const updateMutation = useMutation({
    mutationFn: async () => {
      const serviceId = serviceIdRef.current?.value ?? '';
      const name = nameRef.current?.value ?? '';
      const description = descriptionRef.current?.value ?? '';
      const paths = pathsRef.current?.value ?? '';
      const methods = methodsRef.current?.value ?? '';
      const protocols = protocolsRef.current?.value ?? '';
      const host = hostRef.current?.value ?? '';
      const stripPath = Boolean(stripPathRef.current?.checked);

      return apiFetch<{ route: { id: string } }>(
        `/workspaces/${params.workspaceId}/routes/${params.routeId}`,
        {
          method: 'PATCH',
          token,
          body: JSON.stringify({
            serviceId,
            name: name.trim() ? name : null,
            description: description.trim() ? description : null,
            paths: splitList(paths),
            methods: splitList(methods),
            protocols: splitList(protocols),
            host: host.trim() ? host : null,
            stripPath,
          }),
        },
      );
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['routes', params.workspaceId] });
      await queryClient.invalidateQueries({ queryKey: ['route', params.workspaceId, params.routeId] });
      router.push(`/w/${params.workspaceId}/gateway/routes/${params.routeId}`);
    },
  });

  const serviceOptions = servicesQuery.data ?? [];
  const isReady = Boolean(route) && !servicesQuery.isLoading && !routeQuery.isLoading;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900">Edit Route</h1>
          <p className="mt-1 text-sm text-zinc-600">Atualize a regra de roteamento.</p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/w/${params.workspaceId}/gateway/routes/${params.routeId}`}
            className="rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-900 hover:bg-zinc-50"
          >
            Cancel
          </Link>
          <button
            className="rounded-md bg-black px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
            disabled={updateMutation.isPending || routeQuery.isLoading || servicesQuery.isLoading}
            form="edit-route-form"
            type="submit"
          >
            {updateMutation.isPending ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white p-4">
        {routeQuery.isError ? (
          <div className="mb-3 rounded-md bg-red-50 p-3 text-sm text-red-700">
            Falha ao carregar route.
          </div>
        ) : null}

        {!isReady ? (
          <div className="text-sm text-zinc-600">Carregando…</div>
        ) : (
          <form
            id="edit-route-form"
            key={route!.id}
            className="grid gap-2 sm:grid-cols-2"
            onSubmit={(e) => {
              e.preventDefault();
              updateMutation.mutate();
            }}
          >
            <label className="block">
              <span className="text-sm text-zinc-700">Service</span>
              <select
                className="mt-1 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900"
                defaultValue={route!.serviceId}
                ref={serviceIdRef}
                required
              >
                {serviceOptions.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="text-sm text-zinc-700">Name (opcional)</span>
              <input
                className="mt-1 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900"
                defaultValue={route!.name ?? ''}
                ref={nameRef}
                placeholder="minha-route"
              />
            </label>

            <label className="block sm:col-span-2">
              <span className="text-sm text-zinc-700">Paths (vírgula)</span>
              <input
                className="mt-1 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900"
                defaultValue={route!.paths.join(',')}
                ref={pathsRef}
                required
              />
            </label>

            <label className="block">
              <span className="text-sm text-zinc-700">Methods (vírgula)</span>
              <input
                className="mt-1 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900"
                defaultValue={route!.methods.join(',')}
                ref={methodsRef}
                required
              />
            </label>

            <label className="block">
              <span className="text-sm text-zinc-700">Protocols (vírgula)</span>
              <input
                className="mt-1 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900"
                defaultValue={route!.protocols.join(',')}
                ref={protocolsRef}
                required
              />
            </label>

            <label className="block sm:col-span-2">
              <span className="text-sm text-zinc-700">Host (opcional)</span>
              <input
                className="mt-1 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900"
                defaultValue={route!.host ?? ''}
                ref={hostRef}
              />
            </label>

            <label className="flex items-center gap-2 sm:col-span-2">
              <input
                defaultChecked={route!.stripPath === null ? true : route!.stripPath}
                ref={stripPathRef}
                type="checkbox"
              />
              <span className="text-sm text-zinc-700">Strip path</span>
            </label>

            <label className="block sm:col-span-2">
              <span className="text-sm text-zinc-700">Description (opcional)</span>
              <input
                className="mt-1 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900"
                defaultValue={route!.description ?? ''}
                ref={descriptionRef}
              />
            </label>
          </form>
        )}

        {updateMutation.isError ? (
          <div className="mt-3 rounded-md bg-red-50 p-3 text-sm text-red-700">
            Falha ao salvar (precisa ser admin/owner).
          </div>
        ) : null}
      </div>
    </div>
  );
}
