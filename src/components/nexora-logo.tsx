import { cn } from "@/lib/utils";

/**
 * Nexora brand logo: an abstract forward-movement node symbol + wordmark.
 */
export function NexoraLogo({
  className,
  showWordmark = true,
  size = 28,
}: {
  className?: string;
  showWordmark?: boolean;
  size?: number;
}) {
  return (
    <span className={cn("flex items-center gap-2.5", className)}>
      <NexoraMark size={size} />
      {showWordmark && (
        <span className="text-[1.0625rem] font-semibold tracking-[0.18em] text-foreground">
          NEXORA
        </span>
      )}
    </span>
  );
}

export function NexoraMark({ size = 28 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden="true"
      className="shrink-0"
    >
      <rect
        x="1"
        y="1"
        width="30"
        height="30"
        rx="9"
        className="fill-surface stroke-border"
        strokeWidth="1"
      />
      <path
        d="M10 22V10l12 12V10"
        className="stroke-primary"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="22" cy="10" r="2.6" className="fill-primary" />
    </svg>
  );
}
