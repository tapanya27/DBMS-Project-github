import { cn } from "@/lib/utils";

export function PageShell({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("section-y page-container", className)}>{children}</div>
  );
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-8 flex flex-col gap-4 sm:mb-10 sm:flex-row sm:items-end sm:justify-between">
      <div className="max-w-2xl space-y-2">
        <h1 className="text-2xl font-semibold sm:text-3xl">{title}</h1>
        {description ? (
          <p className="text-sm text-muted-foreground sm:text-base">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex flex-wrap items-center gap-2">{actions}</div>
      ) : null}
    </div>
  );
}

export function EmptyState({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <div className="rounded-xl border border-dashed bg-muted/30 px-6 py-12 text-center">
      <p className="font-medium">{title}</p>
      {description ? (
        <p className="mt-2 text-sm text-muted-foreground">{description}</p>
      ) : null}
    </div>
  );
}

export function StatusBadge({
  status,
}: {
  status: string;
}) {
  const normalized = status?.toLowerCase?.() ?? "";
  const tone =
    normalized.includes("open") || normalized.includes("pending")
      ? "bg-amber-500/15 text-amber-700 dark:text-amber-300"
      : normalized.includes("progress") || normalized.includes("accepted")
        ? "bg-sky-500/15 text-sky-700 dark:text-sky-300"
        : normalized.includes("complete") || normalized.includes("feedback")
          ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
          : normalized.includes("reject")
            ? "bg-rose-500/15 text-rose-700 dark:text-rose-300"
            : "bg-muted text-muted-foreground";

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize",
        tone
      )}
    >
      {status}
    </span>
  );
}
