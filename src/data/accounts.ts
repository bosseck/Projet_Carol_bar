import type { StoredUser } from "../types";

// Compte par défaut du comptoir. Seules les empreintes salées (mot de passe et code
// d'accès) sont conservées ici, jamais les valeurs en clair.
export const DEFAULT_ACCOUNT: StoredUser = {
  name: "Tony",
  email: "tonymod237@gmail.com",
  salt: "84189f2fe4de00f065350ff8c6ec9992",
  passHash: "690ba475ea29aeaa8f516214ae4554f3bbd6525fd1545f60c0716678a20d1561",
  pinHash: "cc640bd8e7f05b45a054c47cbd0bc056542773022d7bdb53d21db2f657c5c119",
  createdAt: "2026-01-01T00:00:00.000Z",
};
