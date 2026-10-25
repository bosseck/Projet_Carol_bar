import { useEffect, useRef, useState } from "react";
import { pctChange } from "../lib/format";
import { Sparkline } from "./Charts";

interface Props {
  label: string;
  value: number;
  format: (n: number) => string;
  previous: number;
  reliable: boolean;
  spark: number[];
  accent: string;
  tone?: "up-good" | "down-good" | "neutral";
  delay?: number;
}

export function KpiCard({
  label,
  value,
  format,
  previous,
  reliable,
  spark,
  accent,
  tone = "up-good",
  delay = 0,
}: Props) {
  const shown = useCountUp(value);
  const trend = pctChange(value, previous);
  const good =
    trend.dir === "flat" || trend.dir === "new"
      ? null
      : tone === "neutral"
        ? null
        : tone === "down-good"
          ? trend.dir === "down"
          : trend.dir === "up";

  return (
    <article
      className="card rise relative overflow-hidden px-3 py-3 sm:px-4 sm:py-4"
      style={{ animationDelay: `${delay}ms` }}
    >
      <span className="absolute inset-y-2 left-0 w-1 rounded-r-full sm:inset-y-3" style={{ background: accent }} />
      <div className="pl-1.5 sm:pl-2">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)] sm:text-[11px] sm:tracking-[0.16em]">{label}</p>
        <p className="mt-1 font-display text-[clamp(1.25rem,5vw,1.85rem)] leading-none tracking-tight tabular">
          {format(shown)}
        </p>
        <div className="mt-2 flex items-end justify-between gap-2 sm:mt-3 sm:gap-3">
          <div>
            {reliable ? (
              <span
                className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[11px] font-semibold sm:px-2 sm:text-xs"
                style={{
                  background: good === null ? "var(--well)" : good ? "var(--green-2)" : "var(--wine-2)",
                  color: good === null ? "var(--muted)" : good ? "var(--green)" : "var(--wine)",
                }}
              >
                {trend.dir === "up" ? "↑" : trend.dir === "down" ? "↓" : "→"} {trend.label}
                <span className="hidden font-medium opacity-80 sm:inline">vs préc.</span>
              </span>
            ) : (
              <span className="text-[11px] text-[var(--faint)] sm:text-xs">Réf. incomplète</span>
            )}
          </div>
          <div className="w-20 shrink-0 sm:w-24">
            <Sparkline values={spark} color={accent} />
          </div>
        </div>
      </div>
    </article>
  );
}

function useCountUp(value: number) {
  const [display, setDisplay] = useState(value);
  const from = useRef(value);
  useEffect(() => {
    const start = performance.now();
    const a = from.current;
    const b = value;
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / 680);
      const e = 1 - Math.pow(1 - t, 3);
      setDisplay(a + (b - a) * e);
      if (t < 1) raf = requestAnimationFrame(tick);
      else from.current = b;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return display;
}
