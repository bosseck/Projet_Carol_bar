import { randomHex } from "./crypto";
import { formatLong } from "./dates";

export type JournalKind =
  | "connexion"
  | "deconnexion"
  | "inscription"
  | "produit-ajout"
  | "produit-modif"
  | "produit-suppression"
  | "entree"
  | "sortie"
  | "mouvement-modif"
  | "mouvement-suppression"
  | "pdf";

export interface JournalEntry {
  id: string;
  at: string;
  kind: JournalKind;
  label: string;
  detail: string;
  user: string;
}

const KEY = "terrasse-journal-v1";
const LIMIT = 400;

export const KIND_LABEL: Record<JournalKind, string> = {
  connexion: "Connexion",
  deconnexion: "Déconnexion",
  inscription: "Inscription",
  "produit-ajout": "Produit ajouté",
  "produit-modif": "Produit modifié",
  "produit-suppression": "Produit supprimé",
  entree: "Entrée de stock",
  sortie: "Vente",
  "mouvement-modif": "Quantité modifiée",
  "mouvement-suppression": "Mouvement supprimé",
  pdf: "Export PDF",
};

export const KIND_TONE: Record<JournalKind, "in" | "out" | "edit" | "danger" | "neutral"> = {
  connexion: "neutral",
  deconnexion: "neutral",
  inscription: "neutral",
  "produit-ajout": "in",
  "produit-modif": "edit",
  "produit-suppression": "danger",
  entree: "in",
  sortie: "out",
  "mouvement-modif": "edit",
  "mouvement-suppression": "danger",
  pdf: "neutral",
};

export function isJournalEntry(x: unknown): x is JournalEntry {
  if (!x || typeof x !== "object") return false;
  const e = x as Record<string, unknown>;
  return (
    typeof e.id === "string" &&
    typeof e.at === "string" &&
    typeof e.kind === "string" &&
    typeof e.label === "string" &&
    typeof e.detail === "string" &&
    typeof e.user === "string"
  );
}

export function loadJournal(): JournalEntry[] {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || "[]");
    if (!Array.isArray(raw)) return [];
    return raw.filter(isJournalEntry);
  } catch {
    return [];
  }
}

export function saveJournal(entries: JournalEntry[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(entries.slice(0, LIMIT)));
  } catch {
    /* stockage indisponible */
  }
}

export interface Draft {
  kind: JournalKind;
  label: string;
  detail: string;
}

export function makeEntry(draft: Draft, user: string): JournalEntry {
  return {
    id: `j-${Date.now().toString(36)}-${randomHex(3)}`,
    at: new Date().toISOString(),
    kind: draft.kind,
    label: draft.label,
    detail: draft.detail,
    user: user || "anonyme",
  };
}

/** Ajoute une opération en tête de journal (400 dernières conservées). */
export function pushEntry(entries: JournalEntry[], draft: Draft, user: string): JournalEntry[] {
  return [makeEntry(draft, user), ...entries].slice(0, LIMIT);
}

export function formatStamp(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatDayLabel(iso: string) {
  return formatLong(iso.slice(0, 10));
}

export function groupByDay(entries: JournalEntry[]) {
  const groups: { day: string; items: JournalEntry[] }[] = [];
  for (const entry of entries) {
    const day = entry.at.slice(0, 10);
    const last = groups[groups.length - 1];
    if (last && last.day === day) last.items.push(entry);
    else groups.push({ day, items: [entry] });
  }
  return groups;
}
