export const HISTORY_DAYS = 140;

export function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export const TODAY = startOfDay(new Date());

export function iso(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function parseISO(s: string) {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

export function addDays(d: Date, n: number) {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  x.setDate(x.getDate() + n);
  return x;
}

export const HISTORY_START = addDays(TODAY, -(HISTORY_DAYS - 1));
export const TODAY_ISO = iso(TODAY);
export const HISTORY_START_ISO = iso(HISTORY_START);

export function eachDate(start: string, end: string) {
  const out: string[] = [];
  let cursor = parseISO(start);
  const last = parseISO(end);
  while (cursor <= last) {
    out.push(iso(cursor));
    cursor = addDays(cursor, 1);
  }
  return out;
}

export function inclusiveDays(start: string, end: string) {
  const ms = parseISO(end).getTime() - parseISO(start).getTime();
  return Math.round(ms / 86_400_000) + 1;
}

export function formatLong(s: string) {
  return parseISO(s).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function formatShort(s: string) {
  return parseISO(s).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
  });
}

export function formatWeekday(s: string) {
  return parseISO(s).toLocaleDateString("fr-FR", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

export function previousWindow(start: string, end: string) {
  const len = inclusiveDays(start, end);
  const endD = addDays(parseISO(start), -1);
  const startD = addDays(endD, -(len - 1));
  return { start: iso(startD), end: iso(endD) };
}
