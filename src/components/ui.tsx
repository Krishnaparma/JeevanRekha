import type { ButtonHTMLAttributes, ReactNode } from "react";
import { BED_TYPES, bedShort, type BedInventory, type BedType } from "@/lib/types";

/* ------------------------------------------------------------------ icons */

type IconProps = { className?: string };

export const IconCross = ({ className = "h-4 w-4" }: IconProps) => (
  <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
    <path d="M9.5 3h5v6.5H21v5h-6.5V21h-5v-6.5H3v-5h6.5z" />
  </svg>
);

export const IconAmbulance = ({ className = "h-4 w-4" }: IconProps) => (
  <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={1.8} aria-hidden>
    <path d="M2 16V8a1 1 0 0 1 1-1h9v9" strokeLinecap="round" />
    <path d="M12 9h4l3 3.5V16h-2" strokeLinecap="round" strokeLinejoin="round" />
    <circle cx="7" cy="17.5" r="1.8" />
    <circle cx="16.5" cy="17.5" r="1.8" />
    <path d="M5.5 11h3M7 9.5v3" strokeLinecap="round" />
  </svg>
);

export const IconPhone = ({ className = "h-4 w-4" }: IconProps) => (
  <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={1.8} aria-hidden>
    <path
      d="M4 5c0 8 7 15 15 15l1.8-3.2-4-2-1.8 1.8a13 13 0 0 1-5.6-5.6L11.2 9l-2-4z"
      strokeLinejoin="round"
    />
  </svg>
);

export const IconRoute = ({ className = "h-4 w-4" }: IconProps) => (
  <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={1.8} aria-hidden>
    <circle cx="6" cy="18" r="2.4" />
    <circle cx="18" cy="6" r="2.4" />
    <path d="M8.4 18h4.1a3.5 3.5 0 0 0 0-7H11a3.5 3.5 0 0 1 0-7h4.6" strokeLinecap="round" />
  </svg>
);

export const IconPulse = ({ className = "h-4 w-4" }: IconProps) => (
  <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={1.9} aria-hidden>
    <path d="M2 12h4l2.5-7 4 14L15.5 12H22" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const IconRefresh = ({ className = "h-4 w-4" }: IconProps) => (
  <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={1.8} aria-hidden>
    <path d="M20 12a8 8 0 1 1-2.4-5.7" strokeLinecap="round" />
    <path d="M20 4v4.5h-4.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const IconAlert = ({ className = "h-4 w-4" }: IconProps) => (
  <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={1.8} aria-hidden>
    <path d="M12 4.5 21 19H3z" strokeLinejoin="round" />
    <path d="M12 10v4" strokeLinecap="round" />
    <circle cx="12" cy="16.6" r="0.9" fill="currentColor" stroke="none" />
  </svg>
);

export const IconPin = ({ className = "h-4 w-4" }: IconProps) => (
  <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={1.8} aria-hidden>
    <path d="M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11z" strokeLinejoin="round" />
    <circle cx="12" cy="10" r="2.4" />
  </svg>
);

export const IconGraph = ({ className = "h-4 w-4" }: IconProps) => (
  <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={1.7} aria-hidden>
    <circle cx="5" cy="6" r="2" />
    <circle cx="19" cy="8" r="2" />
    <circle cx="8" cy="18" r="2" />
    <circle cx="17" cy="17" r="2" />
    <path d="M6.8 7.2 17.2 8M6 8l1.6 8M18.4 10 17 15M9.8 17.6l5.4-.3" />
  </svg>
);

export const IconHeap = ({ className = "h-4 w-4" }: IconProps) => (
  <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={1.7} aria-hidden>
    <path d="M12 4 4 10h16z" strokeLinejoin="round" />
    <path d="M8 13 4 19h8zM16 13l-4 6h8z" strokeLinejoin="round" />
  </svg>
);

/* ----------------------------------------------------------------- panels */

export function Panel({
  title,
  step,
  subtitle,
  right,
  children,
  className = "",
}: {
  title?: string;
  step?: string;
  subtitle?: string;
  right?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`panel rounded-xl ${className}`}>
      {(title || right) && (
        <header className="flex items-start justify-between gap-3 border-b border-white/5 px-4 py-3">
          <div className="min-w-0">
            {step && <span className="label-caps block text-signal-400">{step}</span>}
            {title && (
              <h2 className="truncate text-[13px] font-semibold tracking-wide text-mist-100">{title}</h2>
            )}
            {subtitle && <p className="mt-0.5 text-[11px] leading-snug text-mist-500">{subtitle}</p>}
          </div>
          {right}
        </header>
      )}
      <div className="px-4 py-3">{children}</div>
    </section>
  );
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "danger" | "ghost" | "outline";
  size?: "sm" | "md" | "lg";
  icon?: ReactNode;
};

export function Button({
  variant = "outline",
  size = "sm",
  icon,
  className = "",
  children,
  ...rest
}: ButtonProps) {
  const base =
    "focus-ring inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition active:translate-y-px disabled:cursor-not-allowed disabled:opacity-40";
  const sizes = {
    sm: "px-2.5 py-1.5 text-[11px]",
    md: "px-3.5 py-2 text-xs",
    lg: "px-4 py-3 text-sm",
  }[size];
  const variants = {
    primary:
      "bg-signal-500 text-night-950 hover:bg-signal-400 shadow-[0_0_24px_-6px_rgba(46,224,194,0.7)]",
    danger:
      "bg-critical-500 text-white hover:bg-critical-400 shadow-[0_0_24px_-6px_rgba(255,95,109,0.8)]",
    outline: "border border-white/12 bg-white/[0.03] text-mist-100 hover:border-signal-400/50 hover:bg-white/[0.06]",
    ghost: "text-mist-300 hover:bg-white/[0.06] hover:text-mist-100",
  }[variant];

  return (
    <button className={`${base} ${sizes} ${variants} ${className}`} {...rest}>
      {icon}
      {children}
    </button>
  );
}

export function Chip({
  children,
  tone = "neutral",
  className = "",
}: {
  children: ReactNode;
  tone?: "neutral" | "good" | "warn" | "bad" | "info";
  className?: string;
}) {
  const tones = {
    neutral: "border-white/10 bg-white/[0.04] text-mist-300",
    good: "border-signal-400/30 bg-signal-400/10 text-signal-300",
    warn: "border-alert-400/30 bg-alert-400/10 text-alert-300",
    bad: "border-critical-400/30 bg-critical-400/10 text-critical-300",
    info: "border-sky-400/30 bg-sky-400/10 text-sky-200",
  }[tone];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider ${tones} ${className}`}
    >
      {children}
    </span>
  );
}

export function StatTile({
  label,
  value,
  unit,
  tone = "neutral",
  hint,
}: {
  label: string;
  value: ReactNode;
  unit?: string;
  tone?: "neutral" | "good" | "warn" | "bad";
  hint?: string;
}) {
  const tones = {
    neutral: "text-mist-100",
    good: "text-signal-300",
    warn: "text-alert-300",
    bad: "text-critical-300",
  }[tone];
  return (
    <div className="panel-flat rounded-lg px-3 py-2">
      <div className="label-caps">{label}</div>
      <div className={`mt-1 font-mono text-lg leading-none ${tones}`}>
        {value}
        {unit && <span className="ml-1 text-[10px] text-mist-500">{unit}</span>}
      </div>
      {hint && <div className="mt-1 text-[10px] leading-tight text-mist-500">{hint}</div>}
    </div>
  );
}

/* ------------------------------------------------------------- bed visuals */

export function bedTone(free: number, total: number): "good" | "warn" | "bad" {
  if (free <= 0) return "bad";
  if (total > 0 && free / total <= 0.15) return "warn";
  return "good";
}

export function BedStrip({
  beds,
  highlight,
  compact = false,
}: {
  beds: BedInventory;
  highlight?: BedType;
  compact?: boolean;
}) {
  return (
    <div className={`grid gap-1.5 ${compact ? "grid-cols-4" : "grid-cols-2 sm:grid-cols-4"}`}>
      {BED_TYPES.map((bed) => {
        const entry = beds[bed.id];
        const free = Math.max(0, entry.total - entry.occupied);
        const tone = bedTone(free, entry.total);
        const pct = entry.total > 0 ? Math.round((free / entry.total) * 100) : 0;
        const toneText = { good: "text-signal-300", warn: "text-alert-300", bad: "text-critical-300" }[tone];
        const toneBar = { good: "bg-signal-400", warn: "bg-alert-400", bad: "bg-critical-400" }[tone];
        const active = highlight === bed.id;
        return (
          <div
            key={bed.id}
            className={`rounded-md border px-1.5 py-1 ${
              active ? "border-signal-400/50 bg-signal-400/[0.07]" : "border-white/8 bg-white/[0.02]"
            }`}
          >
            <div className="flex items-baseline justify-between gap-1">
              <span className="font-mono text-[9px] font-bold tracking-wider text-mist-500">
                {bedShort(bed.id)}
              </span>
              <span className={`font-mono text-[11px] font-bold ${toneText}`}>{free}</span>
            </div>
            <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-white/8">
              <div className={`h-full rounded-full ${toneBar}`} style={{ width: `${Math.max(3, pct)}%` }} />
            </div>
            <div className="mt-0.5 font-mono text-[9px] text-mist-700">
              {free}/{entry.total}
            </div>
          </div>
        );
      })}
    </div>
  );
}
