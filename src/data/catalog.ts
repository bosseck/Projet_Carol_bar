import type { Category, Product, Segment } from "../types";

export const CATEGORY_COLORS: Record<Category, string> = {
  Bières: "#d4832a",
  "Softs & eaux": "#3d8eb5",
  Spiritueux: "#b165a3",
  Vins: "#c45b5b",
  "Épicerie sèche": "#3e9a68",
  Snacks: "#d4a24a",
  Hygiène: "#4f9d92",
};

export const CATEGORIES: Category[] = [
  "Bières",
  "Softs & eaux",
  "Spiritueux",
  "Vins",
  "Épicerie sèche",
  "Snacks",
  "Hygiène",
];

export function categorySegment(category: Category): Segment {
  return category === "Épicerie sèche" || category === "Snacks" || category === "Hygiène" ? "Épicerie" : "Bar";
}

const beer = {
  segment: "Bar" as const,
  category: "Bières" as const,
  lotLabel: "casier",
  lotPlural: "casiers",
  unitLabel: "bouteille",
  unitPlural: "bouteilles",
};

const soft = {
  segment: "Bar" as const,
  category: "Softs & eaux" as const,
  lotLabel: "casier",
  lotPlural: "casiers",
  unitLabel: "bouteille",
  unitPlural: "bouteilles",
};

const snack = {
  segment: "Épicerie" as const,
  category: "Snacks" as const,
  lotLabel: "carton",
  lotPlural: "cartons",
  unitLabel: "unité",
  unitPlural: "unités",
};

const grocery = {
  segment: "Épicerie" as const,
  category: "Épicerie sèche" as const,
  lotLabel: "carton",
  lotPlural: "cartons",
  unitLabel: "unité",
  unitPlural: "unités",
};

// Produits et prix repris des tableaux transmis pour le comptoir.
export const PRODUCTS: Product[] = [
  { id: "american-cola", name: "American cola", detail: "", uniteLot: 6, prixAchat: 2500, prixUnitaire: 500, ...soft },
  { id: "aspen", name: "Aspen", detail: "", uniteLot: 20, prixAchat: 800, prixUnitaire: 50, ...snack },
  { id: "benson", name: "Benson", detail: "", uniteLot: 20, prixAchat: 800, prixUnitaire: 50, ...snack },
  { id: "biscuit-delice", name: "Biscuit Delice", detail: "", uniteLot: 35, prixAchat: 1650, prixUnitaire: 50, ...snack },
  { id: "biscuit-naya", name: "Biscuit Naya", detail: "", uniteLot: 27, prixAchat: 1250, prixUnitaire: 50, ...snack },
  { id: "black-bgt", name: "Black + BGT", detail: "", uniteLot: 12, prixAchat: 7800, prixUnitaire: 700, ...beer },
  { id: "bonbon-acolise", name: "Bonbon Acolise", detail: "", uniteLot: 100, prixAchat: 1800, prixUnitaire: 25, ...snack, unitLabel: "bonbon", unitPlural: "bonbons" },
  { id: "bonbon-au-lait", name: "Bonbon au lait", detail: "", uniteLot: 30, prixAchat: 600, prixUnitaire: 25, ...snack, unitLabel: "bonbon", unitPlural: "bonbons" },
  { id: "bonbon-coeur", name: "Bonbon Coeur", detail: "", uniteLot: 45, prixAchat: 1000, prixUnitaire: 25, ...snack, unitLabel: "bonbon", unitPlural: "bonbons" },
  { id: "bonbon-djindja", name: "Bonbon Djindja", detail: "", uniteLot: 40, prixAchat: 950, prixUnitaire: 25, ...snack, unitLabel: "bonbon", unitPlural: "bonbons" },
  { id: "bonbon-football", name: "Bonbon Football", detail: "", uniteLot: 111, prixAchat: 1500, prixUnitaire: 25, ...snack, unitLabel: "bonbon", unitPlural: "bonbons" },
  { id: "bonbon-tomtom", name: "Bonbon TomTom", detail: "", uniteLot: 25, prixAchat: 500, prixUnitaire: 25, ...snack, unitLabel: "bonbon", unitPlural: "bonbons" },
  { id: "coca-cola", name: "Coca-Cola", detail: "", uniteLot: 6, prixAchat: 3100, prixUnitaire: 600, ...soft },
  { id: "cube-crevette", name: "Cube Crevette", detail: "", uniteLot: 100, prixAchat: 1700, prixUnitaire: 25, ...grocery, unitLabel: "cube", unitPlural: "cubes" },
  { id: "cube-magi", name: "Cube Magi", detail: "", uniteLot: 50, prixAchat: 900, prixUnitaire: 25, ...grocery, unitLabel: "cube", unitPlural: "cubes" },
  { id: "ice", name: "ICE", detail: "", uniteLot: 12, prixAchat: 7800, prixUnitaire: 700, ...beer },
  { id: "isembeck", name: "Isembeck", detail: "", uniteLot: 6, prixAchat: 4450, prixUnitaire: 800, ...beer },
  { id: "kadji", name: "Kadji", detail: "", uniteLot: 12, prixAchat: 7800, prixUnitaire: 700, ...beer },
  { id: "mutzic", name: "Mutzic", detail: "", uniteLot: 6, prixAchat: 3900, prixUnitaire: 700, ...beer },
  { id: "opur", name: "Opur", detail: "", uniteLot: 18, prixAchat: 3600, prixUnitaire: 250, ...soft },
  { id: "orangina", name: "Orangina", detail: "", uniteLot: 6, prixAchat: 4100, prixUnitaire: 700, ...soft },
  { id: "origine", name: "Origine", detail: "", uniteLot: 6, prixAchat: 3900, prixUnitaire: 700, ...beer },
  { id: "paquet-allumette", name: "Paquet d'allumette", detail: "", uniteLot: 40, prixAchat: 850, prixUnitaire: 25, ...grocery, unitLabel: "paquet", unitPlural: "paquets" },
  { id: "petite-guiness", name: "Petite Guiness", detail: "", uniteLot: 12, prixAchat: 7800, prixUnitaire: 700, ...beer },
  { id: "planet-chapman", name: "Planet Chapman 1.25L", detail: "", uniteLot: 6, prixAchat: 2400, prixUnitaire: 500, ...soft },
  { id: "planet-fruits-rouge", name: "Planet Fruits Rouge", detail: "", uniteLot: 12, prixAchat: 4800, prixUnitaire: 500, ...soft },
  { id: "planet-tropical", name: "Planet Tropical", detail: "", uniteLot: 6, prixAchat: 2400, prixUnitaire: 500, ...soft },
  { id: "planet-cocktail", name: "Planet Cocktail", detail: "", uniteLot: 6, prixAchat: 2400, prixUnitaire: 500, ...soft },
  { id: "reakto", name: "Reakto", detail: "", uniteLot: 15, prixAchat: 4500, prixUnitaire: 350, ...snack },
  { id: "savon", name: "Savon", detail: "", uniteLot: 15, prixAchat: 5500, prixUnitaire: 400, segment: "Épicerie", category: "Hygiène", lotLabel: "carton", lotPlural: "cartons", unitLabel: "savon", unitPlural: "savons" },
  { id: "shungum-maxi", name: "Shungum Maxi", detail: "", uniteLot: 30, prixAchat: 400, prixUnitaire: 25, ...snack },
  { id: "shungum-maxi-mentol", name: "Shungum Maxi mentol", detail: "", uniteLot: 30, prixAchat: 400, prixUnitaire: 25, ...snack },
  { id: "spaghetti", name: "Spaghetti", detail: "", uniteLot: 10, prixAchat: 3500, prixUnitaire: 500, ...grocery, unitLabel: "paquet", unitPlural: "paquets" },
  { id: "supermont", name: "Supermont", detail: "", uniteLot: 18, prixAchat: 4050, prixUnitaire: 350, ...soft },
  { id: "top-ananas", name: "Top Ananas", detail: "", uniteLot: 6, prixAchat: 2500, prixUnitaire: 500, ...soft },
  { id: "top-grenadine", name: "Top Grenadine", detail: "", uniteLot: 6, prixAchat: 2500, prixUnitaire: 500, ...soft },
  { id: "top-orange", name: "Top Orange", detail: "", uniteLot: 6, prixAchat: 2500, prixUnitaire: 500, ...soft },
  { id: "top-pamplemousse", name: "Top Pamplemousse", detail: "", uniteLot: 6, prixAchat: 2500, prixUnitaire: 500, ...soft },
  { id: "tym", name: "Tym", detail: "", uniteLot: 20, prixAchat: 800, prixUnitaire: 50, ...snack },
  { id: "ucb", name: "UCB", detail: "", uniteLot: 6, prixAchat: 3200, prixUnitaire: 600, ...beer },
];

export const INITIAL_INVENTORY: Record<string, { qteEntree: number; qteSortie: number }> = {
  "bonbon-acolise": { qteEntree: 2, qteSortie: 0 },
  "planet-fruits-rouge": { qteEntree: 1, qteSortie: 2 },
};

export const PRODUCT_MAP = new Map(PRODUCTS.map((p) => [p.id, p]));
