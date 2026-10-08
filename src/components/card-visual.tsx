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

export function CardVisual({
  card,
  primary = false,
  compact = false,
}: {
  card: Card;
  primary?: boolean;
  compact?: boolean;
}) {
  return (
    <div
      role="img"
      aria-label={`${card.provider} ${card.name}, assigned priority ${card.priority}. No payment credentials displayed.`}
      className={`relative isolate flex aspect-[1.62] min-w-0 flex-col justify-between overflow-hidden rounded-xl border border-white/10 bg-gradient-to-br ${accentFor(card.provider)} p-4 shadow-lg shadow-black/20 ${compact ? "w-full max-w-[15rem] p-3" : "w-full"}`}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-10 -top-12 z-0 h-36 w-36 rounded-full border border-white/10 bg-white/[0.04]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-16 right-8 z-0 h-36 w-36 rounded-full border border-primary/15"
      />
      <div className="relative z-10 flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-white/15 bg-white/10 text-primary">
            <CreditCard className="h-4 w-4" aria-hidden="true" />
          </span>
          <div className="relative z-10 min-w-0">
            <p className="truncate text-[10px] font-medium uppercase tracking-[0.14em] text-white/60">
              Nexora · personal tracker
            </p>
            <p className="truncate text-sm font-semibold text-white">{card.provider}</p>
          </div>
        </div>
        <span className="shrink-0 rounded-full border border-white/15 bg-black/15 px-2 py-1 text-[10px] font-medium text-white/85">
          Priority {card.priority}
        </span>
      </div>
      <div className="min-w-0">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-base font-semibold text-white">{card.name}</p>
            <p className="mt-0.5 truncate text-xs capitalize text-white/65">
              {card.card_type} · {card.network}
            </p>
          </div>
          {primary && (
            <span className="rounded-full bg-primary/20 px-2 py-1 text-[10px] font-semibold text-primary">
              Primary
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
