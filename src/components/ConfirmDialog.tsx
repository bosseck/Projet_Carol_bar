import { useEffect, useRef } from "react";

interface Props {
  title: string;
  children: React.ReactNode;
  confirmLabel: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({ title, children, confirmLabel, danger, onConfirm, onCancel }: Props) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    cancelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center p-3 sm:items-center">
      <button type="button" className="absolute inset-0 bg-black/55" aria-label="Annuler" onClick={onCancel} />
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        className="drawer-in relative z-10 w-full max-w-sm rounded-2xl border border-[var(--line)] bg-[var(--card)] p-4 shadow-2xl sm:rounded-3xl sm:p-5"
      >
        <h2 id="confirm-title" className="font-display text-2xl leading-tight">
          {title}
        </h2>
        <div className="mt-2 text-sm leading-relaxed text-[var(--muted)]">{children}</div>
        <div className="mt-5 flex gap-2">
          <button ref={cancelRef} type="button" className="btn btn-ghost flex-1" onClick={onCancel}>
            Annuler
          </button>
          <button
            type="button"
            className="btn flex-1"
            style={{ background: danger ? "var(--wine)" : "var(--amber-3)", color: danger ? "var(--card)" : "#1c1712" }}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
