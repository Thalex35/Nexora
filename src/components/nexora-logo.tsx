import { cn } from "@/lib/utils";

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
      <rect x="1" y="1" width="30" height="30" rx="8" className="fill-surface" />
      <path
        d="M9 23V9l14 14V9"
        fill="none"
        stroke="#2DD4BF"
        strokeWidth="3"
        strokeLinecap="square"
        strokeLinejoin="miter"
      />
    </svg>
  );
}
