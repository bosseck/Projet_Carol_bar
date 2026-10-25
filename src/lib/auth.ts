import { DEFAULT_ACCOUNT } from "../data/accounts";
import type { Session, StoredUser } from "../types";
import { hashPassword, hashPin, randomHex, safeEqual } from "./crypto";

const USERS_KEY = "terrasse-users-v1";
const SESSION_KEY = "terrasse-session-v1";
const LOCK_KEY = "terrasse-auth-lock-v1";
const MAX_FAILS = 5;
const LOCK_MS = 30_000;

export type AuthResult = { ok: true; session: Session } | { ok: false; error: string };

export const normEmail = (value: string) => value.trim().toLowerCase();

function isStoredUser(x: unknown): x is StoredUser {
  if (!x || typeof x !== "object") return false;
  const u = x as Record<string, unknown>;
  return (
    typeof u.name === "string" &&
    typeof u.email === "string" &&
    typeof u.salt === "string" &&
    typeof u.passHash === "string" &&
    typeof u.pinHash === "string"
  );
}

function readUsers(): StoredUser[] {
  try {
    const raw = JSON.parse(localStorage.getItem(USERS_KEY) || "[]");
    return Array.isArray(raw) ? raw.filter(isStoredUser) : [];
  } catch {
    return [];
  }
}

export function allUsers(): StoredUser[] {
  const extra = readUsers().filter((u) => normEmail(u.email) !== normEmail(DEFAULT_ACCOUNT.email));
  return [DEFAULT_ACCOUNT, ...extra];
}

/* ---------- validation ---------- */

export function validateName(name: string) {
  const n = name.trim();
  if (n.length < 2) return "Indiquez votre nom (2 caractères minimum).";
  if (n.length > 40) return "Le nom est limité à 40 caractères.";
  return null;
}

export function validateEmail(email: string) {
  const e = email.trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e)) return "Adresse e-mail invalide.";
  if (e.length > 120) return "Adresse e-mail trop longue.";
  return null;
}

export function validatePassword(password: string) {
  if (password.length < 8) return "Le mot de passe doit contenir au moins 8 caractères.";
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) {
    return "Le mot de passe doit mélanger lettres et chiffres.";
  }
  return null;
}

export function validatePin(pin: string) {
  return /^\d{4}$/.test(pin) ? null : "Le code d'accès au comptoir comporte 4 chiffres.";
}

/* ---------- verrouillage après échecs répétés ---------- */

interface LockState {
  count: number;
  until: number;
}

function readLock(): LockState {
  try {
    const raw = JSON.parse(localStorage.getItem(LOCK_KEY) || "{}") as Partial<LockState>;
    return { count: Number(raw.count) || 0, until: Number(raw.until) || 0 };
  } catch {
    return { count: 0, until: 0 };
  }
}

export function lockRemaining() {
  return Math.max(0, readLock().until - Date.now());
}

function noteFailure() {
  const cur = readLock();
  const count = cur.count + 1;
  const next: LockState = count >= MAX_FAILS ? { count: 0, until: Date.now() + LOCK_MS } : { count, until: 0 };
  try {
    localStorage.setItem(LOCK_KEY, JSON.stringify(next));
  } catch {
    /* stockage indisponible */
  }
}

function clearFailures() {
  try {
    localStorage.removeItem(LOCK_KEY);
  } catch {
    /* stockage indisponible */
  }
}

/* ---------- session ---------- */

export function saveSession(session: Session, remember: boolean) {
  clearSession();
  try {
    (remember ? localStorage : sessionStorage).setItem(SESSION_KEY, JSON.stringify(session));
  } catch {
    /* stockage indisponible */
  }
}

export function clearSession() {
  try {
    localStorage.removeItem(SESSION_KEY);
    sessionStorage.removeItem(SESSION_KEY);
  } catch {
    /* stockage indisponible */
  }
}

export function loadSession(): Session | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY) ?? localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<Session>;
    if (typeof parsed.email !== "string") return null;
    const user = allUsers().find((u) => normEmail(u.email) === normEmail(parsed.email as string));
    return user ? { name: user.name, email: user.email } : null;
  } catch {
    return null;
  }
}

/* ---------- actions ---------- */

const tick = () => new Promise<void>((resolve) => window.setTimeout(resolve, 30));

export async function loginAccount(
  input: { email: string; password: string; pin: string },
  remember: boolean,
): Promise<AuthResult> {
  const wait = lockRemaining();
  if (wait > 0) {
    return { ok: false, error: `Trop de tentatives. Réessayez dans ${Math.ceil(wait / 1000)} s.` };
  }
  if (!input.email.trim() || !input.password || !input.pin) {
    return { ok: false, error: "Renseignez l'adresse, le mot de passe et le code d'accès." };
  }
  await tick();
  const user = allUsers().find((u) => normEmail(u.email) === normEmail(input.email));
  const salt = user?.salt ?? "0000000000000000";
  const passHash = hashPassword(input.password, salt);
  const pinHash = hashPin(input.pin, salt);
  const okPass = user ? safeEqual(passHash, user.passHash) : false;
  const okPin = user ? safeEqual(pinHash, user.pinHash) : false;
  if (!user || !okPass || !okPin) {
    noteFailure();
    return { ok: false, error: "Adresse, mot de passe ou code d'accès incorrect." };
  }
  clearFailures();
  const session = { name: user.name, email: user.email };
  saveSession(session, remember);
  return { ok: true, session };
}

export async function registerAccount(
  input: { name: string; email: string; password: string; confirm: string; pin: string },
  remember: boolean,
): Promise<AuthResult> {
  const problem =
    validateName(input.name) ||
    validateEmail(input.email) ||
    validatePassword(input.password) ||
    (input.password !== input.confirm ? "Les deux mots de passe ne correspondent pas." : null) ||
    validatePin(input.pin);
  if (problem) return { ok: false, error: problem };
  if (allUsers().some((u) => normEmail(u.email) === normEmail(input.email))) {
    return { ok: false, error: "Un compte existe déjà avec cette adresse. Connectez-vous." };
  }
  await tick();
  const salt = randomHex(16);
  const user: StoredUser = {
    name: input.name.trim(),
    email: input.email.trim(),
    salt,
    passHash: hashPassword(input.password, salt),
    pinHash: hashPin(input.pin, salt),
    createdAt: new Date().toISOString(),
  };
  try {
    localStorage.setItem(USERS_KEY, JSON.stringify([...readUsers(), user]));
  } catch {
    return { ok: false, error: "Impossible d'enregistrer le compte sur cet appareil." };
  }
  const session = { name: user.name, email: user.email };
  saveSession(session, remember);
  return { ok: true, session };
}
