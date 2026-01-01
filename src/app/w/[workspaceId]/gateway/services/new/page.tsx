'use client';

import { useMutation } from '@tanstack/react-query';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { getAccessToken } from '@/lib/auth';
import { HelpHint } from '@/app/_components/HelpHint';

export default function NewServicePage() {
  const params = useParams<{ workspaceId: string }>();
  const router = useRouter();
  const token = useMemo(() => getAccessToken(), []);

  const [name, setName] = useState('');
  const [protocol, setProtocol] = useState<'http' | 'https' | 'grpc' | 'grpcs'>('http');
  const [host, setHost] = useState('localhost');
  const [port, setPort] = useState<number>(80);
  const [enabled, setEnabled] = useState(true);
  const [ttl, setTtl] = useState<string>('30');
  const [path, setPath] = useState('');
  const [tags, setTags] = useState('');
  const [connectTimeout, setConnectTimeout] = useState<string>('60000');
  const [writeTimeout, setWriteTimeout] = useState<string>('60000');
  const [readTimeout, setReadTimeout] = useState<string>('60000');
  const [retries, setRetries] = useState<string>('5');

  const tagsArray = useMemo(() => {
    const parts = tags
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);
    return parts.length ? parts : undefined;
  }, [tags]);

  useEffect(() => {
    if (!token) router.replace('/login');
  }, [router, token]);

  const createServiceMutation = useMutation({
    mutationFn: async () => {
      const ttlValue = ttl.trim() ? Number(ttl) : undefined;
      const connectTimeoutValue = connectTimeout.trim() ? Number(connectTimeout) : undefined;
      const writeTimeoutValue = writeTimeout.trim() ? Number(writeTimeout) : undefined;
      const readTimeoutValue = readTimeout.trim() ? Number(readTimeout) : undefined;
      const retriesValue = retries.trim() ? Number(retries) : undefined;
      return apiFetch<{ service: { id: string } }>(
        `/workspaces/${params.workspaceId}/services`,
        {
          method: 'POST',
          token,
          body: JSON.stringify({
            name,
            host,
            protocol,
            port: Number(port),
            enabled,
            ttl: ttlValue,
            path: path.trim() ? path : undefined,
            tags: tagsArray,
            connectTimeout: connectTimeoutValue,
            writeTimeout: writeTimeoutValue,
            readTimeout: readTimeoutValue,
            retries: retriesValue,
          }),
        },
      );
    },
    onSuccess: async (res) => {
      router.push(`/w/${params.workspaceId}/gateway/services/${res.service.id}`);
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900">New Service</h1>
          <p className="mt-1 text-sm text-zinc-600">Create a service (upstream) for the gateway.</p>
        </div>
        <Link
          href={`/w/${params.workspaceId}/gateway/services`}
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
            createServiceMutation.mutate();
          }}
        >
          <label className="flex items-center gap-2 sm:col-span-2">
            <input checked={enabled} onChange={(e) => setEnabled(e.target.checked)} type="checkbox" />
            <span className="text-sm text-zinc-700">Enabled</span>
          </label>

          <label className="block">
            <span className="text-sm text-zinc-700">Name</span>
            <input
              className="mt-1 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="meu-service"
              minLength={2}
              required
            />
          </label>

          <label className="block">
            <span className="text-sm text-zinc-700">Protocol</span>
            <select
              className="mt-1 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900"
              value={protocol}
              onChange={(e) => {
                const v = e.target.value;
                if (v === 'https' || v === 'grpc' || v === 'grpcs') return setProtocol(v);
                return setProtocol('http');
              }}
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
              className="mt-1 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400"
              value={host}
              onChange={(e) => setHost(e.target.value)}
              placeholder="api.mycompany.com"
              minLength={1}
              required
            />
          </label>

          <label className="block">
            <span className="text-sm text-zinc-700">Port</span>
            <input
              className="mt-1 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900"
              value={port}
              onChange={(e) => setPort(Number(e.target.value))}
              type="number"
              min={1}
              required
            />
          </label>

          <label className="block">
            <span className="text-sm text-zinc-700">
              TTL <HelpHint text="Optional service TTL (seconds)." />
            </span>
            <input
              className="mt-1 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400"
              value={ttl}
              onChange={(e) => setTtl(e.target.value)}
              type="number"
              min={1}
              placeholder="30"
            />
          </label>

          <label className="block">
            <span className="text-sm text-zinc-700">
              Path <HelpHint text="Optional base path to prepend to the upstream request." />
            </span>
            <input
              className="mt-1 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400"
              value={path}
              onChange={(e) => setPath(e.target.value)}
              placeholder="/v1"
            />
          </label>

          <label className="block sm:col-span-2">
            <span className="text-sm text-zinc-700">
              Tags <HelpHint text="Optional comma-separated tags for this service." />
            </span>
            <input
              className="mt-1 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="tag1, tag2"
            />
          </label>

          <label className="block">
            <span className="text-sm text-zinc-700">Connect Timeout (ms)</span>
            <input
              className="mt-1 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900"
              value={connectTimeout}
              onChange={(e) => setConnectTimeout(e.target.value)}
              type="number"
              min={1}
            />
          </label>

          <label className="block">
            <span className="text-sm text-zinc-700">Write Timeout (ms)</span>
            <input
              className="mt-1 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900"
              value={writeTimeout}
              onChange={(e) => setWriteTimeout(e.target.value)}
              type="number"
              min={1}
            />
          </label>

          <label className="block">
            <span className="text-sm text-zinc-700">Read Timeout (ms)</span>
            <input
              className="mt-1 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900"
              value={readTimeout}
              onChange={(e) => setReadTimeout(e.target.value)}
              type="number"
              min={1}
            />
          </label>

          <label className="block">
            <span className="text-sm text-zinc-700">Retries</span>
            <input
              className="mt-1 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900"
              value={retries}
              onChange={(e) => setRetries(e.target.value)}
              type="number"
              min={0}
            />
          </label>

          <button
            className="rounded-md bg-black px-3 py-2 text-sm font-medium text-white disabled:opacity-50 sm:col-span-2"
            disabled={createServiceMutation.isPending}
            type="submit"
          >
            {createServiceMutation.isPending ? 'Creating…' : 'Create service'}
          </button>
        </form>

        {createServiceMutation.isError ? (
          <div className="mt-3 rounded-md bg-red-50 p-3 text-sm text-red-700">
            Failed to create service (must be admin/owner).
          </div>
        ) : null}
      </div>
    </div>
  );
}
