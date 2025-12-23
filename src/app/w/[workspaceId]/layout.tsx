'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useParams, usePathname, useRouter } from 'next/navigation';
import { useEffect, useMemo } from 'react';
import { apiFetch } from '@/lib/api';
import { clearAccessToken, getAccessToken } from '@/lib/auth';

type WorkspaceListItem = { id: string; name: string; role: 'viewer' | 'admin' | 'owner' };

function isActive(pathname: string, href: string) {
  if (href === '/') return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function WorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useParams<{ workspaceId: string }>();
  const token = useMemo(() => getAccessToken(), []);

  useEffect(() => {
    if (!token) router.replace('/login');
  }, [router, token]);

  const workspaceId = params.workspaceId;

  if (!workspaceId) return null;

  const workspacesQuery = useQuery({
    queryKey: ['workspaces'],
    queryFn: async () => {
      const res = await apiFetch<{ workspaces: WorkspaceListItem[] }>('/workspaces', { token });
      return res.workspaces;
    },
    enabled: !!token,
  });

  const workspaceName =
    workspacesQuery.data?.find((w) => w.id === workspaceId)?.name ?? workspaceId;

  const nav = [
    { label: 'Overview', href: `/w/${workspaceId}/dashboard` },
    { section: 'Gateway' as const },
    { label: 'Services', href: `/w/${workspaceId}/gateway/services` },
    { label: 'Routes', href: `/w/${workspaceId}/gateway/routes` },
    { label: 'Plugins', href: `/w/${workspaceId}/gateway/plugins` },
    { label: 'Consumers', href: `/w/${workspaceId}/gateway/consumers` },
    { label: 'Certificates', href: `/w/${workspaceId}/gateway/certificates` },
    { section: 'Settings' as const },
    { label: 'Members', href: `/w/${workspaceId}/settings/members` },
  ];

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900">
      <div className="flex min-h-screen">
        <aside className="flex w-64 flex-col bg-zinc-950 px-4 py-5 text-zinc-100">
          <div>
            <Link
              href="/select-workspace"
              className="inline-flex rounded-md px-2 py-1 text-xs font-medium text-zinc-200 hover:bg-zinc-900/60 hover:text-white"
            >
              Trocar workspace
            </Link>
            <div className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
              GrOMEtiS Gateway
            </div>
            <div className="mt-1 truncate text-sm font-medium text-zinc-100">
              Workspace: {workspaceName}
            </div>
          </div>

          <nav className="mt-6 space-y-1">
            {nav.map((item) => {
              if ('section' in item) {
                return (
                  <div
                    key={item.section}
                    className="mt-5 text-xs font-semibold uppercase tracking-wide text-zinc-500"
                  >
                    {item.section}
                  </div>
                );
              }

              const active = isActive(pathname, item.href);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`block rounded-md px-3 py-2 text-sm ${
                    active
                      ? 'bg-zinc-900 text-white'
                      : 'text-zinc-200 hover:bg-zinc-900/60 hover:text-white'
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="mt-auto pt-6">
            <button
              className="mt-2 w-full rounded-md bg-white px-3 py-2 text-left text-sm font-medium text-zinc-900 hover:bg-zinc-100"
              onClick={() => {
                clearAccessToken();
                router.push('/login');
              }}
              type="button"
            >
              Sair
            </button>
          </div>
        </aside>

        <div className="min-w-0 flex-1">
          <header className="sticky top-0 z-10 border-b border-zinc-200 bg-white/90 backdrop-blur">
            <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-3">
              <div className="min-w-0">
                <div className="truncate text-sm font-medium text-zinc-900">{workspaceName}</div>
                <div className="text-xs text-zinc-500">Control plane</div>
              </div>
              <div className="text-xs text-zinc-500">API: http://localhost:3001</div>
            </div>
          </header>

          <main className="mx-auto max-w-5xl px-6 py-6">{children}</main>
        </div>
      </div>
    </div>
  );
}
