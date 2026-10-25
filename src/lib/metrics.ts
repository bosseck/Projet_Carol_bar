import { PRODUCT_MAP } from "../data/catalog";
import {
  HISTORY_START_ISO,
  TODAY_ISO,
  eachDate,
  inclusiveDays,
  parseISO,
  previousWindow,
} from "./dates";
import type { Movement, Product, StockFilter } from "../types";

export interface LineMath {
  reste: number;
  beneficeLot: number;
  beneficeUnite: number;
  beneficeRealise: number;
  caisse: number;
  valeurAchats: number;
  stockCout: number;
}

export function computeLine(
  product: Pick<Product, "uniteLot" | "prixAchat" | "prixUnitaire">,
  qteEntree: number,
  qteSortie: number,
  stockDebut = 0,
): LineMath {
  const reste = stockDebut + qteEntree * product.uniteLot - qteSortie;
  const beneficeLot = product.uniteLot * product.prixUnitaire - product.prixAchat;
  const beneficeUnite = product.uniteLot === 0 ? 0 : beneficeLot / product.uniteLot;
  return {
    reste,
    beneficeLot,
    beneficeUnite,
    beneficeRealise: beneficeUnite * qteSortie,
    caisse: qteSortie * product.prixUnitaire,
    valeurAchats: qteEntree * product.prixAchat,
    stockCout: product.uniteLot === 0 ? 0 : (reste / product.uniteLot) * product.prixAchat,
  };
}

export interface DayCell {
  e: number;
  s: number;
  stockEnd: number;
}

export interface StockIndex {
  days: string[];
  dayPos: Map<string, number>;
  byProduct: Map<string, DayCell[]>;
}

export function buildIndex(products: Product[], movements: Movement[]): StockIndex {
  const days = eachDate(HISTORY_START_ISO, TODAY_ISO);
  const dayPos = new Map(days.map((d, i) => [d, i]));
  const events = new Map<string, { e: number; s: number }>();
  for (const m of movements) {
    const key = `${m.productId}|${m.date}`;
    const cur = events.get(key) ?? { e: 0, s: 0 };
    cur.e += m.qteEntree;
    cur.s += m.qteSortie;
    events.set(key, cur);
  }
  const byProduct = new Map<string, DayCell[]>();
  for (const product of products) {
    const arr: DayCell[] = [];
    let stock = 0;
    for (const d of days) {
      const ev = events.get(`${product.id}|${d}`) ?? { e: 0, s: 0 };
      stock += ev.e * product.uniteLot - ev.s;
      arr.push({ e: ev.e, s: ev.s, stockEnd: stock });
    }
    byProduct.set(product.id, arr);
  }
  return { days, dayPos, byProduct };
}

export interface ProductRow {
  product: Product;
  qteEntree: number;
  qteSortie: number;
  stockDebut: number;
  reste: number;
  beneficeLot: number;
  beneficeUnite: number;
  beneficeRealise: number;
  caisse: number;
  valeurAchats: number;
  stockCout: number;
  status: "ok" | "bas" | "rupture";
}

export interface Totals {
  caisse: number;
  beneficeRealise: number;
  valeurAchats: number;
  stockCout: number;
  unites: number;
  qteEntree: number;
  reste: number;
  alertes: number;
  ruptures: number;
  stockBas: number;
  sommePrixAchat: number;
  produits: number;
}

export interface DailyPoint {
  date: string;
  caisse: number;
  benefice: number;
  unites: number;
  achats: number;
  stockCout: number;
  alertes: number;
}

export interface DashboardModel {
  rows: ProductRow[];
  totals: Totals;
  prev: Totals;
  daily: DailyPoint[];
  prevDaily: DailyPoint[];
  trendReliable: boolean;
  byCategory: { category: Product["category"]; caisse: number; benefice: number; unites: number }[];
  partialOpening: boolean;
}

export interface QueryFilters {
  start: string;
  end: string;
  segment: "Tous" | Product["segment"];
  category: "Toutes" | Product["category"];
  query: string;
  stock: StockFilter;
}

function emptyTotals(): Totals {
  return {
    caisse: 0,
    beneficeRealise: 0,
    valeurAchats: 0,
    stockCout: 0,
    unites: 0,
    qteEntree: 0,
    reste: 0,
    alertes: 0,
    ruptures: 0,
    stockBas: 0,
    sommePrixAchat: 0,
    produits: 0,
  };
}

function statusOf(reste: number, uniteLot: number): ProductRow["status"] {
  if (reste <= 0) return "rupture";
  if (reste < uniteLot) return "bas";
  return "ok";
}

function rangeSlice(index: StockIndex, start: string, end: string) {
  const a = index.dayPos.get(start);
  const b = index.dayPos.get(end);
  if (a === undefined || b === undefined) return null;
  return { from: Math.min(a, b), to: Math.max(a, b) };
}

function sumFlow(arr: DayCell[], from: number, to: number) {
  let e = 0;
  let s = 0;
  for (let i = from; i <= to; i++) {
    e += arr[i].e;
    s += arr[i].s;
  }
  const stockDebut = from > 0 ? arr[from - 1].stockEnd : 0;
  const stockFin = arr[to].stockEnd;
  return { e, s, stockDebut, stockFin };
}

function totalsFrom(rows: ProductRow[], stockFinById?: Map<string, number>): Totals {
  const t = emptyTotals();
  t.produits = rows.length;
  for (const row of rows) {
    t.caisse += row.caisse;
    t.beneficeRealise += row.beneficeRealise;
    t.valeurAchats += row.valeurAchats;
    t.unites += row.qteSortie;
    t.qteEntree += row.qteEntree;
    t.sommePrixAchat += row.product.prixAchat;
    const reste = stockFinById ? (stockFinById.get(row.product.id) ?? row.reste) : row.reste;
    t.reste += reste;
    t.stockCout += row.product.uniteLot === 0 ? 0 : (reste / row.product.uniteLot) * row.product.prixAchat;
    const status = statusOf(reste, row.product.uniteLot);
    if (status === "rupture") {
      t.alertes += 1;
      t.ruptures += 1;
    } else if (status === "bas") {
      t.alertes += 1;
      t.stockBas += 1;
    }
  }
  return t;
}

export function queryDashboard(
  index: StockIndex,
  products: Product[],
  filters: QueryFilters,
): DashboardModel {
  const q = filters.query.trim().toLowerCase();
  const pool = products
    .filter((p) => {
      if (filters.segment !== "Tous" && p.segment !== filters.segment) return false;
      if (filters.category !== "Toutes" && p.category !== filters.category) return false;
      if (!q) return true;
      return `${p.name} ${p.detail} ${p.category} ${p.segment}`.toLowerCase().includes(q);
    });

  const slice = rangeSlice(index, filters.start, filters.end);
  const rowsAll: ProductRow[] = [];
  if (slice) {
    for (const product of pool) {
      const arr = index.byProduct.get(product.id);
      if (!arr) continue;
      const flow = sumFlow(arr, slice.from, slice.to);
      const math = computeLine(product, flow.e, flow.s, flow.stockDebut);
      rowsAll.push({
        product,
        qteEntree: flow.e,
        qteSortie: flow.s,
        stockDebut: flow.stockDebut,
        ...math,
        status: statusOf(math.reste, product.uniteLot),
      });
    }
  }

  const rows = rowsAll.filter((row) => {
    if (filters.stock === "tous") return true;
    return row.status === filters.stock;
  });

  const totals = totalsFrom(rows);
  const prevWindow = previousWindow(filters.start, filters.end);
  const prevSlice = rangeSlice(index, prevWindow.start, prevWindow.end);
  const trendReliable = prevWindow.start >= HISTORY_START_ISO && !!prevSlice;

  let prev = emptyTotals();
  const prevDaily: DailyPoint[] = [];
  if (prevSlice) {
    const prevRows: ProductRow[] = [];
    const fin = new Map<string, number>();
    for (const row of rows) {
      const arr = index.byProduct.get(row.product.id);
      if (!arr) continue;
      const flow = sumFlow(arr, prevSlice.from, prevSlice.to);
      const math = computeLine(row.product, flow.e, flow.s, flow.stockDebut);
      prevRows.push({
        product: row.product,
        qteEntree: flow.e,
        qteSortie: flow.s,
        stockDebut: flow.stockDebut,
        ...math,
        status: statusOf(flow.stockFin, row.product.uniteLot),
      });
      fin.set(row.product.id, flow.stockFin);
    }
    prev = totalsFrom(prevRows, fin);
    for (let i = prevSlice.from; i <= prevSlice.to; i++) {
      prevDaily.push(dayPoint(index, rows, i));
    }
  }

  const daily: DailyPoint[] = [];
  if (slice) {
    for (let i = slice.from; i <= slice.to; i++) {
      daily.push(dayPoint(index, rows, i));
    }
  }

  const byCategoryMap = new Map<Product["category"], { caisse: number; benefice: number; unites: number }>();
  for (const row of rows) {
    const cur = byCategoryMap.get(row.product.category) ?? { caisse: 0, benefice: 0, unites: 0 };
    cur.caisse += row.caisse;
    cur.benefice += row.beneficeRealise;
    cur.unites += row.qteSortie;
    byCategoryMap.set(row.product.category, cur);
  }

  return {
    rows,
    totals,
    prev,
    daily,
    prevDaily,
    trendReliable,
    byCategory: [...byCategoryMap.entries()]
      .map(([category, v]) => ({ category, ...v }))
      .sort((a, b) => b.caisse - a.caisse),
    partialOpening: rows.some((r) => r.stockDebut > 0),
  };
}

function dayPoint(index: StockIndex, rows: ProductRow[], dayIndex: number): DailyPoint {
  let caisse = 0;
  let benefice = 0;
  let unites = 0;
  let achats = 0;
  let stockCout = 0;
  let alertes = 0;
  for (const row of rows) {
    const cell = index.byProduct.get(row.product.id)?.[dayIndex];
    if (!cell) continue;
    caisse += cell.s * row.product.prixUnitaire;
    benefice += (row.product.uniteLot === 0 ? 0 : row.beneficeLot / row.product.uniteLot) * cell.s;
    unites += cell.s;
    achats += cell.e * row.product.prixAchat;
    stockCout += row.product.uniteLot === 0 ? 0 : (cell.stockEnd / row.product.uniteLot) * row.product.prixAchat;
    if (cell.stockEnd <= row.product.uniteLot) alertes += 1;
  }
  return {
    date: index.days[dayIndex],
    caisse,
    benefice,
    unites,
    achats,
    stockCout,
    alertes,
  };
}

export function bucketSeries(points: DailyPoint[], mode: "jour" | "semaine"): DailyPoint[] {
  if (mode === "jour" || points.length === 0) return points;
  const groups: DailyPoint[] = [];
  for (const point of points) {
    const date = parseISO(point.date);
    const day = date.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    const monday = new Date(date.getFullYear(), date.getMonth(), date.getDate() + diff);
    const key = `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, "0")}-${String(monday.getDate()).padStart(2, "0")}`;
    let group = groups.find((g) => g.date === key);
    if (!group) {
      group = { date: key, caisse: 0, benefice: 0, unites: 0, achats: 0, stockCout: 0, alertes: 0 };
      groups.push(group);
    }
    group.caisse += point.caisse;
    group.benefice += point.benefice;
    group.unites += point.unites;
    group.achats += point.achats;
    group.stockCout = point.stockCout;
    group.alertes = point.alertes;
  }
  return groups;
}

export interface Validation {
  ok: boolean;
  message: string;
  resteAfter: number;
}

export function validateMovement(
  movements: Movement[],
  product: Product,
  date: string,
  qteEntree: number,
  qteSortie: number,
): Validation {
  if (qteEntree < 0 || qteSortie < 0 || !Number.isFinite(qteEntree) || !Number.isFinite(qteSortie)) {
    return { ok: false, message: "Quantité invalide.", resteAfter: 0 };
  }
  if (qteEntree === 0 && qteSortie === 0) {
    return { ok: false, message: "Indiquez une quantité.", resteAfter: 0 };
  }
  if (qteEntree > 0 && qteSortie > 0) {
    return { ok: false, message: "Une entrée ou une sortie, pas les deux en même temps.", resteAfter: 0 };
  }
  if (!Number.isInteger(qteEntree) || !Number.isInteger(qteSortie)) {
    return { ok: false, message: "Les quantités sont des nombres entiers.", resteAfter: 0 };
  }
  if (date < HISTORY_START_ISO || date > TODAY_ISO) {
    return { ok: false, message: "Choisissez une date dans l'historique, jusqu'à aujourd'hui.", resteAfter: 0 };
  }

  const hypothetical: Movement[] = [
    ...movements,
    { id: "preview", date, productId: product.id, qteEntree, qteSortie, source: "saisie" },
  ];
  let stock = 0;
  let resteAfter = 0;
  const days = eachDate(HISTORY_START_ISO, TODAY_ISO);
  const mine = hypothetical.filter((m) => m.productId === product.id);
  for (const d of days) {
    for (const m of mine) {
      if (m.date === d) stock += m.qteEntree * product.uniteLot - m.qteSortie;
    }
    if (stock < -0.001) {
      return {
        ok: false,
        message: `Stock insuffisant le ${d.split("-").reverse().join("/")}. Des ventes ultérieures dépendent de ces unités.`,
        resteAfter: stock,
      };
    }
    if (d === date) resteAfter = stock;
  }
  return { ok: true, message: "Mouvement possible.", resteAfter };
}

export function stockOnDate(index: StockIndex, productId: string, date: string) {
  const pos = index.dayPos.get(date);
  if (pos === undefined) return 0;
  return index.byProduct.get(productId)?.[pos]?.stockEnd ?? 0;
}

export function recentOutflows(index: StockIndex, rows: ProductRow[], end: string, limit = 6) {
  const pos = index.dayPos.get(end);
  if (pos === undefined) return [];
  const start = Math.max(0, pos - 6);
  const items: { date: string; product: Product; sortie: number; entree: number; caisse: number }[] = [];
  for (let i = pos; i >= start; i--) {
    for (const row of rows) {
      const cell = index.byProduct.get(row.product.id)?.[i];
      if (!cell || (cell.s === 0 && cell.e === 0)) continue;
      items.push({
        date: index.days[i],
        product: row.product,
        sortie: cell.s,
        entree: cell.e,
        caisse: cell.s * row.product.prixUnitaire,
      });
    }
  }
  return items
    .sort((a, b) => b.date.localeCompare(a.date) || b.caisse - a.caisse)
    .slice(0, limit);
}

export function knownProduct(id: string) {
  return PRODUCT_MAP.get(id);
}

export function periodLength(start: string, end: string) {
  return inclusiveDays(start, end);
}

/** Premier jour où le stock du produit passerait sous zéro, ou null si l'historique reste cohérent. */
export function findNegativeDay(movements: Movement[], product: Product): string | null {
  const flow = new Map<string, number>();
  for (const m of movements) {
    if (m.productId !== product.id) continue;
    flow.set(m.date, (flow.get(m.date) ?? 0) + m.qteEntree * product.uniteLot - m.qteSortie);
  }
  let stock = 0;
  for (const day of eachDate(HISTORY_START_ISO, TODAY_ISO)) {
    stock += flow.get(day) ?? 0;
    if (stock < 0) return day;
  }
  return null;
}
