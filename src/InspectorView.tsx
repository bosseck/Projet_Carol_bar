import { useMemo, useState } from "react";
import banner from "./assets/banner.jpg";
import { CATEGORIES, CATEGORY_COLORS, PRODUCTS, categorySegment } from "./data/catalog";
import { SEED_MOVEMENTS } from "./data/movements";
import { HISTORY_START_ISO, TODAY, TODAY_ISO, addDays, formatShort, inclusiveDays, iso } from "./lib/dates";
import { compact, fcfa, fmt, plural } from "./lib/format";
import { bucketSeries, buildIndex, queryDashboard, type ProductRow } from "./lib/metrics";
import { CategoryDonut, RankBars, SalesLineChart } from "./components/Charts";
import { KpiCard } from "./components/KpiCard";
import { BeerLogo, CashLogo, GroceryLogo, ShopLogo, StockLogo } from "./components/Logos";
import type { Category, Preset, Segment, SortKey, StockFilter } from "./types";

const DATA_VERSION_KEY = "terrasse-stock-data-version";
const DATA_VERSION = "real-products-1";
const CATALOG_KEY = "terrasse-catalog-v1";
const SAISIES_KEY = "terrasse-saisies-v1";
const PLACE = "PK13";

function loadCatalog() {
  try {
    if (localStorage.getItem(DATA_VERSION_KEY) !== DATA_VERSION) return PRODUCTS;
    const raw = localStorage.getItem(CATALOG_KEY);
    if (!raw) return PRODUCTS;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return PRODUCTS;
    const list = parsed
      .filter((p: any) => p && typeof p.id === "string" && typeof p.name === "string")
      .map((p: any) => ({ ...p, segment: categorySegment(p.category) as Segment }));
    if (parsed.length > 0 && list.length === 0) return PRODUCTS;
    return list;
  } catch {
    return PRODUCTS;
  }
}

function loadSaisies(ids: Set<string>) {
  try {
    if (localStorage.getItem(DATA_VERSION_KEY) !== DATA_VERSION) return [];
    const raw = JSON.parse(localStorage.getItem(SAISIES_KEY) || "[]");
    if (!Array.isArray(raw)) return [];
    return raw.filter((m: any) => m && ids.has(m.productId) && typeof m.date === "string");
  } catch {
    return [];
  }
}

function resolveRange(preset: Preset, customStart: string, customEnd: string) {
  if (preset === "7") return { start: iso(addDays(TODAY, -6)), end: TODAY_ISO };
  if (preset === "30") return { start: iso(addDays(TODAY, -29)), end: TODAY_ISO };
  if (preset === "90") return { start: iso(addDays(TODAY, -89)), end: TODAY_ISO };
  if (preset === "month") {
    const start = iso(new Date(TODAY.getFullYear(), TODAY.getMonth(), 1));
    return { start: start < HISTORY_START_ISO ? HISTORY_START_ISO : start, end: TODAY_ISO };
  }
  if (preset === "all") return { start: HISTORY_START_ISO, end: TODAY_ISO };
  const start = customStart < HISTORY_START_ISO ? HISTORY_START_ISO : customStart;
  const end = customEnd > TODAY_ISO ? TODAY_ISO : customEnd;
  return start <= end ? { start, end } : { start: end, end: start };
}

function sortValue(row: ProductRow, key: SortKey): string | number {
  switch (key) {
    case "name":
      return row.product.name;
    case "uniteLot":
      return row.product.uniteLot;
    case "prixAchat":
      return row.product.prixAchat;
    case "prixUnitaire":
      return row.product.prixUnitaire;
    case "beneficeLot":
      return row.beneficeLot;
    default:
      return row[key as keyof ProductRow] as any;
  }
}

export function InspectorView({ onAdminAccess }: { onAdminAccess: () => void }) {
  const [preset, setPreset] = useState<Preset>("30");
  const [customStart, setCustomStart] = useState(iso(addDays(TODAY, -29)));
  const [customEnd, setCustomEnd] = useState(TODAY_ISO);
  const [segment, setSegment] = useState<"Tous" | Segment>("Tous");
  const [category, setCategory] = useState<"Toutes" | Category>("Toutes");
  const [query, setQuery] = useState("");
  const [stock, setStock] = useState<StockFilter>("tous");
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({ key: "caisse", dir: "desc" });
  const [dark, setDark] = useState(() => document.documentElement.classList.contains("dark"));
  const [lineMode, setLineMode] = useState<"both" | "caisse" | "benefice">("both");
  const [rankMetric, setRankMetric] = useState<"caisse" | "benefice" | "unites">("caisse");
  const [bucketOverride, setBucketOverride] = useState<"jour" | "semaine" | null>(null);
  const [now] = useState(() => new Date());

  const catalog = useMemo(() => loadCatalog(), []);
  const extras = useMemo(() => loadSaisies(new Set(catalog.map((p: any) => p.id))), [catalog]);
  const range = useMemo(() => resolveRange(preset, customStart, customEnd), [preset, customStart, customEnd]);
  const allMovements = useMemo(() => [...SEED_MOVEMENTS, ...extras], [extras]);
  const index = useMemo(() => buildIndex(catalog as any, allMovements as any), [catalog, allMovements]);
  const model = useMemo(
    () =>
      queryDashboard(index, catalog as any, {
        start: range.start,
        end: range.end,
        segment,
        category,
        query,
        stock,
      }),
    [index, catalog, range.start, range.end, segment, category, query, stock]
  );

  const sorted = useMemo(() => {
    const list = [...model.rows];
    const dir = sort.dir === "asc" ? 1 : -1;
    list.sort((a, b) => {
      const av = sortValue(a, sort.key);
      const bv = sortValue(b, sort.key);
      if (typeof av === "string" || typeof bv === "string") return String(av).localeCompare(String(bv), "fr") * dir;
      return (Number(av) - Number(bv)) * dir;
    });
    return list;
  }, [model.rows, sort]);

  const days = inclusiveDays(range.start, range.end);
  const bucket = bucketOverride ?? (days > 45 ? "semaine" : "jour");
  const series = useMemo(() => bucketSeries(model.daily, bucket), [model.daily, bucket]);
  const prevSeries = useMemo(() => bucketSeries(model.prevDaily, bucket), [model.prevDaily, bucket]);

  const rank = useMemo(() => {
    const key = rankMetric === "caisse" ? "caisse" : rankMetric === "benefice" ? "beneficeRealise" : "qteSortie";
    return [...model.rows]
      .sort((a: any, b: any) => b[key] - a[key])
      .slice(0, 8)
      .map((row: any) => ({
        id: row.product.id,
        label: row.product.name,
        sub: `${fmt(row.qteSortie)} ${plural(row.qteSortie, row.product.unitLabel, row.product.unitPlural)} · reste ${fmt(row.reste)}`,
        value: row[key],
        color: CATEGORY_COLORS[row.product.category],
        hint: `Caisse ${fcfa(row.caisse)} · bénéfice ${fcfa(row.beneficeRealise)} · ${fmt(row.qteSortie)} vendues`,
      }));
  }, [model.rows, rankMetric]);

  const barCaisse = model.rows.filter((r: any) => r.product.segment === "Bar").reduce((s: number, r: any) => s + r.caisse, 0);
  const epiCaisse = model.rows.filter((r: any) => r.product.segment === "Épicerie").reduce((s: number, r: any) => s + r.caisse, 0);
  const shareTotal = barCaisse + epiCaisse;

  const toggleTheme = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("terrasse-theme", next ? "dark" : "light");
  };

  const clock = now.toLocaleString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  });

  const presets: { id: Preset; label: string }[] = [
    { id: "7", label: "7 jours" },
    { id: "30", label: "30 jours" },
    { id: "90", label: "90 jours" },
    { id: "month", label: "Ce mois" },
    { id: "all", label: "Tout" },
  ];

  const visibleCategories = CATEGORIES.filter((c) => segment === "Tous" || categorySegment(c) === segment);

  return (
    <div className="min-h-screen">
      <header className="topbar sticky top-0 z-40 border-b border-[var(--line)]">
        <div className="mx-auto flex max-w-[1280px] flex-wrap items-center gap-2 px-3 py-2 sm:px-4 sm:gap-3 sm:py-3 md:px-6">
          <ShopLogo className="h-8 w-8 sm:h-9 sm:w-9" />
          <div className="min-w-0 flex-1 sm:flex-none">
            <p className="font-display text-base leading-none sm:text-lg">La Terrasse</p>
            <p className="truncate text-[11px] text-[var(--muted)] sm:text-xs">Consultation des stocks · {PLACE}</p>
          </div>
          <p className="hidden text-sm capitalize text-[var(--muted)] lg:ml-auto lg:block">{clock}</p>
          <div className="ml-auto flex flex-wrap items-center justify-end gap-1.5 sm:gap-2 lg:ml-0">
            <button type="button" className="btn btn-ghost btn-tiny" onClick={toggleTheme}>
              {dark ? "Clair" : "Sombre"}
            </button>
            <button type="button" className="btn btn-primary btn-tiny sm:btn" onClick={onAdminAccess}>
              Accès administrateur
            </button>
          </div>
        </div>
      </header>

      <section className="relative overflow-hidden border-b border-[var(--line)]">
        <img src={banner} alt="" className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#0b1a14]/95 via-[#0b1a14]/80 to-[#0b1a14]/35" />
        <div className="relative mx-auto max-w-[1280px] px-3 py-8 sm:px-4 sm:py-10 md:px-6 md:py-14">
          <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#e3a45c] sm:gap-2 sm:text-[11px] sm:tracking-[0.22em]">
            <ShopLogo className="h-6 w-6 sm:h-7 sm:w-7" /> La Terrasse · {PLACE}
          </p>
          <h1 className="mt-2 max-w-2xl font-display text-3xl leading-[1.05] text-[#f6f1e8] sm:mt-3 sm:text-4xl md:text-5xl">
            État des stocks
            <span className="block italic text-[#e3a45c]">Bar & Épicerie</span>
          </h1>
          <p className="mt-3 text-xs text-[#f6f1e8]/85 sm:mt-4 sm:text-sm">Consultation en lecture seule</p>
        </div>
      </section>

      <main className="mx-auto max-w-[1280px] px-3 py-4 sm:px-4 sm:py-6 md:px-6 lg:px-8">
        <section className="card mt-6 p-3 sm:p-4">
          <div className="flex flex-wrap items-center gap-2">
            {presets.map((item) => (
              <button
                key={item.id}
                type="button"
                className="chip"
                aria-pressed={preset === item.id}
                onClick={() => {
                  setPreset(item.id);
                  setBucketOverride(null);
                }}
              >
                {item.label}
              </button>
            ))}
            <label className="ml-auto flex items-center gap-2 text-xs text-[var(--muted)]">
              Du
              <input
                type="date"
                className="field w-auto"
                min={HISTORY_START_ISO}
                max={TODAY_ISO}
                value={range.start}
                onChange={(e) => {
                  setPreset("custom");
                  setCustomStart(e.target.value);
                  setCustomEnd(range.end);
                }}
              />
            </label>
            <label className="flex items-center gap-2 text-xs text-[var(--muted)]">
              au
              <input
                type="date"
                className="field w-auto"
                min={HISTORY_START_ISO}
                max={TODAY_ISO}
                value={range.end}
                onChange={(e) => {
                  setPreset("custom");
                  setCustomStart(range.start);
                  setCustomEnd(e.target.value);
                }}
              />
            </label>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <div role="radiogroup" aria-label="Segment" className="flex rounded-full bg-[var(--well)] p-1">
              {(["Tous", "Bar", "Épicerie"] as const).map((item) => (
                <button
                  key={item}
                  type="button"
                  role="radio"
                  aria-checked={segment === item}
                  className="rounded-full px-3 py-1.5 text-sm"
                  style={{
                    background: segment === item ? "var(--ink)" : "transparent",
                    color: segment === item ? "var(--paper)" : "var(--muted)",
                  }}
                  onClick={() => setSegment(item)}
                >
                  {item}
                </button>
              ))}
            </div>
            <select className="field w-auto" value={stock} onChange={(e) => setStock(e.target.value as StockFilter)}>
              <option value="tous">Tout le stock</option>
              <option value="ok">En stock</option>
              <option value="bas">Stock bas</option>
              <option value="rupture">Rupture</option>
            </select>
            <input
              className="field min-w-[180px] flex-1"
              placeholder="Rechercher..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
            <button type="button" className="chip" aria-pressed={category === "Toutes"} onClick={() => setCategory("Toutes")}>
              Toutes
            </button>
            {visibleCategories.map((item) => (
              <button key={item} type="button" className="chip" aria-pressed={category === item} onClick={() => setCategory(item)}>
                <span className="mr-1 inline-block h-2 w-2 rounded-full" style={{ background: CATEGORY_COLORS[item] }} />
                {item}
              </button>
            ))}
          </div>
        </section>

        <section className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3" aria-label="Indicateurs">
          <KpiCard label="Argent en caisse" value={model.totals.caisse} format={fcfa} previous={model.prev.caisse} reliable={model.trendReliable} spark={model.daily.map((d: any) => d.caisse)} accent="#d4832a" delay={0} />
          <KpiCard label="Bénéfice réalisé" value={model.totals.beneficeRealise} format={fcfa} previous={model.prev.beneficeRealise} reliable={model.trendReliable} spark={model.daily.map((d: any) => d.benefice)} accent="#2f9a62" delay={60} />
          <KpiCard label="Valeur du stock" value={model.totals.valeurAchats} format={fcfa} previous={model.prev.valeurAchats} reliable={model.trendReliable} spark={model.daily.map((d: any) => d.achats)} accent="#8d4d32" tone="neutral" delay={120} />
        </section>

        <section className="mt-4 grid gap-4 lg:grid-cols-5">
          <article className="card p-4 sm:p-5 lg:col-span-3">
            <div className="mb-2 flex flex-wrap items-start justify-between gap-3">
              <h2 className="font-display text-2xl">Caisse et bénéfice</h2>
              <div className="flex flex-wrap gap-2">
                {(["both", "caisse", "benefice"] as const).map((item) => (
                  <button key={item} type="button" className="chip" aria-pressed={lineMode === item} onClick={() => setLineMode(item)}>
                    {item === "both" ? "Les deux" : item === "caisse" ? "Caisse" : "Bénéfice"}
                  </button>
                ))}
                <button type="button" className="chip" aria-pressed={bucket === "jour"} onClick={() => setBucketOverride("jour")}>
                  Jour
                </button>
                <button type="button" className="chip" aria-pressed={bucket === "semaine"} onClick={() => setBucketOverride("semaine")}>
                  Semaine
                </button>
              </div>
            </div>
            <SalesLineChart points={series} previous={model.trendReliable ? prevSeries : []} mode={lineMode} bucket={bucket} />
          </article>
          <article className="card p-4 sm:p-5 lg:col-span-2">
            <h2 className="font-display text-2xl">Répartition</h2>
            <CategoryDonut
              slices={model.byCategory
                .filter((c: any) => c.caisse > 0)
                .map((c: any) => ({
                  id: c.category,
                  label: c.category,
                  value: c.caisse,
                  color: CATEGORY_COLORS[c.category],
                }))}
              activeId={category === "Toutes" ? null : category}
              onSelect={(id) => setCategory(id as Category)}
            />
            <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
              <button type="button" className="rounded-xl bg-[var(--well)] px-3 py-2 text-left" onClick={() => setSegment("Bar")}>
                <span className="block text-[11px] uppercase tracking-wider text-[var(--faint)]">Bar</span>
                <span className="tabular font-medium">{shareTotal ? Math.round((barCaisse / shareTotal) * 100) : 0} %</span>
                <span className="block text-xs text-[var(--muted)]">{compact(barCaisse)}</span>
              </button>
              <button type="button" className="rounded-xl bg-[var(--well)] px-3 py-2 text-left" onClick={() => setSegment("Épicerie")}>
                <span className="block text-[11px] uppercase tracking-wider text-[var(--faint)]">Épicerie</span>
                <span className="tabular font-medium">{shareTotal ? Math.round((epiCaisse / shareTotal) * 100) : 0} %</span>
                <span className="block text-xs text-[var(--muted)]">{compact(epiCaisse)}</span>
              </button>
            </div>
          </article>
        </section>

        <section className="mt-4 grid gap-4 lg:grid-cols-5">
          <article className="card p-4 sm:p-5 lg:col-span-3">
            <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
              <h2 className="font-display text-2xl">Meilleures ventes</h2>
              <div className="flex gap-2">
                {(
                  [
                    ["caisse", "Caisse"],
                    ["benefice", "Bénéfice"],
                    ["unites", "Unités"],
                  ] as const
                ).map(([id, label]) => (
                  <button key={id} type="button" className="chip" aria-pressed={rankMetric === id} onClick={() => setRankMetric(id)}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <RankBars items={rank as any} activeId={null} onSelect={() => {}} formatValue={rankMetric === "unites" ? fmt : fcfa} />
          </article>
        </section>

        <section id="tableau" className="card mt-4 overflow-hidden">
          <div className="flex flex-col gap-3 border-b border-[var(--line)] px-4 py-4 sm:flex-row sm:items-end sm:justify-between sm:px-5">
            <div>
              <h2 className="font-display text-2xl">État des stocks</h2>
              <p className="text-sm text-[var(--muted)]">Consultation uniquement</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-x-5 gap-y-1 border-b border-[var(--line)] px-4 py-3 text-sm sm:px-5">
            <span>
              Caisse <strong className="tabular">{fcfa(model.totals.caisse)}</strong>
            </span>
            <span>
              Bénéfice réalisé <strong className="tabular">{fcfa(model.totals.beneficeRealise)}</strong>
            </span>
            <span>
              Valeur du stock <strong className="tabular">{fcfa(model.totals.valeurAchats)}</strong>
            </span>
            <span className="text-[var(--faint)]">
              {sorted.length} ligne{sorted.length > 1 ? "s" : ""}
            </span>
          </div>
          <div className="hidden max-h-[680px] overflow-auto md:block">
            <table className="ledger">
              <thead>
                <tr>
                  <th>Produit</th>
                  <th>Unité/lot</th>
                  <th>Qté entrée (période)</th>
                  <th>Qté sortie (période)</th>
                  <th>Reste</th>
                  <th>Prix d'achat</th>
                  <th>Prix unitaire</th>
                  <th>Bénéfice/lot</th>
                  <th>Bén. réalisé</th>
                  <th>Caisse</th>
                </tr>
              </thead>
              <tbody>
                {sorted.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="py-10 text-center text-sm text-[var(--muted)]">
                      Aucun produit ne correspond à ce filtre.
                    </td>
                  </tr>
                ) : (
                  sorted.map((row: any) => (
                    <tr key={row.product.id}>
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
                        <div className="text-[11px] text-[var(--faint)]">{plural(row.qteEntree, row.product.lotLabel, row.product.lotPlural)}</div>
                      </td>
                      <td>
                        <div className="tabular">{fmt(row.qteSortie)}</div>
                        <div className="text-[11px] text-[var(--faint)]">{plural(row.qteSortie, row.product.unitLabel, row.product.unitPlural)}</div>
                      </td>
                      <td>
                        <div className="tabular font-medium">{fmt(row.reste)}</div>
                      </td>
                      <td className="tabular">{fmt(row.product.prixAchat)}</td>
                      <td className="tabular">{fmt(row.product.prixUnitaire)}</td>
                      <td>
                        <div className="tabular">{fmt(row.beneficeLot)}</div>
                      </td>
                      <td className="tabular">{fmt(row.beneficeRealise)}</td>
                      <td className="tabular font-medium">{fmt(row.caisse)}</td>
                    </tr>
                  ))
                )}
              </tbody>
              {sorted.length > 0 ? (
                <tfoot>
                  <tr className="bg-[var(--amber-2)] text-sm font-semibold">
                    <td className="!bg-[var(--amber-2)]">Totaux</td>
                    <td />
                    <td className="tabular">{fmt(model.totals.qteEntree)}</td>
                    <td className="tabular">{fmt(model.totals.unites)}</td>
                    <td className="tabular">{fmt(model.totals.reste)}</td>
                    <td />
                    <td />
                    <td />
                    <td className="tabular">{fmt(model.totals.beneficeRealise)}</td>
                    <td className="tabular">{fmt(model.totals.caisse)}</td>
                  </tr>
                </tfoot>
              ) : null}
            </table>
          </div>
          <div className="space-y-3 p-3 md:hidden">
            {sorted.length === 0 ? (
              <p className="px-2 py-8 text-center text-sm text-[var(--muted)]">Aucun produit</p>
            ) : (
              sorted.map((row: any) => (
                <article key={row.product.id} className="rounded-2xl border border-[var(--line)] bg-[var(--well)] p-3">
                  <div>
                    <h3 className="font-display text-xl">{row.product.name}</h3>
                    <p className="text-xs text-[var(--faint)]">{row.product.category} · 1 {row.product.lotLabel} = {row.product.uniteLot} {row.product.unitPlural}</p>
                  </div>
                  <dl className="mt-3 grid grid-cols-3 gap-2 text-sm">
                    <div>
                      <dt className="text-[10px] uppercase text-[var(--faint)]">Entrée</dt>
                      <dd className="tabular">{fmt(row.qteEntree)} {plural(row.qteEntree, row.product.lotLabel, row.product.lotPlural)}</dd>
                    </div>
                    <div>
                      <dt className="text-[10px] uppercase text-[var(--faint)]">Sortie</dt>
                      <dd className="tabular">{fmt(row.qteSortie)} {plural(row.qteSortie, row.product.unitLabel, row.product.unitPlural)}</dd>
                    </div>
                    <div>
                      <dt className="text-[10px] uppercase text-[var(--faint)]">Reste</dt>
                      <dd className="tabular">{fmt(row.reste)}</dd>
                    </div>
                    <div>
                      <dt className="text-[10px] uppercase text-[var(--faint)]">Achat</dt>
                      <dd className="tabular">{fcfa(row.product.prixAchat)}</dd>
                    </div>
                    <div>
                      <dt className="text-[10px] uppercase text-[var(--faint)]">Unitaire</dt>
                      <dd className="tabular">{fcfa(row.product.prixUnitaire)}</dd>
                    </div>
                    <div>
                      <dt className="text-[10px] uppercase text-[var(--faint)]">Bén.</dt>
                      <dd className="tabular">{fcfa(row.beneficeRealise)}</dd>
                    </div>
                  </dl>
                </article>
              ))
            )}
          </div>
        </section>
      </main>

      <footer className="mx-auto max-w-[1280px] px-4 py-8 text-sm text-[var(--muted)] sm:px-6">
        La Terrasse · Consultation lecture seule
      </footer>
    </div>
  );
}
