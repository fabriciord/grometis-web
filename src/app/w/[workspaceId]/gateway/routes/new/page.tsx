'use client';

import Link from 'next/link';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { getAccessToken } from '@/lib/auth';
import { HelpHint } from '@/app/_components/HelpHint';

type WorkspaceAvatar = { color: string | null; imageDataUrl: string | null };

type ServiceListItem = {
  id: string;
  name: string;
};

type PathItem = {
  id: string;
  value: string;
};
type WorkspaceListItem = {
  id: string;
  name: string;
  role: 'viewer' | 'admin' | 'owner';
  avatar?: WorkspaceAvatar;
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
  const nextPathIdRef = useRef(1);
  const [paths, setPaths] = useState<PathItem[]>([]);
  const [methods, setMethods] = useState('');
  const [protocols, setProtocols] = useState('http,https');
  const [host, setHost] = useState('');
  const [stripPath, setStripPath] = useState<boolean>(true);
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

  const workspaceName =
    workspacesQuery.data?.find((w) => w.id === params.workspaceId)?.name ?? params.workspaceId;
  
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
          paths: paths
            .map((p) => p.value.trim())
            .filter(Boolean),
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
          <p className="mt-1 text-sm text-zinc-600">Create a routing rule.</p>
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

            setPathsTouched(true);
            if (normalizedPaths.length === 0) return;

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
            <span className="text-sm text-zinc-700">
              Name <HelpHint text="Optional name for this route." />
            </span>
            <input
              className="mt-1 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400"
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
                const inputId = `route-path-${pathItem.id}`;
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
                      placeholder={`/${workspaceName}/v1/users`}
                      autoComplete="off"
                      spellCheck={false}
                    />

                    {paths.length > 0 ? (
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
                    ) : null}
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
              className="mt-1 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400"
              value={methods}
              onChange={(e) => setMethods(e.target.value)}
              placeholder="GET,POST"
              required
            />
          </label>

          <label className="block">
            <span className="text-sm text-zinc-700">
              Protocols <HelpHint text="Comma-separated list of protocols allowed by this route." />
            </span>
            <input
              className="mt-1 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400"
              value={protocols}
              onChange={(e) => setProtocols(e.target.value)}
              placeholder="http,https"
              required
            />
          </label>

          <label className="block sm:col-span-2">
            <span className="text-sm text-zinc-700">
              Host <HelpHint text="Optional host that must match this route (e.g. api.mycompany.com)." />
            </span>
            <input
              className="mt-1 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400"
              value={host}
              onChange={(e) => setHost(e.target.value)}
              placeholder="api.mycompany.com"
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
              className="mt-1 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder=""
            />
          </label>

          <button
            className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50 sm:col-span-2"
            disabled={
              createRouteMutation.isPending ||
              servicesQuery.isLoading ||
              !selectedServiceId ||
              normalizedPaths.length === 0
            }
            type="submit"
          >
            {createRouteMutation.isPending ? 'Creating…' : 'Create route'}
          </button>
        </form>

        {servicesQuery.isError ? (
          <div className="mt-3 rounded-md bg-red-50 p-3 text-sm text-red-700">
            Failed to load services (create a service first).
          </div>
        ) : null}

        {createRouteMutation.isError ? (
          <div className="mt-3 rounded-md bg-red-50 p-3 text-sm text-red-700">
            Failed to create route (must be admin/owner).
          </div>
        ) : null}
      </div>
    </div>
  );
}
