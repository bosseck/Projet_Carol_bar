import { INITIAL_INVENTORY, PRODUCTS } from "./catalog";
import { TODAY_ISO } from "../lib/dates";
import type { Movement } from "../types";

// Stock initial repris des tableaux transmis. Planet Fruits Rouge a déjà deux sorties.
export const SEED_MOVEMENTS: Movement[] = PRODUCTS.map((product) => {
  const initial = INITIAL_INVENTORY[product.id] ?? { qteEntree: 1, qteSortie: 0 };
  return {
    id: `initial-${product.id}`,
    date: TODAY_ISO,
    productId: product.id,
    qteEntree: initial.qteEntree,
    qteSortie: initial.qteSortie,
    source: "seed",
  };
});
