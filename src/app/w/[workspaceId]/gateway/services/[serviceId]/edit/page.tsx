'use client';

import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef } from 'react';
import { apiFetch } from '@/lib/api';
import { getAccessToken } from '@/lib/auth';

type ServiceDetails = {
  id: string;
  name: string;
  host: string;
  protocol: string;
  port: number;
  enabled: boolean;
  ttl: number | null;
  path: string | null;
  tags?: string[] | null;
  connectTimeout?: number | null;
  writeTimeout?: number | null;
  readTimeout?: number | null;
  retries?: number | null;
  createdAt: string;
  updatedAt: string;
};

export default function ServiceEditPage() {
  const params = useParams<{ workspaceId: string; serviceId: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const token = useMemo(() => getAccessToken(), []);

  const nameRef = useRef<HTMLInputElement | null>(null);
  const protocolRef = useRef<HTMLSelectElement | null>(null);
  const hostRef = useRef<HTMLInputElement | null>(null);
  const portRef = useRef<HTMLInputElement | null>(null);
  const enabledRef = useRef<HTMLInputElement | null>(null);
  const ttlRef = useRef<HTMLInputElement | null>(null);
  const pathRef = useRef<HTMLInputElement | null>(null);
  const tagsRef = useRef<HTMLInputElement | null>(null);
  const connectTimeoutRef = useRef<HTMLInputElement | null>(null);
  const writeTimeoutRef = useRef<HTMLInputElement | null>(null);
  const readTimeoutRef = useRef<HTMLInputElement | null>(null);
  const retriesRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!token) router.replace('/login');
  }, [router, token]);

  const serviceQuery = useQuery({
    queryKey: ['service', params.workspaceId, params.serviceId],
    queryFn: async () => {
      const res = await apiFetch<{ service: ServiceDetails }>(
        `/workspaces/${params.workspaceId}/services/${params.serviceId}`,
        { token },
      );
      return res.service;
    },
    enabled: !!token,
  });

  const service = serviceQuery.data;

  const updateMutation = useMutation({
    mutationFn: async () => {
      const name = nameRef.current?.value ?? '';
      const host = hostRef.current?.value ?? '';
      const protocolRaw = protocolRef.current?.value ?? 'http';
      const protocol =
        protocolRaw === 'https' || protocolRaw === 'grpc' || protocolRaw === 'grpcs' ? protocolRaw : 'http';
      const port = Number(portRef.current?.value ?? 80);
      const enabled = Boolean(enabledRef.current?.checked);
      const ttlRaw = ttlRef.current?.value ?? '';
      const ttlValue = ttlRaw.trim() ? Number(ttlRaw) : null;
      const pathRaw = pathRef.current?.value ?? '';
      const pathValue = pathRaw.trim() ? pathRaw : null;

      const tagsRaw = tagsRef.current?.value ?? '';
      const tagsParts = tagsRaw
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);
      const tagsValue = tagsParts.length ? tagsParts : null;

      const connectTimeoutRaw = connectTimeoutRef.current?.value ?? '';
      const connectTimeoutValue = connectTimeoutRaw.trim() ? Number(connectTimeoutRaw) : null;
      const writeTimeoutRaw = writeTimeoutRef.current?.value ?? '';
      const writeTimeoutValue = writeTimeoutRaw.trim() ? Number(writeTimeoutRaw) : null;
      const readTimeoutRaw = readTimeoutRef.current?.value ?? '';
      const readTimeoutValue = readTimeoutRaw.trim() ? Number(readTimeoutRaw) : null;
      const retriesRaw = retriesRef.current?.value ?? '';
      const retriesValue = retriesRaw.trim() ? Number(retriesRaw) : null;

      return apiFetch<{ service: { id: string } }>(
        `/workspaces/${params.workspaceId}/services/${params.serviceId}`,
        {
          method: 'PATCH',
          token,
          body: JSON.stringify({
            name,
            host,
            protocol,
            port,
            enabled,
            ttl: ttlValue,
            path: pathValue,
            tags: tagsValue,
            connectTimeout: connectTimeoutValue,
            writeTimeout: writeTimeoutValue,
            readTimeout: readTimeoutValue,
            retries: retriesValue,
          }),
        },
      );
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['services', params.workspaceId] });
      await queryClient.invalidateQueries({ queryKey: ['service', params.workspaceId, params.serviceId] });
      router.push(`/w/${params.workspaceId}/gateway/services/${params.serviceId}`);
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900">Edit Service</h1>
          <p className="mt-1 text-sm text-zinc-600">Update service fields.</p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/w/${params.workspaceId}/gateway/services/${params.serviceId}`}
            className="rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-900 hover:bg-zinc-50"
          >
            Cancel
          </Link>
          <button
            className="rounded-md bg-black px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
            disabled={updateMutation.isPending || serviceQuery.isLoading}
            form="edit-service-form"
            type="submit"
          >
            {updateMutation.isPending ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white p-4">
        {serviceQuery.isError ? (
          <div className="mb-3 rounded-md bg-red-50 p-3 text-sm text-red-700">
            Failed to load service.
          </div>
        ) : null}

        <form
          id="edit-service-form"
          className="grid gap-2 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            updateMutation.mutate();
          }}
        >
          <label className="flex items-center gap-2 sm:col-span-2">
            <input defaultChecked={service?.enabled ?? true} ref={enabledRef} type="checkbox" />
            <span className="text-sm text-zinc-700">Enabled</span>
          </label>

          <label className="block">
            <span className="text-sm text-zinc-700">Name</span>
            <input
              className="mt-1 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900"
              defaultValue={service?.name ?? ''}
              ref={nameRef}
              minLength={2}
              required
            />
          </label>

          <label className="block">
            <span className="text-sm text-zinc-700">Protocol</span>
            <select
              className="mt-1 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900"
              defaultValue={
                service?.protocol === 'https' || service?.protocol === 'grpc' || service?.protocol === 'grpcs'
                  ? service.protocol
                  : 'http'
              }
              ref={protocolRef}
            >
              <option value="http">http</option>
              <option value="https">https</option>
              <option value="grpc">grpc</option>
              <option value="grpcs">grpcs</option>
            </select>
          </label>

          <label className="block">
            <span className="text-sm text-zinc-700">Host</span>
            <input
              className="mt-1 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900"
              defaultValue={service?.host ?? ''}
              ref={hostRef}
              minLength={1}
              required
            />
          </label>

          <label className="block">
            <span className="text-sm text-zinc-700">Port</span>
            <input
              className="mt-1 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900"
              defaultValue={service?.port ?? 80}
              ref={portRef}
              type="number"
              min={1}
              required
            />
          </label>

          <label className="block">
            <span className="text-sm text-zinc-700">TTL</span>
            <input
              className="mt-1 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900"
              defaultValue={service?.ttl === null || service?.ttl === undefined ? '' : String(service.ttl)}
              ref={ttlRef}
              type="number"
              min={1}
              placeholder="30"
            />
          </label>

          <label className="block">
            <span className="text-sm text-zinc-700">Path</span>
            <input
              className="mt-1 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900"
              defaultValue={service?.path ?? ''}
              ref={pathRef}
              placeholder="/v1"
            />
          </label>

          <label className="block sm:col-span-2">
            <span className="text-sm text-zinc-700">Tags</span>
            <input
              className="mt-1 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400"
              defaultValue={service?.tags && service.tags.length ? service.tags.join(', ') : ''}
              ref={tagsRef}
              placeholder="tag1, tag2"
            />
          </label>

          <label className="block">
            <span className="text-sm text-zinc-700">Connect Timeout (ms)</span>
            <input
              className="mt-1 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900"
              defaultValue={service?.connectTimeout ?? 60000}
              ref={connectTimeoutRef}
              type="number"
              min={1}
            />
          </label>

          <label className="block">
            <span className="text-sm text-zinc-700">Write Timeout (ms)</span>
            <input
              className="mt-1 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900"
              defaultValue={service?.writeTimeout ?? 60000}
              ref={writeTimeoutRef}
              type="number"
              min={1}
            />
          </label>

          <label className="block">
            <span className="text-sm text-zinc-700">Read Timeout (ms)</span>
            <input
              className="mt-1 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900"
              defaultValue={service?.readTimeout ?? 60000}
              ref={readTimeoutRef}
              type="number"
              min={1}
            />
          </label>

          <label className="block">
            <span className="text-sm text-zinc-700">Retries</span>
            <input
              className="mt-1 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900"
              defaultValue={service?.retries ?? 5}
              ref={retriesRef}
              type="number"
              min={0}
            />
          </label>
        </form>

        {updateMutation.isError ? (
          <div className="mt-3 rounded-md bg-red-50 p-3 text-sm text-red-700">
            Failed to save (must be admin/owner).
          </div>
        ) : null}
      </div>
    </div>
  );
}
