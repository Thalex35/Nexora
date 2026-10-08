import { CreditCard } from "lucide-react";

import type { Card } from "@/lib/nexora-data";

const cardGradients = [
  "from-teal-400/30 via-cyan-950 to-slate-950",
  "from-emerald-400/25 via-emerald-950 to-slate-950",
  "from-cyan-400/25 via-sky-950 to-slate-950",
  "from-sky-400/25 via-indigo-950 to-slate-950",
];

function accentFor(provider: string) {
  let hash = 0;
  for (const character of provider) hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  return cardGradients[hash % cardGradients.length];
}

function gradientFor(priority: number, provider: string) {
  if (priority === 1) return "from-zinc-950 via-black to-zinc-950";
  if (priority === 2) return "from-slate-700 via-slate-900 to-black";
  if (priority === 3) return "from-teal-500 via-emerald-900 to-slate-950";
  return accentFor(provider);
}

export function CardVisual({
  card,
  primary = false,
  compact = false,
}: {
  card: Card;
  primary?: boolean;
  compact?: boolean;
}) {
  const priorityOne = card.priority === 1;

  return (
    <div
      role="img"
      aria-label={`${card.provider} ${card.name}, assigned priority ${card.priority}. No payment credentials displayed.`}
      className={`relative isolate flex aspect-[1.62] min-w-0 flex-col justify-between overflow-hidden rounded-xl border ${priorityOne ? "border-amber-300/70 shadow-amber-950/50" : "border-white/10 shadow-black/20"} bg-gradient-to-br ${gradientFor(card.priority, card.provider)} p-4 shadow-lg ${compact ? "w-full max-w-[15rem] p-3" : "w-full"}`}
    >
      {priorityOne && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-0 bg-[linear-gradient(130deg,rgba(255,215,100,0.32)_0%,rgba(255,215,100,0.08)_10%,transparent_34%,transparent_62%,rgba(255,215,100,0.13)_63%,transparent_77%)]"
        />
      )}
      <div
        aria-hidden="true"
        className={`pointer-events-none absolute -right-10 -top-12 z-0 h-36 w-36 rounded-full border ${priorityOne ? "border-amber-200/25 bg-amber-100/[0.06]" : "border-white/10 bg-white/[0.04]"}`}
      />
      <div
        aria-hidden="true"
        className={`pointer-events-none absolute -bottom-16 right-8 z-0 h-36 w-36 rounded-full border ${priorityOne ? "border-amber-300/20" : "border-primary/15"}`}
      />
      <div className="relative z-10 flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span
            className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg border ${priorityOne ? "border-amber-300/40 bg-amber-300/10 text-amber-300" : "border-white/15 bg-white/10 text-primary"}`}
          >
            <CreditCard className="h-4 w-4" aria-hidden="true" />
          </span>
          <div className="relative z-10 min-w-0">
            <p
              className={`truncate text-[10px] font-medium uppercase tracking-[0.14em] ${priorityOne ? "text-amber-200/75" : "text-white/60"}`}
            >
              Nexora · personal tracker
            </p>
            <p
              className={`truncate text-sm font-semibold ${priorityOne ? "text-amber-300" : "text-white"}`}
            >
              {card.provider}
            </p>
          </div>
        </div>
        <span
          className={`shrink-0 rounded-full border px-2 py-1 text-[10px] font-medium ${priorityOne ? "border-amber-300/40 bg-black/50 text-amber-200" : "border-white/15 bg-black/15 text-white/85"}`}
        >
          Priority {card.priority}
        </span>
      </div>
      <div className="min-w-0">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div className="min-w-0">
            <p
              className={`truncate text-base font-semibold ${priorityOne ? "text-amber-100" : "text-white"}`}
            >
              {card.name}
            </p>
            <p
              className={`mt-0.5 truncate text-xs capitalize ${priorityOne ? "text-amber-200/70" : "text-white/65"}`}
            >
              {card.card_type} · {card.network}
            </p>
          </div>
          {primary && (
            <span
              className={`rounded-full px-2 py-1 text-[10px] font-semibold ${priorityOne ? "bg-amber-300/15 text-amber-200" : "bg-primary/20 text-primary"}`}
            >
              Primary
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
