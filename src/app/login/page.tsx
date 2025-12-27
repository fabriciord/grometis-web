'use client';

import { useMutation } from '@tanstack/react-query';
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
  const [name, setName] = useState('');

  const loginMutation = useMutation({
    mutationFn: async () => {
      return apiFetch<LoginResponse>('/auth/dev/login', {
        method: 'POST',
        body: JSON.stringify({ email, name: name || undefined }),
      });
    },
    onSuccess: (data) => {
      setAccessToken(data.accessToken);
      router.push('/workspace');
    },
  });

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-6">
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-sm">
        <h1 className="text-xl font-semibold text-zinc-900">Login (dev)</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Autenticação temporária. Depois trocamos por Keycloak.
        </p>

        <form
          className="mt-6 space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            loginMutation.mutate();
          }}
        >
          <label className="block">
            <span className="text-sm text-zinc-700">Email</span>
            <input
              className="mt-1 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-zinc-900 placeholder:text-zinc-400"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="voce@empresa.com"
              required
              type="email"
              autoComplete="email"
            />
          </label>

          <label className="block">
            <span className="text-sm text-zinc-700">Nome (opcional)</span>
            <input
              className="mt-1 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-zinc-900 placeholder:text-zinc-400"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Seu nome"
              type="text"
            />
          </label>

          {loginMutation.isError ? (
            <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">
              Falha no login.
            </div>
          ) : null}

          <button
            className="w-full rounded-md bg-black px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
            disabled={loginMutation.isPending}
            type="submit"
          >
            {loginMutation.isPending ? 'Entrando…' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  );
}
