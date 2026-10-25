import { useEffect, useRef, useState } from "react";
import { loginAccount, lockRemaining, registerAccount } from "../lib/auth";
import type { Session } from "../types";
import { LockIcon } from "./Icons";

interface Props {
  reason: string;
  onClose: () => void;
  onAuthed: (session: Session) => void;
}

export function AuthDialog({ reason, onClose, onAuthed }: Props) {
  const [tab, setTab] = useState<"login" | "register">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [pin, setPin] = useState("");
  const [remember, setRemember] = useState(false);
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lockLeft, setLockLeft] = useState(() => lockRemaining());
  const firstRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    firstRef.current?.focus();
  }, [tab]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    if (lockLeft <= 0) return;
    const id = window.setInterval(() => setLockLeft(lockRemaining()), 500);
    return () => window.clearInterval(id);
  }, [lockLeft]);

  const locked = lockLeft > 0 && tab === "login";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy || locked) return;
    setBusy(true);
    setError(null);
    const result =
      tab === "login"
        ? await loginAccount({ email, password, pin }, remember)
        : await registerAccount({ name, email, password, confirm, pin }, remember);
    setBusy(false);
    if (result.ok) {
      onAuthed(result.session);
      return;
    }
    setError(result.error);
    setLockLeft(lockRemaining());
    if (tab === "login") setPassword("");
  }

  function switchTab(next: "login" | "register") {
    setTab(next);
    setError(null);
    setPassword("");
    setConfirm("");
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center p-3 sm:items-center">
      <button type="button" className="absolute inset-0 bg-black/55" aria-label="Fermer" onClick={onClose} />
      <form
        onSubmit={submit}
        className="drawer-in relative z-10 max-h-[95vh] w-full max-w-md overflow-y-auto rounded-2xl border border-[var(--line)] bg-[var(--card)] p-4 shadow-2xl sm:rounded-3xl sm:p-5"
        aria-labelledby="auth-title"
        role="dialog"
        aria-modal="true"
        noValidate
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-[var(--ink)] text-[var(--paper)]">
              <LockIcon />
            </span>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--amber)]">Accès au comptoir</p>
              <h2 id="auth-title" className="font-display text-2xl leading-tight">
                {tab === "login" ? "Connexion" : "Créer un compte"}
              </h2>
            </div>
          </div>
          <button type="button" className="btn btn-ghost btn-tiny" onClick={onClose}>
            Fermer
          </button>
        </div>

        <p className="mt-3 rounded-xl bg-[var(--well)] px-3 py-2 text-sm text-[var(--muted)]">
          Le tableau reste consultable par tous. Il faut un compte pour <strong className="text-[var(--ink)]">{reason}</strong>.
        </p>

        <div className="mt-4 flex rounded-full bg-[var(--well)] p-1 text-sm" role="tablist">
          {(["login", "register"] as const).map((id) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={tab === id}
              className="flex-1 rounded-full px-3 py-1.5"
              style={{ background: tab === id ? "var(--card)" : "transparent", color: "var(--ink)" }}
              onClick={() => switchTab(id)}
            >
              {id === "login" ? "Se connecter" : "S'inscrire"}
            </button>
          ))}
        </div>

        <div className="mt-4 space-y-3">
          {tab === "register" ? (
            <label className="block text-sm">
              Nom
              <input
                ref={firstRef}
                className="field mt-1 w-full"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="name"
                maxLength={40}
              />
            </label>
          ) : null}
          <label className="block text-sm">
            Adresse e-mail
            <input
              ref={tab === "login" ? firstRef : undefined}
              className="field mt-1 w-full"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="username"
              inputMode="email"
              placeholder="vous@exemple.com"
            />
          </label>
          <label className="block text-sm">
            Mot de passe
            <span className="relative mt-1 block">
              <input
                className="field w-full pr-24"
                type={show ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={tab === "login" ? "current-password" : "new-password"}
              />
              <button
                type="button"
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full px-2 py-1 text-xs text-[var(--muted)] hover:bg-[var(--well)]"
                onClick={() => setShow((v) => !v)}
                aria-pressed={show}
              >
                {show ? "Masquer" : "Afficher"}
              </button>
            </span>
            {tab === "register" ? (
              <span className="mt-1 block text-xs text-[var(--faint)]">8 caractères minimum, lettres et chiffres.</span>
            ) : null}
          </label>
          {tab === "register" ? (
            <label className="block text-sm">
              Confirmer le mot de passe
              <input
                className="field mt-1 w-full"
                type={show ? "text" : "password"}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                autoComplete="new-password"
              />
            </label>
          ) : null}
          <label className="block text-sm">
            Code d'accès au comptoir
            <input
              className="field mt-1 w-full tracking-[0.5em]"
              type="password"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={4}
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
              autoComplete="off"
              placeholder="••••"
            />
            <span className="mt-1 block text-xs text-[var(--faint)]">
              {tab === "login" ? "Les 4 chiffres liés à votre compte." : "Choisissez 4 chiffres : ils protègent l'accès à votre compte."}
            </span>
          </label>
          <label className="flex items-center gap-2 text-sm text-[var(--muted)]">
            <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} className="h-4 w-4 accent-[var(--amber)]" />
            Rester connecté sur cet appareil
          </label>
        </div>

        {locked ? (
          <p role="alert" className="mt-3 rounded-xl bg-[var(--wine-2)] px-3 py-2 text-sm text-[var(--wine)]">
            Trop de tentatives. Réessayez dans {Math.ceil(lockLeft / 1000)} s.
          </p>
        ) : error ? (
          <p role="alert" className="mt-3 rounded-xl bg-[var(--wine-2)] px-3 py-2 text-sm text-[var(--wine)]">
            {error}
          </p>
        ) : null}

        <button type="submit" className="btn btn-primary mt-4 w-full" disabled={busy || locked}>
          {busy ? "Vérification…" : tab === "login" ? "Se connecter" : "Créer mon compte"}
        </button>
        <p className="mt-3 text-center text-xs leading-relaxed text-[var(--faint)]">
          Les comptes sont enregistrés dans ce navigateur, mots de passe et codes hachés. Sans serveur, ce verrou protège l'interface, pas les données du navigateur.
        </p>
      </form>
    </div>
  );
}
