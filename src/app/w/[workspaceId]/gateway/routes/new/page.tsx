'use client';

import Link from 'next/link';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { getAccessToken } from '@/lib/auth';

type ServiceListItem = {
  id: string;
  name: string;
};

function splitList(value: string): string[] {
  return value
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);
}

export default function NewRoutePage() {
  const params = useParams<{ workspaceId: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = useMemo(() => getAccessToken(), []);

  const [serviceId, setServiceId] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [paths, setPaths] = useState('/');
  const [methods, setMethods] = useState('GET,POST');
  const [protocols, setProtocols] = useState('http,https');
  const [host, setHost] = useState('');
  const [stripPath, setStripPath] = useState<boolean>(true);

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

  const serviceIdFromQuery = searchParams.get('serviceId') ?? '';
  const queryServiceIdIsValid = (servicesQuery.data ?? []).some((s) => s.id === serviceIdFromQuery);

  const selectedServiceId =
    serviceId || (queryServiceIdIsValid ? serviceIdFromQuery : servicesQuery.data?.[0]?.id || '');

  const createRouteMutation = useMutation({
    mutationFn: async () => {
      return apiFetch<{ route: { id: string } }>(`/workspaces/${params.workspaceId}/routes`, {
        method: 'POST',
        token,
        body: JSON.stringify({
          serviceId: selectedServiceId,
          name: name.trim() ? name : undefined,
          description: description.trim() ? description : undefined,
          paths: splitList(paths),
          methods: splitList(methods),
          protocols: splitList(protocols),
          host: host.trim() ? host : undefined,
          stripPath,
        }),
      });
    },
    onSuccess: async (res) => {
      router.push(`/w/${params.workspaceId}/gateway/routes/${res.route.id}`);
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900">New Route</h1>
          <p className="mt-1 text-sm text-zinc-600">Crie uma regra de roteamento.</p>
        </div>
        <Link
          href={`/w/${params.workspaceId}/gateway/routes`}
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
            createRouteMutation.mutate();
          }}
        >
          <label className="block">
            <span className="text-sm text-zinc-700">Service</span>
            <select
              className="mt-1 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900"
              value={selectedServiceId}
              onChange={(e) => setServiceId(e.target.value)}
              required
            >
              {(servicesQuery.data ?? []).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="text-sm text-zinc-700">Name (opcional)</span>
            <input
              className="mt-1 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="minha-route"
            />
          </label>

          <label className="block sm:col-span-2">
            <span className="text-sm text-zinc-700">Paths (separados por vírgula)</span>
            <input
              className="mt-1 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400"
              value={paths}
              onChange={(e) => setPaths(e.target.value)}
              placeholder="/v1,/v2"
              required
            />
          </label>

          <label className="block">
            <span className="text-sm text-zinc-700">Methods (vírgula)</span>
            <input
              className="mt-1 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400"
              value={methods}
              onChange={(e) => setMethods(e.target.value)}
              placeholder="GET,POST"
              required
            />
          </label>

          <label className="block">
            <span className="text-sm text-zinc-700">Protocols (vírgula)</span>
            <input
              className="mt-1 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400"
              value={protocols}
              onChange={(e) => setProtocols(e.target.value)}
              placeholder="http,https"
              required
            />
          </label>

          <label className="block sm:col-span-2">
            <span className="text-sm text-zinc-700">Host (opcional)</span>
            <input
              className="mt-1 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400"
              value={host}
              onChange={(e) => setHost(e.target.value)}
              placeholder="api.minhaempresa.com"
            />
          </label>

          <label className="flex items-center gap-2 sm:col-span-2">
            <input checked={stripPath} onChange={(e) => setStripPath(e.target.checked)} type="checkbox" />
            <span className="text-sm text-zinc-700">Strip path</span>
          </label>

          <label className="block sm:col-span-2">
            <span className="text-sm text-zinc-700">Description (opcional)</span>
            <input
              className="mt-1 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder=""
            />
          </label>

          <button
            className="rounded-md bg-black px-3 py-2 text-sm font-medium text-white disabled:opacity-50 sm:col-span-2"
            disabled={createRouteMutation.isPending || servicesQuery.isLoading || !selectedServiceId}
            type="submit"
          >
            {createRouteMutation.isPending ? 'Creating…' : 'Create route'}
          </button>
        </form>

        {servicesQuery.isError ? (
          <div className="mt-3 rounded-md bg-red-50 p-3 text-sm text-red-700">
            Falha ao carregar services (crie um service primeiro).
          </div>
        ) : null}

        {createRouteMutation.isError ? (
          <div className="mt-3 rounded-md bg-red-50 p-3 text-sm text-red-700">
            Falha ao criar route (precisa ser admin/owner).
          </div>
        ) : null}
      </div>
    </div>
  );
}
