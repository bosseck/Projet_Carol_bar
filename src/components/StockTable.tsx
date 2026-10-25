import { fcfa, fmt, plural } from "../lib/format";
import type { ProductRow, Totals } from "../lib/metrics";
import type { SortKey } from "../types";
import { LockIcon, PencilIcon, PlusIcon, TrashIcon } from "./Icons";

interface Props {
  rows: ProductRow[];
  sort: { key: SortKey; dir: "asc" | "desc" };
  onSort: (key: SortKey, dir?: "asc" | "desc") => void;
  onSell: (id: string) => void;
  onReceive: (id: string) => void;
  onEditMovement: (id: string, kind: "entree" | "sortie") => void;
  onOpen: (id: string) => void;
  onAdd: () => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onLogin: () => void;
  signedIn: boolean;
  focusId: string | null;
  totals: Totals;
  onDownload: () => void;
  busy: boolean;
}

const COLUMNS: { key: SortKey; label: string; title: string }[] = [
  { key: "name", label: "Produit", title: "Nom du produit" },
  { key: "uniteLot", label: "Unité/lot", title: "Nombre d'unités dans un lot" },
  { key: "qteEntree", label: "Qté entrée", title: "Nombre de lots reçus sur la période" },
  { key: "qteSortie", label: "Qté sortie", title: "Nombre d'unités vendues sur la période" },
  { key: "reste", label: "Reste", title: "Stock en fin de période" },
  { key: "prixAchat", label: "Prix d'achat", title: "Prix d'achat d'un lot" },
  { key: "prixUnitaire", label: "Prix unitaire", title: "Prix de vente d'une unité" },
  { key: "beneficeLot", label: "Bénéfice", title: "(Unité/lot × prix unitaire) − prix d'achat" },
  { key: "beneficeRealise", label: "Bén. réalisé", title: "(Bénéfice ÷ unité/lot) × qté sortie" },
  { key: "caisse", label: "Caisse", title: "Qté sortie × prix unitaire" },
];

export function StockTable({
  rows,
  sort,
  onSort,
  onSell,
  onReceive,
  onOpen,
  onAdd,
  onEdit,
  onDelete,
  onLogin,
  signedIn,
  focusId,
  totals,
  onDownload,
  busy,
}: Props) {
  return (
    <section id="tableau" className="card mt-4 overflow-hidden">
      <div className="flex flex-col gap-3 border-b border-[var(--line)] px-4 py-4 sm:flex-row sm:items-end sm:justify-between sm:px-5">
        <div>
          <h2 className="font-display text-2xl">Grand livre</h2>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="text-sm text-[var(--muted)] md:hidden">
            <span className="sr-only">Trier le tableau</span>
            <select
              className="field w-full"
              value={`${sort.key}:${sort.dir}`}
              onChange={(e) => {
                const [key, dir] = e.target.value.split(":");
                onSort(key as SortKey, dir as "asc" | "desc");
              }}
            >
              <option value="caisse:desc">Caisse décroissante</option>
              <option value="beneficeRealise:desc">Bénéfice réalisé</option>
              <option value="qteSortie:desc">Unités vendues</option>
              <option value="reste:asc">Reste croissant</option>
              <option value="name:asc">Nom A → Z</option>
              <option value="valeurAchats:desc">Valeur d'achat</option>
            </select>
          </label>
          <button type="button" className="btn btn-primary" onClick={onAdd}>
            {signedIn ? <PlusIcon /> : <LockIcon />}
            Ajouter un produit
          </button>
          <button type="button" className="btn btn-ghost" onClick={onDownload} disabled={busy}>
            {busy ? "Préparation…" : "Télécharger PDF"}
          </button>
        </div>
      </div>

      {!signedIn ? (
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--line)] bg-[var(--well)] px-4 py-2.5 text-sm sm:px-5">
          <p className="text-[var(--muted)]">
            <strong className="text-[var(--ink)]">Mode lecture.</strong> Connectez-vous pour ajouter, modifier ou supprimer un produit et enregistrer des mouvements.
          </p>
          <button type="button" className="btn btn-ghost btn-tiny" onClick={onLogin}>
            <LockIcon className="h-3.5 w-3.5" /> Se connecter
          </button>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-x-5 gap-y-1 border-b border-[var(--line)] px-4 py-3 text-sm sm:px-5">
        <span>
          Caisse <strong className="tabular">{fcfa(totals.caisse)}</strong>
        </span>
        <span>
          Bénéfice réalisé <strong className="tabular">{fcfa(totals.beneficeRealise)}</strong>
        </span>
        <span>
          Valeur du stock <strong className="tabular">{fcfa(totals.valeurAchats)}</strong>
        </span>
        <span className="text-[var(--faint)]">
          {rows.length} ligne{rows.length > 1 ? "s" : ""}
        </span>
      </div>

      <div className="hidden max-h-[680px] overflow-auto md:block">
        <table className="ledger">
          <thead>
            <tr>
              {COLUMNS.map((col) => {
                const active = sort.key === col.key;
                return (
                  <th key={col.key} aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}>
                    <button
                      type="button"
                      title={col.title}
                      className="inline-flex items-center gap-1 uppercase"
                      onClick={() => onSort(col.key)}
                    >
                      {col.label}
                      <span aria-hidden className={active ? "opacity-100" : "opacity-30"}>
                        {active && sort.dir === "asc" ? "↑" : "↓"}
                      </span>
                    </button>
                  </th>
                );
              })}
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={11} className="py-10 text-center text-sm text-[var(--muted)]">
                  Aucun produit ne correspond à ce filtre.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr
                  key={row.product.id}
                  id={`row-${row.product.id}`}
                  onClick={() => onOpen(row.product.id)}
                  className={[
                    row.product.id === focusId ? "is-focus" : "",
                    row.status === "rupture" ? "is-rupture" : "",
                    row.status === "bas" ? "is-bas" : "",
                    row.product.id === "kadji" ? "is-kadji" : "",
                  ].join(" ")}
                >
                  <td>
                    <div className="font-medium">{row.product.name}</div>
                    <div className="text-[11px] text-[var(--faint)]">
                      {row.product.detail ? `${row.product.detail} · ` : ""}
                      {row.product.category}
                    </div>
                  </td>
                  <td>
                    <div className="tabular">{row.product.uniteLot}</div>
                    <div className="text-[11px] text-[var(--faint)]">{row.product.unitPlural}</div>
                  </td>
                  <td>
                    <div className="tabular">{fmt(row.qteEntree)}</div>
                    <div className="text-[11px] text-[var(--faint)]">
                      {plural(row.qteEntree, row.product.lotLabel, row.product.lotPlural)}
                    </div>
                  </td>
                  <td>
                    <div className="tabular">{fmt(row.qteSortie)}</div>
                    <div className="text-[11px] text-[var(--faint)]">
                      {plural(row.qteSortie, row.product.unitLabel, row.product.unitPlural)}
                    </div>
                  </td>
                  <td>
                    <div className="tabular font-medium">{fmt(row.reste)}</div>
                    <div className="text-[11px] text-[var(--faint)]">
                      {row.stockDebut > 0
                        ? `${fmt(row.stockDebut)} + ${fmt(row.qteEntree)}×${row.product.uniteLot} − ${fmt(row.qteSortie)}`
                        : `${fmt(row.qteEntree)}×${row.product.uniteLot} − ${fmt(row.qteSortie)}`}
                    </div>
                  </td>
                  <td className="tabular">{fmt(row.product.prixAchat)}</td>
                  <td className="tabular">{fmt(row.product.prixUnitaire)}</td>
                  <td>
                    <div className="tabular">{fmt(row.beneficeLot)}</div>
                    <div className="text-[11px] text-[var(--faint)]">{fmt(row.beneficeUnite)} / unité</div>
                  </td>
                  <td className="tabular">{fmt(row.beneficeRealise)}</td>
                  <td className="tabular font-medium">{fmt(row.caisse)}</td>
                  <td>
                    <div className="flex gap-1 whitespace-nowrap">
                      <button
                        type="button"
                        className="btn btn-ghost btn-tiny"
                        onClick={(e) => {
                          e.stopPropagation();
                          onSell(row.product.id);
                        }}
                      >
                        Vendre
                      </button>
                      <button
                        type="button"
                        className="btn btn-ghost btn-tiny"
                        onClick={(e) => {
                          e.stopPropagation();
                          onReceive(row.product.id);
                        }}
                      >
                        Entrée
                      </button>
                      <button
                        type="button"
                        className="btn btn-ghost btn-tiny !px-2"
                        title={signedIn ? "Modifier ce produit" : "Connexion requise pour modifier"}
                        aria-label={`Modifier ${row.product.name}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          onEdit(row.product.id);
                        }}
                      >
                        <PencilIcon className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        className="btn btn-ghost btn-tiny !px-2"
                        style={{ color: "var(--wine)" }}
                        title={signedIn ? "Supprimer ce produit" : "Connexion requise pour supprimer"}
                        aria-label={`Supprimer ${row.product.name}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          onDelete(row.product.id);
                        }}
                      >
                        <TrashIcon className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
          {rows.length > 0 ? (
            <tfoot>
              <tr className="bg-[var(--amber-2)] text-sm font-semibold">
                <td className="!bg-[var(--amber-2)]">Totaux</td>
                <td />
                <td className="tabular">{fmt(totals.qteEntree)}</td>
                <td className="tabular">{fmt(totals.unites)}</td>
                <td className="tabular">{fmt(totals.reste)}</td>
                <td />
                <td />
                <td />
                <td className="tabular">{fmt(totals.beneficeRealise)}</td>
                <td className="tabular">{fmt(totals.caisse)}</td>
                <td />
              </tr>
            </tfoot>
          ) : null}
        </table>
      </div>

      <div className="space-y-3 p-3 md:hidden">
        {rows.length === 0 ? (
          <p className="px-2 py-8 text-center text-sm text-[var(--muted)]">Aucun produit ne correspond à ce filtre.</p>
        ) : (
          rows.map((row) => (
            <article
              key={row.product.id}
              id={`card-${row.product.id}`}
              className="rounded-2xl border border-[var(--line)] bg-[var(--well)] p-3"
              style={{
                boxShadow:
                  row.status === "rupture"
                    ? "inset 3px 0 0 var(--wine)"
                    : row.status === "bas"
                      ? "inset 3px 0 0 var(--amber-3)"
                      : undefined,
              }}
            >
              <button type="button" className="w-full text-left" onClick={() => onOpen(row.product.id)}>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-display text-xl">{row.product.name}</h3>
                    <p className="text-xs text-[var(--faint)]">
                      {row.product.category} · 1 {row.product.lotLabel} = {row.product.uniteLot} {row.product.unitPlural}
                    </p>
                  </div>
                  <Status status={row.status} />
                </div>
                <span className="mt-2 block text-[11px] leading-relaxed text-[var(--faint)]">
                  Reste = {row.stockDebut > 0 ? `${fmt(row.stockDebut)} + ` : ""}({fmt(row.qteEntree)} × {row.product.uniteLot}) − {fmt(row.qteSortie)}
                </span>
                <dl className="mt-3 grid grid-cols-3 gap-2 text-sm">
                  <Cell k="Entrée" v={`${fmt(row.qteEntree)} ${plural(row.qteEntree, row.product.lotLabel, row.product.lotPlural)}`} />
                  <Cell k="Sortie" v={`${fmt(row.qteSortie)} ${plural(row.qteSortie, row.product.unitLabel, row.product.unitPlural)}`} />
                  <Cell k="Reste" v={`${fmt(row.reste)} ${plural(row.reste, row.product.unitLabel, row.product.unitPlural)}`} />
                  <Cell k="Achat" v={fcfa(row.product.prixAchat)} />
                  <Cell k="Unitaire" v={fcfa(row.product.prixUnitaire)} />
                  <Cell k="Bénéfice" v={fcfa(row.beneficeLot)} />
                  <Cell k="Réalisé" v={fcfa(row.beneficeRealise)} />
                  <Cell k="Caisse" v={fcfa(row.caisse)} />
                </dl>
              </button>
              <div className="mt-3 flex gap-2">
                <button type="button" className="btn btn-primary btn-tiny flex-1" onClick={() => onSell(row.product.id)}>
                  Vendre 1
                </button>
                <button type="button" className="btn btn-ghost btn-tiny flex-1" onClick={() => onReceive(row.product.id)}>
                  + 1 lot
                </button>
              </div>
              <div className="mt-2 flex gap-2">
                <button type="button" className="btn btn-ghost btn-tiny flex-1" onClick={() => onEdit(row.product.id)}>
                  <PencilIcon className="h-3.5 w-3.5" /> Modifier
                </button>
                <button
                  type="button"
                  className="btn btn-ghost btn-tiny flex-1"
                  style={{ color: "var(--wine)" }}
                  onClick={() => onDelete(row.product.id)}
                >
                  <TrashIcon className="h-3.5 w-3.5" /> Supprimer
                </button>
              </div>
            </article>
          ))
        )}
      </div>
    </section>
  );
}

function Cell({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <dt className="text-[10px] uppercase tracking-wider text-[var(--faint)]">{k}</dt>
      <dd className="tabular text-[13px]">{v}</dd>
    </div>
  );
}

function Status({ status }: { status: ProductRow["status"] }) {
  const label = status === "rupture" ? "Rupture" : status === "bas" ? "Stock bas" : "En stock";
  const color = status === "rupture" ? "var(--wine)" : status === "bas" ? "var(--amber)" : "var(--green)";
  return (
    <span className="rounded-full px-2 py-0.5 text-[11px] font-semibold" style={{ color, background: "var(--card)" }}>
      {label}
    </span>
  );
}
