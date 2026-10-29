import type { ReactNode } from "react";
import type { TicketPriority, TicketStatus } from "@/shared/constants";

/**
 * Shared presentation primitives.
 *
 * These exist because the same four or five shapes — a page header, a status
 * chip, an empty state, an error state, a stat — recur on every screen. Keeping
 * them here is what makes the app feel like one product instead of six pages.
 */

// --- Page header ----------------------------------------------------------

export function PageHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <header className="rise mb-8 flex flex-wrap items-end justify-between gap-4">
      <div className="max-w-[60ch]">
        {eyebrow ? (
          <p className="text-[10px] uppercase tracking-[0.18em] text-faint">
            {eyebrow}
          </p>
        ) : null}
        <h1 className="font-display mt-2 text-[26px] text-ink">{title}</h1>
        {description ? (
          <p className="mt-2 text-[13px] leading-relaxed text-muted">
            {description}
          </p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </header>
  );
}

// --- Chips ----------------------------------------------------------------

type Variant = "danger" | "info" | "success" | "warn" | "neutral";

const VARIANT_CLASS: Record<Variant, string> = {
  danger: "bg-danger-bg text-danger-fg",
  info: "bg-info-bg text-info-fg",
  success: "bg-success-bg text-success-fg",
  warn: "bg-warn-bg text-warn-fg",
  neutral: "bg-neutral-bg text-neutral-fg",
};

const STATUS_VARIANT: Record<TicketStatus, Variant> = {
  Open: "info",
  "In Progress": "warn",
  Resolved: "success",
  Closed: "neutral",
};

const PRIORITY_VARIANT: Record<TicketPriority, Variant> = {
  Critical: "danger",
  High: "warn",
  Medium: "info",
  Low: "neutral",
};

export function Chip({ variant, children }: { variant: Variant; children: ReactNode }) {
  return <span className={`chip ${VARIANT_CLASS[variant]}`}>{children}</span>;
}

export function StatusChip({ status }: { status: TicketStatus }) {
  return <Chip variant={STATUS_VARIANT[status]}>{status}</Chip>;
}

export function PriorityChip({ priority }: { priority: TicketPriority }) {
  return <Chip variant={PRIORITY_VARIANT[priority]}>{priority}</Chip>;
}

/**
 * Book status is a free-text string from the source data
 * ("Published & Live", "In Production - Typesetting", …), so it is matched by
 * prefix rather than an enum — unknown values still render, as neutral.
 */
export function BookStatusChip({ status }: { status: string }) {
  const variant: Variant = status.startsWith("Published")
    ? "success"
    : status.startsWith("In Production")
      ? "warn"
      : "neutral";
  return <Chip variant={variant}>{status}</Chip>;
}

// --- Data states ----------------------------------------------------------

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="card flex flex-col items-center gap-3 px-6 py-14 text-center">
      <p className="text-[14px] text-ink">{title}</p>
      {description ? (
        <p className="max-w-[46ch] text-[13px] leading-relaxed text-muted">
          {description}
        </p>
      ) : null}
      {action ? <div className="mt-1">{action}</div> : null}
    </div>
  );
}

export function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div className="card flex flex-wrap items-center justify-between gap-3 px-5 py-4">
      <p className="text-[13px] text-danger-fg">{message}</p>
      {onRetry ? (
        <button type="button" className="btn btn-secondary" onClick={onRetry}>
          Try again
        </button>
      ) : null}
    </div>
  );
}

/** Quiet skeleton lines — no spinners, no layout shift. */
export function LoadingRows({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-2" aria-hidden>
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className="card h-[68px] animate-pulse bg-sunken" />
      ))}
    </div>
  );
}

// --- Stat -----------------------------------------------------------------

export function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
}) {
  return (
    <div className="card px-4 py-3.5">
      <p className="text-[10px] uppercase tracking-[0.14em] text-faint">{label}</p>
      <p className="font-display mt-1.5 text-[22px] text-ink">{value}</p>
      {hint ? <p className="mt-0.5 text-[11px] text-muted">{hint}</p> : null}
    </div>
  );
}

// --- Field-level helpers --------------------------------------------------

export function FieldError({ children }: { children?: string }) {
  if (!children) return null;
  return (
    <p role="alert" className="mt-1.5 text-[11px] text-danger-fg">
      {children}
    </p>
  );
}

export function Banner({ children }: { children: ReactNode }) {
  return (
    <p
      role="alert"
      className="rounded-md bg-danger-bg px-3 py-2 text-[12px] text-danger-fg"
    >
      {children}
    </p>
  );
}

/** A label/value row used in detail sidebars. */
export function MetaRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2">
      <dt className="text-[11px] uppercase tracking-[0.1em] text-faint">
        {label}
      </dt>
      <dd className="text-right text-[12.5px] text-ink-soft">{children}</dd>
    </div>
  );
}
