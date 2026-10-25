const grouped = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 });
const flex = new Intl.NumberFormat("fr-FR", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 1,
});

export function fmt(n: number) {
  return grouped.format(Math.round(n));
}

export function fmtFlex(n: number) {
  if (!Number.isFinite(n)) return "—";
  if (Math.abs(n - Math.round(n)) < 0.05) return grouped.format(Math.round(n));
  return flex.format(n);
}

export function fcfa(n: number) {
  return `${fmt(n)}\u00a0FCFA`;
}

export function compact(n: number) {
  const sign = n < 0 ? "−" : "";
  const abs = Math.abs(n);
  if (abs >= 1_000_000) {
    return `${sign}${(abs / 1_000_000).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} M`;
  }
  if (abs >= 10_000) {
    return `${sign}${(abs / 1_000).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} k`;
  }
  return `${sign}${fmt(abs)}`;
}

export function pdfNumber(n: number) {
  return grouped.format(Math.round(n)).replace(/[\u202f\u00a0]/g, " ");
}

export function pdfMoney(n: number) {
  return `${pdfNumber(n)} FCFA`;
}

export function pctChange(cur: number, prev: number) {
  if (!Number.isFinite(prev) || (prev === 0 && cur === 0)) {
    return { label: "stable", dir: "flat" as const };
  }
  if (prev === 0) return { label: "nouveau", dir: "new" as const };
  const p = ((cur - prev) / Math.abs(prev)) * 100;
  if (Math.abs(p) < 0.05) return { label: "0 %", dir: "flat" as const };
  const sign = p > 0 ? "+" : "−";
  const label = `${sign}${Math.abs(p).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} %`;
  return { label, dir: p > 0 ? ("up" as const) : ("down" as const) };
}

export function plural(n: number, one: string, many: string) {
  return Math.abs(Math.round(n)) <= 1 ? one : many;
}

export function pluralizeFr(word: string) {
  const w = word.trim().toLowerCase();
  if (!w) return w;
  if (/[sxz]$/.test(w)) return w;
  if (/(eau|eu)$/.test(w)) return `${w}x`;
  if (/al$/.test(w)) return `${w.slice(0, -2)}aux`;
  return `${w}s`;
}
