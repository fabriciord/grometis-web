'use client';

import { useMutation } from '@tanstack/react-query';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { apiFetch } from '@/lib/api';
import { setAccessToken } from '@/lib/auth';

type LoginResponse = {
  accessToken: string;
  user: { id: string; email: string; name: string | null };
};

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showBrandLogo, setShowBrandLogo] = useState(true);

  const loginMutation = useMutation({
    mutationFn: async () => {
      return apiFetch<LoginResponse>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
    },
    onSuccess: (data) => {
      setAccessToken(data.accessToken);
      router.push('/workspace');
    },
  });

  return (
    <div className="min-h-screen bg-zinc-50 px-6">
      <div className="mx-auto flex min-h-screen w-full max-w-7xl items-center justify-center py-10">
        <div className="w-full max-w-md">
          <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
            <div className="flex flex-col items-center text-center">
              {showBrandLogo ? (
                <Image
                  src="/brand/gateway_grometis.png"
                  alt="GrOMEtiS"
                  width={600}
                  height={600}
                  className="mx-auto h-36 w-auto max-w-xs object-contain"
                  onError={() => setShowBrandLogo(false)}
                  priority
                />
              ) : (
                <div className="flex h-14 w-14 items-center justify-center rounded-xl border border-zinc-200 bg-white text-sm font-semibold text-zinc-700">
                  G
                </div>
              )}

              <div className="mt-2 text-sm text-zinc-600">Access the gateway control plane.</div>
            </div>

            <h1 className="mt-6 text-base font-semibold text-zinc-900">Sign in</h1>
            <p className="mt-1 text-sm text-zinc-600">Use your email and password to continue.</p>

            <form
              className="mt-6 space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                loginMutation.mutate();
              }}
            >
              <label className="block">
                <span className="text-sm font-medium text-zinc-800">Email</span>
                <input
                  className="mt-2 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-zinc-900 placeholder:text-zinc-400"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="user@email.com"
                  required
                  type="email"
                  autoComplete="email"
                />
              </label>

              <label className="block">
                <span className="text-sm font-medium text-zinc-800">Password</span>
                <input
                  className="mt-2 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-zinc-900 placeholder:text-zinc-400"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  required
                  type="password"
                  autoComplete="current-password"
                />
              </label>

              {loginMutation.isError ? (
                <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">
                  Invalid email or password.
                </div>
              ) : null}

              <button
                className="w-full rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                disabled={loginMutation.isPending}
                type="submit"
              >
                {loginMutation.isPending ? 'Signing in…' : 'Sign in'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
