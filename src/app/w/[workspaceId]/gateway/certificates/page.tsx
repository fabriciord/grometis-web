'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useMemo } from 'react';
import { getAccessToken } from '@/lib/auth';

export default function CertificatesPage() {
  const params = useParams<{ workspaceId: string }>();
  const router = useRouter();
  const token = useMemo(() => getAccessToken(), []);

  useEffect(() => {
    if (!token) router.replace('/login');
  }, [router, token]);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900">Certificates</h1>
          <p className="mt-1 text-sm text-zinc-600">Ainda não implementado no backend.</p>
        </div>
        <Link
          href={`/w/${params.workspaceId}/gateway/certificates/new`}
          className="rounded-md bg-black px-3 py-2 text-sm font-medium text-white"
        >
          New certificate
        </Link>
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white">
        <div className="p-4 text-sm text-zinc-700">Em breve.</div>
      </div>
    </div>
  );
}
