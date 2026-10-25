import { useMemo, useState } from "react";
import {
  groupByDay,
  formatDayLabel,
  formatStamp,
  KIND_LABEL,
  KIND_TONE,
  type JournalEntry,
  type JournalKind,
} from "../lib/journal";
import { JournalLogo } from "./Logos";

const FILTERS: { id: "tous" | JournalKind; label: string }[] = [
  { id: "tous", label: "Tout" },
  { id: "sortie", label: "Ventes" },
  { id: "entree", label: "Entrées" },
  { id: "mouvement-modif", label: "Quantités" },
  { id: "produit-ajout", label: "Ajouts produit" },
  { id: "produit-modif", label: "Modifs produit" },
  { id: "produit-suppression", label: "Suppressions" },
  { id: "connexion", label: "Connexions" },
  { id: "pdf", label: "Exports PDF" },
];

interface Props {
  entries: JournalEntry[];
  onClear: () => void;
}

export function JournalPanel({ entries, onClear }: Props) {
  const [filter, setFilter] = useState<"tous" | JournalKind>("tous");
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return entries.filter((e) => {
      if (filter !== "tous" && e.kind !== filter) return false;
      if (!q) return true;
      return `${e.label} ${e.detail} ${e.user}`.toLowerCase().includes(q);
    });
  }, [entries, filter, query]);

  const groups = useMemo(() => groupByDay(filtered), [filtered]);

  return (
    <section id="historique" className="card mt-4 p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-2xl bg-[var(--ink)] text-[var(--paper)]">
            <JournalLogo />
          </span>
          <div>
            <h2 className="font-display text-2xl leading-none">Historique</h2>
            <p className="mt-1 text-sm text-[var(--muted)]">
              {entries.length} opération{entries.length > 1 ? "s" : ""} enregistrée{entries.length > 1 ? "s" : ""}
            </p>
          </div>
        </div>
        {entries.length > 0 ? (
          <button
            type="button"
            className="btn btn-ghost btn-tiny"
            style={{ color: "var(--wine)" }}
            onClick={onClear}
          >
            Vider l'historique
          </button>
        ) : null}
      </div>

      {entries.length > 0 ? (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <div className="flex gap-2 overflow-x-auto pb-1">
            {FILTERS.map((item) => (
              <button
                key={item.id}
                type="button"
                className="chip"
                aria-pressed={filter === item.id}
                onClick={() => setFilter(item.id)}
              >
                {item.label}
              </button>
            ))}
          </div>
          <label className="relative ml-auto min-w-[170px] flex-1">
            <span className="sr-only">Rechercher dans l'historique</span>
            <input
              className="field w-full"
              placeholder="Rechercher une opération…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
        </div>
      ) : null}

      {entries.length === 0 ? (
        <p className="mt-4 rounded-2xl bg-[var(--well)] px-4 py-6 text-center text-sm text-[var(--muted)]">
          Aucune opération enregistrée pour l'instant. Les ventes, entrées, modifications de produits, connexions et
          exports PDF apparaîtront ici.
        </p>
      ) : filtered.length === 0 ? (
        <p className="mt-4 rounded-2xl bg-[var(--well)] px-4 py-6 text-center text-sm text-[var(--muted)]">
          Aucune opération ne correspond à ce filtre.
        </p>
      ) : (
        <div className="mt-4 space-y-5">
          {groups.map((group) => (
            <div key={group.day}>
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--faint)]">
                {formatDayLabel(group.day)}
              </p>
              <ul className="space-y-1.5">
                {group.items.map((entry) => (
                  <li
                    key={entry.id}
                    className="flex flex-wrap items-start justify-between gap-2 rounded-xl bg-[var(--well)] px-3 py-2.5"
                    style={{ boxShadow: `inset 3px 0 0 ${toneColor(entry.kind)}` }}
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium">
                        {entry.label}
                        <span className="ml-2 rounded-full bg-[var(--card)] px-2 py-0.5 text-[11px] font-semibold text-[var(--muted)]">
                          {KIND_LABEL[entry.kind]}
                        </span>
                      </p>
                      <p className="mt-0.5 text-xs text-[var(--muted)]">{entry.detail}</p>
                    </div>
                    <p className="shrink-0 text-right text-[11px] text-[var(--faint)]">
                      <span className="block tabular">{formatStamp(entry.at)}</span>
                      <span className="block">{entry.user}</span>
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function toneColor(kind: JournalKind) {
  const tone = KIND_TONE[kind];
  if (tone === "in") return "var(--green)";
  if (tone === "out") return "var(--amber)";
  if (tone === "edit") return "#3d8eb5";
  if (tone === "danger") return "var(--wine)";
  return "var(--faint)";
}
