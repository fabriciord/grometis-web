'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useMemo } from 'react';
import { getAccessToken } from '@/lib/auth';

export default function CertificateViewPage() {
  const params = useParams<{ workspaceId: string; certificateId: string }>();
  const router = useRouter();
  const token = useMemo(() => getAccessToken(), []);

  useEffect(() => {
    if (!token) router.replace('/login');
  }, [router, token]);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900">Certificate</h1>
          <p className="mt-1 text-sm text-zinc-600">Ainda não implementado no backend.</p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/w/${params.workspaceId}/gateway/certificates`}
            className="rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-900 hover:bg-zinc-50"
          >
            Back
          </Link>
          <Link
            href={`/w/${params.workspaceId}/gateway/certificates/${params.certificateId}/edit`}
            className="rounded-md bg-black px-3 py-2 text-sm font-medium text-white"
          >
            Edit
          </Link>
        </div>
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white p-4 text-sm text-zinc-700">Em breve.</div>
    </div>
  );
}
