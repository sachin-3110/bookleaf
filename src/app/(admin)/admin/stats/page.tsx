"use client";

import {
  PRIORITIES,
  TICKET_CATEGORIES,
  TICKET_STATUSES,
} from "@/shared/constants";
import {
  EmptyState,
  ErrorState,
  LoadingRows,
  PageHeader,
  Stat,
} from "@/components/ui";
import { formatNumber } from "@/lib/format";
import { useTicketStats } from "@/lib/hooks";

/**
 * Overview.
 *
 * Deliberately not a chart library: the whole dataset is a handful of counts,
 * so hairline bars communicate proportions faster than any visualisation would,
 * and they cost nothing to render.
 */
export default function AdminStatsPage() {
  const { data, error, isLoading, mutate } = useTicketStats();
  const stats = data?.stats;

  return (
    <>
      <PageHeader
        eyebrow="Admin Console"
        title="Overview"
        description="Volume across the queue, broken down by the dimensions the team triages on."
      />

      {error ? (
        <ErrorState
          message={
            error instanceof Error ? error.message : "Could not load statistics."
          }
          onRetry={() => void mutate()}
        />
      ) : isLoading || !stats ? (
        <LoadingRows rows={4} />
      ) : stats.total === 0 ? (
        <EmptyState
          title="No tickets in the system yet"
          description="Once authors start raising queries, the numbers here will fill in."
        />
      ) : (
        <>
          <section className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Total" value={formatNumber(stats.total)} />
            <Stat
              label="Unassigned"
              value={formatNumber(stats.unassigned)}
              hint="No owner yet"
            />
            <Stat
              label="Open"
              value={formatNumber(stats.byStatus.Open ?? 0)}
              hint="Awaiting first touch"
            />
            <Stat
              label="Critical + High"
              value={formatNumber(
                (stats.byPriority.Critical ?? 0) + (stats.byPriority.High ?? 0),
              )}
              hint="Needs attention first"
            />
          </section>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <Breakdown
              title="By status"
              order={[...TICKET_STATUSES]}
              counts={stats.byStatus}
              total={stats.total}
            />
            <Breakdown
              title="By category"
              order={[...TICKET_CATEGORIES]}
              counts={stats.byCategory}
              total={stats.total}
            />
            <Breakdown
              title="By priority"
              order={[...PRIORITIES]}
              counts={stats.byPriority}
              total={stats.total}
            />
          </div>
        </>
      )}
    </>
  );
}

function Breakdown({
  title,
  order,
  counts,
  total,
}: {
  title: string;
  order: string[];
  counts: Record<string, number>;
  total: number;
}) {
  const max = Math.max(1, ...order.map((key) => counts[key] ?? 0));

  return (
    <section className="card px-4 py-3.5">
      <h2 className="mb-3.5 text-[10px] uppercase tracking-[0.14em] text-faint">
        {title}
      </h2>
      <ul className="space-y-3">
        {order.map((key) => {
          const count = counts[key] ?? 0;
          const share = total > 0 ? Math.round((count / total) * 100) : 0;
          return (
            <li key={key}>
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-[12.5px] text-ink-soft">{key}</span>
                <span className="text-[12px] text-muted">
                  {formatNumber(count)}
                  <span className="ml-1.5 text-faint">{share}%</span>
                </span>
              </div>
              <div className="mt-1.5 h-[3px] w-full overflow-hidden rounded-full bg-sunken">
                <div
                  className="h-full rounded-full bg-ink/70 transition-[width] duration-200 ease-out"
                  style={{ width: `${count === 0 ? 0 : Math.max(4, (count / max) * 100)}%` }}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
