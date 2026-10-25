import { useEffect, useMemo, useState } from "react";
import { TODAY_ISO, HISTORY_START_ISO, formatLong } from "../lib/dates";
import { fcfa, fmt } from "../lib/format";
import { computeLine, validateMovement } from "../lib/metrics";
import type { Movement, Product } from "../types";

interface Props {
  products: Product[];
  movements: Movement[];
  productId: string;
  kind: "entree" | "sortie";
  defaultDate: string;
  initialQty?: number;
  mode?: "create" | "edit";
  title?: string;
  submitLabel?: string;
  movementId?: string | null;
  onClose: () => void;
  onSubmit: (draft: { productId: string; date: string; qteEntree: number; qteSortie: number }) => void;
  onDelete?: () => void;
}

export function MovementDialog({
  products,
  movements,
  productId,
  kind,
  defaultDate,
  initialQty = 1,
  mode = "create",
  title,
  submitLabel,
  movementId,
  onClose,
  onSubmit,
  onDelete,
}: Props) {
  const [pid, setPid] = useState(productId);
  const [type, setType] = useState(kind);
  const [qty, setQty] = useState(initialQty);
  const [date, setDate] = useState(defaultDate);
  const product = products.find((p) => p.id === pid) ?? products[0];

  const qteEntree = type === "entree" ? qty : 0;
  const qteSortie = type === "sortie" ? qty : 0;
  const scopedMovements = useMemo(
    () => (movementId ? movements.filter((m) => m.id !== movementId) : movements),
    [movements, movementId],
  );
  const validation = useMemo(
    () => validateMovement(scopedMovements, product, date, qteEntree, qteSortie),
    [scopedMovements, product, date, qteEntree, qteSortie],
  );
  const impact = computeLine(product, qteEntree, qteSortie, 0);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-3 sm:items-center">
      <button type="button" className="absolute inset-0 bg-black/45" aria-label="Fermer la saisie" onClick={onClose} />
      <form
        className="drawer-in relative z-10 max-h-[95vh] w-full max-w-md overflow-y-auto rounded-2xl border border-[var(--line)] bg-[var(--card)] p-4 shadow-2xl sm:rounded-3xl sm:p-5"
        onSubmit={(e) => {
          e.preventDefault();
          if (!validation.ok) return;
          onSubmit({ productId: product.id, date, qteEntree, qteSortie });
        }}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--amber)]">Bon de mouvement</p>
            <h2 className="font-display text-2xl">{title ?? (mode === "edit" ? "Modifier le mouvement" : "Entrer un lot ou vendre")}</h2>
          </div>
          <button type="button" className="btn btn-ghost btn-tiny" onClick={onClose}>
            Fermer
          </button>
        </div>

        <label className="mt-4 block text-sm">
          Produit
          <select className="field mt-1 w-full" value={product.id} onChange={(e) => setPid(e.target.value)}>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} — {p.segment}
              </option>
            ))}
          </select>
        </label>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <button
            type="button"
            className="chip"
            aria-pressed={type === "sortie"}
            onClick={() => setType("sortie")}
          >
            Sortie · {product.unitLabel}
          </button>
          <button
            type="button"
            className="chip"
            aria-pressed={type === "entree"}
            onClick={() => setType("entree")}
          >
            Entrée · {product.lotLabel}
          </button>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-3">
          <label className="text-sm">
            Quantité
            <input
              className="field mt-1 w-full"
              type="number"
              min={1}
              step={1}
              value={qty}
              onChange={(e) => setQty(Math.max(0, Math.round(Number(e.target.value) || 0)))}
            />
          </label>
          <label className="text-sm">
            Date
            <input
              className="field mt-1 w-full"
              type="date"
              min={HISTORY_START_ISO}
              max={TODAY_ISO}
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </label>
        </div>
        <div className="mt-2 flex gap-2">
          {[1, 6, 12].map((n) => (
            <button key={n} type="button" className="chip" aria-pressed={qty === n} onClick={() => setQty(n)}>
              {n}
            </button>
          ))}
        </div>

        <div className="mt-4 rounded-2xl bg-[var(--well)] px-3 py-3 text-sm">
          <p className="font-medium">{validation.ok ? "Aperçu" : "Mouvement refusé"}</p>
          <p className="mt-1 text-[var(--muted)]">{validation.message}</p>
          {validation.ok ? (
            <ul className="mt-2 space-y-1 tabular">
              <li>Reste après mouvement : {fmt(validation.resteAfter)} {product.unitPlural}</li>
              {type === "sortie" ? (
                <>
                  <li>Caisse : +{fcfa(impact.caisse)}</li>
                  <li>Bénéfice réalisé : +{fcfa(impact.beneficeRealise)}</li>
                </>
              ) : (
                <li>Valeur du stock : +{fcfa(impact.valeurAchats)}</li>
              )}
              <li className="text-[var(--faint)]">Date : {formatLong(date)}</li>
            </ul>
          ) : null}
        </div>

        <div className="mt-4 flex gap-2">
          {mode === "edit" && onDelete ? (
            <button type="button" className="btn btn-ghost flex-1" style={{ color: "var(--wine)" }} onClick={onDelete}>
              Supprimer
            </button>
          ) : null}
          <button type="submit" className="btn btn-primary flex-1" disabled={!validation.ok}>
            {submitLabel ?? (mode === "edit" ? "Mettre à jour" : "Enregistrer")}
          </button>
        </div>
      </form>
    </div>
  );
}
