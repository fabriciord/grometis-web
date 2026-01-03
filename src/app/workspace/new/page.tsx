'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch, type ApiError } from '@/lib/api';
import { clearAccessToken, getAccessToken } from '@/lib/auth';

function formatApiError(err: unknown): string {
  if (!err || typeof err !== 'object') return 'Unknown error.';
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
  return status ? `${status}: Failed to create workspace.` : 'Failed to create workspace.';
}

type AvatarColor =
  | 'blue'
  | 'gray'
  | 'purple'
  | 'red'
  | 'green'
  | 'slate'
  | 'amber'
  | 'teal'
  | 'indigo';

const AVATAR_COLORS: { id: AvatarColor; swatchClass: string }[] = [
  { id: 'blue', swatchClass: 'bg-blue-600' },
  { id: 'gray', swatchClass: 'bg-zinc-500' },
  { id: 'purple', swatchClass: 'bg-purple-600' },
  { id: 'red', swatchClass: 'bg-red-600' },
  { id: 'green', swatchClass: 'bg-green-600' },
  { id: 'slate', swatchClass: 'bg-slate-700' },
  { id: 'amber', swatchClass: 'bg-amber-500' },
  { id: 'teal', swatchClass: 'bg-teal-600' },
  { id: 'indigo', swatchClass: 'bg-indigo-600' },
];

export default function CreateWorkspacePage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const token = useMemo(() => getAccessToken(), []);

  const [name, setName] = useState('');
  const [avatarColor, setAvatarColor] = useState<AvatarColor>('blue');
  const [avatarImageDataUrl, setAvatarImageDataUrl] = useState<string | null>(null);
  const [avatarImageName, setAvatarImageName] = useState<string>('');
  const [fileError, setFileError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!token) router.replace('/login');
  }, [router, token]);

  const createWorkspaceMutation = useMutation({
    mutationFn: async () => {
      return apiFetch<{ workspace: { id: string; name: string } }>(
        '/workspaces',
        {
          method: 'POST',
          token,
          body: JSON.stringify({
            name,
            avatarColor,
            avatarImageDataUrl: avatarImageDataUrl ?? undefined,
          }),
        },
      );
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['workspaces'] });
      router.push('/workspace');
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
              <div className="text-sm text-zinc-700">Workspaces</div>
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
          <Link href="/workspace" className="hover:underline">
            Workspaces
          </Link>{' '}
          <span className="text-zinc-400">›</span>
        </div>

        <h1 className="mt-3 text-3xl font-semibold text-zinc-900">Create Workspace</h1>
        <div className="mt-6 border-b border-zinc-200" />

        <form
          className="mt-6 max-w-3xl"
          onSubmit={(e) => {
            e.preventDefault();
            createWorkspaceMutation.mutate();
          }}
        >
          <div>
            <div className="text-sm font-medium text-zinc-900">Name</div>
            <input
              className="mt-2 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400"
              value={name}
              onChange={(e) => setName(e.target.value)}
              minLength={2}
              required
            />
            <div className="mt-2 text-sm text-zinc-500">
              Workspace name cannot be changed after creation.
            </div>
          </div>

          <div className="mt-8">
            <div className="text-sm font-semibold text-zinc-800">Workspace Avatar</div>

            <div className="mt-3 flex flex-wrap gap-3">
              {AVATAR_COLORS.map((c) => {
                const selected = avatarColor === c.id && !avatarImageDataUrl;
                return (
                  <button
                    key={c.id}
                    type="button"
                    className={`relative h-10 w-10 rounded-md ${c.swatchClass} ${
                      selected ? 'ring-2 ring-indigo-600 ring-offset-2 ring-offset-zinc-50' : ''
                    }`}
                    onClick={() => {
                      setAvatarColor(c.id);
                      setAvatarImageDataUrl(null);
                      setAvatarImageName('');
                      setFileError(null);
                      if (fileInputRef.current) fileInputRef.current.value = '';
                    }}
                    aria-label={`Avatar color ${c.id}`}
                  >
                    {selected ? (
                      <svg
                        viewBox="0 0 20 20"
                        fill="none"
                        className="absolute left-1/2 top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2"
                      >
                        <path
                          d="M16.25 5.75l-7.1 7.1-3.4-3.4"
                          stroke="white"
                          strokeWidth="2.2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    ) : null}
                  </button>
                );
              })}
            </div>

            <div className="mt-6 text-sm text-zinc-600">Or use an image instead… (Max 1MB)</div>

            <div className="mt-2 flex items-center gap-3 rounded-md border border-zinc-200 bg-white px-3 py-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-md border border-zinc-200 bg-zinc-50 text-zinc-400">
                <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4">
                  <path
                    d="M4 7.5C4 6.12 5.12 5 6.5 5h11C18.88 5 20 6.12 20 7.5v9c0 1.38-1.12 2.5-2.5 2.5h-11C5.12 19 4 17.88 4 16.5v-9Z"
                    stroke="currentColor"
                    strokeWidth="1.6"
                  />
                  <path
                    d="M8 14l2.2-2.2a1 1 0 0 1 1.4 0L14 14l1-1a1 1 0 0 1 1.4 0L20 16"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>

              <div className="min-w-0 flex-1 truncate text-sm text-zinc-500">
                {avatarImageName ? avatarImageName : 'No File Chosen'}
              </div>

              <label className="cursor-pointer text-sm font-medium text-indigo-600 hover:underline">
                Upload Image
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;

                    if (file.size > 1_000_000) {
                      setFileError('Image exceeds 1MB.');
                      setAvatarImageDataUrl(null);
                      setAvatarImageName('');
                      return;
                    }

                    setFileError(null);
                    setAvatarImageName(file.name);

                    const dataUrl = await new Promise<string>((resolve, reject) => {
                      const reader = new FileReader();
                      reader.onload = () => resolve(String(reader.result ?? ''));
                      reader.onerror = () => reject(new Error('Failed to read file'));
                      reader.readAsDataURL(file);
                    });

                    setAvatarImageDataUrl(dataUrl);
                  }}
                />
              </label>
            </div>

            {fileError ? (
              <div className="mt-2 text-sm text-red-600">{fileError}</div>
            ) : null}
          </div>

          {createWorkspaceMutation.isError ? (
            <div className="mt-6 rounded-md bg-red-50 p-3 text-sm text-red-700">
              {formatApiError(createWorkspaceMutation.error)}
            </div>
          ) : null}

          <div className="mt-8 flex items-center gap-3">
            <button
              type="submit"
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
              disabled={createWorkspaceMutation.isPending}
            >
              Create New Workspace
            </button>
            <button
              type="button"
              className="rounded-md border border-zinc-200 bg-white px-4 py-2 text-sm text-zinc-700 hover:bg-zinc-50"
              onClick={() => router.push('/workspace')}
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
