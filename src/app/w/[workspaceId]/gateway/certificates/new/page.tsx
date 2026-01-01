'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useMemo } from 'react';
import { getAccessToken } from '@/lib/auth';

export default function CertificateNewPage() {
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
          <h1 className="text-xl font-semibold text-zinc-900">New certificate</h1>
          <p className="mt-1 text-sm text-zinc-600">Not implemented in the backend yet.</p>
        </div>
        <Link
          href={`/w/${params.workspaceId}/gateway/certificates`}
          className="rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-900 hover:bg-zinc-50"
        >
          Back
        </Link>
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white p-4 text-sm text-zinc-700">
        Coming soon.
      </div>
    </div>
  );
}
