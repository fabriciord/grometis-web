'use client';

import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { getAccessToken } from '@/lib/auth';
import { HelpHint } from '@/app/_components/HelpHint';

type ServiceListItem = { id: string; name: string };

type PathItem = {
  id: string;
  value: string;
};

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

  const nextPathIdRef = useRef(1);
  const [loadedRouteId, setLoadedRouteId] = useState<string | null>(null);
  const [serviceId, setServiceId] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [paths, setPaths] = useState<PathItem[]>([]);
  const [methods, setMethods] = useState('');
  const [protocols, setProtocols] = useState('');
  const [host, setHost] = useState('');
  const [stripPath, setStripPath] = useState(true);
  const [pathsTouched, setPathsTouched] = useState(false);

  const normalizedPaths = useMemo(
    () => paths.map((p) => p.value.trim()).filter(Boolean),
    [paths],
  );

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

  function applyRouteToForm(r: RouteDetails) {
    setLoadedRouteId(r.id);
    setServiceId(r.serviceId);
    setName(r.name ?? '');
    setDescription(r.description ?? '');

    const initialPaths = (r.paths ?? []).map((p, idx) => ({ id: String(idx), value: p }));
    setPaths(initialPaths);
    nextPathIdRef.current = initialPaths.length;
    setPathsTouched(false);

    setMethods((r.methods ?? []).join(','));
    setProtocols((r.protocols ?? []).join(','));
    setHost(r.host ?? '');
    setStripPath(r.stripPath === null ? true : Boolean(r.stripPath));
  }

  useEffect(() => {
    if (!route) return;
    if (loadedRouteId === route.id) return;

    // eslint-disable-next-line react-hooks/set-state-in-effect
    applyRouteToForm(route);
  }, [loadedRouteId, route]);

  const updateMutation = useMutation({
    mutationFn: async () => {
      return apiFetch<{ route: { id: string } }>(
        `/workspaces/${params.workspaceId}/routes/${params.routeId}`,
        {
          method: 'PATCH',
          token,
          body: JSON.stringify({
            serviceId,
            name: name.trim() ? name : null,
            description: description.trim() ? description : null,
            paths: normalizedPaths,
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
          <p className="mt-1 text-sm text-zinc-600">Update the routing rule.</p>
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
            Failed to load route.
          </div>
        ) : null}

        {!isReady ? (
          <div className="text-sm text-zinc-600">Loading…</div>
        ) : (
          <form
            id="edit-route-form"
            key={route!.id}
            className="grid gap-2 sm:grid-cols-2"
            onSubmit={(e) => {
              e.preventDefault();

              setPathsTouched(true);
              if (normalizedPaths.length === 0) return;

              updateMutation.mutate();
            }}
          >
            <label className="block">
              <span className="text-sm text-zinc-700">Service</span>
              <select
                className="mt-1 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900"
                value={serviceId}
                onChange={(e) => setServiceId(e.target.value)}
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
              <span className="text-sm text-zinc-700">
                Name <HelpHint text="Optional name for this route." />
              </span>
              <input
                className="mt-1 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="my-route"
              />
            </label>

            <div className="block sm:col-span-2">
              <span className="text-sm text-zinc-700">
                Paths <HelpHint text="Add one or more paths that match this route." />
              </span>

              <div className="mt-2 space-y-2">
                {paths.map((pathItem, index) => {
                  const inputId = `edit-route-path-${pathItem.id}`;
                  return (
                    <div key={pathItem.id} className="flex items-center gap-2">
                      <label className="sr-only" htmlFor={inputId}>
                        Path {index + 1}
                      </label>
                      <input
                        id={inputId}
                        className="flex-1 rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400"
                        value={pathItem.value}
                        onChange={(e) => {
                          const nextValue = e.target.value;
                          setPathsTouched(true);
                          setPaths((prev) =>
                            prev.map((p) =>
                              p.id === pathItem.id ? { ...p, value: nextValue } : p,
                            ),
                          );
                        }}
                        placeholder="/v1/users"
                        autoComplete="off"
                        spellCheck={false}
                      />

                      <button
                        type="button"
                        aria-label="Remove path"
                        onClick={() => {
                          setPathsTouched(true);
                          setPaths((prev) => prev.filter((p) => p.id !== pathItem.id));
                        }}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50"
                      >
                        <svg
                          viewBox="0 0 24 24"
                          className="h-4 w-4"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M3 6h18" />
                          <path d="M8 6V4h8v2" />
                          <path d="M19 6l-1 14H6L5 6" />
                          <path d="M10 11v6" />
                          <path d="M14 11v6" />
                        </svg>
                      </button>
                    </div>
                  );
                })}

                <div>
                  <button
                    type="button"
                    onClick={() => {
                      setPathsTouched(true);
                      setPaths((prev) => [
                        ...prev,
                        { id: String(nextPathIdRef.current++), value: '' },
                      ]);
                    }}
                    className="rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 hover:bg-zinc-50"
                  >
                    + Add Path
                  </button>
                </div>

                {pathsTouched && paths.length === 0 ? (
                  <div className="text-sm text-red-600">Add at least one path.</div>
                ) : null}
              </div>
            </div>

            <label className="block">
              <span className="text-sm text-zinc-700">
                Methods{' '}
                <HelpHint text="A list of HTTP methods that match this route, separated by commas." />
              </span>
              <input
                className="mt-1 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900"
                value={methods}
                onChange={(e) => setMethods(e.target.value)}
                required
              />
            </label>

            <label className="block">
              <span className="text-sm text-zinc-700">
                Protocols <HelpHint text="Comma-separated list of protocols allowed by this route." />
              </span>
              <input
                className="mt-1 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900"
                value={protocols}
                onChange={(e) => setProtocols(e.target.value)}
                required
              />
            </label>

            <label className="block sm:col-span-2">
              <span className="text-sm text-zinc-700">
                Host <HelpHint text="Optional host that must match this route (e.g. api.mycompany.com)." />
              </span>
              <input
                className="mt-1 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900"
                value={host}
                onChange={(e) => setHost(e.target.value)}
              />
            </label>

            <label className="flex items-center gap-2 sm:col-span-2">
              <input checked={stripPath} onChange={(e) => setStripPath(e.target.checked)} type="checkbox" />
              <span className="text-sm text-zinc-700">Strip path</span>
            </label>

            <label className="block sm:col-span-2">
              <span className="text-sm text-zinc-700">
                Description <HelpHint text="Optional description for this route." />
              </span>
              <input
                className="mt-1 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </label>
          </form>
        )}

        {updateMutation.isError ? (
          <div className="mt-3 rounded-md bg-red-50 p-3 text-sm text-red-700">
            Failed to save (must be admin/owner).
          </div>
        ) : null}
      </div>
    </div>
  );
}
