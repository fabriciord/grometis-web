'use client';

export function HelpHint({ text }: { text: string }) {
  return (
    <span className="group relative ml-1 inline-flex align-middle">
      <span
        className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-zinc-200 bg-white text-zinc-600"
        aria-label={text}
        tabIndex={0}
        role="img"
      >
        <svg
          viewBox="0 0 24 24"
          className="h-3 w-3"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="10" />
          <path d="M9.09 9a3 3 0 0 1 5.82 1c0 2-3 2-3 4" />
          <path d="M12 17h.01" />
        </svg>
      </span>

      <span className="pointer-events-none absolute left-1/2 top-0 z-10 hidden w-64 -translate-x-1/2 -translate-y-[calc(100%+8px)] rounded-md border border-zinc-200 bg-white px-2 py-1 text-xs text-zinc-700 shadow-sm group-hover:block group-focus-within:block">
        {text}
      </span>
    </span>
  );
}
