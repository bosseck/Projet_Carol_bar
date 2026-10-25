import { useEffect } from "react";
import { fcfa, fmt, fmtFlex } from "../lib/format";
import type { ProductRow } from "../lib/metrics";
import { PencilIcon, TrashIcon } from "./Icons";

interface Props {
  row: ProductRow;
  onClose: () => void;
  onSell: () => void;
  onReceive: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onEditEntry: () => void;
  onEditExit: () => void;
}

export function ProductDrawer({
  row,
  onClose,
  onSell,
  onReceive,
  onEdit,
  onDelete,
  onEditEntry,
  onEditExit,
}: Props) {
  const p = row.product;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button type="button" className="absolute inset-0 bg-black/45" aria-label="Fermer la fiche" onClick={onClose} />
      <aside className="drawer-in relative ml-auto flex h-full w-full max-w-full flex-col overflow-y-auto bg-[var(--card)] shadow-2xl sm:max-w-[460px]">
        <div className="border-b border-[var(--line)] bg-[var(--well)] p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] uppercase tracking-[0.16em] text-[var(--amber)]">{p.category}</p>
              <h2 className="font-display text-3xl leading-none">{p.name}</h2>
              {p.detail ? <p className="mt-1 text-sm text-[var(--muted)]">{p.detail}</p> : null}
            </div>
            <button type="button" className="btn btn-ghost btn-tiny" onClick={onClose}>
              Fermer
            </button>
          </div>
        </div>
        <div className="space-y-4 p-5">
          <dl className="space-y-2 text-sm">
            <Line k="Unité / lot" v={`${p.uniteLot} ${p.unitPlural} / ${p.lotLabel}`} />
            <Line k="Prix d'achat" v={`${fcfa(p.prixAchat)} / ${p.lotLabel}`} />
            <Line k="Prix unitaire" v={`${fcfa(p.prixUnitaire)} / ${p.unitLabel}`} />
            <Line k="Qté entrée" v={`${fmt(row.qteEntree)} ${p.lotPlural}`} />
            <Line k="Qté sortie" v={`${fmt(row.qteSortie)} ${p.unitPlural}`} />
            <Line k="Reste" v={`${fmt(row.reste)} ${p.unitPlural}`} />
            <Line k="Bénéfice / lot" v={`${fcfa(row.beneficeLot)} = (${p.uniteLot} × ${fmt(p.prixUnitaire)}) − ${fmt(p.prixAchat)}`} />
            <Line k="Par unité" v={fcfa(row.beneficeUnite)} />
            <Line k="Caisse" v={fcfa(row.caisse)} />
            <Line k="Bénéfice réalisé" v={`${fcfa(row.beneficeRealise)} = ${fmtFlex(row.beneficeUnite)} × ${fmt(row.qteSortie)}`} />
          </dl>

          <div className="grid gap-2 sm:grid-cols-2">
            <button type="button" className="btn btn-primary" onClick={onSell}>
              Vendre 1
            </button>
            <button type="button" className="btn btn-ghost" onClick={onReceive}>
              + 1 lot
            </button>
            <button type="button" className="btn btn-ghost" onClick={onEditEntry}>
              Modifier entrée
            </button>
            <button type="button" className="btn btn-ghost" onClick={onEditExit}>
              Modifier sortie
            </button>
          </div>

          <div className="flex gap-2 border-t border-[var(--line)] pt-4">
            <button type="button" className="btn btn-ghost flex-1" onClick={onEdit}>
              <PencilIcon /> Modifier
            </button>
            <button type="button" className="btn btn-ghost flex-1" style={{ color: "var(--wine)" }} onClick={onDelete}>
              <TrashIcon /> Supprimer
            </button>
          </div>
        </div>
      </aside>
    </div>
  );
}

function Line({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-dashed border-[var(--line)] py-1.5">
      <dt className="text-[var(--faint)]">{k}</dt>
      <dd className="text-right tabular font-medium">{v}</dd>
    </div>
  );
}
