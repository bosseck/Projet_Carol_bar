import { useEffect, useMemo, useRef, useState } from "react";
import { CATEGORIES, categorySegment } from "../data/catalog";
import { HISTORY_START_ISO, TODAY_ISO } from "../lib/dates";
import { fcfa, fmt, fmtFlex, pluralizeFr } from "../lib/format";
import { computeLine } from "../lib/metrics";
import type { Category, Product } from "../types";

const LABEL_DEFAULTS: Record<Category, { lot: string; unit: string }> = {
  Bières: { lot: "casier", unit: "bouteille" },
  "Softs & eaux": { lot: "casier", unit: "bouteille" },
  Spiritueux: { lot: "carton", unit: "bouteille" },
  Vins: { lot: "carton", unit: "bouteille" },
  "Épicerie sèche": { lot: "carton", unit: "paquet" },
  Snacks: { lot: "carton", unit: "sachet" },
  Hygiène: { lot: "carton", unit: "pièce" },
};

interface Props {
  mode: "add" | "edit";
  product?: Product;
  catalog: Product[];
  checkEdit: (next: Product) => string | null;
  onSubmit: (product: Product, initial?: { lots: number; date: string }) => void;
  onClose: () => void;
}

function newId() {
  return `p-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

export function ProductFormDialog({ mode, product, catalog, checkEdit, onSubmit, onClose }: Props) {
  const startCategory: Category = product?.category ?? "Bières";
  const [name, setName] = useState(product?.name ?? "");
  const [detail, setDetail] = useState(product?.detail ?? "");
  const [category, setCategory] = useState<Category>(startCategory);
  const [lotLabel, setLotLabel] = useState(product?.lotLabel ?? LABEL_DEFAULTS[startCategory].lot);
  const [unitLabel, setUnitLabel] = useState(product?.unitLabel ?? LABEL_DEFAULTS[startCategory].unit);
  const [labelsTouched, setLabelsTouched] = useState(Boolean(product));
  const [uniteLot, setUniteLot] = useState(String(product?.uniteLot ?? 12));
  const [prixAchat, setPrixAchat] = useState(product ? String(product.prixAchat) : "");
  const [prixUnitaire, setPrixUnitaire] = useState(product ? String(product.prixUnitaire) : "");
  const [initialLots, setInitialLots] = useState("1");
  const [date, setDate] = useState(TODAY_ISO);
  const [submitted, setSubmitted] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    nameRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const lot = Number(uniteLot);
  const achat = Number(prixAchat);
  const unit = Number(prixUnitaire);
  const lots = Number(initialLots);

  const errors = useMemo(() => {
    const e: Record<string, string> = {};
    const trimmed = name.trim();
    if (trimmed.length < 2) e.name = "Au moins 2 caractères.";
    else if (trimmed.length > 40) e.name = "40 caractères maximum.";
    else if (
      catalog.some((p) => p.id !== product?.id && p.name.trim().toLowerCase() === trimmed.toLowerCase())
    ) {
      e.name = "Un produit porte déjà ce nom.";
    }
    if (!lotLabel.trim()) e.lotLabel = "Nommez le lot (casier, carton…).";
    if (!unitLabel.trim()) e.unitLabel = "Nommez l'unité (bouteille, paquet…).";
    if (!Number.isInteger(lot) || lot < 1 || lot > 1000) e.uniteLot = "Entier entre 1 et 1 000.";
    if (!Number.isFinite(achat) || achat <= 0 || achat > 50_000_000) e.prixAchat = "Montant positif en FCFA.";
    if (!Number.isFinite(unit) || unit <= 0 || unit > 50_000_000) e.prixUnitaire = "Montant positif en FCFA.";
    if (mode === "add") {
      if (!Number.isInteger(lots) || lots < 0 || lots > 1000) e.initialLots = "Entier entre 0 et 1 000.";
      if (!date || date < HISTORY_START_ISO || date > TODAY_ISO) e.date = "Date comprise dans l'historique.";
    }
    return e;
  }, [name, catalog, product?.id, lotLabel, unitLabel, lot, achat, unit, lots, date, mode]);

  const preview =
    !errors.uniteLot && !errors.prixAchat && !errors.prixUnitaire
      ? computeLine({ uniteLot: lot, prixAchat: achat, prixUnitaire: unit }, Math.max(0, lots || 0), 0, 0)
      : null;
  const margin = preview && unit > 0 ? (preview.beneficeLot / (lot * unit)) * 100 : 0;

  function changeCategory(next: Category) {
    setCategory(next);
    if (!labelsTouched) {
      setLotLabel(LABEL_DEFAULTS[next].lot);
      setUnitLabel(LABEL_DEFAULTS[next].unit);
    }
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitted(true);
    if (Object.keys(errors).length > 0) return;
    const lotName = lotLabel.trim().toLowerCase();
    const unitName = unitLabel.trim().toLowerCase();
    const next: Product = {
      id: product?.id ?? newId(),
      name: name.trim(),
      detail: detail.trim(),
      segment: categorySegment(category),
      category,
      uniteLot: lot,
      prixAchat: Math.round(achat),
      prixUnitaire: Math.round(unit),
      lotLabel: lotName,
      lotPlural: pluralizeFr(lotName),
      unitLabel: unitName,
      unitPlural: pluralizeFr(unitName),
    };
    if (mode === "edit") {
      const problem = checkEdit(next);
      if (problem) {
        setFailure(problem);
        return;
      }
    }
    onSubmit(next, mode === "add" ? { lots, date } : undefined);
  }

  const err = (key: string) =>
    submitted && errors[key] ? (
      <span className="mt-1 block text-xs" style={{ color: "var(--wine)" }}>
        {errors[key]}
      </span>
    ) : null;

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center p-3 sm:items-center">
      <button type="button" className="absolute inset-0 bg-black/45" aria-label="Fermer le formulaire" onClick={onClose} />
      <form
        onSubmit={submit}
        noValidate
        role="dialog"
        aria-modal="true"
        aria-labelledby="product-form-title"
        className="drawer-in relative z-10 max-h-[96vh] w-full max-w-xl overflow-y-auto rounded-2xl border border-[var(--line)] bg-[var(--card)] p-4 shadow-2xl sm:rounded-3xl sm:p-5"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--amber)]">
              {mode === "add" ? "Nouveau produit" : "Fiche produit"}
            </p>
            <h2 id="product-form-title" className="font-display text-2xl leading-tight">
              {mode === "add" ? "Ajouter au catalogue" : `Modifier ${product?.name}`}
            </h2>
          </div>
          <button type="button" className="btn btn-ghost btn-tiny" onClick={onClose}>
            Fermer
          </button>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="block text-sm">
            Produit
            <input
              ref={nameRef}
              className="field mt-1 w-full"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex. Kadji"
              aria-invalid={submitted && Boolean(errors.name)}
              maxLength={40}
            />
            {err("name")}
          </label>
          <label className="block text-sm">
            Précision <span className="text-[var(--faint)]">(facultatif)</span>
            <input
              className="field mt-1 w-full"
              value={detail}
              onChange={(e) => setDetail(e.target.value)}
              placeholder="Ex. Bière 65 cl"
              maxLength={50}
            />
          </label>
          <label className="block text-sm sm:col-span-2">
            Rayon
            <select
              className="field mt-1 w-full"
              value={category}
              onChange={(e) => changeCategory(e.target.value as Category)}
            >
              <optgroup label="Bar">
                {CATEGORIES.filter((c) => categorySegment(c) === "Bar").map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </optgroup>
              <optgroup label="Épicerie">
                {CATEGORIES.filter((c) => categorySegment(c) === "Épicerie").map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </optgroup>
            </select>
            <span className="mt-1 block text-xs text-[var(--faint)]">Segment : {categorySegment(category)}</span>
          </label>

          <label className="block text-sm">
            Nom du lot
            <input
              className="field mt-1 w-full"
              list="lot-names"
              value={lotLabel}
              onChange={(e) => {
                setLotLabel(e.target.value);
                setLabelsTouched(true);
              }}
            />
            {err("lotLabel")}
          </label>
          <label className="block text-sm">
            Nom de l'unité
            <input
              className="field mt-1 w-full"
              list="unit-names"
              value={unitLabel}
              onChange={(e) => {
                setUnitLabel(e.target.value);
                setLabelsTouched(true);
              }}
            />
            {err("unitLabel")}
          </label>
          <datalist id="lot-names">
            {["casier", "carton", "pack", "sac", "caisse", "fût"].map((v) => (
              <option key={v} value={v} />
            ))}
          </datalist>
          <datalist id="unit-names">
            {["bouteille", "canette", "paquet", "sachet", "boîte", "pièce", "sac", "bidon", "rouleau"].map((v) => (
              <option key={v} value={v} />
            ))}
          </datalist>

          <label className="block text-sm">
            Unité / lot
            <input
              className="field mt-1 w-full"
              type="number"
              inputMode="numeric"
              min={1}
              step={1}
              value={uniteLot}
              onChange={(e) => {
                setUniteLot(e.target.value);
                setFailure(null);
              }}
              aria-invalid={submitted && Boolean(errors.uniteLot)}
            />
            <span className="mt-1 block text-xs text-[var(--faint)]">
              1 {lotLabel.trim() || "lot"} = {fmt(lot || 0)} {pluralizeFr(unitLabel) || "unités"}
            </span>
            {err("uniteLot")}
          </label>
          <label className="block text-sm">
            Prix d'achat <span className="text-[var(--faint)]">(par {lotLabel.trim() || "lot"})</span>
            <input
              className="field mt-1 w-full"
              type="number"
              inputMode="numeric"
              min={1}
              step={1}
              value={prixAchat}
              onChange={(e) => setPrixAchat(e.target.value)}
              placeholder="7800"
              aria-invalid={submitted && Boolean(errors.prixAchat)}
            />
            {err("prixAchat")}
          </label>
          <label className="block text-sm sm:col-span-2">
            Prix unitaire <span className="text-[var(--faint)]">(vente d'une {unitLabel.trim() || "unité"})</span>
            <input
              className="field mt-1 w-full"
              type="number"
              inputMode="numeric"
              min={1}
              step={1}
              value={prixUnitaire}
              onChange={(e) => setPrixUnitaire(e.target.value)}
              placeholder="700"
              aria-invalid={submitted && Boolean(errors.prixUnitaire)}
            />
            {err("prixUnitaire")}
          </label>

          {mode === "add" ? (
            <>
              <label className="block text-sm">
                Qté entrée initiale <span className="text-[var(--faint)]">({pluralizeFr(lotLabel) || "lots"})</span>
                <input
                  className="field mt-1 w-full"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  step={1}
                  value={initialLots}
                  onChange={(e) => setInitialLots(e.target.value)}
                />
                {err("initialLots")}
              </label>
              <label className="block text-sm">
                Date de réception
                <input
                  className="field mt-1 w-full"
                  type="date"
                  min={HISTORY_START_ISO}
                  max={TODAY_ISO}
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
                {err("date")}
              </label>
            </>
          ) : null}
        </div>

        <div className="mt-4 rounded-2xl bg-[var(--well)] px-4 py-3 text-sm">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--faint)]">Aperçu des calculs</p>
          {preview ? (
            <dl className="mt-2 space-y-1 tabular">
              <div className="flex justify-between gap-3">
                <dt className="text-[var(--muted)]">
                  Bénéfice / lot = ({fmt(lot)} × {fmt(unit)}) − {fmt(achat)}
                </dt>
                <dd className="font-medium" style={{ color: preview.beneficeLot < 0 ? "var(--wine)" : undefined }}>
                  {fcfa(preview.beneficeLot)}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-[var(--muted)]">Par {unitLabel.trim() || "unité"} vendue</dt>
                <dd className="font-medium">{fcfa(preview.beneficeUnite)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-[var(--muted)]">Marge sur la vente</dt>
                <dd className="font-medium">{fmtFlex(margin)} %</dd>
              </div>
              {mode === "add" && lots > 0 ? (
                <>
                  <div className="flex justify-between gap-3">
                    <dt className="text-[var(--muted)]">
                      Reste = {fmt(lots)} × {fmt(lot)}
                    </dt>
                    <dd className="font-medium">{fmt(lots * lot)}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-[var(--muted)]">Valeur du stock</dt>
                    <dd className="font-medium">{fcfa(preview.valeurAchats)}</dd>
                  </div>
                </>
              ) : null}
            </dl>
          ) : (
            <p className="mt-1 text-[var(--muted)]">Renseignez l'unité par lot et les deux prix pour voir le bénéfice.</p>
          )}
          {preview && preview.beneficeLot < 0 ? (
            <p className="mt-2 text-xs" style={{ color: "var(--wine)" }}>
              Ce prix de vente est inférieur au prix d'achat : chaque lot vendu fait perdre de l'argent.
            </p>
          ) : null}
          {mode === "edit" ? (
            <p className="mt-2 text-xs text-[var(--faint)]">
              Les nouveaux prix et la nouvelle unité par lot s'appliquent à tout l'historique de ce produit.
            </p>
          ) : null}
        </div>

        {failure ? (
          <p role="alert" className="mt-3 rounded-xl bg-[var(--wine-2)] px-3 py-2 text-sm text-[var(--wine)]">
            {failure}
          </p>
        ) : null}

        <div className="mt-4 flex gap-2">
          <button type="button" className="btn btn-ghost flex-1" onClick={onClose}>
            Annuler
          </button>
          <button type="submit" className="btn btn-primary flex-1">
            {mode === "add" ? "Ajouter le produit" : "Enregistrer"}
          </button>
        </div>
      </form>
    </div>
  );
}
