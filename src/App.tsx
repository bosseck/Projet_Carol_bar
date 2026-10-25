import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { InspectorView } from "./InspectorView";
import banner from "./assets/banner.jpg";
import { CATEGORIES, CATEGORY_COLORS, PRODUCTS, categorySegment } from "./data/catalog";
import { SEED_MOVEMENTS } from "./data/movements";
import {
  HISTORY_START_ISO,
  TODAY,
  TODAY_ISO,
  addDays,
  formatShort,
  inclusiveDays,
  iso,
} from "./lib/dates";
import { compact, fcfa, fmt, plural } from "./lib/format";
import {
  bucketSeries,
  buildIndex,
  findNegativeDay,
  queryDashboard,
  recentOutflows,
  validateMovement,
  type ProductRow,
} from "./lib/metrics";
import { clearSession, loadSession } from "./lib/auth";
import { exportStockPdf } from "./lib/pdf";
import {
  KIND_LABEL,
  loadJournal,
  pushEntry,
  saveJournal,
  type JournalEntry,
  type JournalKind,
} from "./lib/journal";
import { AuthDialog } from "./components/AuthDialog";
import { CategoryDonut, RankBars, SalesLineChart } from "./components/Charts";
import { ConfirmDialog } from "./components/ConfirmDialog";
import { LockIcon } from "./components/Icons";
import { KpiCard } from "./components/KpiCard";
import { JournalPanel } from "./components/JournalPanel";
import { MovementDialog } from "./components/MovementDialog";
import { ProductDrawer } from "./components/ProductDrawer";
import { ProductFormDialog } from "./components/ProductFormDialog";
import { StockTable } from "./components/StockTable";
import {
  BeerLogo,
  CashLogo,
  GroceryLogo,
  JournalLogo,
  ShopLogo,
  StockLogo,
} from "./components/Logos";
import type { Category, Movement, Preset, Product, Segment, Session, SortKey, StockFilter } from "./types";

const THEME_KEY = "terrasse-theme";
const SAISIES_KEY = "terrasse-saisies-v1";
const CATALOG_KEY = "terrasse-catalog-v1";
const DATA_VERSION_KEY = "terrasse-stock-data-version";
const DATA_VERSION = "real-products-1";
const PLACE = "PK13";
const DEFAULT_EMAIL = "tonymod237@gmail.com";

type Toast = { id: number; text: string; undo?: () => void };
type DialogState =
  | { mode: "create"; productId: string; kind: "entree" | "sortie" }
  | { mode: "edit"; movementId: string; productId: string; kind: "entree" | "sortie" }
  | null;
type FormState = { mode: "add" } | { mode: "edit"; id: string } | null;

function isProductLike(x: unknown): x is Product {
  if (!x || typeof x !== "object") return false;
  const p = x as Record<string, unknown>;
  return (
    typeof p.id === "string" &&
    typeof p.name === "string" &&
    typeof p.detail === "string" &&
    typeof p.category === "string" &&
    (CATEGORIES as string[]).includes(p.category) &&
    Number.isInteger(p.uniteLot) &&
    (p.uniteLot as number) >= 1 &&
    typeof p.prixAchat === "number" &&
    p.prixAchat > 0 &&
    typeof p.prixUnitaire === "number" &&
    p.prixUnitaire > 0 &&
    typeof p.lotLabel === "string" &&
    typeof p.lotPlural === "string" &&
    typeof p.unitLabel === "string" &&
    typeof p.unitPlural === "string"
  );
}

function loadCatalog(): Product[] {
  try {
    if (localStorage.getItem(DATA_VERSION_KEY) !== DATA_VERSION) return PRODUCTS;
    const raw = localStorage.getItem(CATALOG_KEY);
    if (!raw) return PRODUCTS;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return PRODUCTS;
    const list = parsed
      .filter(isProductLike)
      .map((p) => ({ ...p, segment: categorySegment(p.category) as Segment }));
    if (parsed.length > 0 && list.length === 0) return PRODUCTS;
    return list;
  } catch {
    return PRODUCTS;
  }
}

function loadSaisies(ids: Set<string>): Movement[] {
  try {
    if (localStorage.getItem(DATA_VERSION_KEY) !== DATA_VERSION) return [];
    const raw = JSON.parse(localStorage.getItem(SAISIES_KEY) || "[]") as Movement[];
    if (!Array.isArray(raw)) return [];
    return raw.filter((m) => m && ids.has(m.productId) && typeof m.date === "string" && typeof m.id === "string");
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
      return row[key];
  }
}

export default function App() {
  const [view, setView] = useState<"inspector" | "admin">(() => {
    if (typeof window === "undefined") return "inspector";
    const h = window.location.hash;
    if (h === "#admin" || h === "#/admin") return "admin";
    const p = new URLSearchParams(window.location.search);
    if (p.get("view") === "admin" || p.get("mode") === "admin") return "admin";
    return "inspector";
  });
  const [dark, setDark] = useState(() => document.documentElement.classList.contains("dark"));
  const [preset, setPreset] = useState<Preset>("30");
  const [customStart, setCustomStart] = useState(iso(addDays(TODAY, -29)));
  const [customEnd, setCustomEnd] = useState(TODAY_ISO);
  const [segment, setSegment] = useState<"Tous" | Segment>("Tous");
  const [category, setCategory] = useState<"Toutes" | Category>("Toutes");
  const [query, setQuery] = useState("");
  const [stock, setStock] = useState<StockFilter>("tous");
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({ key: "caisse", dir: "desc" });
  const [catalog, setCatalog] = useState<Product[]>(loadCatalog);
  const [extras, setExtras] = useState<Movement[]>(() => loadSaisies(new Set(loadCatalog().map((p) => p.id))));
  const [user, setUser] = useState<Session | null>(loadSession);
  const [authReason, setAuthReason] = useState<string | null>(null);
  const [dialog, setDialog] = useState<DialogState>(null);
  const [productForm, setProductForm] = useState<FormState>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [drawerId, setDrawerId] = useState<string | null>(null);
  const [focusId, setFocusId] = useState<string | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [lineMode, setLineMode] = useState<"both" | "caisse" | "benefice">("both");
  const [rankMetric, setRankMetric] = useState<"caisse" | "benefice" | "unites">("caisse");
  const [bucketOverride, setBucketOverride] = useState<"jour" | "semaine" | null>(null);
  const [now, setNow] = useState(() => new Date());
  const [journal, setJournal] = useState<JournalEntry[]>(loadJournal);
  const pending = useRef<(() => void) | null>(null);
  const userRef = useRef<string | null>(null);
  const knownEmails = useRef<Set<string>>(new Set());

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    localStorage.setItem(THEME_KEY, dark ? "dark" : "light");
  }, [dark]);

  useEffect(() => {
    localStorage.setItem(SAISIES_KEY, JSON.stringify(extras));
  }, [extras]);

  useEffect(() => {
    localStorage.setItem(CATALOG_KEY, JSON.stringify(catalog));
    localStorage.setItem(DATA_VERSION_KEY, DATA_VERSION);
  }, [catalog]);

  useEffect(() => {
    userRef.current = user?.name ?? null;
  }, [user]);

  /** Journalise une opération importante, au nom de l'utilisateur connecté. */
  const log = useCallback((kind: JournalKind, label: string, detail: string) => {
    setJournal((prev) => pushEntry(prev, { kind, label, detail }, userRef.current ?? "anonyme"));
  }, []);

  useEffect(() => {
    saveJournal(journal);
  }, [journal]);

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(null), 6400);
    return () => window.clearTimeout(id);
  }, [toast]);

  const anyModal = Boolean(dialog || drawerId || productForm || deleteId || authReason);
  useEffect(() => {
    document.body.style.overflow = anyModal ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [anyModal]);

  const range = useMemo(() => resolveRange(preset, customStart, customEnd), [preset, customStart, customEnd]);
  const catalogMap = useMemo(() => new Map(catalog.map((p) => [p.id, p])), [catalog]);
  const allMovements = useMemo(() => [...SEED_MOVEMENTS, ...extras], [extras]);
  const index = useMemo(() => buildIndex(catalog, allMovements), [catalog, allMovements]);
  const model = useMemo(
    () =>
      queryDashboard(index, catalog, {
        start: range.start,
        end: range.end,
        segment,
        category,
        query,
        stock,
      }),
    [index, catalog, range.start, range.end, segment, category, query, stock],
  );

  const sorted = useMemo(() => {
    const list = [...model.rows];
    const dir = sort.dir === "asc" ? 1 : -1;
    list.sort((a, b) => {
      const av = sortValue(a, sort.key);
      const bv = sortValue(b, sort.key);
      if (typeof av === "string" || typeof bv === "string") return String(av).localeCompare(String(bv), "fr") * dir;
      return (av - bv) * dir;
    });
    return list;
  }, [model.rows, sort]);

  const days = inclusiveDays(range.start, range.end);
  const bucket = bucketOverride ?? (days > 45 ? "semaine" : "jour");
  const series = useMemo(() => bucketSeries(model.daily, bucket), [model.daily, bucket]);
  const prevSeries = useMemo(() => bucketSeries(model.prevDaily, bucket), [model.prevDaily, bucket]);
  const drawerRow =
    sorted.find((r) => r.product.id === drawerId) ?? model.rows.find((r) => r.product.id === drawerId) ?? null;
  const visibleCategories = CATEGORIES.filter((c) => segment === "Tous" || categorySegment(c) === segment);
  const formProduct = productForm?.mode === "edit" ? catalogMap.get(productForm.id) : undefined;
  const deleteProductTarget = deleteId ? catalogMap.get(deleteId) : undefined;

  const rank = useMemo(() => {
    const key = rankMetric === "caisse" ? "caisse" : rankMetric === "benefice" ? "beneficeRealise" : "qteSortie";
    return [...model.rows]
      .sort((a, b) => b[key] - a[key])
      .slice(0, 8)
      .map((row) => ({
        id: row.product.id,
        label: row.product.name,
        sub: `${fmt(row.qteSortie)} ${plural(row.qteSortie, row.product.unitLabel, row.product.unitPlural)} · reste ${fmt(row.reste)}`,
        value: row[key],
        color: CATEGORY_COLORS[row.product.category],
        hint: `Caisse ${fcfa(row.caisse)} · bénéfice ${fcfa(row.beneficeRealise)} · ${fmt(row.qteSortie)} vendues`,
      }));
  }, [model.rows, rankMetric]);

  const activity = useMemo(() => recentOutflows(index, model.rows, range.end, 6), [index, model.rows, range.end]);
  const alerts = [...model.rows].filter((r) => r.status !== "ok").sort((a, b) => a.reste - b.reste).slice(0, 6);
  const barCaisse = model.rows.filter((r) => r.product.segment === "Bar").reduce((s, r) => s + r.caisse, 0);
  const epiCaisse = model.rows.filter((r) => r.product.segment === "Épicerie").reduce((s, r) => s + r.caisse, 0);
  const shareTotal = barCaisse + epiCaisse;

  function notify(text: string, undo?: () => void) {
    setToast({ id: Date.now(), text, undo });
  }

  /* ---------- accès : toute modification passe par ce garde ---------- */

  function guard(reason: string, action: () => void) {
    if (user) {
      action();
      return;
    }
    pending.current = action;
    setAuthReason(reason);
  }

  function closeAuth() {
    pending.current = null;
    setAuthReason(null);
  }

  function handleAuthed(session: Session) {
    const isNew = !knownEmails.current.has(session.email) && session.email !== DEFAULT_EMAIL;
    knownEmails.current.add(session.email);
    setUser(session);
    setAuthReason(null);
    log("connexion", `Connexion de ${session.name}`, `${session.email} · accès aux modifications activé`);
    if (isNew) log("inscription", `Nouveau compte : ${session.name}`, `${session.email} · code d'accès créé`);
    notify(`Bienvenue ${session.name}. Les modifications sont activées.`);
    const run = pending.current;
    pending.current = null;
    if (run) window.setTimeout(run, 0);
  }

  function logout() {
    if (user) log("deconnexion", `Déconnexion de ${user.name}`, "Retour en mode lecture");
    clearSession();
    setUser(null);
    setDialog(null);
    setProductForm(null);
    setDeleteId(null);
    notify("Déconnecté. Le tableau reste consultable.");
  }

  function chooseSegment(next: "Tous" | Segment) {
    setSegment(next);
    if (next !== "Tous" && category !== "Toutes" && categorySegment(category) !== next) setCategory("Toutes");
  }

  function chooseCategory(next: Category) {
    setCategory((cur) => (cur === next ? "Toutes" : next));
    if (segment !== "Tous" && categorySegment(next) !== segment) setSegment(categorySegment(next));
  }

  function scrollToProduct(id: string, delay = 50) {
    window.setTimeout(() => {
      (document.getElementById(`row-${id}`) ?? document.getElementById(`card-${id}`))?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }, delay);
  }

  function focusProduct(id: string) {
    setFocusId(id);
    setDrawerId(id);
    scrollToProduct(id, 40);
  }

  /* ---------- mouvements ---------- */

  function commitMovement(draft: { productId: string; date: string; qteEntree: number; qteSortie: number }) {
    const product = catalogMap.get(draft.productId);
    if (!product) {
      notify("Ce produit n'existe plus.");
      return;
    }
    const check = validateMovement(allMovements, product, draft.date, draft.qteEntree, draft.qteSortie);
    if (!check.ok) {
      notify(check.message);
      return;
    }
    const movement: Movement = { id: `saisie-${Date.now()}`, source: "saisie", ...draft };
    setExtras((prev) => [...prev, movement]);
    setDialog(null);
    const verb =
      draft.qteSortie > 0
        ? `${draft.qteSortie} ${plural(draft.qteSortie, product.unitLabel, product.unitPlural)} vendue${draft.qteSortie > 1 ? "s" : ""} · caisse +${fcfa(draft.qteSortie * product.prixUnitaire)}`
        : `${draft.qteEntree} ${plural(draft.qteEntree, product.lotLabel, product.lotPlural)} entré${draft.qteEntree > 1 ? "s" : ""} · valeur +${fcfa(draft.qteEntree * product.prixAchat)}`;
    notify(`${product.name} · ${verb}`, () => setExtras((prev) => prev.filter((m) => m.id !== movement.id)));
  }

  function quick(productId: string, kind: "entree" | "sortie") {
    commitMovement({
      productId,
      date: range.end,
      qteEntree: kind === "entree" ? 1 : 0,
      qteSortie: kind === "sortie" ? 1 : 0,
    });
  }

  const sell = (id: string) => guard("enregistrer une vente", () => quick(id, "sortie"));
  const receive = (id: string) => guard("enregistrer une entrée", () => quick(id, "entree"));

  function latestMovement(productId: string, kind: "entree" | "sortie") {
    return [...allMovements]
      .filter((m) => m.productId === productId && (kind === "entree" ? m.qteEntree > 0 : m.qteSortie > 0))
      .sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id))[0] ?? null;
  }

  const editMovement = (productId: string, kind: "entree" | "sortie") =>
    guard(`modifier la quantité ${kind === "entree" ? "d'entrée" : "de sortie"}`, () => {
      const last = latestMovement(productId, kind);
      if (!last) {
        notify(`Aucune ${kind === "entree" ? "entrée" : "sortie"} à modifier pour ce produit.`);
        return;
      }
      setDialog({ mode: "edit", movementId: last.id, productId, kind });
    });

  function updateMovement(movementId: string, draft: { productId: string; date: string; qteEntree: number; qteSortie: number }) {
    const before = allMovements.find((m) => m.id === movementId);
    if (!before) {
      notify("Mouvement introuvable.");
      return;
    }
    const product = catalogMap.get(draft.productId);
    if (!product) {
      notify("Ce produit n'existe plus.");
      return;
    }
    const scoped = allMovements.filter((m) => m.id !== movementId);
    const check = validateMovement(scoped, product, draft.date, draft.qteEntree, draft.qteSortie);
    if (!check.ok) {
      notify(check.message);
      return;
    }
    const updated: Movement = { ...before, ...draft, source: before.source === "seed" ? "saisie" : before.source };
    const beforeQty = before.qteEntree > 0 ? before.qteEntree : before.qteSortie;
    const afterQty = draft.qteEntree > 0 ? draft.qteEntree : draft.qteSortie;
    const kindName = draft.qteEntree > 0 ? "entrée" : "sortie";
    if (before.source === "seed") {
      setExtras((prev) => [...prev, updated]);
    } else {
      setExtras((prev) => prev.map((m) => (m.id === movementId ? updated : m)));
    }
    log(
      "mouvement-modif",
      `Quantité modifiée : ${product.name}`,
      `${kindName} ${fmt(beforeQty)} → ${fmt(afterQty)} ${draft.qteEntree > 0 ? product.lotPlural : product.unitPlural} · reste ${fmt(check.resteAfter)}`,
    );
    notify(`Mouvement de ${product.name} mis à jour.`);
    setDialog(null);
  }

  function removeMovement(movementId: string) {
    const before = allMovements.find((m) => m.id === movementId);
    if (!before) {
      notify("Mouvement introuvable.");
      return;
    }
    const product = catalogMap.get(before.productId);
    if (!product) return;
    if (before.source === "seed") {
      setExtras((prev) => [
        ...prev.filter((m) => m.id !== `cancel-${movementId}`),
        {
          id: `cancel-${movementId}`,
          productId: before.productId,
          date: before.date,
          qteEntree: -before.qteEntree,
          qteSortie: -before.qteSortie,
          source: "saisie",
        },
      ]);
    } else {
      setExtras((prev) => prev.filter((m) => m.id !== movementId));
    }
    setDialog(null);
    notify(`Mouvement retiré pour ${product.name}.`);
  }

  /* ---------- produits : ajouter, modifier, supprimer ---------- */

  const openAdd = () =>
    guard("ajouter un produit", () => {
      setDrawerId(null);
      setProductForm({ mode: "add" });
    });

  const openEdit = (id: string) =>
    guard("modifier un produit", () => {
      setDrawerId(null);
      setProductForm({ mode: "edit", id });
    });

  const askDelete = (id: string) =>
    guard("supprimer un produit", () => {
      setDrawerId(null);
      setDeleteId(id);
    });

  function checkEdit(next: Product) {
    const day = findNegativeDay(allMovements, next);
    if (!day) return null;
    return `Avec ${next.uniteLot} ${next.unitPlural} par ${next.lotLabel}, le stock serait négatif le ${day.split("-").reverse().join("/")} : les ventes enregistrées dépassent les entrées. Augmentez l'unité par lot.`;
  }

  function saveProduct(next: Product, initial?: { lots: number; date: string }) {
    const before = catalogMap.get(next.id);
    setProductForm(null);
    if (before) {
      setCatalog((prev) => prev.map((p) => (p.id === next.id ? next : p)));
      const changes: string[] = [];
      if (before.uniteLot !== next.uniteLot)
        changes.push(`unité/lot ${before.uniteLot} → ${next.uniteLot}`);
      if (before.prixAchat !== next.prixAchat)
        changes.push(`prix d'achat ${fcfa(before.prixAchat)} → ${fcfa(next.prixAchat)}`);
      if (before.prixUnitaire !== next.prixUnitaire)
        changes.push(`prix unitaire ${fcfa(before.prixUnitaire)} → ${fcfa(next.prixUnitaire)}`);
      if (before.category !== next.category) changes.push(`rayon ${before.category} → ${next.category}`);
      if (before.name !== next.name) changes.push(`nom ${before.name} → ${next.name}`);
      if (changes.length === 0) {
        notify(`${next.name} modifié. Les calculs sont à jour.`, () =>
          setCatalog((prev) => prev.map((p) => (p.id === next.id ? before : p))),
        );
        return;
      }
      log("produit-modif", `Produit modifié : ${next.name}`, changes.join(" · "));
      notify(`${next.name} modifié. Les calculs sont à jour.`, () =>
        setCatalog((prev) => prev.map((p) => (p.id === next.id ? before : p))),
      );
      return;
    }
    const movement: Movement | null =
      initial && initial.lots > 0
        ? {
            id: `saisie-${Date.now()}`,
            source: "saisie",
            date: initial.date,
            productId: next.id,
            qteEntree: initial.lots,
            qteSortie: 0,
          }
        : null;
    setCatalog((prev) => [...prev, next]);
    if (movement) setExtras((prev) => [...prev, movement]);
    if (movement && movement.date > range.end) {
      setPreset("30");
      setBucketOverride(null);
    }
    setSegment("Tous");
    setCategory("Toutes");
    setQuery("");
    setStock("tous");
    setFocusId(next.id);
    notify(`${next.name} ajouté au catalogue.`, () => {
      setCatalog((prev) => prev.filter((p) => p.id !== next.id));
      setExtras((prev) => prev.filter((m) => m.productId !== next.id));
    });
    scrollToProduct(next.id, 200);
  }

  function deleteProduct() {
    const product = deleteProductTarget;
    if (!product) return;
    const position = catalog.findIndex((p) => p.id === product.id);
    const removed = extras.filter((m) => m.productId === product.id);
    setDeleteId(null);
    setDrawerId(null);
    setFocusId((cur) => (cur === product.id ? null : cur));
    setCatalog((prev) => prev.filter((p) => p.id !== product.id));
    setExtras((prev) => prev.filter((m) => m.productId !== product.id));
    notify(`${product.name} supprimé du catalogue.`, () => {
      setCatalog((prev) => {
        const copy = [...prev];
        copy.splice(Math.min(position, copy.length), 0, product);
        return copy;
      });
      setExtras((prev) => [...prev, ...removed]);
    });
  }

  function onSort(key: SortKey, dir?: "asc" | "desc") {
    setSort((cur) => {
      if (dir) return { key, dir };
      if (cur.key === key) return { key, dir: cur.dir === "asc" ? "desc" : "asc" };
      return { key, dir: key === "name" ? "asc" : "desc" };
    });
  }

  function download() {
    setPdfBusy(true);
    try {
      const stockLabel =
        stock === "tous" ? "Tous" : stock === "ok" ? "En stock" : stock === "bas" ? "Stock bas" : "Rupture";
      exportStockPdf({
        rows: sorted,
        totals: model.totals,
        start: range.start,
        end: range.end,
        segment,
        category,
        query,
        stock: stockLabel,
        generatedAt: new Date().toLocaleString("fr-FR", { dateStyle: "long", timeStyle: "short" }),
      });
      log(
        "pdf",
        "Export PDF de l'état des stocks",
        `${sorted.length} ligne${sorted.length > 1 ? "s" : ""} · ${formatShort(range.start)} — ${formatShort(range.end)} · caisse ${fcfa(model.totals.caisse)}`,
      );
      notify("PDF téléchargé — le tableau suit le filtre en cours.");
    } catch {
      notify("Le PDF n'a pas pu être généré.");
    } finally {
      setPdfBusy(false);
    }
  }

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

  if (view === "inspector") {
    return (
      <InspectorView
        onAdminAccess={() => {
          setAuthReason("accéder à l'interface administrateur");
          setView("admin");
          try {
            window.location.hash = "#admin";
          } catch {}
        }}
      />
    );
  }

  return (
    <div className="min-h-screen">
      <a
        href="#tableau"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-[var(--card)] focus:px-3 focus:py-2"
      >
        Aller au tableau
      </a>
      <header className="topbar sticky top-0 z-40 border-b border-[var(--line)]">
        <div className="mx-auto flex max-w-[1280px] flex-wrap items-center gap-2 px-3 py-2 sm:px-4 sm:gap-3 sm:py-3 md:px-6">
          <ShopLogo className="h-8 w-8 sm:h-9 sm:w-9" />
          <div className="min-w-0 flex-1 sm:flex-none">
            <p className="font-display text-base leading-none sm:text-lg">La Terrasse</p>
            <p className="truncate text-[11px] text-[var(--muted)] sm:text-xs">Comptoir · stocks bar & épicerie · {PLACE}</p>
          </div>
          <p className="hidden text-sm capitalize text-[var(--muted)] lg:ml-auto lg:block">{clock}</p>
          <div className="ml-auto flex flex-wrap items-center justify-end gap-1.5 sm:gap-2 lg:ml-0">
            <button
              type="button"
              className="btn btn-ghost btn-tiny"
              onClick={() => setDark((v) => !v)}
              aria-pressed={dark}
              aria-label={dark ? "Activer le mode clair" : "Activer le mode sombre"}
            >
              {dark ? "Clair" : "Sombre"}
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-tiny"
              onClick={() => {
                setView("inspector");
                try {
                  window.location.hash = "";
                } catch {}
              }}
            >
              Vue consultation
            </button>
            {user ? (
              <>
                <span
                  className="flex items-center gap-1.5 rounded-full border border-[var(--line)] py-0.5 pl-0.5 pr-2 text-xs sm:gap-2 sm:py-1 sm:pl-1 sm:pr-3 sm:text-sm"
                  title={user.email}
                >
                  <span className="grid h-6 w-6 place-items-center rounded-full bg-[var(--ink)] text-[10px] font-semibold text-[var(--paper)] sm:h-7 sm:w-7 sm:text-xs">
                    {user.name.slice(0, 1).toUpperCase()}
                  </span>
                  <span className="hidden max-w-[90px] truncate sm:inline md:max-w-[110px]">{user.name}</span>
                </span>
                <button type="button" className="btn btn-ghost btn-tiny" onClick={logout}>
                  Déconnexion
                </button>
              </>
            ) : (
              <button
                type="button"
                className="btn btn-ghost btn-tiny"
                onClick={() => setAuthReason("modifier le catalogue et les stocks")}
              >
                <LockIcon className="h-3.5 w-3.5" /> <span className="hidden xs:inline sm:inline">Connexion</span>
              </button>
            )}
            <button type="button" className="btn btn-primary btn-tiny sm:btn" onClick={download} disabled={pdfBusy}>
              <DownloadIcon />
              <span className="hidden sm:inline">{pdfBusy ? "Préparation…" : "Télécharger PDF"}</span>
              <span className="sm:hidden">PDF</span>
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
            Gestion des stocks
            <span className="block italic text-[#e3a45c]">Bar & Épicerie</span>
          </h1>
          <p className="mt-3 flex flex-wrap items-center gap-1.5 text-xs text-[#f6f1e8]/85 sm:mt-4 sm:gap-2 sm:text-sm">
            <span className="inline-flex items-center gap-1 rounded-full border border-[#e3a45c]/50 px-2 py-0.5 sm:gap-1.5 sm:px-2.5 sm:py-1">
              <BeerLogo className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-[#e3a45c]" /> Bar
            </span>
            <span className="inline-flex items-center gap-1 rounded-full border border-[#e3a45c]/50 px-2 py-0.5 sm:gap-1.5 sm:px-2.5 sm:py-1">
              <GroceryLogo className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-[#e3a45c]" /> Épicerie
            </span>
            <span className="inline-flex items-center gap-1 rounded-full border border-[#e3a45c]/50 px-2 py-0.5 sm:gap-1.5 sm:px-2.5 sm:py-1">
              <StockLogo className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-[#e3a45c]" /> {catalog.length} produits
            </span>
            <span className="inline-flex items-center gap-1 rounded-full border border-[#e3a45c]/50 px-2 py-0.5 sm:gap-1.5 sm:px-2.5 sm:py-1">
              <CashLogo className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-[#e3a45c]" /> <span className="tabular">{compact(model.totals.caisse)} FCFA</span>
            </span>
          </p>
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
                  onClick={() => chooseSegment(item)}
                >
                  {item}
                </button>
              ))}
            </div>
            <label className="text-sm text-[var(--muted)]">
              <span className="sr-only">État du stock</span>
              <select className="field w-auto" value={stock} onChange={(e) => setStock(e.target.value as StockFilter)}>
                <option value="tous">Tout le stock</option>
                <option value="ok">En stock</option>
                <option value="bas">Stock bas</option>
                <option value="rupture">Rupture</option>
              </select>
            </label>
            <label className="relative min-w-[180px] flex-1">
              <span className="sr-only">Rechercher un produit</span>
              <input
                className="field w-full"
                placeholder="Rechercher Kadji, riz, savon…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </label>
            {query || segment !== "Tous" || category !== "Toutes" || stock !== "tous" || preset !== "30" ? (
              <button
                type="button"
                className="btn btn-ghost btn-tiny"
                onClick={() => {
                  setPreset("30");
                  setSegment("Tous");
                  setCategory("Toutes");
                  setQuery("");
                  setStock("tous");
                  setBucketOverride(null);
                }}
              >
                Réinitialiser
              </button>
            ) : null}
          </div>
          <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
            <button type="button" className="chip" aria-pressed={category === "Toutes"} onClick={() => setCategory("Toutes")}>
              Toutes
            </button>
            {visibleCategories.map((item) => (
              <button key={item} type="button" className="chip" aria-pressed={category === item} onClick={() => chooseCategory(item)}>
                <span className="mr-1 inline-block h-2 w-2 rounded-full" style={{ background: CATEGORY_COLORS[item] }} />
                {item}
              </button>
            ))}
          </div>
        </section>

        <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-[var(--muted)]">
          <span className="inline-flex items-center gap-2">
            <CashLogo className="h-4 w-4 text-[var(--amber)]" /> {catalog.length} produits
          </span>
          <span className="inline-flex items-center gap-2">
            <BeerLogo className="h-4 w-4 text-[var(--amber)]" /> {model.rows.filter((r) => r.product.segment === "Bar").length} au bar
          </span>
          <span className="inline-flex items-center gap-2">
            <GroceryLogo className="h-4 w-4 text-[var(--amber)]" /> {model.rows.filter((r) => r.product.segment === "Épicerie").length} à l'épicerie
          </span>
          <span className="inline-flex items-center gap-2">
            <StockLogo className="h-4 w-4 text-[var(--amber)]" /> <span className="tabular">{fmt(model.totals.reste)}</span> unités en stock
          </span>
          <span className="inline-flex items-center gap-2">
            <JournalLogo className="h-4 w-4 text-[var(--amber)]" />
            <span className="tabular">{journal.length}</span> opération{journal.length > 1 ? "s" : ""} dans l'historique
            {KIND_LABEL.sortie ? "" : ""}
          </span>
        </div>

        <section className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3" aria-label="Indicateurs">
          <KpiCard
            label="Argent en caisse"
            value={model.totals.caisse}
            format={fcfa}
            previous={model.prev.caisse}
            reliable={model.trendReliable}
            spark={model.daily.map((d) => d.caisse)}
            accent="#d4832a"
            delay={0}
          />
          <KpiCard
            label="Bénéfice réalisé"
            value={model.totals.beneficeRealise}
            format={fcfa}
            previous={model.prev.beneficeRealise}
            reliable={model.trendReliable}
            spark={model.daily.map((d) => d.benefice)}
            accent="#2f9a62"
            delay={60}
          />
          <KpiCard
            label="Valeur du stock"
            value={model.totals.valeurAchats}
            format={fcfa}
            previous={model.prev.valeurAchats}
            reliable={model.trendReliable}
            spark={model.daily.map((d) => d.achats)}
            accent="#8d4d32"
            tone="neutral"
            delay={120}
          />
          <KpiCard
            label="Stock au coût"
            value={model.totals.stockCout}
            format={fcfa}
            previous={model.prev.stockCout}
            reliable={model.trendReliable}
            spark={model.daily.map((d) => d.stockCout)}
            accent="#3d8eb5"
            tone="neutral"
            delay={180}
          />
          <KpiCard
            label="Unités vendues"
            value={model.totals.unites}
            format={fmt}
            previous={model.prev.unites}
            reliable={model.trendReliable}
            spark={model.daily.map((d) => d.unites)}
            accent="#b165a3"
            delay={240}
          />
          <KpiCard
            label="Alertes stock"
            value={model.totals.alertes}
            format={fmt}
            previous={model.prev.alertes}
            reliable={model.trendReliable}
            spark={model.daily.map((d) => d.alertes)}
            accent={model.totals.alertes > 0 ? "#c45b5b" : "#2f9a62"}
            tone="down-good"
            delay={300}
          />
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
            <div className="mb-2 flex gap-4 text-xs text-[var(--muted)]">
              <span className="inline-flex items-center gap-1">
                <span className="inline-block h-2 w-4 rounded-full bg-[var(--amber)]" /> Caisse
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="inline-block h-2 w-4 rounded-full bg-[var(--green)]" /> Bénéfice réalisé
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="inline-block h-0.5 w-4 border-t border-dashed border-[var(--faint)]" /> Période préc.
              </span>
            </div>
            <SalesLineChart points={series} previous={model.trendReliable ? prevSeries : []} mode={lineMode} bucket={bucket} />
          </article>
          <article className="card p-4 sm:p-5 lg:col-span-2">
            <h2 className="font-display text-2xl">Répartition</h2>
            <CategoryDonut
              slices={model.byCategory
                .filter((c) => c.caisse > 0)
                .map((c) => ({
                  id: c.category,
                  label: c.category,
                  value: c.caisse,
                  color: CATEGORY_COLORS[c.category],
                }))}
              activeId={category === "Toutes" ? null : category}
              onSelect={(id) => chooseCategory(id as Category)}
            />
            <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
              <button type="button" className="rounded-xl bg-[var(--well)] px-3 py-2 text-left" onClick={() => chooseSegment("Bar")}>
                <span className="block text-[11px] uppercase tracking-wider text-[var(--faint)]">Bar</span>
                <span className="tabular font-medium">{shareTotal ? Math.round((barCaisse / shareTotal) * 100) : 0} %</span>
                <span className="block text-xs text-[var(--muted)]">{compact(barCaisse)}</span>
              </button>
              <button type="button" className="rounded-xl bg-[var(--well)] px-3 py-2 text-left" onClick={() => chooseSegment("Épicerie")}>
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
              <div>
                <h2 className="font-display text-2xl">Meilleures ventes</h2>
              </div>
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
            <RankBars items={rank} activeId={focusId} onSelect={focusProduct} formatValue={rankMetric === "unites" ? fmt : fcfa} />
          </article>
          <div className="grid gap-4 lg:col-span-2">
            <article className="card p-4">
              <h2 className="font-display text-xl">À surveiller</h2>
              {alerts.length === 0 ? (
                <p className="rounded-xl bg-[var(--green-2)] px-3 py-3 text-sm text-[var(--green)]">
                  Aucun stock bas.
                </p>
              ) : (
                <ul className="space-y-2">
                  {alerts.map((row) => (
                    <li key={row.product.id}>
                      <button
                        type="button"
                        className="flex w-full items-center justify-between gap-3 rounded-xl px-2 py-1.5 text-left hover:bg-[var(--well)]"
                        onClick={() => focusProduct(row.product.id)}
                      >
                        <span>
                          <span className="block font-medium">{row.product.name}</span>
                          <span className="text-xs text-[var(--faint)]">{row.product.category}</span>
                        </span>
                        <span className="text-right text-sm">
                          <span
                            className="block tabular font-semibold"
                            style={{ color: row.status === "rupture" ? "var(--wine)" : "var(--amber)" }}
                          >
                            {fmt(row.reste)} {plural(row.reste, row.product.unitLabel, row.product.unitPlural)}
                          </span>
                          <span className="text-[11px] uppercase tracking-wider text-[var(--faint)]">
                            {row.status === "rupture" ? "Rupture" : "Stock bas"}
                          </span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </article>
            <article className="card p-4">
              <h2 className="font-display text-xl">Mouvements de fin de période</h2>
              <ul className="mt-3 space-y-2 text-sm">
                {activity.length === 0 ? <li className="text-[var(--muted)]">Aucun mouvement.</li> : null}
                {activity.map((item, i) => (
                  <li
                    key={`${item.date}-${item.product.id}-${i}`}
                    className="flex items-baseline justify-between gap-3 border-b border-dashed border-[var(--line)] pb-1.5"
                  >
                    <span>
                      <span className="font-medium">{item.product.name}</span>
                      <span className="block text-[11px] text-[var(--faint)]">{formatShort(item.date)}</span>
                    </span>
                    <span className="text-right tabular text-[var(--muted)]">
                      {item.sortie > 0
                        ? `−${fmt(item.sortie)} ${plural(item.sortie, item.product.unitLabel, item.product.unitPlural)}`
                        : null}
                      {item.entree > 0
                        ? ` +${fmt(item.entree)} ${plural(item.entree, item.product.lotLabel, item.product.lotPlural)}`
                        : null}
                    </span>
                  </li>
                ))}
              </ul>
            </article>
          </div>
        </section>

        <StockTable
          rows={sorted}
          sort={sort}
          onSort={onSort}
          onSell={sell}
          onReceive={receive}
          onEditMovement={editMovement}
          onOpen={focusProduct}
          onAdd={openAdd}
          onEdit={openEdit}
          onDelete={askDelete}
          onLogin={() => setAuthReason("modifier le catalogue et les stocks")}
          signedIn={Boolean(user)}
          focusId={focusId}
          totals={model.totals}
          onDownload={download}
          busy={pdfBusy}
        />

        <JournalPanel
          entries={journal}
          onClear={() => {
            const snapshot = journal;
            setJournal([]);
            notify("Historique vidé.", () => setJournal(snapshot));
          }}
        />
      </main>

      <footer className="mx-auto max-w-[1280px] px-4 py-8 text-sm text-[var(--muted)] sm:px-6">
        La Terrasse · {catalog.length} produits
      </footer>

      {dialog ? (
        <MovementDialog
          products={catalog}
          movements={allMovements}
          productId={dialog.productId}
          kind={dialog.kind}
          defaultDate={
            dialog.mode === "edit"
              ? (allMovements.find((m) => m.id === dialog.movementId)?.date ?? range.end)
              : range.end
          }
          initialQty={
            dialog.mode === "edit"
              ? ((() => {
                  const current = allMovements.find((m) => m.id === dialog.movementId);
                  return dialog.kind === "entree" ? current?.qteEntree ?? 1 : current?.qteSortie ?? 1;
                })())
              : 1
          }
          mode={dialog.mode}
          movementId={dialog.mode === "edit" ? dialog.movementId : null}
          title={dialog.mode === "edit" ? `Modifier ${dialog.kind === "entree" ? "l'entrée" : "la sortie"}` : undefined}
          submitLabel={dialog.mode === "edit" ? "Mettre à jour" : undefined}
          onClose={() => setDialog(null)}
          onSubmit={(draft) => {
            if (dialog.mode === "edit") updateMovement(dialog.movementId, draft);
            else commitMovement(draft);
          }}
          onDelete={dialog.mode === "edit" ? () => removeMovement(dialog.movementId) : undefined}
        />
      ) : null}

      {drawerRow ? (
        <ProductDrawer
          row={drawerRow}
          onClose={() => setDrawerId(null)}
          onSell={() => sell(drawerRow.product.id)}
          onReceive={() => receive(drawerRow.product.id)}
          onEditEntry={() => editMovement(drawerRow.product.id, "entree")}
          onEditExit={() => editMovement(drawerRow.product.id, "sortie")}
          onEdit={() => openEdit(drawerRow.product.id)}
          onDelete={() => askDelete(drawerRow.product.id)}
        />
      ) : null}

      {productForm && (productForm.mode === "add" || formProduct) ? (
        <ProductFormDialog
          key={productForm.mode === "edit" ? productForm.id : "new"}
          mode={productForm.mode}
          product={formProduct}
          catalog={catalog}
          checkEdit={checkEdit}
          onSubmit={saveProduct}
          onClose={() => setProductForm(null)}
        />
      ) : null}

      {deleteProductTarget ? (
        <ConfirmDialog
          title={`Supprimer ${deleteProductTarget.name} ?`}
          confirmLabel="Supprimer"
          danger
          onConfirm={deleteProduct}
          onCancel={() => setDeleteId(null)}
        >
          <p>
            Le produit disparaît du catalogue, du tableau, des graphiques et du PDF, avec ses{" "}
            {fmt(allMovements.filter((m) => m.productId === deleteProductTarget.id).length)} mouvements.
          </p>
          <p className="mt-2">Vous pourrez annuler juste après la suppression.</p>
        </ConfirmDialog>
      ) : null}

      {authReason ? (
        <AuthDialog
          reason={authReason}
          onClose={closeAuth}
          onAuthed={(session) => {
            handleAuthed(session);
            if (view !== "admin") {
              setView("admin");
              try {
                window.location.hash = "#admin";
              } catch {}
            }
          }}
        />
      ) : null}

      {toast ? (
        <div
          className="fixed bottom-4 left-1/2 z-[90] flex w-[min(92vw,460px)] -translate-x-1/2 items-center justify-between gap-3 rounded-2xl bg-[var(--ink)] px-4 py-3 text-sm text-[var(--paper)] shadow-xl"
          role="status"
        >
          <p>{toast.text}</p>
          {toast.undo ? (
            <button
              type="button"
              className="shrink-0 font-semibold text-[var(--amber-3)]"
              onClick={() => {
                toast.undo?.();
                setToast(null);
              }}
            >
              Annuler
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function DownloadIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M12 4v11" strokeLinecap="round" />
      <path d="M7 11l5 5 5-5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5 20h14" strokeLinecap="round" />
    </svg>
  );
}
