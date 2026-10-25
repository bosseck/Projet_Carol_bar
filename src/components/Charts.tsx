import { useId, useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { compact, fcfa, fmt } from "../lib/format";
import { formatWeekday } from "../lib/dates";

export function Sparkline({ values, color }: { values: number[]; color: string }) {
  if (values.length < 2) return <div className="h-9" />;
  const w = 112;
  const h = 36;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const d = values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * (w - 2) + 1;
      const y = h - 3 - ((v - min) / span) * (h - 8);
      return `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-9 w-full" aria-hidden>
      <path d={d} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

interface Point {
  date: string;
  caisse: number;
  benefice: number;
}

interface LineProps {
  points: Point[];
  previous: Point[];
  mode: "both" | "caisse" | "benefice";
  bucket: "jour" | "semaine";
}

export function SalesLineChart({ points, previous, mode, bucket }: LineProps) {
  const uid = useId().replace(/:/g, "");
  const wrap = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<number | null>(null);
  const w = 640;
  const h = 280;
  const pad = { l: 52, r: 14, t: 16, b: 34 };
  const innerW = w - pad.l - pad.r;
  const innerH = h - pad.t - pad.b;

  const showCaisse = mode !== "benefice";
  const showBenef = mode !== "caisse";
  const seriesMax = Math.max(
    1,
    ...points.map((p) => Math.max(showCaisse ? p.caisse : 0, showBenef ? p.benefice : 0)),
    ...previous.map((p) => (showCaisse ? p.caisse : 0)),
  );
  const max = seriesMax * 1.12;
  const n = points.length;
  const xAt = (i: number) => pad.l + (n <= 1 ? innerW / 2 : (i / (n - 1)) * innerW);
  const yAt = (v: number) => pad.t + innerH - (v / max) * innerH;
  const baseline = pad.t + innerH;

  const caissePts = points.map((p, i) => ({ x: xAt(i), y: yAt(p.caisse) }));
  const benefPts = points.map((p, i) => ({ x: xAt(i), y: yAt(p.benefice) }));
  const prevPts = previous.slice(0, n).map((p, i) => ({ x: xAt(i), y: yAt(p.caisse) }));

  const alive = points.some((p) => p.caisse > 0 || p.benefice > 0);
  const ticks = 4;
  const labelIdx = labelIndexes(n);

  function move(clientX: number) {
    const svg = wrap.current?.querySelector("svg");
    if (!svg || n === 0) return;
    const rect = svg.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * w;
    let best = 0;
    let dist = Infinity;
    for (let i = 0; i < n; i++) {
      const d = Math.abs(xAt(i) - x);
      if (d < dist) {
        dist = d;
        best = i;
      }
    }
    setHover(best);
  }

  const tip = hover !== null ? points[hover] : null;
  const prevTip = hover !== null ? previous[hover] : undefined;

  return (
    <div ref={wrap} className="relative">
      {!alive ? (
        <div className="flex h-[220px] items-center justify-center text-sm text-[var(--muted)] sm:h-[280px]">
          Aucune vente sur cette période.
        </div>
      ) : (
        <svg
          viewBox={`0 0 ${w} ${h}`}
          className="h-[220px] w-full touch-none sm:h-[280px]"
          role="img"
          aria-label="Courbe de l'argent en caisse et du bénéfice réalisé"
          onPointerMove={(e) => move(e.clientX)}
          onPointerLeave={() => setHover(null)}
        >
          <defs>
            <linearGradient id={`${uid}-fill`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--amber)" stopOpacity="0.28" />
              <stop offset="100%" stopColor="var(--amber)" stopOpacity="0.02" />
            </linearGradient>
          </defs>
          {Array.from({ length: ticks + 1 }, (_, i) => {
            const v = (max * (ticks - i)) / ticks;
            const y = yAt(v);
            return (
              <g key={i}>
                <line x1={pad.l} x2={w - pad.r} y1={y} y2={y} stroke="var(--line)" strokeDasharray="3 4" />
                <text x={pad.l - 8} y={y + 3} textAnchor="end" fontSize="10" fill="var(--faint)">
                  {compact(v)}
                </text>
              </g>
            );
          })}
          {showCaisse && caissePts.length > 1 ? (
            <path d={areaPath(caissePts, baseline)} fill={`url(#${uid}-fill)`} />
          ) : null}
          {showCaisse && prevPts.length > 1 ? (
            <path
              d={smoothPath(prevPts)}
              fill="none"
              stroke="var(--faint)"
              strokeWidth="1.4"
              strokeDasharray="5 4"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          ) : null}
          {showCaisse ? <AnimatedPath d={smoothPath(caissePts)} color="var(--amber)" /> : null}
          {showBenef ? <AnimatedPath d={smoothPath(benefPts)} color="var(--green)" width={2.1} /> : null}
          {hover !== null ? (
            <g>
              <line
                x1={xAt(hover)}
                x2={xAt(hover)}
                y1={pad.t}
                y2={baseline}
                stroke="var(--ink)"
                strokeOpacity="0.25"
              />
              {showCaisse ? <circle cx={xAt(hover)} cy={yAt(points[hover].caisse)} r="4" fill="var(--amber)" /> : null}
              {showBenef ? (
                <circle cx={xAt(hover)} cy={yAt(points[hover].benefice)} r="4" fill="var(--green)" />
              ) : null}
            </g>
          ) : null}
          {labelIdx.map((i) => (
            <text key={i} x={xAt(i)} y={h - 10} textAnchor="middle" fontSize="10" fill="var(--faint)">
              {formatWeekday(points[i].date).replace(".", "")}
            </text>
          ))}
        </svg>
      )}
      {tip ? (
        <div
          className="pointer-events-none absolute z-10 w-52 rounded-xl border border-[var(--line)] bg-[var(--card)] px-3 py-2 text-xs shadow-lg"
          style={{
            left: `${Math.min(78, Math.max(8, (xAt(hover ?? 0) / w) * 100))}%`,
            top: 8,
          }}
        >
          <p className="font-semibold">
            {bucket === "semaine" ? `Semaine du ${formatWeekday(tip.date)}` : formatWeekday(tip.date)}
          </p>
          {showCaisse ? (
            <p className="mt-1 flex justify-between gap-3">
              <span className="text-[var(--amber)]">Caisse</span>
              <span className="tabular">{fcfa(tip.caisse)}</span>
            </p>
          ) : null}
          {showBenef ? (
            <p className="mt-0.5 flex justify-between gap-3">
              <span className="text-[var(--green)]">Bénéfice</span>
              <span className="tabular">{fcfa(tip.benefice)}</span>
            </p>
          ) : null}
          {prevTip && showCaisse ? (
            <p className="mt-1 flex justify-between gap-3 text-[var(--faint)]">
              <span>Caisse préc.</span>
              <span className="tabular">{fcfa(prevTip.caisse)}</span>
            </p>
          ) : null}
        </div>
      ) : null}
      <ul className="sr-only">
        {points.map((p) => (
          <li key={p.date}>
            {p.date} : caisse {fmt(p.caisse)}, bénéfice {fmt(p.benefice)}
          </li>
        ))}
      </ul>
    </div>
  );
}

function AnimatedPath({ d, color, width = 2.4 }: { d: string; color: string; width?: number }) {
  const ref = useRef<SVGPathElement>(null);
  useLayoutEffect(() => {
    const path = ref.current;
    if (!path || !d) return;
    const len = path.getTotalLength();
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    path.style.transition = "none";
    path.style.strokeDasharray = `${len}`;
    path.style.strokeDashoffset = reduce ? "0" : `${len}`;
    const id = requestAnimationFrame(() => {
      if (reduce) return;
      path.style.transition = "stroke-dashoffset 900ms cubic-bezier(0.22, 1, 0.36, 1)";
      path.style.strokeDashoffset = "0";
    });
    return () => cancelAnimationFrame(id);
  }, [d]);
  if (!d) return null;
  return (
    <path
      ref={ref}
      d={d}
      fill="none"
      stroke={color}
      strokeWidth={width}
      strokeLinejoin="round"
      strokeLinecap="round"
    />
  );
}

export interface Slice {
  id: string;
  label: string;
  value: number;
  color: string;
}

export function CategoryDonut({
  slices,
  activeId,
  onSelect,
}: {
  slices: Slice[];
  activeId: string | null;
  onSelect: (id: string) => void;
}) {
  const [hover, setHover] = useState<string | null>(null);
  const [tip, setTip] = useState<{ x: number; y: number } | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const total = slices.reduce((s, sl) => s + sl.value, 0);
  const r = 72;
  const c = 2 * Math.PI * r;
  const cx = 100;
  const cy = 100;
  let offset = 0;
  const arcs = slices.map((slice) => {
    const len = total === 0 ? 0 : (slice.value / total) * c;
    const start = offset;
    offset += len;
    return { ...slice, len, start };
  });
  const active = arcs.find((a) => a.id === (hover ?? activeId)) ?? null;

  function pointer(e: ReactPointerEvent<SVGSVGElement>) {
    const svg = e.currentTarget;
    const rect = svg.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 200 - cx;
    const y = ((e.clientY - rect.top) / rect.height) * 200 - cy;
    const dist = Math.hypot(x, y);
    const host = box.current?.getBoundingClientRect();
    if (host) setTip({ x: e.clientX - host.left, y: e.clientY - host.top });
    if (dist < 46 || dist > 98 || total === 0) {
      setHover(null);
      return;
    }
    let angle = Math.atan2(x, -y);
    if (angle < 0) angle += Math.PI * 2;
    const at = (angle / (Math.PI * 2)) * c;
    const hit = arcs.find((a) => at >= a.start && at < a.start + a.len);
    setHover(hit?.id ?? null);
  }

  return (
    <div ref={box} className="relative">
      <div className="grid items-center gap-3 sm:grid-cols-[200px_1fr]">
        <svg
          viewBox="0 0 200 200"
          className="mx-auto h-[210px] w-[210px]"
          role="img"
          aria-label="Répartition de la caisse par rayon"
          onPointerMove={pointer}
          onPointerLeave={() => {
            setHover(null);
            setTip(null);
          }}
          onClick={() => {
            if (hover) onSelect(hover);
          }}
        >
          <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--well)" strokeWidth="22" />
          {arcs.map((arc) => (
            <circle
              key={arc.id}
              cx={cx}
              cy={cy}
              r={r}
              fill="none"
              stroke={arc.color}
              strokeWidth={hover === arc.id || activeId === arc.id ? 28 : 22}
              strokeDasharray={`${arc.len} ${c - arc.len}`}
              strokeDashoffset={-arc.start}
              strokeLinecap="butt"
              transform={`rotate(-90 ${cx} ${cy})`}
              style={{ transition: "stroke-width 180ms ease, stroke-dasharray 600ms ease, opacity 180ms ease" }}
              opacity={hover && hover !== arc.id ? 0.45 : 1}
            />
          ))}
          <text x={cx} y={cy - 6} textAnchor="middle" fontSize="11" fill="var(--faint)">
            Caisse
          </text>
          <text x={cx} y={cy + 14} textAnchor="middle" fontSize="13" fontWeight="650" fill="var(--ink)">
            {compact(total)}
          </text>
        </svg>
        <ul className="space-y-1.5">
          {slices.length === 0 ? (
            <li className="text-sm text-[var(--muted)]">Aucune vente à répartir.</li>
          ) : (
            slices.map((slice) => {
              const share = total === 0 ? 0 : (slice.value / total) * 100;
              const on = activeId === slice.id;
              return (
                <li key={slice.id}>
                  <button
                    type="button"
                    onClick={() => onSelect(slice.id)}
                    onMouseEnter={() => setHover(slice.id)}
                    onMouseLeave={() => setHover(null)}
                    className="flex w-full items-center gap-2 rounded-xl px-2 py-1.5 text-left text-sm transition"
                    style={{ background: on ? "var(--well)" : "transparent" }}
                    aria-pressed={on}
                  >
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: slice.color }} />
                    <span className="min-w-0 flex-1 truncate">{slice.label}</span>
                    <span className="tabular text-[var(--muted)]">{share.toLocaleString("fr-FR", { maximumFractionDigits: 0 })} %</span>
                  </button>
                </li>
              );
            })
          )}
        </ul>
      </div>
      {active && tip ? (
        <div
          className="pointer-events-none absolute z-10 rounded-xl border border-[var(--line)] bg-[var(--card)] px-3 py-2 text-xs shadow-lg"
          style={{ left: Math.min(tip.x + 12, 180), top: Math.max(8, tip.y - 46) }}
        >
          <p className="font-semibold">{active.label}</p>
          <p className="tabular">{fcfa(active.value)}</p>
          <p className="text-[var(--faint)]">
            {total === 0 ? "0" : ((active.value / total) * 100).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} % de la caisse
          </p>
        </div>
      ) : null}
    </div>
  );
}

export interface RankItem {
  id: string;
  label: string;
  sub: string;
  value: number;
  color: string;
  hint: string;
}

export function RankBars({
  items,
  activeId,
  onSelect,
  formatValue,
}: {
  items: RankItem[];
  activeId: string | null;
  onSelect: (id: string) => void;
  formatValue: (n: number) => string;
}) {
  const [hover, setHover] = useState<string | null>(null);
  const max = Math.max(1, ...items.map((i) => i.value));
  if (items.length === 0 || items.every((i) => i.value === 0)) {
    return <p className="py-10 text-center text-sm text-[var(--muted)]">Rien à classer sur ce filtre.</p>;
  }
  return (
    <ol className="space-y-1.5">
      {items.map((item, index) => {
        const pct = Math.max(2, (item.value / max) * 100);
        const on = hover === item.id || activeId === item.id;
        return (
          <li key={item.id}>
            <button
              type="button"
              onClick={() => onSelect(item.id)}
              onMouseEnter={() => setHover(item.id)}
              onMouseLeave={() => setHover(null)}
              onFocus={() => setHover(item.id)}
              onBlur={() => setHover(null)}
              className="grid w-full grid-cols-[1.4rem_1fr] items-start gap-2 rounded-xl px-2 py-1.5 text-left"
              style={{ background: on ? "var(--well)" : "transparent" }}
            >
              <span className="pt-0.5 text-xs text-[var(--faint)]">{index + 1}</span>
              <span className="min-w-0">
                <span className="flex items-baseline justify-between gap-3">
                  <span className="truncate font-medium">{item.label}</span>
                  <span className="tabular text-sm">{formatValue(item.value)}</span>
                </span>
                <span className="mt-1 block h-2 overflow-hidden rounded-full bg-[var(--paper-2)]">
                  <span
                    className="block h-full rounded-full"
                    style={{
                      width: `${pct}%`,
                      background: item.color,
                      transition: "width 700ms cubic-bezier(0.22, 1, 0.36, 1)",
                    }}
                  />
                </span>
                <span className="mt-1 block text-[11px] text-[var(--faint)]">{on ? item.hint : item.sub}</span>
              </span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}

function labelIndexes(n: number) {
  if (n <= 1) return [0];
  const steps = Math.min(5, n);
  const out: number[] = [];
  for (let i = 0; i < steps; i++) out.push(Math.round((i * (n - 1)) / (steps - 1)));
  return [...new Set(out)];
}

function smoothPath(pts: { x: number; y: number }[]) {
  if (pts.length === 0) return "";
  if (pts.length === 1) return `M ${pts[0].x} ${pts[0].y}`;
  const d = [`M ${pts[0].x} ${pts[0].y}`];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    d.push(`C ${c1x} ${c1y}, ${c2x} ${c2y}, ${p2.x} ${p2.y}`);
  }
  return d.join(" ");
}

function areaPath(pts: { x: number; y: number }[], baseline: number) {
  if (pts.length < 2) return "";
  return `${smoothPath(pts)} L ${pts[pts.length - 1].x} ${baseline} L ${pts[0].x} ${baseline} Z`;
}
