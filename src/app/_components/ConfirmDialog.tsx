'use client';

import { useEffect, useId, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';

type ConfirmDialogTone = 'danger' | 'primary';

type ConfirmDialogProps = {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: ConfirmDialogTone;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

function useIsBrowser(): boolean {
  return typeof window !== 'undefined' && typeof document !== 'undefined';
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  tone = 'primary',
  busy = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const isBrowser = useIsBrowser();
  const headingId = useId();
  const descriptionId = useId();

  const overlayRef = useRef<HTMLDivElement | null>(null);
  const cancelButtonRef = useRef<HTMLButtonElement | null>(null);
  const confirmButtonRef = useRef<HTMLButtonElement | null>(null);

  const { confirmClassName, confirmTextClassName } = useMemo(() => {
    if (tone === 'danger') {
      return {
        confirmClassName: 'border border-red-200 bg-red-50 hover:bg-red-100',
        confirmTextClassName: 'text-red-700',
      };
    }

    return {
      confirmClassName: 'bg-indigo-600 hover:bg-indigo-700',
      confirmTextClassName: 'text-white',
    };
  }, [tone]);

  useEffect(() => {
    if (!open) return;
    if (!isBrowser) return;

    const previousActive = document.activeElement as HTMLElement | null;

    const timer = window.setTimeout(() => {
      cancelButtonRef.current?.focus();
    }, 0);

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        if (!busy) onCancel();
        return;
      }

      if (e.key === 'Tab') {
        const cancelEl = cancelButtonRef.current;
        const confirmEl = confirmButtonRef.current;
        if (!cancelEl || !confirmEl) return;

        const focusables = [cancelEl, confirmEl].filter((el) => !el.disabled);
        if (focusables.length === 0) return;

        const active = document.activeElement;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];

        if (e.shiftKey) {
          if (active === first) {
            e.preventDefault();
            last.focus();
          }
        } else {
          if (active === last) {
            e.preventDefault();
            first.focus();
          }
        }
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener('keydown', onKeyDown);
      previousActive?.focus?.();
    };
  }, [busy, isBrowser, onCancel, open]);

  if (!open) return null;
  if (!isBrowser) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      aria-labelledby={headingId}
      aria-describedby={description ? descriptionId : undefined}
      aria-modal="true"
      role="dialog"
    >
      <div
        ref={overlayRef}
        className="absolute inset-0 bg-black/50"
        onMouseDown={(e) => {
          if (e.target !== overlayRef.current) return;
          if (busy) return;
          onCancel();
        }}
      />

      <div className="relative w-full max-w-md rounded-xl border border-zinc-200 bg-white shadow-lg ring-1 ring-black/5">
        <div className="p-5">
          <div id={headingId} className="text-base font-semibold text-zinc-900">
            {title}
          </div>
          {description ? (
            <div id={descriptionId} className="mt-2 text-sm text-zinc-600">
              {description}
            </div>
          ) : null}

          <div className="mt-5 flex justify-end gap-2">
            <button
              ref={cancelButtonRef}
              type="button"
              className="rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-900 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
              onClick={() => {
                if (busy) return;
                onCancel();
              }}
              disabled={busy}
            >
              {cancelLabel}
            </button>
            <button
              ref={confirmButtonRef}
              type="button"
              className={`rounded-md px-3 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50 ${confirmClassName} ${confirmTextClassName}`}
              onClick={() => {
                if (busy) return;
                onConfirm();
              }}
              disabled={busy}
            >
              {confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
