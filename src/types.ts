export type Segment = "Bar" | "Épicerie";

export type Category =
  | "Bières"
  | "Softs & eaux"
  | "Spiritueux"
  | "Vins"
  | "Épicerie sèche"
  | "Snacks"
  | "Hygiène";

export interface Product {
  id: string;
  name: string;
  detail: string;
  segment: Segment;
  category: Category;
  uniteLot: number;
  prixAchat: number;
  prixUnitaire: number;
  lotLabel: string;
  lotPlural: string;
  unitLabel: string;
  unitPlural: string;
}

export interface Movement {
  id: string;
  date: string;
  productId: string;
  qteEntree: number;
  qteSortie: number;
  source: "seed" | "saisie";
}

export interface StoredUser {
  name: string;
  email: string;
  salt: string;
  passHash: string;
  pinHash: string;
  createdAt: string;
}

export interface Session {
  name: string;
  email: string;
}

export type SortKey =
  | "name"
  | "uniteLot"
  | "qteEntree"
  | "qteSortie"
  | "reste"
  | "prixAchat"
  | "prixUnitaire"
  | "beneficeLot"
  | "beneficeRealise"
  | "caisse"
  | "valeurAchats";

export type StockFilter = "tous" | "ok" | "bas" | "rupture";

export type Preset = "7" | "30" | "90" | "month" | "all" | "custom";
